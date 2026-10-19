import { Component, inject, OnInit, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreSettingsService } from '../../core/services/store-settings.service';
import { StoreSettings } from '../../core/models/store-settings.model';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { CategoryService } from '../../core/services/category.service';
import { PopupService } from '../../core/services/popup.service';
import { Product } from '../../core/models/product.model';
import { Category } from '../../core/models/category.model';
import { OrderItem } from '../../core/models/order-item.model';
import { Order } from '../../core/models/order.model';
import { PaymentAccount } from '../../core/models/payment-account.model';
import { PaymentAccountService} from '../../core/services/payment-account.service';
import { Customer } from '../../core/models/customer.model';
import { CustomerService} from '../../core/services/customer.service';
import { CustomerTransaction } from '../../core/models/customer-transaction.model';
import { CustomerTransactionService } from '../../core/services/customer-transaction.service';
import {forkJoin } from 'rxjs';
import { Shift } from '../../core/models/shift.model';
import { ShiftService } from '../../core/services/shift.service';
import { CashMovement, CASH_DRAWER_ACCOUNT_ID, SAFE_ACCOUNT_ID } from '../../core/models/cash-movement.model';
import { CashMovementService } from '../../core/services/cash-movement.service';
import { ShiftHandover } from '../../core/models/shift-handover.model';
import { ShiftHandoverService } from '../../core/services/shift-handover.service';

interface PosInvoiceTab {
  id: string;
  ticketNumber: string;
  cart: OrderItem[];
  paymentStatus: 'Paid' | 'OnAccount';
  selectedPaymentAccountId: string;
  selectedCustomerId: string;
  pendingOrderId?: string;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})

export class PosComponent implements OnInit {
// Check whether the product belongs to a category that tracks expiry.
isExpiryTrackedProduct(product: object): boolean {
  const categoryName = this.getPosProductCategoryName(product)
    .trim()
    .toLowerCase();

  const expiryCategories = [
    'food',
    'foods',
    'drink',
    'drinks',
    'beverage',
    'beverages',
    'medicine',
    'medicines',
    'medication',
    'pharmacy',
    'طعام',
    'أطعمة',
    'اغذية',
    'أغذية',
    'مشروب',
    'مشروبات',
    'شراب',
    'دواء',
    'أدوية',
    'ادوية'
  ];

  return expiryCategories.some(category =>
    categoryName.includes(category)
  );
}

// Read the product expiry value without assuming a specific model field.
getProductExpiryDate(product: object): string | number | Date | null {
  const productData = product as unknown as Record<string, unknown>;
  const expiryKeys = [
    'expiryDate',
    'expirationDate',
    'expireDate',
    'expiry',
    'expiration',
    'expiry_date',
    'expire_date',
    'expDate'
  ];

  for (const key of expiryKeys) {
    const value = productData[key];

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'string' && value.trim()) {
      return Number.isNaN(Date.parse(value)) ? null : value;
    }

    if (typeof value === 'number') {
      return Number.isNaN(new Date(value).getTime()) ? null : value;
    }
  }
  return null;
}

// Resolve the category name from the product or the loaded categories.
private getPosProductCategoryName(product: object): string {
  const productData = product as unknown as Record<string, unknown>;
  const directName = productData['categoryName'];
  if (typeof directName === 'string') {
    return directName;
  }

  const embeddedCategory = productData['category'];
  if (typeof embeddedCategory === 'string') {
    return embeddedCategory;
  }

  if (
    embeddedCategory !== null && typeof embeddedCategory === 'object'
  ) {
    const embeddedName = (embeddedCategory as Record<string, unknown>)['name'];

    if (typeof embeddedName === 'string') {
      return embeddedName;
    }
  }

  const component = this as unknown as {
    categories?: Array<{
      id?: string | number;
      name?: string;
      title?: string;
    }>;
  };

  const categoryId = productData['categoryId'];
  const category = component.categories?.find(
    item => String(item.id) === String(categoryId)
  );

  return category?.name ?? category?.title ?? '';
}

