import { Component, inject, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
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
import { PaymentAccount } from '../../core/models/payment-account.model';
import { PaymentAccountService } from '../../core/services/payment-account.service';
import { Customer } from '../../core/models/customer.model';
import { CustomerService } from '../../core/services/customer.service';
import {
  CustomerTransaction
} from '../../core/models/customer-transaction.model';
import { CustomerTransactionService }
  from '../../core/services/customer-transaction.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})

export class PosComponent implements OnInit {

  // SERVICES
  private readonly productService = inject(ProductService);
  private readonly orderService = inject(OrderService);
  private readonly categoryService = inject(CategoryService);
  private readonly storeSettingsService = inject(StoreSettingsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly popupService = inject(PopupService);
  private readonly paymentAccountService = inject(PaymentAccountService);
  private readonly customerService = inject(CustomerService);
  private readonly customerTransactionService = inject(CustomerTransactionService);
  // CART PERSISTENCE
  private readonly CART_STORAGE_KEY = 'pos_cart';
  private readonly TICKET_STORAGE_KEY = 'pos_ticket';

  // SAVE CART
  saveCart(): void {
    localStorage.setItem( this.CART_STORAGE_KEY, JSON.stringify(this.cart));
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
      localStorage.removeItem(
        this.CART_STORAGE_KEY
      );
    }
  }

  // SAVE TICKET NUMBER
  saveTicketNumber(): void {
    localStorage.setItem( this.TICKET_STORAGE_KEY, this.currentTicketNumber);
  }

  // LOAD TICKET NUMBER
  loadTicketNumber(): void {
    const savedTicket = localStorage.getItem( this.TICKET_STORAGE_KEY );
    if (savedTicket) { this.currentTicketNumber = savedTicket;
    } else {
      this.generateTicketNumber();
    }
  }

  loadPaymentAccounts(): void {
    this.paymentAccountService
      .getActivePaymentAccounts()
      .subscribe({
        next: (accounts) => {
          this.paymentAccounts = accounts;
  
          if (
            !this.selectedPaymentAccountId &&
            accounts.length > 0
          ) {
            this.selectedPaymentAccountId = accounts[0].id;
          }
  
          this.cdr.detectChanges();
        },
  
        error: (err) => {
          console.error(
            'Error loading payment accounts:',
            err
          );
        }
      });
  }

  loadCustomers(): void {
    this.customerService
      .getCustomers()
      .subscribe({
        next: (customers) => {
          this.customers = customers.filter(
            customer => customer.status === 'Active'
          );
  
          this.cdr.detectChanges();
        },
  
        error: (err) => {
          console.error(
            'Error loading customers:',
            err
          );
        }
      });
  }

  onPaymentStatusChange(
    status: 'Paid' | 'OnAccount'
  ): void {
  
    this.paymentStatus = status;
  
    this.showCustomerDropdown = false;
  
    if (status === 'Paid') {
      this.selectedCustomerId = '';
    } else {
      this.selectedPaymentAccountId = '';
    }
  
    this.cdr.detectChanges();
  }

  // CLEAR SAVED CART
  clearSavedCart(): void {
    localStorage.removeItem( this.CART_STORAGE_KEY );
    localStorage.removeItem( this.TICKET_STORAGE_KEY );
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

  // DATE / TICKET
  currentDate: Date = new Date();
  currentTicketNumber: string = '';

  // SUCCESS MODAL
  showSuccessModal: boolean = false;
  showCustomerDropdown: boolean = false;
  lastOrderTotal: number = 0;
  lastPaymentStatus: 'Paid' | 'OnAccount' = 'Paid';
  lastPaymentAccountName: string = '';
  lastCustomerName: string = '';
  lastTicketNumber: string = '';

  // INIT
  ngOnInit(): void {
    this.loadTicketNumber();
    this.loadCart();
    this.loadStoreSettings();
    this.loadData();
    this.loadPaymentAccounts();
    this.loadCustomers();
  }

  // LOAD STORE SETTINGS
  loadStoreSettings(): void {
    this.storeSettingsService .getOrLoadSettings().subscribe({ next: (  settings: StoreSettings | null ) => {
          if (!settings) {
            return;
          }

          // TAX
          this.taxRate = Number(settings.taxRate) / 100;

          // CURRENCY
          this.currency = settings.currency;
          this.currencySymbol = this.storeSettingsService .getCurrencySymbol( settings.currency );
          console.log( 'POS Settings:', { taxRate: this.taxRate, currency: this.currency, currencySymbol: this.currencySymbol });
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          console.error( 'Failed to load store settings:', error );
        }
      });
  }

  toggleCustomerDropdown(): void {
    this.showCustomerDropdown =
      !this.showCustomerDropdown;
  }

  selectCustomer(customer: Customer): void {

    this.selectedCustomerId =
      customer.id;
  
    this.showCustomerDropdown = false;
  
    this.cdr.detectChanges();
  }

  getSelectedCustomerName(): string {

    const customer =
      this.customers.find(
        c =>
          String(c.id) ===
          String(this.selectedCustomerId)
      );
  
    return customer?.name || '';
  }

  @HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent): void {

  const target =
    event.target as HTMLElement;

  if (
    !target.closest('.customer-dropdown')
  ) {
    this.showCustomerDropdown = false;
  }
}

  // GENERATE TICKET
  generateTicketNumber(): void {
    const randomNum = Math.floor( 1000 + Math.random() * 9000 );
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const randomChar = letters.charAt( Math.floor( Math.random() * letters.length ));
    this.currentTicketNumber = `#${randomNum}-${randomChar}`;
  }

  // LOAD DATA
  loadData(): void {
    
    // PRODUCTS
    this.productService .getProducts().subscribe({
        next: (data) => {
          this.products = data.map((p) => ({ ...p, id: String(p.id) }));
          this.restoreCartStock();
          this.filterProducts();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error( 'Error fetching products:', err );
        }
      });

    // CATEGORIES
    this.categoryService .getCategories().subscribe({
        next: (data) => {
          this.categories = data;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error( 'Error fetching categories:', err );
        }
      });
  }

  // RESTORE RESERVED STOCK
  restoreCartStock(): void {
    this.cart.forEach((item) => {
        const product = this.products.find((p) => String(p.id) === String(item.productId));
        if (product) {
          product.stock = Math.max( 0, product.stock - item.quantity );
        }
      }
    );
  }

  // FILTER PRODUCTS
  filterProducts(): void {
    const query = (this.searchQuery || '').trim().toLowerCase();
    this.filteredProducts = this.products.filter((product) => {
          const matchesSearch = !query ||  product.name .toLowerCase() .includes(query) || ( product.sku && product.sku .toLowerCase() .includes(query));
          const matchesCategory = this.selectedCategoryId === 'ALL' || String(product.categoryId) === String(this.selectedCategoryId);
          return (  matchesSearch && matchesCategory
          );
        }
      );
  }

  // SELECT CATEGORY
  selectCategory( categoryId: string ): void {
    this.selectedCategoryId = categoryId;
    this.filterProducts();
  }

  // PRODUCT IMAGE
  getProductImage(item: OrderItem ): string {
    const product = this.products.find((p) => String(p.id) === String(item.productId));
    return ( product?.image || 'https://via.placeholder.com/120x120?text=Product' );
  }

  // ADD TO CART
  addToCart( product: Product ): void {

    // OUT OF STOCK
    if (product.stock <= 0) {
      this.popupService.showAlert( 'Product is out of stock!', 'warning', 'Out of Stock' );
      return;
    }

    // RESERVE ONE UNIT
    product.stock -= 1;

    // CHECK IF PRODUCT ALREADY EXISTS
    const existingItem = this.cart.find((item) => String(item.productId) === String(product.id));
    if (existingItem) { existingItem.quantity += 1; 
      existingItem.total = existingItem.quantity * existingItem.price;
    } else {
      this.cart.push({
        productId: product.id as any,
        productName: product.name,
        price: Number(product.price),
        costPrice:  Number(product.costPrice ?? 0),
        quantity: 1,
        total: Number(product.price)
      } as OrderItem);
    }
    this.saveCart();
  }

  // UPDATE QUANTITY
  updateQuantity(
    item: OrderItem,
    change: number
  ): void {
    const product = this.products.find((p) => String(p.id) === String(item.productId));

    // INCREASE
    if (change > 0) {
      if ( product && product.stock > 0 ) {
        product.stock -= 1;
        item.quantity += 1;
        item.total = item.quantity * item.price;
      } else {
        this.popupService.showAlert(
          'No more stock available!', 'warning', 'Out of Stock'
        );
        return;
      }
    }

    // DECREASE
    else if (change < 0) {
      if (product) {
        product.stock += 1;
      }

      item.quantity -= 1;
      if (item.quantity <= 0) {
        this.cart = this.cart.filter((i) => String(i.productId) !==  String(item.productId));
      } else {
        item.total = item.quantity *  item.price;
      }
    }
    this.saveCart();
  }

  // REMOVE FROM CART
  removeFromCart(
    item: OrderItem
  ): void {
    const product = this.products.find((p) => String(p.id) === String(item.productId));
    if (product) {
      product.stock += item.quantity;
    }
    this.cart = this.cart.filter((i) => String(i.productId) !== String(item.productId));
    this.saveCart();
  }

  // CLEAR CART
  clearCart(): void {
    this.cart.forEach(
      (item) => { const product = this.products.find((p) => String(p.id) === String(item.productId));
        if (product) { product.stock += item.quantity;
        }
      }
    );

    this.cart = [];
    localStorage.removeItem(this.CART_STORAGE_KEY);
  }


  // TOTALS
  get subtotal(): number {
    return this.cart.reduce((sum, item) => sum + item.total, 0);
  }

  get tax(): number {
    return ( this.subtotal * this.taxRate );
  }

  get total(): number {
    return ( this.subtotal + this.tax );
  }

    /* =========================================================
     CHECKOUT
     ========================================================= */

     checkout(): void {

      if (this.cart.length === 0) {
        return;
      }
  
      /*
       * On Account requires customer
       */
      if (
        this.paymentStatus === 'OnAccount' &&
        !this.selectedCustomerId
      ) {
        this.popupService.showAlert(
          'Please select a customer for the On Account sale.',
          'warning',
          'Customer Required'
        );
  
        return;
      }
  
      /*
       * Paid requires payment account
       */
      if (
        this.paymentStatus === 'Paid' &&
        !this.selectedPaymentAccountId
      ) {
        this.popupService.showAlert(
          'Please select a payment account.',
          'warning',
          'Payment Account Required'
        );
  
        return;
      }
  
      this.currentDate = new Date();
  
      this.lastOrderTotal = this.total;
      this.lastPaymentStatus = this.paymentStatus;
      this.lastTicketNumber = this.currentTicketNumber;
  
      this.receiptCart = [...this.cart];
  
      const selectedCustomer =
        this.customers.find(
          customer =>
            String(customer.id) ===
            String(this.selectedCustomerId)
        );
  
      const selectedAccount =
        this.paymentAccounts.find(
          account =>
            String(account.id) ===
            String(this.selectedPaymentAccountId)
        );
  
      /*
       * CUSTOMER TRANSACTION ITEMS
       */
      const customerTransactionItems =
        this.cart.map(item => ({
          productId: String(item.productId),
          productName: item.productName,
          quantity: Number(item.quantity),
          unitPrice: Number(item.price),
          total: Number(item.total)
        }));
  
      /*
       * CREATE ORDER
       */
      const newOrder: any = {
        ticketNumber: this.currentTicketNumber,
  
        items: [...this.cart],
  
        subtotal: Number(this.subtotal.toFixed(2)),
  
        tax: Number(this.tax.toFixed(2)),
  
        total: Number(this.total.toFixed(2)),
  
        paymentStatus: this.paymentStatus,
  
        status: 'Completed',
  
        createdAt: this.currentDate.toISOString()
      };
  
      /*
       * PAID
       */
      if (
        this.paymentStatus === 'Paid' &&
        selectedAccount
      ) {
        newOrder.paymentAccountId =
          String(selectedAccount.id);
      }
  
      /*
       * ON ACCOUNT
       */
      if (
        this.paymentStatus === 'OnAccount' &&
        selectedCustomer
      ) {
        newOrder.customerId =
          String(selectedCustomer.id);
  
        newOrder.customerName =
          selectedCustomer.name;
      }
  
      /*
       * SAVE ORDER
       */
      this.orderService
        .createOrder(newOrder)
        .subscribe({
  
          next: () => {
  
            const updateRequests: any[] = [];
  
            /*
             * UPDATE PRODUCT STOCK
             */
            this.cart.forEach(item => {
  
              const product =
                this.products.find(
                  p =>
                    String(p.id) ===
                    String(item.productId)
                );
  
              if (!product) {
                return;
              }
  
              const updatedProduct = {
                ...product,
                stock: Number(product.stock)
              };
  
              updateRequests.push(
                this.productService.updateProduct(
                  product.id,
                  updatedProduct as any
                )
              );
  
            });
  
            /*
             * ON ACCOUNT DATA
             */
            if (
              this.paymentStatus === 'OnAccount' &&
              selectedCustomer
            ) {
  
              /*
               * UPDATE CUSTOMER BALANCE
               */
              const updatedCustomer: Customer = {
  
                ...selectedCustomer,
  
                balance:
                  Number(selectedCustomer.balance || 0) +
                  Number(this.total)
  
              };
  
              updateRequests.push(
                this.customerService.updateCustomer(
                  selectedCustomer.id,
                  updatedCustomer
                )
              );
  
              /*
               * SAVE CUSTOMER TRANSACTION
               */
              const customerTransaction:
                Omit<CustomerTransaction, 'id'> = {
  
                customerId:
                  String(selectedCustomer.id),
  
                customerName:
                  selectedCustomer.name,
  
                type: 'OnAccountSale',
  
                referenceId:
                  String(this.currentTicketNumber),
  
                referenceNumber:
                  this.currentTicketNumber,
  
                amount:
                  Number(this.total.toFixed(2)),
  
                items:
                  customerTransactionItems,
  
                createdAt:
                  this.currentDate.toISOString()
              };
  
              updateRequests.push(
                this.customerTransactionService
                  .addTransaction(
                    customerTransaction
                  )
              );
            }
  
            /*
             * FINISH CHECKOUT
             */
            if (updateRequests.length === 0) {
  
              this.cart = [];
  
              this.clearSavedCart();
  
              this.showSuccessModal = true;
  
              this.cdr.detectChanges();
  
              return;
            }
  
            forkJoin(updateRequests)
              .subscribe({
  
                next: () => {
  
                  this.cart = [];
  
                  this.clearSavedCart();
  
                  this.showSuccessModal = true;
  
                  this.cdr.detectChanges();
  
                },
  
                error: err => {
  
                  console.error(
                    'Error updating checkout data:',
                    err
                  );
  
                  this.popupService.showAlert(
                    'Order was created, but some related data could not be updated.',
                    'error',
                    'Checkout Warning'
                  );
  
                  this.cdr.detectChanges();
  
                }
  
              });
  
          },
  
          error: err => {
  
            console.error(
              'Error creating order:',
              err
            );
  
            this.popupService.showAlert(
              'Failed to process checkout!',
              'error',
              'Checkout Failed'
            );
  
            this.cdr.detectChanges();
  
          }
  
        });
  
    }
  
  
    /* =========================================================
       PRINT RECEIPT
       ========================================================= */
  
    printReceipt(): void {
      window.print();
    }
  
  
    /* =========================================================
       CLOSE SUCCESS MODAL
       ========================================================= */
  
    closeModal(): void {
  
      this.showSuccessModal = false;
  
      this.generateTicketNumber();
  
      this.saveTicketNumber();
  
    }
  
  }