getCartProductImage(item: { productId: string | number }): string {
  const product = this.products.find( p => String(p.id) === String(item.productId)
  );

  return product?.image || '';
}

  // SERVICES
  private readonly productService = inject(ProductService);
  private readonly orderService = inject(OrderService);
  private readonly categoryService = inject(CategoryService);
  private readonly storeSettingsService = inject(StoreSettingsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly popupService = inject(PopupService);
  private readonly paymentAccountService = inject(PaymentAccountService);
  private readonly customerService = inject(CustomerService);
  private readonly customerTransactionService = inject(CustomerTransactionService);
  private readonly shiftService = inject(ShiftService);
  private readonly cashMovementService = inject(CashMovementService);
  private readonly shiftHandoverService = inject(ShiftHandoverService);

  // CART PERSISTENCE
  private readonly CART_STORAGE_KEY = 'pos_cart';
  private readonly TICKET_STORAGE_KEY = 'pos_ticket';
  private readonly ACTIVE_SHIFT_STORAGE_KEY = 'pos_active_shift';
  private readonly INVOICE_TABS_STORAGE_KEY = 'pos_invoice_tabs';
  private readonly ACTIVE_INVOICE_STORAGE_KEY = 'pos_active_invoice';

  // SAVE CART
  saveCart(): void {
    localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(this.cart));
    this.syncActiveInvoiceTab();
    this.recalculateReservedStock();
  }


  // LOAD CART
  loadCart(): void {
    const savedCart = localStorage.getItem( this.CART_STORAGE_KEY );
    if (!savedCart) {
      this.cart = [];
      return;
    }

    try {
      const parsed = JSON.parse(savedCart);
      if (Array.isArray(parsed)) {
        this.cart = parsed;
      } else {
        this.cart = [];
      }
    }

    catch (error) {
      console.error( 'Error loading saved cart:', error );
      this.cart = [];
      localStorage.removeItem( this.CART_STORAGE_KEY);
    }
  }


  // SAVE TICKET NUMBER
  saveTicketNumber(): void {
    localStorage.setItem(this.TICKET_STORAGE_KEY, this.currentTicketNumber);
  }

  // LOAD TICKET NUMBER
  loadTicketNumber(): void {
    const savedTicket = localStorage.getItem( this.TICKET_STORAGE_KEY );
    if (savedTicket) {
      this.currentTicketNumber = savedTicket;
    } else {
      this.generateTicketNumber();
    }
  }

  // MULTI-INVOICE TABS / LOCAL DRAFTS
  invoiceTabs: PosInvoiceTab[] = [];
  activeInvoiceId = '';
  editingPendingOrderId: string | null = null;
  showPendingOrdersModal = false;
  pendingOrders: Order[] = [];
  pendingOrdersLoading = false;
  pendingOrdersError = '';
  isHoldingInvoice = false;
  isCheckingStock = false;
  isProcessingCheckout = false;

  /** Actual stock returned by the API, before local draft reservations. */
  private readonly baseProductStocks = new Map<string, number>();
  private newInvoiceId(): string {
    return `pos-invoice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private createBlankInvoiceTab(): PosInvoiceTab {
    this.generateTicketNumber();
    return {
      id: this.newInvoiceId(),
      ticketNumber: this.currentTicketNumber,
      cart: [],
      paymentStatus: 'Paid',
      selectedPaymentAccountId: this.paymentAccounts[0]?.id || '',
      selectedCustomerId: ''
    };
  }

  private syncActiveInvoiceTab(): void {
    const tab = this.invoiceTabs.find(item => item.id === this.activeInvoiceId);
    if (!tab) {
      this.saveInvoiceTabs();
      return;
    }

    tab.ticketNumber = this.currentTicketNumber;
    tab.cart = this.cart.map(item => ({ ...item }));
    tab.paymentStatus = this.paymentStatus;
    tab.selectedPaymentAccountId = this.selectedPaymentAccountId;
    tab.selectedCustomerId = this.selectedCustomerId;
    tab.pendingOrderId = this.editingPendingOrderId || undefined;
    this.saveInvoiceTabs();
  }

  private saveInvoiceTabs(): void {
    localStorage.setItem(this.INVOICE_TABS_STORAGE_KEY, JSON.stringify(this.invoiceTabs));
    if (this.activeInvoiceId) {
      localStorage.setItem(this.ACTIVE_INVOICE_STORAGE_KEY, this.activeInvoiceId);
    } else {
      localStorage.removeItem(this.ACTIVE_INVOICE_STORAGE_KEY);
    }
  }

  private activateInvoiceTab(tab: PosInvoiceTab): void {
    this.activeInvoiceId = tab.id;
    this.currentTicketNumber = tab.ticketNumber;
    this.cart = tab.cart.map(item => ({ ...item }));
    this.paymentStatus = tab.paymentStatus || 'Paid';
    this.selectedPaymentAccountId = tab.selectedPaymentAccountId || '';
    this.selectedCustomerId = tab.selectedCustomerId || '';
    this.editingPendingOrderId = tab.pendingOrderId || null;
    this.showCustomerDropdown = false;
    this.saveTicketNumber();
    this.saveCart();
  }

  loadInvoiceTabs(): void {
    const rawTabs = localStorage.getItem(this.INVOICE_TABS_STORAGE_KEY);

    if (rawTabs) {
      try {
        const parsed: unknown = JSON.parse(rawTabs);
        if (Array.isArray(parsed)) {
          this.invoiceTabs = parsed.filter((tab: any) =>
            tab && typeof tab.id === 'string' && typeof tab.ticketNumber === 'string' && Array.isArray(tab.cart)
          ).map((tab: any) => ({
            id: String(tab.id),
            ticketNumber: String(tab.ticketNumber),
            cart: tab.cart as OrderItem[],
            paymentStatus: tab.paymentStatus === 'OnAccount' ? 'OnAccount' : 'Paid',
            selectedPaymentAccountId: String(tab.selectedPaymentAccountId || ''),
            selectedCustomerId: String(tab.selectedCustomerId || ''),
            pendingOrderId: tab.pendingOrderId ? String(tab.pendingOrderId) : undefined
          }));
        }
      } catch (error) {
        console.error('Error loading saved POS invoice tabs:', error);
        localStorage.removeItem(this.INVOICE_TABS_STORAGE_KEY);
      }
    }

    // Backward compatibility: migrate the previous single-cart storage.
    if (!this.invoiceTabs.length) {
      let savedCart: OrderItem[] = [];
      try {
        const legacyCart = localStorage.getItem(this.CART_STORAGE_KEY);
        const parsedCart = legacyCart ? JSON.parse(legacyCart) : [];
        savedCart = Array.isArray(parsedCart) ? parsedCart : [];
      } catch {
        savedCart = [];
      }

      const legacyTicket = localStorage.getItem(this.TICKET_STORAGE_KEY);
      if (legacyTicket) {
        this.currentTicketNumber = legacyTicket;
      } else {
        this.generateTicketNumber();
      }

      this.invoiceTabs = [{
        id: this.newInvoiceId(),
        ticketNumber: this.currentTicketNumber,
        cart: savedCart,
        paymentStatus: 'Paid',
        selectedPaymentAccountId: '',
        selectedCustomerId: ''
      }];
    }

    const savedActiveId = localStorage.getItem(this.ACTIVE_INVOICE_STORAGE_KEY);
    const active = this.invoiceTabs.find(tab => tab.id === savedActiveId) || this.invoiceTabs[0];
    this.activateInvoiceTab(active);
    this.recalculateReservedStock();
  }

  switchInvoiceTab(tabId: string): void {
    if (tabId === this.activeInvoiceId) return;
    this.syncActiveInvoiceTab();
    const next = this.invoiceTabs.find(tab => tab.id === tabId);
    if (!next) return;
    this.activateInvoiceTab(next);
  }

  createNewInvoice(): void {
    this.syncActiveInvoiceTab();
    const tab = this.createBlankInvoiceTab();
    this.invoiceTabs.push(tab);
    this.activateInvoiceTab(tab);
  }

  closeInvoiceTab(tabId: string): void {
    const tab = this.invoiceTabs.find(item => item.id === tabId);
    if (!tab) return;

    const close = () => {
      // Removing this tab releases its local reservation when stock is recomputed.
      this.invoiceTabs = this.invoiceTabs.filter(item => item.id !== tabId);
      if (tabId === this.activeInvoiceId) {
        if (this.invoiceTabs.length === 0) {
          const fresh = this.createBlankInvoiceTab();
          this.invoiceTabs.push(fresh);
          this.activateInvoiceTab(fresh);
        } else {
          this.activateInvoiceTab(this.invoiceTabs[0]);
        }
      } else {
        this.saveInvoiceTabs();
        this.recalculateReservedStock();
      }
    };

    if (tab.cart.length) {
      this.popupService.showConfirm(
        `Close ${tab.ticketNumber}? Its local draft will be removed. If it was already saved as Pending, that server order will remain in Pending.`,
        'Close Invoice'
      ).subscribe(confirmed => {
        if (confirmed) close();
      });
    } else {
      close();
    }
  }

  openPendingInvoices(): void {
    this.showPendingOrdersModal = true;
    this.pendingOrdersLoading = true;
    this.pendingOrdersError = '';
    this.orderService.getOrders().subscribe({
      next: orders => {
        this.pendingOrders = (orders || [])
          .filter(order => order.status === 'Pending')
          .sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
  
        this.pendingOrdersLoading = false;
        this.cdr.detectChanges();
      },
      error: error => {
        console.error('Failed to load pending invoices:', error);
  
        this.pendingOrdersLoading = false;
        this.pendingOrdersError = 'Pending invoices could not be loaded. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  cancelPendingInvoice(order: Order): void {
    if (
      order.status !== 'Pending' ||
      order.id === undefined ||
      order.id === null
    ) {
      return;
    }
  
    this.popupService.showConfirm(
      `Delete pending invoice ${order.ticketNumber || `#${order.id}`}? It has not been sold and will be removed without changing stock.`,
      'Delete Pending Invoice'
    ).subscribe(confirmed => {
      if (!confirmed) {
        return;
      }
  
      this.orderService.deleteOrder(order.id!).subscribe({
        next: () => {
          this.pendingOrders = this.pendingOrders.filter(
            item => String(item.id) !== String(order.id)
          );
  
          // Remove the local tab too, if this invoice is currently open.
          this.removePendingInvoiceTab(order.id!);
          this.cdr.detectChanges();
          this.popupService.showAlert(
            'Pending invoice deleted. Stock and sales totals were not changed.',
            'success',
            'Invoice Removed'
          );
        },
  
        error: error => {
          console.error('Failed to delete pending invoice:', error);
          this.popupService.showAlert(
            'The pending invoice could not be deleted.',
            'error',
            'Delete Failed'
          );
        }
      });
    });
  }
  
  private removePendingInvoiceTab(
    orderId: string | number
  ): void {
    const tab = this.invoiceTabs.find(
      item => String(item.pendingOrderId) === String(orderId)
    );
  
    if (!tab) {
      return;
    }
    const wasActive = tab.id === this.activeInvoiceId;
    this.invoiceTabs = this.invoiceTabs.filter(
      item => item.id !== tab.id
    );
  
    if (wasActive) {
      this.cart = [];
      this.editingPendingOrderId = null;
      const fresh = this.createBlankInvoiceTab();
      this.invoiceTabs.push(fresh);
      this.activateInvoiceTab(fresh);
    } else {
      this.saveInvoiceTabs();
      this.recalculateReservedStock();
    }
  }

  resumePendingInvoice(order: Order): void {
    if (order.id === undefined || order.id === null) {
      return;
    }
  
    // If this Pending invoice is already open, switch to its existing tab.
    const existingTab = this.invoiceTabs.find(
      tab => String(tab.pendingOrderId) === String(order.id)
    );
  
    if (existingTab) {
      this.showPendingOrdersModal = false;
      this.switchInvoiceTab(existingTab.id);
      return;
    }
  
    this.syncActiveInvoiceTab();
  
    const tab: PosInvoiceTab = {
      id: this.newInvoiceId(),
      ticketNumber: order.ticketNumber || `#ORD-${order.id}`,
      cart: (order.items || []).map(
        item => ({ ...item } as OrderItem)
      ),
      paymentStatus:
        order.paymentStatus === 'OnAccount' ? 'OnAccount' : 'Paid',
      selectedPaymentAccountId: String(order.paymentAccountId || ''),
      selectedCustomerId: String(order.customerId || ''),
      pendingOrderId: String(order.id)
    };
  
    this.invoiceTabs.push(tab);
    this.showPendingOrdersModal = false;
    this.activateInvoiceTab(tab);
    this.recalculateReservedStock();
  }

  holdInvoice(): void {
    if (!this.cart.length || this.isHoldingInvoice) return;
    if (!this.currentShift || this.currentShift.status !== 'Open') {
      this.popupService.showAlert('Please open an active shift before using the POS.', 'warning', 'Shift Required');
      return;
    }

    this.isHoldingInvoice = true;
    this.currentDate = new Date();
    const orderItems = this.cart.map(item => {
      const product = this.products.find(p => String(p.id) === String(item.productId));
      const costPrice = Number(product?.costPrice ?? item.costPrice ?? 0);
      return {
        ...item,
        categoryId: item.categoryId ?? product?.categoryId,
        costPrice: Number.isFinite(costPrice) && costPrice > 0 ? costPrice : 0
      };
    });

    const pendingOrder: any = {
      ticketNumber: this.currentTicketNumber,
      items: orderItems,
      subtotal: Number(this.subtotal.toFixed(2)),
      tax: Number(this.tax.toFixed(2)),
      total: Number(this.total.toFixed(2)),
      paymentStatus: this.paymentStatus,
      status: 'Pending',
      createdAt: this.currentDate.toISOString()
    };

    if (this.paymentStatus === 'Paid' && this.selectedPaymentAccountId) {
      pendingOrder.paymentAccountId = String(this.selectedPaymentAccountId);
    }
    if (this.paymentStatus === 'OnAccount' && this.selectedCustomerId) {
      const customer = this.customers.find(c => String(c.id) === String(this.selectedCustomerId));
      if (customer) {
        pendingOrder.customerId = String(customer.id);
        pendingOrder.customerName = customer.name;
      }
    }

    const request = this.editingPendingOrderId
      ? this.orderService.updateOrder(this.editingPendingOrderId, pendingOrder)
      : this.orderService.createOrder(pendingOrder);

    request.subscribe({
      next: savedOrder => {
        // Pending orders do not change server stock, customer balances, or cash movements.
        this.invoiceTabs = this.invoiceTabs.filter(tab => tab.id !== this.activeInvoiceId);
        this.cart = [];
        this.editingPendingOrderId = null;
        this.clearSavedCart();

        const fresh = this.createBlankInvoiceTab();
        this.invoiceTabs.push(fresh);
        this.activateInvoiceTab(fresh);
        this.saveInvoiceTabs();
        this.popupService.showAlert(
          `Invoice ${savedOrder.ticketNumber || pendingOrder.ticketNumber} was saved under Pending.`,
          'success',
          'Invoice Saved'
        );
        this.isHoldingInvoice = false;
        this.cdr.detectChanges();
      },
      error: error => {
        console.error('Failed to save pending invoice:', error);
        this.isHoldingInvoice = false;
        this.popupService.showAlert('The invoice could not be saved as Pending.', 'error', 'Save Failed');
        this.cdr.detectChanges();
      }
    });
  }

  private getStockAfterActiveSale(productId: string | number): number {
    const base = this.baseProductStocks.get(String(productId)) ?? 0;
    const activeQty = this.cart
      .filter(item => String(item.productId) === String(productId))
      .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return Math.max(0, base - activeQty);
  }

  /**
   * Draft and Pending invoices do not reserve or subtract stock.
   * Keep product.stock synchronized with the latest known backend stock;
   * stock is decreased only after checkout has been saved successfully.
   */
  private recalculateReservedStock(): void {
    for (const product of this.products) {
      const baseStock = this.baseProductStocks.get(String(product.id));
      if (baseStock !== undefined) {
        product.stock = baseStock;
      }
    }
    this.filterProducts();
  }

  private finishCompletedInvoice(): void {
    // Stock has now been saved as sold; don't release the active cart's reservation.
    for (const item of this.cart) {
      this.baseProductStocks.set(String(item.productId), this.getStockAfterActiveSale(item.productId));
    }
    this.invoiceTabs = this.invoiceTabs.filter(tab => tab.id !== this.activeInvoiceId);
    this.cart = [];
    this.editingPendingOrderId = null;
    this.clearSavedCart();
    const fresh = this.createBlankInvoiceTab();
    this.invoiceTabs.push(fresh);
    this.activateInvoiceTab(fresh);
    this.saveInvoiceTabs();
    this.recalculateReservedStock();
  }

  // LOAD PAYMENT ACCOUNTS
  loadPaymentAccounts(): void {
    this.paymentAccountService
      .getActivePaymentAccounts()
      .subscribe({
        next: (accounts) => {
          this.paymentAccounts = accounts;
          if (
            !this.selectedPaymentAccountId && accounts.length > 0
          ) {
            this.selectedPaymentAccountId = accounts[0].id;
          }
          this.syncActiveInvoiceTab();
          this.cdr.detectChanges();
        },
        error: (err) => { console.error( 'Error loading payment accounts:', err
          );
        }
      });
  }

  // LOAD CUSTOMERS
  loadCustomers(): void {
    this.customerService
      .getCustomers()
      .subscribe({ next: (customers) => {
          this.customers = customers.filter(
              customer => customer.status === 'Active'
            );
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error( 'Error loading customers:', err
          );
        }
      });
  }

  // PAYMENT STATUS CHANGE
  onPaymentStatusChange(
    status: 'Paid' | 'OnAccount' ): void {
    this.paymentStatus = status;
    this.showCustomerDropdown = false;

    if (
      status === 'Paid'
    ) {
      this.selectedCustomerId =  '';
    } else {
      this.selectedPaymentAccountId = '';
    }

    this.saveCart();
    this.cdr.detectChanges();
  }

  // CLEAR SAVED CART
  clearSavedCart(): void {
    localStorage.removeItem(this.CART_STORAGE_KEY );
    localStorage.removeItem( this.TICKET_STORAGE_KEY );
    this.saveInvoiceTabs();
  }

  // DATA
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: Category[] = [];

  // CART
  cart: OrderItem[] = [];
  receiptCart: OrderItem[] = [];

  // FILTERS
  selectedCategoryId: string = 'ALL';
  searchQuery: string = '';

  // PAYMENT
  paymentStatus: 'Paid' | 'OnAccount' = 'Paid';
  paymentAccounts: PaymentAccount[] = [];
  selectedPaymentAccountId: string = '';
  customers: Customer[] = [];
  selectedCustomerId: string = '';
  taxRate: number = 0.14;
  currency: string = 'EGP';
  currencySymbol: string = 'EGP';
  /** Store details loaded from Settings and used on the receipt. */
  storeSettings: StoreSettings | null = null;

  // DATE / TICKET
  currentDate: Date = new Date();
  currentTicketNumber: string = '';

  // SUCCESS MODAL
  showSuccessModal:  boolean = false;
  showCustomerDropdown: boolean = false;
  lastOrderTotal: number = 0;
  lastOrderSubtotal: number = 0;
  lastOrderTax: number = 0;
  lastTaxRate: number = 0.14;
  lastStoreName: string = '';
  lastStoreAddress: string = '';
  lastStorePhone: string = '';
  lastPaymentStatus: 'Paid' | 'OnAccount' = 'Paid';
  lastPaymentAccountName: string = '';
  lastCustomerName: string = '';
  lastTicketNumber: string = '';

  // SHIFT
  currentShift: Shift | null = null;
  showOpenShiftModal: boolean = false;
  shiftLoading: boolean = false;
  shiftErrorMessage: string = '';
  openingFloat: number = 0;

  // CLOSE SHIFT
  showCloseShiftModal: boolean = false;
  closeShiftLoading: boolean = false;
  closeShiftErrorMessage: string = '';
  shiftHandoverTotal: number = 0;
  shiftHandoverBreakdown: {
    accountId: string;
    accountName: string;
    amount: number;
  }[] = [];

  // INIT
  ngOnInit(): void {
    this.loadInvoiceTabs();
    this.loadCurrentShift();
    this.loadStoreSettings();
    this.loadData();
    this.loadPaymentAccounts();
    this.loadCustomers();
  }

  // LOAD CURRENT OPEN SHIFT
  loadCurrentShift(): void {
    this.shiftLoading = true;
    this.shiftErrorMessage = '';
    this.showOpenShiftModal = false;
    const savedShiftId = localStorage.getItem( this.ACTIVE_SHIFT_STORAGE_KEY );


    // 1. TRY REMEMBERED GLOBAL ACTIVE SHIFT
    if (savedShiftId) {
      this.shiftService .getShiftById( savedShiftId )
        .subscribe({ next: (shift) => {

            if ( shift && shift.status === 'Open' ) {
              this.setCurrentOpenShift( shift);
              return;
            }

            localStorage.removeItem( this.ACTIVE_SHIFT_STORAGE_KEY );
            this.findGlobalOpenShift();
          },
          error: (error: unknown) => { console.error( 'Error loading remembered active shift:', error );
            localStorage.removeItem( this.ACTIVE_SHIFT_STORAGE_KEY );
            this.findGlobalOpenShift();
          }
        });
      return;
    }

    // 2. NO REMEMBERED SHIFT → ASK BACKEND
    this.findGlobalOpenShift();
  }

  // FIND GLOBAL OPEN SHIFT
  private findGlobalOpenShift(): void {
    this.shiftService.getOpenShifts().subscribe({
        next: (shifts) => {
          if (
            shifts.length > 0
          ) {
            const sortedShifts = [...shifts].sort(( first, second ) => new Date( second.openedAt ).getTime() - new Date(first.openedAt ).getTime() );
            const activeShift = sortedShifts[0];
            this.setCurrentOpenShift( activeShift );
            return;
          }

          // NO OPEN SHIFT
          this.currentShift =  null;
          localStorage.removeItem( this.ACTIVE_SHIFT_STORAGE_KEY );
          this.showOpenShiftModal = true;
          this.shiftLoading = false;
          this.cdr.detectChanges();
        },
        error: (error: unknown) => { console.error( 'Error loading global open shift:', error );
          this.currentShift = null;
          this.shiftLoading = false;
          this.shiftErrorMessage = 'Failed to load the current shift. Please try again.';
          this.showOpenShiftModal = true;
          this.cdr.detectChanges();
        }
      });
  }

  // SET CURRENT OPEN SHIFT
  private setCurrentOpenShift( shift: Shift): void {
    this.currentShift = { ...shift,  id: String( shift.id ), openingFloat: Number( shift.openingFloat ) || 0 };
    localStorage.setItem( this.ACTIVE_SHIFT_STORAGE_KEY, String( shift.id) );
    this.showOpenShiftModal = false;
    this.shiftLoading = false;
    this.cdr.detectChanges();
  }

  // OPEN SHIFT
  openCurrentShift(): void { const currentUserRaw = localStorage.getItem( 'currentUser' );
    if (!currentUserRaw) {
      this.shiftErrorMessage = 'No logged-in employee was found. Please log in again.';
      return;
    }

    let currentUser: Record<string, unknown>;
    try {
      const parsed = JSON.parse( currentUserRaw );
      if (
        typeof parsed !== 'object' || parsed === null
      ) {
        throw new Error( 'Invalid current user data' );
      }
      currentUser =  parsed as Record<string, unknown>;
    }

    catch (error) { console.error( 'Error parsing current user:', error );
      this.shiftErrorMessage = 'Unable to read the current employee data.';
      return;
    }

    const employeeId = String( currentUser['id'] ?? currentUser['username'] ?? currentUser['email'] ?? '' ).trim();
    const employeeName = String( currentUser['name'] ?? currentUser['username'] ?? currentUser['email'] ?? 'Current User' ).trim();
    const amount = Number( this.openingFloat );

    if ( !Number.isFinite(amount) || amount < 0 ) {
      this.shiftErrorMessage = 'Opening Float must be zero or greater.';
      return;
    }

    if (!employeeId) {
      this.shiftErrorMessage = 'Unable to identify the current employee.';
      return;
    }

    this.shiftLoading = true;
    this.shiftErrorMessage =  '';

    this.shiftService  .getOpenShifts() .subscribe({ next: (openShifts) => {
          if (
            openShifts.length > 0
          ) {
            const sortedShifts = [...openShifts].sort( ( first,  second ) => new Date( second.openedAt )
            .getTime() - new Date( first.openedAt ).getTime());
            const activeShift = sortedShifts[0];
            this.setCurrentOpenShift( activeShift );
            return;
          }

          // NO OPEN SHIFT → CREATE ONE
          const newShift:  Omit<Shift, 'id'> = {
            employeeId,
            employeeName,
            status: 'Open',
            openingFloat: Number( amount.toFixed(2) ),
            openedAt: new Date().toISOString()
          };

          this.shiftService .openShift(  newShift ) .subscribe({
              next: (shift) => {
                this.currentShift = {  ...shift,
                  id: String(shift.id ),
                  openingFloat: Number( shift.openingFloat ) || 0
                };
                localStorage.setItem( this.ACTIVE_SHIFT_STORAGE_KEY, String( shift.id)
                );

                this.showOpenShiftModal = false;
                this.shiftLoading =  false;
                this.cdr.detectChanges();
              },
              error: (error: unknown) => { console.error( 'Error opening shift:', error );
                this.shiftLoading = false;
                this.shiftErrorMessage = 'Failed to open the shift. Please try again.';
                this.cdr.detectChanges();
              }
            });
        },
        error: (error: unknown) => {
          console.error( 'Error checking existing open shifts:', error );
          this.shiftLoading = false;
          this.shiftErrorMessage = 'Failed to verify the current shift. Please try again.';
          this.cdr.detectChanges();
        }
      });
  }

  // LOAD STORE SETTINGS
  loadStoreSettings(): void {
    this.storeSettingsService 
    .getOrLoadSettings() 
    .subscribe({ next:
          ( settings:  StoreSettings | null  ) => {
            if (!settings) {
              return;
            }
            this.storeSettings = { ...settings };
            // TAX
            this.taxRate = Number( settings.taxRate ) / 100;
            // OPENING FLOAT
            this.openingFloat =  Number( settings.openingFloat ) || 0;
            // CURRENCY
            this.currency = settings.currency;
            this.currencySymbol = this.storeSettingsService  .getCurrencySymbol( settings.currency  );

            console.log( 'POS Settings:',
              { taxRate: this.taxRate,
                currency: this.currency,
                currencySymbol: this.currencySymbol,
                openingFloat: this.openingFloat
              }
            );
            this.cdr.detectChanges();
          },
          error: (error: unknown) => {
            console.error( 'Failed to load store settings:', error );
          }
      });
  }

  // CUSTOMER DROPDOWN
  toggleCustomerDropdown(): void {
    this.showCustomerDropdown = !this.showCustomerDropdown;
  }

  selectCustomer( customer: Customer ): void {
    this.selectedCustomerId = customer.id;
    this.showCustomerDropdown = false;
    this.saveCart();
    this.cdr.detectChanges();
  }

  getSelectedCustomerName(): string {
    const customer = this.customers.find( c => String(c.id) === String( this.selectedCustomerId ));
    return customer?.name || '';
  }

  // OUTSIDE CLICK
  @HostListener( 'document:click', ['$event'] )
  onDocumentClick( event: MouseEvent ): void {
    const target = event.target as HTMLElement;
    if (
      !target.closest( '.customer-dropdown' ) ) {
      this.showCustomerDropdown = false;
    }
  }

  selectPaymentAccount(accountId: string): void {
    this.selectedPaymentAccountId = String(accountId);
    this.saveCart();
  }

// GET PAYMENT ACCOUNT IMAGE FOR CLOSE SHIFT
getHandoverAccountImage(account: {
  accountId: string;
  accountName: string;
}): string {
  const normalizedName = String( account.accountName || '' ).trim().toLowerCase();
  // Match by account ID first.
  const accountById = this.paymentAccounts.find( paymentAccount => String(paymentAccount.id) === String(account.accountId)
  );
  if (accountById?.image) {
    return accountById.image;
  }

  // Cash Drawer movements use a special account ID,
  // so fall back to the configured payment account name.
  const accountByName = this.paymentAccounts.find( paymentAccount => String(paymentAccount.name || '').trim().toLowerCase() === normalizedName );
  return accountByName?.image || '';
}

  // GENERATE TICKET
  generateTicketNumber(): void {
    const randomNum = Math.floor( 1000 +  Math.random() * 9000 );
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const randomChar = letters.charAt( Math.floor( Math.random() * letters.length ));
    this.currentTicketNumber = `#${randomNum}-${randomChar}`;
  }


  // LOAD DATA
  loadData(): void {
    // PRODUCTS
    this.productService
      .getProducts()
      .subscribe({ next: (data) => {
          this.products = data.map((p) => ({ ...p, id: String(p.id), stock: Number(p.stock) || 0 }) );
          this.baseProductStocks.clear();
          this.products.forEach(product => {
            this.baseProductStocks.set(String(product.id), Number(product.stock) || 0);
          });
          this.restoreCartStock();
          this.filterProducts();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error( 'Error fetching products:', err);
        }
      });

    // CATEGORIES
    this.categoryService
      .getCategories()
      .subscribe({ next: (data) => {
          this.categories = data;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error( 'Error fetching categories:', err
          );
        }
      });
  }

  // RESTORE RESERVED STOCK
  restoreCartStock(): void {
    this.recalculateReservedStock();
  }

  // PRODUCT SEARCH
  /** Normalize user input and product fields before comparing them. */
  private normalizeSearchText(value: unknown): string {
    return String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  }

  /** Filter the products already loaded in memory; this does not call the API. */
  onProductSearchInput(value: string): void {
    this.searchQuery = value;
    this.filterProducts();
  }

  filterProducts(): void {
    const query = this.normalizeSearchText(this.searchQuery);
    if (!query) {
      this.filteredProducts = [];
      return;
    }

    const queryWords = query.split(' ');
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true});
    this.filteredProducts = this.products
      .filter(product => {
        const name = this.normalizeSearchText(product.name);
        const nameWords = name.split(' ');
        const sku = this.normalizeSearchText(product.sku);
        const barcode = this.normalizeSearchText(product.barcode);
        // Match the start of the product name or the start of any word in it.
        const matchesName = queryWords.every(queryWord =>
          nameWords.some(nameWord => nameWord.startsWith(queryWord))
        );
        const matchesSku = Boolean(sku) && sku.startsWith(query);
        const matchesBarcode = Boolean(barcode) && barcode.startsWith(query);
        return matchesName || matchesSku || matchesBarcode;
      })
      .sort((first, second) => collator.compare(String(first.name || ''), String(second.name || '')));
  }

  /** Run the latest search immediately when Enter is pressed. */
  onProductSearchEnter(): void {
    this.filterProducts();

    const query = this.normalizeSearchText(this.searchQuery);
    if (!query) return;

    const exactMatch = this.products.find(product =>
      this.normalizeSearchText(product.barcode) === query ||
      this.normalizeSearchText(product.sku) === query
    );

    const isNumericCode = /^\d+$/.test(query);
    const product = exactMatch || (!isNumericCode && this.filteredProducts.length === 1 ? this.filteredProducts[0] : undefined);

    if (!product) {
      this.popupService.showAlert(
        this.filteredProducts.length
          ? 'More than one product matches. Choose the correct product from the search results.'
          : 'No product matches this barcode, SKU, or name.', 'warning', 'Product Not Found'
      );
      return;
    }

    if (this.addToCart(product)) {
      this.searchQuery = '';
      this.filterProducts();
      this.cdr.detectChanges();
    }
  }

  clearProductSearch(): void {
    this.searchQuery = '';
    this.filteredProducts = [];
  }

  getCartProductSku(item: OrderItem): string {
    return String(this.products.find(product => String(product.id) === String(item.productId))?.sku || '—');
  }

  getCartProductBarcode(item: OrderItem): string {
    return String(this.products.find(product => String(product.id) === String(item.productId))?.barcode || '—');
  }

  trackByCartProduct(_index: number, item: OrderItem): string | number {
    return item.productId;
  }

  addProductFromSearch(product: Product): void {
    if (this.addToCart(product)) {
      this.clearProductSearch();
    }
  }

  // SELECT CATEGORY
  selectCategory( categoryId: string ): void {
    this.selectedCategoryId = categoryId;
    this.filterProducts();
  }

  // PRODUCT IMAGE
  getProductImage( item: OrderItem): string {
    const product = this.products.find( (p) => String(p.id) === String(item.productId) );
    return (
      product?.image || 'https://via.placeholder.com/120x120?text=Product'
    );
  }

  // ADD TO CART
  addToCart( product: Product ): boolean {
    // The cart is a draft. It must not mutate the stock shown in the catalog.
    const existingItem = this.cart.find(
      item => String(item.productId) === String(product.id)
    );
    const stockAvailable = this.baseProductStocks.get(String(product.id)) ?? (Number(product.stock) || 0);

    if (stockAvailable <= 0) {
      this.popupService.showAlert(
        'Product is out of stock!', 'warning', 'Out of Stock'
      );
      return false;
    }

    // Prevent a single draft invoice from exceeding currently available stock.
    if ((Number(existingItem?.quantity) || 0) >= stockAvailable) {
      this.popupService.showAlert(  'No more stock available for this product.', 'warning', 'Out of Stock'
      );
      return false;
    }

    if (existingItem) {
      existingItem.quantity += 1;
      existingItem.total = existingItem.quantity * existingItem.price;
    } else {
      this.cart.push({
        productId: product.id as any,
        productName: product.name,
        categoryId: product.categoryId,
        price: Number( product.price ),
        costPrice: Number( product.costPrice ?? 0 ),
        quantity: 1,
        total:  Number( product.price)
      } as OrderItem);
    }
    this.saveCart();
    return true;
  }

  // UPDATE QUANTITY
  updateQuantity( item: OrderItem, change: number ): void {
    const product = this.products.find((p) => String(p.id) ===  String(item.productId) );
    // INCREASE
    if (
      change > 0
    ) {

      if (
        product && item.quantity < (this.baseProductStocks.get(String(product.id)) ?? (Number(product.stock) || 0))
      ) {
        item.quantity += 1;
        item.total = item.quantity * item.price;
      } else {
        this.popupService.showAlert(  'No more stock available!', 'warning', 'Out of Stock'
        );
        return;
      }
    }

    // DECREASE
    else if (
      change < 0
    ) {
      item.quantity -= 1;

      if (
        item.quantity <= 0
      ) {
        this.cart = this.cart.filter( (i) => String( i.productId  ) !== String( item.productId )
          );
      } else {
        item.total = item.quantity * item.price;
      }
    }
    this.saveCart();
  }

  // REMOVE FROM CART
  removeFromCart( item: OrderItem ): void {
    this.cart = this.cart.filter((i) => String( i.productId ) !== String( item.productId) );
    this.saveCart();
  }

  // CLEAR CART
  clearCart(): void {
    const wasEditingPending = !!this.editingPendingOrderId;
    this.cart = [];
    if (wasEditingPending) {
      // Clearing a resumed Pending invoice must not erase its saved server record.
      // Detach this now-empty local tab so it cannot overwrite the original Pending order.
      this.editingPendingOrderId = null;
      this.currentTicketNumber = '';
      this.generateTicketNumber();
    }
    this.saveCart();
    this.saveTicketNumber();
  }

  // TOTALS
  get subtotal(): number {
    return this.cart.reduce(
      ( sum, item ) => sum + item.total, 0);
  }

  get tax(): number {
    return ( this.subtotal * this.taxRate );
  }

  get total(): number {
    return ( this.subtotal +  this.tax );
  }

  // CHECKOUT
  checkout(): void {
    if (this.isCheckingStock || this.isProcessingCheckout) return;
    if (!this.currentShift || this.currentShift.status !== 'Open') {
      this.popupService.showAlert(
        'Please open an active shift before processing sales.', 'warning', 'Shift Required'
      );
      return;
    }
    if (!this.cart.length) return;
    this.isCheckingStock = true;
    this.productService.getProducts().subscribe({
      next: freshProducts => {
        // Replace stale in-memory stock with the backend's current inventory snapshot.
        this.baseProductStocks.clear();
        this.products = (freshProducts || []).map(product => ({
          ...product,
          id: String(product.id),
          stock: Number(product.stock) || 0
        }));
        for (const product of this.products) {
          this.baseProductStocks.set(String(product.id), Number(product.stock) || 0);
        }
        this.isCheckingStock = false;
        this.filterProducts();

        const unavailableItem = this.cart.find(item => {
          const stock = this.baseProductStocks.get(String(item.productId)) ?? 0;
          return Number(item.quantity) > stock;
        });
        this.cdr.detectChanges();
        if (unavailableItem) {
          this.popupService.showAlert(
            `Not enough stock available for ${unavailableItem.productName}.
            Available stock was refreshed; reduce the quantity before completing the sale.`, 'warning', 'Insufficient Stock'
          );
          return;
        }
        this.processCheckout();
      },
      error: error => {
        console.error('Could not refresh product stock before checkout:', error);
        this.isCheckingStock = false;
        this.popupService.showAlert(
          'Current stock could not be verified. The sale was not completed; please try again.', 'error', 'Stock Verification Failed'
        );
        this.cdr.detectChanges();
      }
    });
  }

  private processCheckout(): void {
    if (
      !this.currentShift || this.currentShift.status !== 'Open'
    ) {

      this.popupService.showAlert(
        'Please open an active shift before processing sales.', 'warning', 'Shift Required'
      );
      return;
    }

    if (
      this.cart.length === 0
    ) {
      return;
    }

    const unavailableItem = this.cart.find(item => {
      const baseStock = this.baseProductStocks.get(String(item.productId)) ?? 0;
      return Number(item.quantity) > baseStock;
    });

    if (unavailableItem) {
      this.popupService.showAlert(
        `Not enough stock available for ${unavailableItem.productName}. Review the quantity before completing the sale.`, 'warning', 'Insufficient Stock'
      );
      return;
    }

    // ON ACCOUNT REQUIRES CUSTOMER
    if (
      this.paymentStatus === 'OnAccount' && (!this.selectedCustomerId || !this.customers.some(customer => String(customer.id) === String(this.selectedCustomerId)))
    ) {

      this.popupService.showAlert(
        'Please select a customer for the On Account sale.', 'warning', 'Customer Required'
      );
      return;
    }

    // PAID REQUIRES PAYMENT ACCOUNT
    if (
      this.paymentStatus === 'Paid' &&
      (!this.selectedPaymentAccountId || !this.paymentAccounts.some(account => String(account.id) === String(this.selectedPaymentAccountId)))
    ) {

      this.popupService.showAlert(
        'Please select a payment account.', 'warning', 'Payment Account Required'
      );
      return;
    }

    this.currentDate = new Date();
    this.lastOrderTotal = this.total;
    this.lastOrderSubtotal = this.subtotal;
    this.lastOrderTax = this.tax;
    this.lastTaxRate = this.taxRate;

    // Snapshot store information so the printed receipt stays consistent
    // with the completed sale even if Settings change later.
    this.lastStoreName = String(this.storeSettings?.storeName ?? '').trim();
    this.lastStoreAddress = String(this.storeSettings?.address ?? '').trim();
    this.lastStorePhone = String(this.storeSettings?.phone ?? '').trim();
    this.lastPaymentStatus = this.paymentStatus;
    this.lastTicketNumber = this.currentTicketNumber;
    this.receiptCart = [ ...this.cart ];

    const selectedCustomer = this.customers.find( customer => String( customer.id ) === String( this.selectedCustomerId ));
    const selectedAccount = this.paymentAccounts.find( account => String( account.id ) === String( this.selectedPaymentAccountId ));
    this.lastCustomerName = selectedCustomer?.name ?? '';
    this.lastPaymentAccountName = selectedAccount?.name ?? '';

    // PAYMENT ACCOUNT DETAILS
    const isCashAccount = selectedAccount && String( selectedAccount.type ).toLowerCase() === 'cash';
    const selectedAccountMovementType: 'drawer' | 'paymentAccount' = isCashAccount ? 'drawer' : 'paymentAccount';
    const selectedAccountMovementId = isCashAccount ? CASH_DRAWER_ACCOUNT_ID : String( selectedAccount?.id ?? '' );
    const selectedAccountMovementName = isCashAccount  ? ( selectedAccount?.name ?? 'Cash Drawer' ) : ( selectedAccount?.name ?? 'Payment Account' );

    // CUSTOMER TRANSACTION ITEMS
    const customerTransactionItems = this.cart.map(
        item => ({ productId:  String( item.productId ), productName: item.productName,
          quantity: Number( item.quantity ),
          unitPrice: Number(  item.price ),
          total: Number( item.total )
        })
      );

    // CREATE ORDER
    const orderItems = this.cart.map(item => {
      const product = this.products.find( p => String(p.id) === String(item.productId));
      const currentCostPrice = Number(product?.costPrice ?? 0);
      return { ...item, categoryId: item.categoryId ?? product?.categoryId, costPrice:  Number.isFinite(currentCostPrice) && currentCostPrice > 0 ? currentCostPrice : 0
      };
    });    
    const newOrder: any = {
      ticketNumber: this.currentTicketNumber,
      items: orderItems,
      subtotal: Number( this.subtotal.toFixed(2) ),
      tax: Number( this.tax.toFixed(2) ),
      total: Number( this.total.toFixed(2)),
      paymentStatus: this.paymentStatus,
      status: 'Completed',
      createdAt: this.currentDate.toISOString()
    };

    // PAID
    if (
      this.paymentStatus === 'Paid' && selectedAccount ) {
      newOrder.paymentAccountId = String( selectedAccount.id );
    }

    // ON ACCOUNT
    if (
      this.paymentStatus === 'OnAccount' && selectedCustomer) {
      newOrder.customerId = String( selectedCustomer.id );
      newOrder.customerName = selectedCustomer.name;
    }

    // SAVE ORDER
    const orderSaveRequest = this.editingPendingOrderId ? this.orderService.updateOrder(this.editingPendingOrderId, newOrder) : this.orderService.createOrder(newOrder);
    this.isProcessingCheckout = true;
    orderSaveRequest.subscribe({ next: () => { const updateRequests: any[] = [];

    // UPDATE PRODUCT STOCK
          this.cart.forEach(
            item => {
              const product = this.products.find( p => String( p.id ) === String( item.productId ));
              if (!product) {
                return;
              }
              const updatedProduct = { ...product, stock: this.getStockAfterActiveSale(product.id)};
              updateRequests.push( this.productService .updateProduct( product.id,  updatedProduct as any));
            }
          );

          // PAID SALE → CASH MOVEMENT
          if (
            this.paymentStatus === 'Paid' && selectedAccount && this.currentShift ) {
            const saleMovement: Omit< CashMovement, 'id' > = {
              createdAt: this.currentDate .toISOString(),
              type: 'CashIn',
              reason: 'Sale',
              amount: Number( this.total.toFixed(2) ),
              toAccountType: selectedAccountMovementType,
              toAccountId: selectedAccountMovementId,
              toAccountName: selectedAccountMovementName,
              referenceType: 'Order',
              referenceId: String( this.currentTicketNumber),
              shiftId: this.currentShift.id
            };

            updateRequests.push( this.cashMovementService.createCashMovement( saleMovement )
            );
          }

          // ON ACCOUNT DATA
          if (
            this.paymentStatus ===  'OnAccount' &&  selectedCustomer
          ) {

            // UPDATE CUSTOMER BALANCE
            const updatedCustomer: Customer = { ...selectedCustomer,  balance: Number( selectedCustomer.balance || 0 ) + Number( this.total )};
            updateRequests.push( this.customerService .updateCustomer( selectedCustomer.id, updatedCustomer )
            );

            // SAVE CUSTOMER TRANSACTION
            const customerTransaction: Omit< CustomerTransaction, 'id' > = {
              customerId:String( selectedCustomer.id ),
              customerName: selectedCustomer.name,
              type:'OnAccountSale',
              referenceId: String( this.currentTicketNumber),
              referenceNumber: this.currentTicketNumber,
              amount: Number( this.total.toFixed(2)),
              items:customerTransactionItems,
              createdAt:this.currentDate.toISOString()
            };

            updateRequests.push(
              this.customerTransactionService .addTransaction( customerTransaction)
            );
          }
          // FINISH CHECKOUT
          if (
            updateRequests.length === 0
          ) {

            this.ngZone.run(() => {
              this.isProcessingCheckout = false;
              this.finishCompletedInvoice();
              this.showSuccessModal = true;
              this.cdr.detectChanges();
            });
            return;
          }

          forkJoin( updateRequests ).subscribe({
            next: () => {
              this.ngZone.run(() => {
                this.isProcessingCheckout = false;
                this.finishCompletedInvoice();
                this.showSuccessModal = true;
                this.cdr.detectChanges();
              });
            },
            error: err => {
              this.isProcessingCheckout = false;
              console.error('Error updating checkout data:', err );
              this.popupService.showAlert( 'Order was created, but some related data could not be updated.','error', 'Checkout Warning'
              );
              this.cdr.detectChanges();
            }
          });
        },
        error: err => {
          this.isProcessingCheckout = false;
          console.error( 'Error creating or completing order:', err );
          this.popupService.showAlert( 'Failed to process checkout!', 'error', 'Checkout Failed' );
          this.cdr.detectChanges();
        }
      });
  }

  // OPEN CLOSE SHIFT MODAL
  openCloseShiftModal(): void {
    if ( !this.currentShift || this.currentShift.status !== 'Open' ) {
      return;
    }

    this.closeShiftErrorMessage = '';
    this.shiftHandoverTotal = 0;
    this.shiftHandoverBreakdown = [];
    this.showCloseShiftModal = true;
    this.closeShiftLoading = true;
    this.cashMovementService.getCashMovementsByShift(  this.currentShift.id ) .subscribe({
        next: (movements) => {
          const balances = new Map< string, { accountId: string; accountName: string; amount: number;}  >();

          // CALCULATE NET BALANCE PER ACCOUNT
          for (
            const movement of movements
          ) {
            // MONEY IN
            if (
              movement.toAccountId &&
              movement.toAccountType &&
              String(movement.toAccountId) !== String(SAFE_ACCOUNT_ID) &&
              movement.toAccountType !== 'safe' &&
              String(movement.toAccountId) !== 'external' &&
              movement.toAccountType !== 'external'
            ) {

              const accountId =  String( movement.toAccountId );
              const accountName = movement.toAccountName || 'Payment Account';
              const existing = balances.get( accountId );
              if (existing) {
                existing.amount += Number( movement.amount || 0  );
              } else {
                balances.set( accountId, {
                    accountId, accountName, amount: Number( movement.amount || 0 )
                  }
                );
              }
            }

            // MONEY OUT
            if (
              movement.fromAccountId &&
              movement.fromAccountType &&
              String(movement.fromAccountId) !== String(SAFE_ACCOUNT_ID) &&
              movement.fromAccountType !== 'safe' &&
              String(movement.fromAccountId) !== 'external' &&
              movement.fromAccountType !== 'external'
            ) {

              const accountId = String( movement.fromAccountId);
              const accountName = movement.fromAccountName ||'Payment Account';
              const existing = balances.get( accountId);

              if (existing) {
                existing.amount -= Number( movement.amount || 0);
              } else {

                balances.set(
                  accountId,
                  {
                    accountId, accountName, amount: -Number( movement.amount ||  0 )
                  }
                );
              }
            }
          }

          // BUILD BREAKDOWN
          this.ngZone.run(() => {
            this.shiftHandoverBreakdown = Array.from(
              balances.values()
            )
              .filter(account => account.amount > 0)
              .map(account => ({
                accountId: account.accountId,
                accountName: account.accountName,
                amount: Number(account.amount.toFixed(2))
              }));

            // TOTAL HANDOVER
            this.shiftHandoverTotal = Number(
              this.shiftHandoverBreakdown
                .reduce((sum, account) => sum + account.amount, 0 ) .toFixed(2)
            );
            this.closeShiftLoading = false;
            this.cdr.detectChanges();
          });
        },

        error: (error: unknown) => {
          console.error( 'Error loading shift movements:', error
          );

          this.ngZone.run(() => {
            this.closeShiftLoading = false;
            this.closeShiftErrorMessage ='Failed to calculate the shift handover. Please try again.';
            this.cdr.detectChanges();
          });
        }
      });
  }

  // CONFIRM CLOSE SHIFT
  confirmCloseShift(): void {
    if (
      !this.currentShift
    ) {
      return;
    }

    if (
      this.closeShiftLoading
    ) {
      return;
    }

    this.closeShiftLoading = true;
    this.closeShiftErrorMessage = '';
    const shiftId = String( this.currentShift.id );
    const closedAt = new Date().toISOString();
    const shiftOpenedByEmployeeId = String( this.currentShift.employeeId );
    const shiftOpenedByEmployeeName = String( this.currentShift.employeeName );

// CURRENT ACCOUNT = HANDOVER BY
const currentUserRaw = localStorage.getItem('currentUser');
if (!currentUserRaw) {
this.closeShiftLoading = false;
this.closeShiftErrorMessage = 'No logged-in employee was found. Please log in again.';
this.cdr.detectChanges();
return;
}

let currentUser:
Record<string, unknown>;

try {
const parsed = JSON.parse( currentUserRaw );

if (
  typeof parsed !== 'object' ||
  parsed === null
) {
  throw new Error( 'Invalid current user data' );
}

currentUser = parsed as Record<string, unknown>;
}

catch (error) {
console.error( 'Error parsing current user:', error
);


this.closeShiftLoading = false;
this.closeShiftErrorMessage = 'Unable to read the current employee data.';
this.cdr.detectChanges();
return;
}

const handedOverByEmployeeId = String( currentUser['id'] ?? currentUser['username'] ?? currentUser['email'] ?? '').trim();
const handedOverByEmployeeName =
String( currentUser['name'] ?? currentUser['username'] ?? currentUser['email'] ??'Current User').trim();

if (!handedOverByEmployeeId) {
this.closeShiftLoading = false;
this.closeShiftErrorMessage = 'Unable to identify the account handing over the shift.';
this.cdr.detectChanges();
return;
}

    // CHECK DUPLICATE HANDOVER FIRST
    this.shiftHandoverService
      .getHandoversByShiftId( shiftId ) .subscribe({ next:
          ( existingHandovers ) => {
            if (
              existingHandovers.length > 0
            ) {
              this.closeShiftLoading = false;
              this.closeShiftErrorMessage = 'A handover has already been created for this shift.';
              this.cdr.detectChanges();
              return;
            }

            // CREATE REAL TREASURY TRANSFERS
            /*
             * One ShiftHandover record represents
             * the complete employee handover.
             *
             * The actual money movement is recorded
             * per source account so Treasury can know
             * exactly where the money came from.
             *
             * Example:
             *
             * Cash Drawer   → Safe
             * Visa POS      → Safe
             * InstaPay      → Safe
             *
             * These are NOT separate handovers.
             * They are the internal money movements
             * belonging to ONE shift handover.
             */

            const transferRequests = this.shiftHandoverBreakdown.map( account => {
                    const isCashDrawer = String( account.accountId ) === String( CASH_DRAWER_ACCOUNT_ID );
                    const transfer: Omit< CashMovement, 'id' > = {
                      createdAt: closedAt,
                      type: 'Transfer',
                      reason: 'ShiftHandover',
                      amount: Number( account.amount.toFixed(2)),
                      fromAccountType: isCashDrawer ? 'drawer' : 'paymentAccount',
                      fromAccountId: String( account.accountId ),
                      fromAccountName: account.accountName,
                      toAccountType: 'safe',
                      toAccountId: SAFE_ACCOUNT_ID,
                      toAccountName: 'Safe',
                      referenceType: 'Shift',
                      referenceId: shiftId,
                      shiftId: shiftId
                    };

                    return this.cashMovementService .createCashMovement( transfer );
                  }
                );

            // SAVE TRANSFERS
            /*
             * forkJoin([]) is not a problem here.
             * If the handover total is zero, it will continue
             * directly to creating the aggregated handover.
             */
            forkJoin( transferRequests ) .subscribe({
              next: () => {
                  // CREATE ONE AGGREGATED HANDOVER
                  const handover: Omit< ShiftHandover, 'id' > = {
                    shiftId: shiftId,
                    createdAt: closedAt,
                    totalAmount: Number( this.shiftHandoverTotal .toFixed(2)),
                    destinationAccountId: SAFE_ACCOUNT_ID,
                    destinationAccountName: 'Safe',
                    handedOverByEmployeeId: handedOverByEmployeeId,
                    handedOverByEmployeeName: handedOverByEmployeeName,
                    note: `Shift handover | Opened by: ${shiftOpenedByEmployeeName} (${shiftOpenedByEmployeeId}) | Handed over by: ${handedOverByEmployeeName} (${handedOverByEmployeeId})`,
                    breakdown: this.shiftHandoverBreakdown.map( account => ({
                    accountId: account.accountId,
                    accountName: account.accountName,
                    amount: Number(account.amount .toFixed(2))
                    }))};

                  // SAVE ONE HANDOVER
                  this.shiftHandoverService .createHandover( handover ).subscribe({ next:( createdHandover ) => {

                          // CLOSE SHIFT
                          this.shiftService.closeShift(shiftId, closedAt, String( createdHandover.id),'Shift closed and handed over to Safe.')
                            .subscribe({ next:
                                ( closedShift ) => {
                                  this.currentShift = {...closedShift,
                                    id: String( closedShift.id ),
                                    openingFloat: Number( closedShift .openingFloat ) || 0
                                  };

                              /* IMPORTANT: The global active shift is now finished, so remove it. 
                              The next account that enters the POS will see no Open Shift and can start a new one.*/
                                  localStorage.removeItem( this.ACTIVE_SHIFT_STORAGE_KEY);
                                  this.closeShiftLoading = false;
                                  this.showCloseShiftModal = false;
                                  this.popupService.showAlert(
                                    `Shift closed successfully. Handover: ${this.shiftHandoverTotal.toFixed(2)} ${this.currencySymbol}`,'success', 'Shift Closed'
                                  );
                                  this.cdr.detectChanges();
                                },
                              error:
                                ( error: unknown ) => {
                                  console.error( 'Error closing shift:', error );
                                  this.closeShiftLoading = false;
                                  this.closeShiftErrorMessage = 'Handover was created, but the shift could not be closed.';
                                  this.cdr.detectChanges();
                                }
                            });
                        },
                      error: ( error: unknown ) => { console.error( 'Error creating shift handover:', error );
                          this.closeShiftLoading = false;
                          this.closeShiftErrorMessage = 'Failed to create the shift handover.';
                          this.cdr.detectChanges();
                        }
                    });
                },
              error:
                (  error: unknown ) => {
                  console.error( 'Error creating treasury transfers:', error );
                  this.closeShiftLoading = false;
                  this.closeShiftErrorMessage = 'Failed to transfer the shift funds to Safe.';
                  this.cdr.detectChanges();
                }
            });
          },
        error:
          ( error: unknown ) => { console.error( 'Error checking existing handover:', error );
            this.closeShiftLoading = false;
            this.closeShiftErrorMessage = 'Failed to verify the shift handover.';
            this.cdr.detectChanges();
          }
      });
  }

  // CANCEL CLOSE SHIFT
  cancelCloseShift(): void {
    if (
      this.closeShiftLoading
    ) {
      return;
    }
    this.showCloseShiftModal = false;
    this.closeShiftErrorMessage ='';
  }

  // PRINT RECEIPT
  printReceipt(): void {
    const receiptElement = document.querySelector<HTMLElement>('.printable-receipt');

    if (!receiptElement) {
      this.popupService.showAlert(
        'The receipt is not ready to print. Please try again.',
        'error',
        'Print Receipt'
      );
      return;
    }

    // Print through a hidden iframe so the receipt opens directly in the
    // browser print dialog without navigating to a separate white receipt tab.
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.title = 'Receipt print frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '1px';
    printFrame.style.height = '1px';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0';
    printFrame.style.pointerEvents = 'none';
    document.body.appendChild(printFrame);

    const printDocument = printFrame.contentDocument;
    const printWindow = printFrame.contentWindow;

    if (!printDocument || !printWindow) {
      printFrame.remove();
      this.popupService.showAlert(
        'The receipt print dialog could not be opened. Please try again.', 'error', 'Print Receipt'
      );
      return;
    }

    const receiptContent = receiptElement.innerHTML;
    const receiptTitle = `Receipt ${this.lastTicketNumber || ''}`;
    let cleanedUp = false;
    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      printFrame.remove();
    };

    printWindow.addEventListener('afterprint', cleanup, { once: true });
    printDocument.open();
    printDocument.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${receiptTitle}</title>
          <style>
            /* Thermal receipt paper: 80 mm roll, 72 mm usable print area. */
            @page { size: 80mm 200mm; margin: 0; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; width: 80mm; background: #fff; color: #171717; }
            body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.4; }
            .receipt-print-page { width: 72mm; max-width: 72mm; margin: 0 auto; padding: 4mm 0; }
            .receipt-header { text-align: center; overflow-wrap: anywhere; }
            .receipt-header h2 { margin: 0 0 5px; font-size: 17px; line-height: 1.2; font-weight: 800; }
            .receipt-header p { margin: 2px 0; font-size: 10px; }
            .receipt-header .receipt-address { font-size: 9px; }
            .receipt-divider { height: 0; margin: 8px 0; border-top: 1px dashed #777; }
            .receipt-meta-row, .receipt-payment-details > div, .receipt-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin: 3px 0; }
            .receipt-meta-row span, .receipt-payment-details span { color: #555; }
            .receipt-meta-row strong, .receipt-payment-details strong { text-align: right; overflow-wrap: anywhere; }
            .receipt-payment-details { margin: 7px 0; }
            .receipt-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9px; }
            .receipt-table th { padding: 5px 1px; text-align: left; border-bottom: 1px solid #333; }
            .receipt-table td { padding: 5px 1px; vertical-align: top; border-bottom: 1px dotted #d0d0d0; overflow-wrap: anywhere; }
            .receipt-table th:nth-child(1), .receipt-table td:nth-child(1) { width: 39%; }
            .receipt-table th:nth-child(2), .receipt-table td:nth-child(2) { width: 10%; text-align: center; }
            .receipt-table th:nth-child(3), .receipt-table td:nth-child(3) { width: 23%; text-align: right; }
            .receipt-table th:nth-child(4), .receipt-table td:nth-child(4) { width: 28%; text-align: right; }
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .receipt-totals { margin-top: 8px; }
            .receipt-totals .receipt-row { margin: 4px 0; }
            .receipt-totals .total-row { margin-top: 7px; padding-top: 7px; border-top: 1px solid #222; font-size: 13px; font-weight: 800; }
            .receipt-footer { margin-top: 12px; text-align: center; }
            .receipt-footer p { margin: 0; font-size: 10px; font-weight: 700; }
            .receipt-footer small { display: block; margin-top: 3px; color: #555; font-size: 8px; }
            @media print {
              html, body { width: 80mm !important; min-width: 80mm !important; max-width: 80mm !important; margin: 0 !important; padding: 0 !important; }
              .receipt-print-page { width: 72mm !important; max-width: 72mm !important; margin: 0 auto !important; padding: 4mm 0 !important; }
              .receipt-table, .receipt-totals, .receipt-header, .receipt-payment-details { max-width: 100%; }
              tr, .receipt-row, .receipt-meta-row { break-inside: avoid; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <main class="receipt-print-page">${receiptContent}</main>
        </body>
      </html>
    `);
    printDocument.close();

    // Give the iframe document a moment to render before invoking the native
    // print dialog. afterprint removes the temporary frame once printing ends.
    window.setTimeout(() => {
      if (!printFrame.isConnected) return;
      printWindow.focus();
      printWindow.print();
      // Safety cleanup for browsers that do not dispatch afterprint reliably.
      window.setTimeout(cleanup, 60000);
    }, 150);
  }

  // CLOSE SUCCESS MODAL
  closeModal(): void {
    // The next invoice tab is created immediately after a successful checkout.
    // Closing the receipt should not generate a second ticket for that tab.
    this.showSuccessModal = false;
  }
}