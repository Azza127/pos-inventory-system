import { ChangeDetectorRef, Component, HostListener,  OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { EMPTY, forkJoin, Observable, of, switchMap } from 'rxjs';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';
import { CategoryService } from '../../core/services/category.service';
import { Category } from '../../core/models/category.model';
import { StoreSettingsService } from '../../core/services/store-settings.service';
import { PurchaseInvoiceService } from '../../core/services/purchase-invoice.service';
import { OrderService } from '../../core/services/order.service';
import { PurchaseInvoice, PurchaseInvoiceItem, PurchaseInvoicePaymentStatus} from '../../core/models/purchase-invoice.model';
import { SupplierService } from '../../core/services/supplier.service';
import { Supplier as SupplierModel } from '../../core/models/supplier.model';
import { SupplierTransactionService } from '../../core/services/supplier-transaction.service';
import { SupplierTransaction } from '../../core/models/supplier-transaction.model';
import { PopupService } from '../../core/services/popup.service';
import { ReturnService } from '../../core/services/return.service';
import { ReturnTransaction } from '../../core/models/return.model';
import { PaymentAccount } from '../../core/models/payment-account.model';
import { PaymentAccountService } from '../../core/services/payment-account.service';
import * as ExcelJS from 'exceljs';

@Component({
  selector: 'app-purchase-invoices',
  standalone: true,
  imports: [ FormsModule, DecimalPipe ],
  templateUrl: './purchase-invoices.html',
  styleUrl: './purchase-invoices.css'
})

export class PurchaseInvoices implements OnInit {

  // SERVICES
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly purchaseInvoiceService = inject(PurchaseInvoiceService);
  private readonly supplierService = inject(SupplierService);
  private readonly supplierTransactionService = inject(SupplierTransactionService);
  private readonly paymentAccountService = inject(PaymentAccountService);
  private readonly popupService = inject(PopupService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly storeSettingsService = inject(StoreSettingsService);
  private readonly returnService = inject(ReturnService);
  private readonly orderService = inject(OrderService);

  // DATA
  invoices: PurchaseInvoice[] = [];
  products: Product[] = [];
  suppliers: SupplierModel[] = [];
  paymentAccounts: PaymentAccount[] = [];
  selectedPaymentAccountId = '';
  isPaymentAccountDropdownOpen = false;

  private suppliersLoaded = false;
  private invoicesLoaded = false;
  private purchaseReturnsLoaded = false;
  private supplierBalanceSyncInProgress = false;
  private productsLoadedForPriceSync = false;
  private missingProductPricesSyncStarted = false;

  // PURCHASE RETURNS
  purchaseReturns: ReturnTransaction[] = [];

  // STORE SETTINGS / CURRENCY
  currency = 'EGP';
  currencySymbol = 'EGP';

  // SEARCH / FILTERS
  searchTerm = '';
  invoiceSearchTerm = '';
  invoiceDateFilter = '';

  // MODAL
  showInvoiceForm = false;
  editingInvoiceId: string | null = null;

  // PRODUCT SEARCH
  productSearchTerm = '';
  productSearchResults: Product[] = [];
  showProductResults = false;

  // QUICK ADD PRODUCT
  showQuickAddProduct = false;
  categories: Category[] = [];
  quickProduct: Product = this.createEmptyQuickProduct();

  // FORM
  newInvoice: PurchaseInvoice = this.createEmptyInvoice();

  // INIT
  ngOnInit(): void {
    this.loadInvoices();
    this.loadProducts();
    this.loadCategories();
    this.loadStoreSettings();
    this.loadPurchaseReturns();
    this.loadPaymentAccounts();
  }

  // LOAD STORE SETTINGS
  private loadStoreSettings(): void {
    this.storeSettingsService .getOrLoadSettings() .subscribe({ next: (settings) => {
          if (!settings) {
            return;
          }
          this.currency = settings.currency;
          this.currencySymbol = this.storeSettingsService .getCurrencySymbol( settings.currency );
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error( 'Failed to load store settings:', error );
        }
      });
  }

  // LOAD INVOICES
  loadInvoices(): void {
    this.purchaseInvoiceService.getPurchaseInvoices() .subscribe({
        next: (invoices) => { this.invoices = [...(invoices || [])]
          .sort( (a, b) => new Date( b.invoiceDate )
          .getTime() - new Date( a.invoiceDate ).getTime()
            );

          this.invoicesLoaded = true;
          this.syncMissingProductPricesFromHistory();
          this.cdr.markForCheck();
          this.trySyncSupplierBalances();
        },
        error: (error) => {
          console.error( 'Error loading purchase invoices:', error
          );
        }
      });
  }

  // LOAD SUPPLIERS
  loadSuppliers(): void {
    this.supplierService
      .getSuppliers()
      .subscribe({ next: (suppliers) => {
          const collator = new Intl.Collator( 'ar', { sensitivity: 'base', numeric: true });
          this.suppliers = [...(suppliers || [])].sort( (a, b) => collator.compare( a.name.trim(), b.name.trim() ));
          this.suppliersLoaded = true;
          this.cdr.markForCheck();
          this.trySyncSupplierBalances();
        },
        error: () => {
          this.popupService.showAlert(
            'Failed to load suppliers.',
            'error'
          );
        }
      });
  }

  // LOAD ACTIVE PAYMENT ACCOUNTS
  loadPaymentAccounts(): void {
    this.paymentAccountService
      .getActivePaymentAccounts()
      .subscribe({ next: (accounts) => {
          this.paymentAccounts = [...(accounts || [])];
          if (
            !this.editingInvoiceId && this.newInvoice.paymentStatus === 'Paid' &&
            !this.selectedPaymentAccountId && this.paymentAccounts.length > 0
          ) {
            this.selectedPaymentAccountId = String( this.paymentAccounts[0].id );
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error( 'Failed to load payment accounts:', error );
          this.popupService.showAlert( 'Failed to load payment accounts.', 'error', 'Payment Accounts Error');
        }
      });
  }

  // PAYMENT ACCOUNT DROPDOWN
  togglePaymentAccountDropdown(): void {
    if (this.editingInvoiceId) {
      return;
    }
    this.isPaymentAccountDropdownOpen = !this.isPaymentAccountDropdownOpen;
  }

  selectPaymentAccount( account: PaymentAccount): void {
    if (this.editingInvoiceId) {
      return;
    }

    this.selectedPaymentAccountId = String(account.id);
    this.isPaymentAccountDropdownOpen = false;
    this.cdr.markForCheck();
  }

  isSelectedPaymentAccount( account: PaymentAccount ): boolean {
    return ( String(account.id) === String(this.selectedPaymentAccountId));
  }

  getSelectedPaymentAccountLabel(): string {
    if (
      !this.selectedPaymentAccountId
    ) {
      return 'Select payment account';
    }

    const account = this.paymentAccounts.find( item => String(item.id) === String( this.selectedPaymentAccountId ));
    return ( account?.name || 'Select payment account' );
  }

  // PAYMENT STATUS
  onPaymentStatusChange( status: PurchaseInvoicePaymentStatus
  ): void {
    if (this.editingInvoiceId) {
      return;
    }
    this.newInvoice.paymentStatus = status;

    if (
      status === 'OnAccount'
    ) {
      this.selectedPaymentAccountId = '';
      this.isPaymentAccountDropdownOpen = false;
      return;
    }

    if (
      status === 'Paid' && !this.selectedPaymentAccountId && this.paymentAccounts.length > 0
    ) {
      this.selectedPaymentAccountId = String( this.paymentAccounts[0].id );
    }
  }

  // MIGRATE HISTORICAL SUPPLIERS
  private migrateHistoricalSuppliers(): void {
    this.supplierService
      .getSuppliers()
      .subscribe({ next: (registeredSuppliers) => {
          const currentSuppliers = [...(registeredSuppliers || [])];
          this.suppliers = currentSuppliers;
          const supplierByName = new Map< string, SupplierModel >();
          for (
            const supplier of currentSuppliers
          ) {
            const normalizedName = supplier.name .trim() .toLowerCase();

            if (
              normalizedName && !supplierByName.has( normalizedName
              )
            ) {
              supplierByName.set( normalizedName, supplier
              );
            }
          }

          const historicalNames = new Map< string, string >();
          for (
            const invoice of this.invoices
          ) {
            const supplierName = invoice.supplierName?.trim();
            if (!supplierName) {
              continue;
            }

            const normalizedName = supplierName .toLowerCase();

            if ( !historicalNames.has( normalizedName )
            ) {
              historicalNames.set( normalizedName, supplierName
              );
            }
          }

          const missingSuppliers = Array.from( historicalNames.entries() )
            .filter(([normalizedName]) => !supplierByName.has( normalizedName ));

          if ( missingSuppliers.length === 0 ) {
            this.linkPurchaseInvoicesToSuppliers();
            return;
          }

          const createRequests = missingSuppliers.map(([normalizedName, supplierName]) => {
                return this.supplierService .addSupplier({
                    name: supplierName,
                    phone: '',
                    address: undefined,
                    notes: 'Created from historical purchase invoices.',
                    balance: 0,
                    status:'Active'
                  });
              }
            );

          forkJoin(createRequests)
            .subscribe({ next: (createdSuppliers) => {
                for ( const supplier of createdSuppliers ) {
                  const normalizedName = supplier.name .trim().toLowerCase();
                  supplierByName.set( normalizedName, supplier );
                }

                this.suppliers = Array.from( supplierByName.values() );
                this.cdr.markForCheck();
                this.linkPurchaseInvoicesToSuppliers(
                  supplierByName
                );
              },
              error: (error) => {
                console.error( 'Failed to migrate historical suppliers:', error
                );

                this.popupService.showAlert( 'Some historical suppliers could not be migrated.', 'error', 'Supplier Migration Failed');
              }
            });
        },
        error: (error) => {
          console.error( 'Failed to load suppliers for migration:',  error );
        }
      });
  }

  // LINK PURCHASE INVOICES TO SUPPLIER IDS
  private linkPurchaseInvoicesToSuppliers(
    supplierMap?: Map< string, SupplierModel > ): void {
    const lookup = supplierMap ?? new Map(
        this.suppliers.map(supplier => [ supplier.name .trim() .toLowerCase(), supplier ])
      );

    const invoicesToUpdate = this.invoices.filter( invoice =>  !invoice.supplierId && !!invoice.supplierName?.trim());
    if (
      invoicesToUpdate.length === 0
    ) {
      return;
    }

    const updateRequests = invoicesToUpdate .map(invoice => {
          const normalizedName = invoice.supplierName.trim() .toLowerCase();
          const supplier = lookup.get( normalizedName );
          if (!supplier) {
            console.warn( `No supplier record found for invoice ${invoice.id} (${invoice.supplierName}).` );
            return null;
          }
          const updatedInvoice: PurchaseInvoice = {...invoice, supplierId: String(supplier.id)};
          return this.purchaseInvoiceService .updatePurchaseInvoice( invoice.id, updatedInvoice );
        }) .filter(
          ( request ): request is Observable<PurchaseInvoice> => request !== null );
    if (
      updateRequests.length === 0
    ) {
      return;
    }

    forkJoin(updateRequests)
      .subscribe({ next: (updatedInvoices) => {
          const updatedMap = new Map( updatedInvoices.map(invoice => [ String(invoice.id), invoice ]));
          this.invoices = this.invoices.map( invoice => updatedMap.get( String(invoice.id) ) ?? invoice );
          this.trySyncSupplierBalances();
          this.cdr.markForCheck();
          console.log(`Supplier migration completed. ${updatedInvoices.length} purchase invoice(s) linked.`);
        },
        error: (error) => {
          console.error( 'Failed to link purchase invoices to suppliers:', error );
          this.popupService.showAlert('Suppliers were created, but some purchase invoices could not be linked.', 'error', 'Invoice Linking Failed' );
        }
      });
  }

  // SUPPLIER DROPDOWN
  isSupplierDropdownOpen = false;
  toggleSupplierDropdown(): void {
    if (this.editingInvoiceId) {
      return;
    }
    this.isSupplierDropdownOpen = !this.isSupplierDropdownOpen;
  }

  selectSupplier( supplier: SupplierModel
  ): void {
    if (this.editingInvoiceId) {
        return;
    }

    this.newInvoice.supplierId = String(supplier.id);
    this.newInvoice.supplierName = supplier.name;
    this.isSupplierDropdownOpen = false;
    this.cdr.markForCheck();
  }

  isSelectedSupplier( supplier: SupplierModel ): boolean {
    return (
      String(supplier.id) === String( this.newInvoice.supplierId )
    );
  }

  getSelectedSupplierLabel(): string {
    if (
      !this.newInvoice.supplierId
    ) {
      return 'Select supplier';
    }

    const supplier = this.suppliers.find( item => String(item.id) === String( this.newInvoice.supplierId ) );
    if (supplier) {
      return supplier.name;
    }
    
    return (
      this.newInvoice.supplierName ||
      'Select supplier'
    );
  }

  onSupplierChange( supplierId: string): void {
    if (this.editingInvoiceId) {
      return;
    }

    const supplier = this.suppliers.find( item => item.id === supplierId );
    this.newInvoice.supplierId = supplierId;
    this.newInvoice.supplierName = supplier?.name || '';
  }

  // LOAD PRODUCTS
  loadProducts(): void {
    this.productService .getProducts() .subscribe({ next: (products) => {
          this.products = products;
            this.productsLoadedForPriceSync = true;
            this.syncMissingProductPricesFromHistory();
          this.cdr.markForCheck();
        }, 
        error: (error: unknown) => {
          console.error( 'Failed to load products:', error );
          this.popupService.showAlert( 'Failed to load products.', 'error', 'Loading Error' );
        }
      });
  }

// SYNC PRODUCTS WITH MISSING COST PRICES
// USING THE LATEST HISTORICAL PURCHASE INVOICE
private syncMissingProductPricesFromHistory(): void {
  if (
    !this.invoicesLoaded || !this.productsLoadedForPriceSync || this.missingProductPricesSyncStarted
  ) {
    return;
  }

  this.missingProductPricesSyncStarted = true;
  const latestItems = new Map< string, { invoiceDate: number; item: PurchaseInvoiceItem; }  >();
  // Find the latest valid purchase price per product.
  for (const invoice of this.invoices) {
    const invoiceDate = new Date( invoice.invoiceDate ).getTime();
    if (!Number.isFinite(invoiceDate)) {
      continue;
    }

    for (const item of invoice.items || []) {
      const productId = String( item.productId ?? '' );
      const purchasePrice = Number(
        item.purchasePrice
      );

      if (
        !productId || !Number.isFinite(purchasePrice) || purchasePrice <= 0
      ) {
        continue;
      }

      const existing = latestItems.get(
        productId
      );

      if (
        !existing ||invoiceDate >= existing.invoiceDate
      ) {
        latestItems.set( productId, { invoiceDate, item } );
      }
    }
  }

  const updateRequests: Observable<Product>[] = [];
  for (const product of this.products) {
    const currentCostPrice = Number(
      product.costPrice ?? 0
    );

    // Preserve products that already have a valid cost price.
    if (
      Number.isFinite(currentCostPrice) &&
      currentCostPrice > 0
    ) {
      continue;
    }

    const latest = latestItems.get(
      String(product.id)
    );

    if (!latest) {
      continue;
    }

    const purchasePrice = Number(
      latest.item.purchasePrice
    );

    const invoiceSellingPrice = Number(
      latest.item.sellingPrice
    );

    const sellingPrice = Number.isFinite(invoiceSellingPrice) && invoiceSellingPrice > 0 ? invoiceSellingPrice : undefined;
    updateRequests.push(
      this.updateProductStock( product, 0, purchasePrice, sellingPrice )
    );
  }

  if (updateRequests.length === 0) {
    return;
  }

  forkJoin(updateRequests).subscribe({
    next: (updatedProducts) => {
      const updatedMap = new Map(
        updatedProducts.map(product => [
          String(product.id),
          product
        ])
      );

      this.products = this.products.map( product => updatedMap.get(String(product.id)) ?? product );
      this.cdr.markForCheck();
      console.log( `Price synchronization completed for ${updatedProducts.length} product(s).` );
    },

    error: (error: unknown) => {
      console.error( 'Failed to synchronize missing product prices:', error );
      // Allow a retry if the synchronization is triggered again.
      this.missingProductPricesSyncStarted = false;
    }
  });
}

  // LOAD CATEGORIES
  loadCategories(): void {
    this.categoryService .getCategories() .subscribe({ next: (categories) => {
          this.categories =  categories.map( category => ({ ...category, id: String(category.id) }) );
          this.cdr.markForCheck();
        },
        error: (error: unknown) => { console.error( 'Failed to load categories:', error );
          this.popupService.showAlert( 'Failed to load product categories.', 'error', 'Loading Error' );
        }
      });
  }

  // LOAD PURCHASE RETURNS
  loadPurchaseReturns(): void {
    this.returnService .getReturnsByType('purchase') .subscribe({
        next: (returns) => {
          this.purchaseReturns =  returns || [];
          this.purchaseReturnsLoaded = true;
          this.cdr.markForCheck();
          this.trySyncSupplierBalances();
        },
        error: (error: unknown) => {
          console.error( 'Failed to load purchase returns:', error );
        }
      });
  }

  // TRY SYNC SUPPLIER BALANCES
  private trySyncSupplierBalances(): void {
    if (
      !this.suppliersLoaded || !this.invoicesLoaded || !this.purchaseReturnsLoaded
    ) {
      return;
    }
    this.syncSupplierBalances();
  }

  // SYNC SUPPLIER BALANCES
  private syncSupplierBalances(): void {
    if (this.supplierBalanceSyncInProgress) {
      return;
    }

    this.supplierBalanceSyncInProgress = true;
    this.supplierTransactionService
      .getSupplierTransactions().subscribe({ next: (transactions) => {
          const calculatedSuppliers = this.suppliers.map(supplier => ({
            ...supplier, balance: this.calculateSupplierBalanceFromSources(supplier, transactions || [] )}));
          const currentBalanceById = new Map(
            this.suppliers.map(supplier => [String(supplier.id), Number(supplier.balance || 0)])
          );
          const changedSuppliers = calculatedSuppliers.filter(supplier =>
            Math.abs(
              Number(supplier.balance || 0) - Number(currentBalanceById.get(String(supplier.id)) || 0)) >= 0.005
          );

          if (changedSuppliers.length === 0) {
            this.suppliers = calculatedSuppliers;
            this.supplierBalanceSyncInProgress = false;
            this.cdr.markForCheck();
            return;
          }

          const updateRequests = changedSuppliers.map(supplier =>
            this.supplierService.updateSupplier(String(supplier.id), {
              name: supplier.name,
              phone: supplier.phone,
              address: supplier.address,
              notes: supplier.notes,
              balance: supplier.balance,
              status: supplier.status
            })
          );

          forkJoin(updateRequests).subscribe({
            next: (updatedSuppliers) => {
              const updatedById = new Map(
                updatedSuppliers.map(supplier => [String(supplier.id), supplier])
              );
              const calculatedById = new Map(
                calculatedSuppliers.map(supplier => [String(supplier.id), supplier])
              );

              this.suppliers = this.suppliers.map(supplier =>
                updatedById.get(String(supplier.id)) ??
                calculatedById.get(String(supplier.id)) ??
                supplier
              );

              this.supplierBalanceSyncInProgress = false;
              this.cdr.markForCheck();
            },
            error: (error: unknown) => {
              console.error('Failed to synchronize supplier balances:', error);
              this.supplierBalanceSyncInProgress = false;
              this.cdr.markForCheck();
            }
          });
        },
        error: (error: unknown) => {
          console.error('Failed to load supplier transactions for balance synchronization:', error);
          this.supplierBalanceSyncInProgress = false;
        }
      });
  }

  private calculateSupplierBalanceFromSources(
    supplier: SupplierModel,
    transactions: SupplierTransaction[]
  ): number {
    const supplierName = String(supplier.name || '').trim().toLowerCase();
    const supplierInvoices = this.invoices.filter(invoice =>
      String(invoice.supplierName || '').trim().toLowerCase() === supplierName
    );
    const invoiceIds = new Set(supplierInvoices.map(invoice => String(invoice.id)));

    let balance = supplierInvoices.reduce((sum, invoice) => {
      // Older invoices may not have a paymentStatus. Treat them as unpaid
      // unless they are explicitly marked Paid.
      return invoice.paymentStatus !== 'Paid'
        ? sum + Number(invoice.total || 0)
        : sum;
    }, 0);

    for (const purchaseReturn of this.purchaseReturns) {
      if (
        purchaseReturn.status === 'completed' && invoiceIds.has(String(purchaseReturn.referenceId || ''))
      ) {
        balance -= Number(purchaseReturn.total || 0);
      }
    }

    for (const transaction of transactions) {
      if (String(transaction.supplierName || '').trim().toLowerCase() !== supplierName) {
        continue;
      }
      if (transaction.type === 'SupplierPayment') {
        balance -= Number(transaction.amount || 0);
      } else if (transaction.type === 'SupplierRefund') {
        balance += Number(transaction.amount || 0);
      }
    }

    return Number(balance.toFixed(2));
  }

  // CHECK IF THE WHOLE PURCHASE INVOICE WAS RETURNED
  isInvoiceFullyReturned(invoice: PurchaseInvoice ): boolean {
    if (
      !invoice.items || invoice.items.length === 0
    ) {
      return false;
    }

    const completedReturns = this.purchaseReturns.filter(
        returnTransaction => returnTransaction.type === 'purchase' && returnTransaction.status === 'completed' &&
          String( returnTransaction.referenceId ) === String(invoice.id)
      );
    if (
      completedReturns.length === 0
    ) {
      return false;
    }

    return invoice.items.every(
      (invoiceItem) => {
        const returnedQuantity = completedReturns.reduce(
            ( total, returnTransaction ) => total + ( returnTransaction.items || [] )
              .filter( returnItem => String( returnItem.productId ) === String( invoiceItem.productId ) )
              .reduce(( itemTotal, returnItem ) => itemTotal + Number( returnItem.quantity || 0 ), 0 ), 0 );
        return (
          returnedQuantity >= Number( invoiceItem.quantity || 0 )
        );
      }
    );
  }

  // OPEN NEW INVOICE
  showNewInvoiceForm(): void {
    this.editingInvoiceId = null;
    this.newInvoice = this.createEmptyInvoice();
    this.selectedPaymentAccountId = '';
    this.isPaymentAccountDropdownOpen = false;
    this.productSearchTerm = '';
    this.productSearchResults = [];
    this.showProductResults = false;
    this.isSupplierDropdownOpen = false;
    this.showInvoiceForm = true;
    this.loadSuppliers();
    this.loadPaymentAccounts();
  }

  // CANCEL INVOICE
  cancelInvoiceForm(): void {
    this.showInvoiceForm = false;
    this.editingInvoiceId = null;
    this.productSearchTerm = '';
    this.productSearchResults = [];
    this.showProductResults = false;
    this.isSupplierDropdownOpen = false;
    this.isPaymentAccountDropdownOpen = false;
    this.selectedPaymentAccountId = '';
    this.newInvoice = this.createEmptyInvoice();
  }

  // CREATE EMPTY INVOICE
  private createEmptyInvoice():
    PurchaseInvoice {
    return {
      id: '',
      supplierId: '',
      supplierName: '',
      invoiceNumber: '',
      invoiceDate: this.getTodayDate(),
      warehouseId: '',
      notes: '',
      subtotal: 0,
      taxTotal: 0,
      total: 0,
      items: [],
      paymentStatus: 'Paid'
    };
  }

  // TODAY DATE
  private getTodayDate(): string {
    return new Date() .toISOString() .split('T')[0];
  }

  // PRODUCT SEARCH
  searchProducts( term: string ): void {
    this.productSearchTerm = term;
    const normalizedTerm = term .trim() .toLowerCase();
    if (
      normalizedTerm === ''
    ) {
      this.productSearchResults = [];
      this.showProductResults =false;
      return;
    }

    this.productSearchResults = this.products .filter(
          (product) => { const name = product.name.toLowerCase();
            const sku = product.sku .toLowerCase();
            return (
              name.includes( normalizedTerm ) || sku.includes( normalizedTerm )
            );
          }
        ) .slice(0, 8);
    this.showProductResults = this.productSearchResults.length > 0;
  }

  // SCAN / ENTER PRODUCT CODE
  scanProductByCode( code: string ): void {
    if (this.editingInvoiceId) {
      return;
    }

    const normalizedCode = code .trim() .toLowerCase();
    if (
      normalizedCode === ''
    ) {
      return;
    }

    const product = this.products.find( item => item.sku .trim() .toLowerCase() === normalizedCode );
    if (product) { this.selectProduct( product );
      return;
    }
    this.popupService.showAlert( `No product was found with code "${code}".`, 'warning','Product Not Found'
    );
  }

  // SELECT PRODUCT
  selectProduct( product: Product): void {
    if (this.editingInvoiceId) {
      return;
    }
    const existingItem = this.newInvoice.items.find( item => item.productId === product.id );
    if (existingItem) {
      existingItem.quantity += 1;
      this.recalculateInvoice();
      this.clearProductSearch();
      return;
    }

    const item:
      PurchaseInvoiceItem = {
      id:  this.generateId(),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: 1,
      expiryDate: '',
      purchasePrice: product.costPrice ?? 0,
      sellingPrice: product.price,
      taxRate: 0,
      taxAmount: 0,
      subtotal: 0,
      total: 0
    };
    this.newInvoice.items = [ ...this.newInvoice.items, item];
    this.recalculateInvoice();
    this.clearProductSearch();
  }

  // CLEAR PRODUCT SEARCH
  clearProductSearch(): void {
    this.productSearchTerm = '';
    this.productSearchResults = [];
    this.showProductResults = false;
  }

  // QUICK ADD PRODUCT
  openQuickAddProduct(): void {
    if (this.editingInvoiceId) {
      return;
    }

    this.quickProduct = this.createEmptyQuickProduct();
    const searchValue = this.productSearchTerm .trim();
    if (
      searchValue !== ''
    ) {
      const looksLikeSku = /^[A-Za-z0-9_-]+$/ .test(searchValue);
      if (looksLikeSku) {
        this.quickProduct.sku = searchValue;
      } else {
        this.quickProduct.name = searchValue;
      }
    }

    this.showProductResults = false;
    this.showQuickAddProduct = true;
    this.cdr.markForCheck();
  }

  // CLOSE QUICK ADD PRODUCT
  closeQuickAddProduct(): void {
    this.showQuickAddProduct = false;
    this.quickProduct = this.createEmptyQuickProduct();
    this.cdr.markForCheck();
  }

  // CREATE EMPTY QUICK PRODUCT
  private createEmptyQuickProduct(): Product {
    return {
      id: '',
      name: '',
      description: '',
      sku: '',
      categoryId: '',
      price: 0,
      stock: 0,
      maxStock: 0,
      minStock: 0,
      image: ''
    };
  }

  // VALIDATE QUICK PRODUCT
  isQuickProductValid(): boolean {
    const name = this.quickProduct.name .trim();
    const sku = this.quickProduct.sku .trim();
    const categoryId = String( this.quickProduct.categoryId || '' ).trim();
    const price = Number(  this.quickProduct.price );
    const minStock = Number( this.quickProduct.minStock );
    const maxStock = Number( this.quickProduct.maxStock);
    if (
      name === ''
    ) {
      return false;
    }

    if (
      sku === ''
    ) {
      return false;
    }

    if (
      categoryId === ''
    ) {
      return false;
    }

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return false;
    }

    if (
      !Number.isFinite(minStock) || minStock < 0
    ) {
      return false;
    }

    if (
      !Number.isFinite(maxStock) ||  maxStock <= 0
    ) {
      return false;
    }

    if (
      minStock > maxStock
    ) {
      return false;
    }

    return true;
  }

  // SAVE QUICK PRODUCT
  saveQuickProduct(): void {
    if (this.editingInvoiceId) {
      return;
    }

    if (
      !this.isQuickProductValid()
    ) {
      this.popupService.showAlert( 'Please complete the required product information.', 'warning', 'Incomplete Product');
      return;
    }

    const productToSave: Product = { ...this.quickProduct,
      name: this.quickProduct.name .trim(),
      sku: this.quickProduct.sku .trim(),
      categoryId: String( this.quickProduct.categoryId ),
      stock: 0,
      minStock: Number( this.quickProduct.minStock || 0),
      maxStock: Number( this.quickProduct.maxStock || 0 ),
      price: Number( this.quickProduct.price || 0),
      image: this.quickProduct.image?.trim() ?? '',
      description: this.quickProduct.description  ?.trim() ?? ''
    };

    this.productService
      .createProduct( productToSave ) .subscribe({
        next: ( createdProduct: Product ) => {
          const normalizedProduct:
            Product = {  ...createdProduct,
            id: String(  createdProduct.id ),
            categoryId: String( createdProduct.categoryId ),
            stock: Number( createdProduct.stock || 0 )
          };
          this.products = [ ...this.products, normalizedProduct
          ];

          this.selectProduct( normalizedProduct );
          this.showQuickAddProduct = false;
          this.quickProduct = this.createEmptyQuickProduct();
          this.clearProductSearch();
          this.popupService.showAlert( 'Product added successfully and added to the current purchase invoice.', 'success', 'Product Added' );
          this.cdr.markForCheck();
        },
        error: (error: unknown) => { console.error( 'Failed to create product:', error );
          this.popupService.showAlert( 'Failed to add the product.', 'error', 'Add Product Failed'
          );
        }
      });
  }

  // REMOVE ITEM
  removeInvoiceItem( itemId: string ): void {
    if (this.editingInvoiceId) {
      return;
    }
    this.newInvoice.items = this.newInvoice.items.filter( item => item.id !== itemId );
    this.recalculateInvoice();
  }

  // UPDATE ITEM
  updateItem( item: PurchaseInvoiceItem ): void {
    if (this.editingInvoiceId) {
      return;
    }
    if ( item.quantity < 1) { item.quantity = 1; }
    if ( item.purchasePrice < 0 ) { item.purchasePrice = 0; }
    if ( item.sellingPrice < 0 ) { item.sellingPrice = 0; }
    if ( item.taxRate < 0 ) { item.taxRate = 0; }
    this.recalculateInvoice();
  }

 // RECALCULATE INVOICE
  recalculateInvoice(): void {
    if (this.editingInvoiceId) {
      return;
    }

    let subtotal = 0;
    let taxTotal = 0;
    this.newInvoice.items.forEach( (item) => { item.subtotal = item.quantity * item.purchasePrice;
          item.taxAmount = item.subtotal * ( item.taxRate / 100  );
          item.total = item.subtotal + item.taxAmount;
          subtotal += item.subtotal;
          taxTotal += item.taxAmount;
        }
      );

    this.newInvoice.subtotal = subtotal;
    this.newInvoice.taxTotal = taxTotal;
    this.newInvoice.total = subtotal + taxTotal;
    this.cdr.markForCheck();
  }

  // UPDATE ONE PRODUCT STOCK + CURRENT PRICES
  private updateProductStock(
    product: Product, quantityDelta: number, purchasePrice?: number, sellingPrice?: number ): Observable<Product> {
    const currentStock = Math.max(  0, Number(product.stock ?? 0));
    const delta = Number(quantityDelta);
    const newStock = Math.max(0, currentStock + delta);
    const currentCostPrice = Number(product.costPrice ?? 0);
    const incomingPurchasePrice = Number(purchasePrice);
    const hasCurrentCost = Number.isFinite(currentCostPrice) && currentCostPrice > 0;
    const hasValidPurchasePrice = purchasePrice !== undefined && Number.isFinite(incomingPurchasePrice) && incomingPurchasePrice > 0;
    // Keep the current cost unless there is enough
    // information to calculate a reliable new average.
    let nextCostPrice = product.costPrice;

    if (delta > 0 && hasValidPurchasePrice) {
      if (currentStock === 0) {
        // No existing inventory: the incoming purchase
        // establishes the cost of the available stock.
        nextCostPrice = incomingPurchasePrice;
      } else if (hasCurrentCost && newStock > 0) {
        // Moving weighted-average cost:
        // (old inventory value + incoming purchase value)
        // / new inventory quantity.
        nextCostPrice = Number(
          (( currentStock * currentCostPrice + delta * incomingPurchasePrice ) / newStock ).toFixed(6));
      }
      // If existing stock has no valid cost, do not invent
      // an average. The missing cost remains visible.
    } else if (
      delta === 0 && currentStock === 0 && !hasCurrentCost && hasValidPurchasePrice ) {
      // A product with zero stock can use a known purchase
      // price as its starting cost for future receipts.
      nextCostPrice = incomingPurchasePrice;
    }
  
    const updatedProduct: Product = {
      ...product, stock: newStock,
      costPrice: nextCostPrice,
      price: sellingPrice !== undefined ? Number(sellingPrice) : product.price
    };
  
    return this.productService.updateProduct(
      product.id,
      updatedProduct
    );
  }

  // ADD PURCHASE QUANTITIES TO STOCK
private addInvoiceStock( invoice: PurchaseInvoice ): Observable<Product[]> { 
  if (!invoice.items?.length) { return of([]); }
  return this.productService.getProducts().pipe(
    switchMap(latestProducts => {
      const groupedItems = new Map< string, { quantity: number; purchaseCostTotal: number; sellingPrice?: number; } >();
      for (const item of invoice.items) {
        const productId = String(item.productId ?? '');
        const quantity = Number(item.quantity ?? 0);
        const purchasePrice = Number(item.purchasePrice ?? 0);
        const sellingPrice = Number(item.sellingPrice ?? 0);

        if (
          !productId || !Number.isFinite(quantity) ||  quantity <= 0 || !Number.isFinite(purchasePrice) || purchasePrice <= 0
        ) {
          throw new Error( `Invalid purchase item for product ${productId || '(unknown)'}.` );
        }

        const existing = groupedItems.get(productId) ?? {
          quantity: 0, purchaseCostTotal: 0,  sellingPrice: undefined
        };

        existing.quantity += quantity;
        existing.purchaseCostTotal += quantity * purchasePrice;

        if (
          Number.isFinite(sellingPrice) && sellingPrice > 0
        ) {
          existing.sellingPrice = sellingPrice;
        }
        groupedItems.set(productId, existing);
      }

      const updates: Observable<Product>[] = [];
      for (const [productId, summary] of groupedItems) {
        const product = latestProducts.find(
          item => String(item.id) === productId
        );

        if (!product) {
          throw new Error( `Product ${productId} was not found while updating stock.` );
        }
        const weightedPurchasePrice = summary.purchaseCostTotal / summary.quantity;
        updates.push(
          this.updateProductStock(
            product, summary.quantity,  weightedPurchasePrice, summary.sellingPrice
          )
        );
      }
      return updates.length > 0 ? forkJoin(updates) : of([]);
    })
  );
}

  // UPDATE STOCK AFTER EDITING INVOICE
  private updateStockAfterInvoiceEdit( oldInvoice: PurchaseInvoice, newInvoice: PurchaseInvoice ): Observable<Product[]> {
    return of([]);
  }

  // SUPPLIER ACCOUNT
  private updateSupplierBalance( supplierId: string, balanceDelta: number ): Observable<SupplierModel> {
    return this.supplierService
      .getSupplier( String(supplierId) ) .pipe( switchMap((supplier) => {
            const updatedSupplier: Omit< SupplierModel, 'id' > = {
              name: supplier.name,
              phone: supplier.phone,
              address: supplier.address,
              notes:  supplier.notes,
              balance: Number(( Number(supplier.balance || 0) + Number(balanceDelta || 0) ).toFixed(2) ),
              status: supplier.status
            };

            return this.supplierService .updateSupplier( supplier.id, updatedSupplier
              );
          }
        )
      );
  }

  // CREATE SUPPLIER PURCHASE TRANSACTION
  private createSupplierPurchaseTransaction( invoice: PurchaseInvoice ): Observable<SupplierTransaction> {
    const transaction: Omit< SupplierTransaction, 'id' > = {
      supplierId: String( invoice.supplierId ),
      supplierName: invoice.supplierName,
      type: 'OnAccountPurchase',
      referenceId: String( invoice.id ),
      referenceNumber: invoice.invoiceNumber,
      amount: Number( invoice.total.toFixed(2) ),
      createdAt: new Date().toISOString()
    };
    return this.supplierTransactionService .addTransaction( transaction );
  }

  // ADD PURCHASE TO SUPPLIER ACCOUNT
  private addPurchaseToSupplierAccount( invoice: PurchaseInvoice ): Observable<SupplierTransaction> {
    const supplierId = String( invoice.supplierId || '' ) .trim();
    if (!supplierId) {
      throw new Error( `Supplier ID is missing for invoice ${invoice.invoiceNumber}.` );
    }
    return this.updateSupplierBalance( supplierId, invoice.total
    )
    .pipe( switchMap(() => this.createSupplierPurchaseTransaction( invoice
          )
      )
    );
  }

  // REMOVE PURCHASE FROM SUPPLIER ACCOUNT
  private removePurchaseFromSupplierAccount( invoice: PurchaseInvoice ): Observable<unknown> {
    const supplierId = String( invoice.supplierId || '' ).trim();
    if (!supplierId) {
      throw new Error( `Supplier ID is missing for invoice ${invoice.invoiceNumber}.` );
    }
    return this.updateSupplierBalance( supplierId, -Number( invoice.total || 0 ) ) .pipe(
      switchMap( () => this.supplierTransactionService .getSupplierTransactionsBySupplier( supplierId  ) ),
      switchMap(
        (transactions) => {
          const invoiceTransaction = transactions .find( transaction => transaction.type === 'OnAccountPurchase' && String( transaction.referenceId ) === String( invoice.id ));
          if (
            !invoiceTransaction
          ) {
            return of(null);
          }
          return this.supplierTransactionService .deleteTransaction( invoiceTransaction.id );
        }
      )
    );
  }

  // SAVE INVOICE
  saveInvoice(): void {
    if (
      !this.isInvoiceValid()
    ) {
      this.popupService.showAlert( 'Please complete all required invoice information and add at least one product.',
          'warning', 'Incomplete Invoice' );
      return;
    }

    if (!this.editingInvoiceId) {
      this.recalculateInvoice();
    }

    const selectedPaymentAccount = this.paymentAccounts.find( account => String(account.id) === String( this.selectedPaymentAccountId) );
    const paymentStatus: PurchaseInvoicePaymentStatus = this.newInvoice.paymentStatus || 'Paid';
    const invoiceToSave: PurchaseInvoice = { ...this.newInvoice, supplierId: String( this.newInvoice.supplierId || ''),
      supplierName: this.newInvoice.supplierName .trim(),
      invoiceNumber: this.newInvoice.invoiceNumber .trim(),
      notes: this.newInvoice.notes ?.trim() ?? '',
      items: this.newInvoice.items.map( item => ({ ...item }) ), paymentStatus,
      paymentAccountId: paymentStatus === 'Paid' ? String( selectedPaymentAccount?.id || '' ) : undefined,
      paymentAccountName: paymentStatus === 'Paid' ? selectedPaymentAccount?.name : undefined
    };

    // UPDATE EXISTING INVOICE
    if (
      this.editingInvoiceId
    ) {
      const oldInvoice = this.invoices.find( invoice => String(invoice.id) === String( this.editingInvoiceId ) );
      if (!oldInvoice) {
        this.popupService.showAlert( 'The original invoice could not be found.', 'error', 'Update Failed' );
        return;
      }

      const editedInvoice: PurchaseInvoice = { ...oldInvoice,
        supplierId: oldInvoice.supplierId,
        supplierName: oldInvoice.supplierName,
        invoiceNumber: this.newInvoice.invoiceNumber .trim(),
        invoiceDate: this.newInvoice.invoiceDate,
        warehouseId: this.newInvoice.warehouseId,
        notes: this.newInvoice.notes ?.trim() ?? '',
        subtotal: oldInvoice.subtotal,
        taxTotal: oldInvoice.taxTotal,
        total: oldInvoice.total,
        items: oldInvoice.items.map( item => ({ ...item }) ),
        paymentStatus: oldInvoice.paymentStatus,
        paymentAccountId: oldInvoice.paymentAccountId,
        paymentAccountName: oldInvoice.paymentAccountName
      };

      this.purchaseInvoiceService .updatePurchaseInvoice( this.editingInvoiceId, editedInvoice ) 
      .subscribe({ next: ( updatedInvoice ) => {
            this.invoices = this.invoices.map(invoice => String( invoice.id ) === String( updatedInvoice.id ) ? updatedInvoice : invoice);
            this.cancelInvoiceForm();
            this.popupService.showAlert( 'Purchase invoice details were updated successfully.', 'success', 'Invoice Updated' );
            this.cdr.markForCheck();
          },
          error: ( error: unknown ) => {
            console.error( 'Failed to update purchase invoice:', error );
            this.popupService.showAlert( 'Failed to update purchase invoice.', 'error', 'Update Failed'
            );
          }
        });
      return;
    }

    // CREATE NEW INVOICE
    this.purchaseInvoiceService
      .createPurchaseInvoice( invoiceToSave)
      .subscribe({ next: ( createdInvoice ) => {

          // STEP 1: Add purchased quantities to inventory stock.
          this.addInvoiceStock( createdInvoice )
          .subscribe({ next: ( updatedProducts ) => {
              if (
                updatedProducts.length > 0
              ) {
                const updatedMap = new Map( updatedProducts.map( product => [ String( product.id ), product ]));
                this.products = this.products.map( product => updatedMap.get( String( product.id ) ) ?? product );
              }

              // STEP 2: Only On Account invoices affect supplier balance.
              if ( createdInvoice.paymentStatus === 'OnAccount' ) {
                this.addPurchaseToSupplierAccount( createdInvoice )
                .subscribe({ next: () => {
                    this.invoices = [ createdInvoice,  ...this.invoices ];
                    this.loadSuppliers();
                    this.cancelInvoiceForm();
                    this.popupService.showAlert( 'Purchase invoice created, inventory updated, and supplier account updated successfully.','success', 'Invoice Created' );
                    this.cdr.markForCheck();
                  },
                  error: ( error: unknown ) => { console.error( 'Failed to update supplier account after creating invoice:', error );
                    this.invoices = [ createdInvoice, ...this.invoices ];
                    this.loadSuppliers();
                    this.cancelInvoiceForm();
                    this.popupService.showAlert('The purchase invoice and inventory were saved, but the supplier account could not be updated.', 'error', 'Supplier Account Update Failed' );
                    this.cdr.markForCheck();
                  }
                });
                return;
              }

              // PAID INVOICE
              this.invoices = [ createdInvoice, ...this.invoices ];
              this.loadSuppliers();
              this.cancelInvoiceForm();
              this.popupService.showAlert( 'Purchase invoice created and inventory stock updated successfully.', 'success', 'Invoice Created' );
              this.cdr.markForCheck();
            },
            error: ( error: unknown ) => {
              console.error( 'Failed to update inventory stock after creating invoice:',  error );
              this.invoices = [ createdInvoice, ...this.invoices ];
              this.cancelInvoiceForm();
              this.popupService.showAlert( 'The purchase invoice was created, but the inventory stock could not be updated.', 'error','Inventory Update Failed');
              this.cdr.markForCheck();
            }
          });
        },
        error: ( error: unknown ) => {
          console.error( 'Failed to create purchase invoice:', error );
          this.popupService.showAlert( 'Failed to create purchase invoice.', 'error', 'Save Failed'
          );
        }
      });
  }

  // VALIDATION
  isInvoiceValid(): boolean {
    if (
      !this.newInvoice.supplierId || !this.newInvoice.invoiceNumber .trim() || !this.newInvoice.invoiceDate
    ) {
      return false;
    }

    if (
      this.editingInvoiceId
    ) {
      return true;
    }

    if (
      this.newInvoice.items.length === 0
    ) {
      return false;
    }

    if (
      this.newInvoice.paymentStatus ===  'Paid' && !this.selectedPaymentAccountId
    ) {
      return false;
    }

    return this.newInvoice.items.every(
      item => item.productId !== '' && item.quantity > 0 && item.purchasePrice >= 0 && item.sellingPrice >= 0 && item.taxRate >= 0);
  }

  // EDIT INVOICE
  editInvoice( invoice: PurchaseInvoice  ): void {
    this.editingInvoiceId = String(invoice.id);
    this.newInvoice = { ...invoice,
      supplierId: invoice.supplierId || this.findSupplierIdByName( invoice.supplierName ),
      supplierName: invoice.supplierName,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      warehouseId: invoice.warehouseId,
      notes: invoice.notes || '',
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
      items: invoice.items.map( item => ({ ...item }) ),
      paymentStatus: invoice.paymentStatus,
      paymentAccountId: invoice.paymentAccountId,
      paymentAccountName: invoice.paymentAccountName
    };


    this.selectedPaymentAccountId = invoice.paymentStatus === 'Paid' ? String( invoice.paymentAccountId || '' ) : '';
    this.isSupplierDropdownOpen = false;
    this.isPaymentAccountDropdownOpen = false;
    this.showInvoiceForm = true;
    this.loadSuppliers();
    this.loadPaymentAccounts();
  }

  // DELETE INVOICE
  deleteInvoice( invoice: PurchaseInvoice ): void {
    this.popupService.showConfirm( `Are you sure you want to delete invoice "${invoice.invoiceNumber}"? This action cannot be undone.`, 'Delete Purchase Invoice')
      .subscribe(
        ( confirmed ) => {
          if (!confirmed) {
            return;
          }
          this.performDeleteInvoice( invoice );
        }
      );
  }

  // FIND SUPPLIER ID BY NAME
  private findSupplierIdByName( supplierName: string ): string {
    const normalizedName = supplierName .trim() .toLowerCase();
    const supplier = this.suppliers.find( item => item.name .trim() .toLowerCase() === normalizedName );
    return supplier ? String(supplier.id) : '';
  }


  // PERFORM DELETE
  private performDeleteInvoice( invoice: PurchaseInvoice ): void {
    const invoiceDate = new Date( invoice.invoiceDate ).getTime();

    forkJoin({
      products: this.productService.getProducts(),
      orders: this.orderService.getOrders(),
      purchaseReturns: this.returnService.getReturnsByType('purchase')
    })
    .pipe( switchMap(
        ({ products, orders, purchaseReturns }) => {
          const groupedItems = new Map< string, { quantity: number; purchaseCostTotal: number;  }  >();
          // Group duplicate product rows in the invoice.
          for (const item of invoice.items || []) {
            const productId = String( item.productId ?? '' );
            const quantity = Number( item.quantity ?? 0 );
            const purchasePrice = Number( item.purchasePrice );
            if ( !productId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(purchasePrice) || purchasePrice <= 0 ) {
              this.popupService.showAlert( 'This invoice cannot be safely deleted because an item has an invalid quantity or purchase price.', 'warning','Delete Blocked' );
              return EMPTY;
            }
  
            const existing = groupedItems.get(productId) ?? { quantity: 0, purchaseCostTotal: 0 };
            existing.quantity += quantity;
            existing.purchaseCostTotal += quantity * purchasePrice;
            groupedItems.set( productId, existing );
          }
  
          const affectedProductIds = new Set(
            groupedItems.keys()
          );
  
          // Block deletion if an affected product
          // has a completed sale on or after the invoice date.
          const hasSaleAfterInvoice = (orders || []).some(order => {
              if (
                order.status !== 'Completed' || !Array.isArray(order.items)
              ) {
                return false;
              }
  
              const orderDate = new Date( order.createdAt ).getTime();
              const containsAffectedProduct = order.items.some( item => affectedProductIds.has( String(item.productId) ));
              if (!containsAffectedProduct) {
                return false;
              }
  
              // If dates are invalid, block conservatively.
              return (
                !Number.isFinite(invoiceDate) || !Number.isFinite(orderDate) || orderDate >= invoiceDate );
            });
  
          if (hasSaleAfterInvoice) {
            this.popupService.showAlert( 'This invoice cannot be safely deleted because a product on it has a completed sale on or after the invoice date.', 'warning', 'Delete Blocked');
            return EMPTY;
          }
  
          // A completed purchase return changes stock history.
          // Without a complete stock-movement ledger, do not
          // reverse the weighted average automatically.
          const hasCompletedPurchaseReturn =
            (purchaseReturns || []).some(
              transaction => transaction.type === 'purchase' && transaction.status === 'completed' && (transaction.items || []).some( item => affectedProductIds.has( String(item.productId)) )
            );
  
          if (hasCompletedPurchaseReturn) {
            this.popupService.showAlert(
              'This invoice cannot be safely deleted because a product on it has a completed purchase return.', 'warning', 'Delete Blocked'
            );
            return EMPTY;
          }
  
          const plannedUpdates: Product[] = [];
          let validationError = '';
  
          // Calculate all stock and cost changes first.
          // Do not send updates until every item is validated.
          for (
            const [productId, summary] of groupedItems ) {
            const product = products.find( item => String(item.id) === productId );
            if (!product) {
              validationError = `Product ${productId} was not found.`;
              break;
            }
  
            const currentStock = Number(
              product.stock ?? 0
            );
  
            const currentCostPrice = Number(
              product.costPrice ?? 0
            );
  
            if (
              !Number.isFinite(currentStock) || currentStock < summary.quantity
            ) {
  
              validationError = `There is not enough stock to safely delete the invoice for "${product.name}".`;
              break;
            }
  
            const remainingStock = currentStock - summary.quantity;
            let nextCostPrice = product.costPrice;

            if (remainingStock > 0) {
              if (
                !Number.isFinite(currentCostPrice) ||  currentCostPrice <= 0
              ) {
  
                validationError = `The current cost price for "${product.name}" is missing or invalid.`;
                break;
              }
  
              // Reverse the deleted purchase's contribution
              // to the current weighted-average inventory value.
              const remainingInventoryValue = currentStock * currentCostPrice - summary.purchaseCostTotal;
              if ( !Number.isFinite( remainingInventoryValue ) || remainingInventoryValue <= 0 ) {
                validationError = `The previous average cost for "${product.name}" cannot be calculated reliably.`;
                break;
              }
  
              nextCostPrice = Number( ( remainingInventoryValue / remainingStock ).toFixed(6) );
            }

            plannedUpdates.push({ ...product, stock: remainingStock, costPrice: nextCostPrice });
          }
  
          if (validationError) { this.popupService.showAlert( validationError, 'warning', 'Delete Blocked' );
            return EMPTY;
          }
  
          const updates: Observable<Product>[] = plannedUpdates.map( product => this.productService.updateProduct( product.id, product ) );
          return updates.length > 0 ? forkJoin(updates) : of([]);
        }
      )
    )
    .subscribe({ next: () => {
      // Delete the invoice only after stock updates succeed.
        this.purchaseInvoiceService
          .deletePurchaseInvoice(invoice.id)
          .subscribe({ next: () => {
              this.invoices = this.invoices.filter( item => String(item.id) !==  String(invoice.id));
              this.trySyncSupplierBalances();
              this.loadProducts();
              this.popupService.showAlert(
                `Invoice "${invoice.invoiceNumber}" was deleted and inventory stock and average cost were updated successfully.`,'success','Invoice Deleted'
              );
              this.cdr.markForCheck();
            },
            error: (error: unknown) => {
              console.error( 'Failed to delete purchase invoice:', error );
              this.popupService.showAlert(
                'Inventory was updated, but the purchase invoice could not be deleted. Please check the inventory before retrying.','error', 'Delete Failed'
              );
            }
          });
      },
  
      error: (error: unknown) => {
        console.error( 'Failed to reverse inventory stock:', error
        );
  
        this.popupService.showAlert(
          'The purchase invoice was not deleted because inventory could not be updated.','error', 'Inventory Update Failed'
        );
      }
    });
  }

  // FILTER INVOICES
  get filteredInvoices():
    PurchaseInvoice[] {

    const searchTerm = this.invoiceSearchTerm .trim() .toLowerCase();
    const selectedDate = this.invoiceDateFilter;
    return this.invoices.filter( (invoice) => {
        const matchesSearch = searchTerm === '' || 
          invoice.invoiceNumber .toLowerCase() .includes(searchTerm) ||
          invoice.supplierName .toLowerCase() .includes(searchTerm) ||
          invoice.items.some((item) =>
              item.productName .toLowerCase() .includes(searchTerm) ||
              item.sku .toLowerCase() .includes(searchTerm)
          );

        const matchesDate = selectedDate === '' || this.normalizeInvoiceDate( invoice.invoiceDate ) === selectedDate;
        return ( matchesSearch && matchesDate );
      }
    );
  }

  // NORMALIZE INVOICE DATE
  private normalizeInvoiceDate( date: string ): string {
    if (!date) {
      return '';
    }
    return new Date(date) .toISOString().split('T')[0];
  }

  // CLEAR INVOICE FILTERS
  clearInvoiceFilters(): void {
    this.invoiceSearchTerm = '';
    this.invoiceDateFilter = '';
    this.cdr.markForCheck();
  }

  private subtotalValue(invoice: { subtotal?: number; }): number {
    return Number(invoice.subtotal) || 0;
  }

// EXPORT PURCHASE INVOICES — PRINT-FRIENDLY DESIGN
async exportInvoices(): Promise<void> {
  const invoices = this.filteredInvoices;

  if (!invoices || invoices.length === 0) {
    this.popupService.showAlert(
      'There are no invoices to export.', 'warning', 'Nothing to Export'
    );
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Moasher POS & Inventory';
    workbook.title = 'Purchase Invoices';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Purchase Invoices');
    const currency = this.currencySymbol || 'EGP';
    const moneyFormat = '#,##0.00';
    const colors = {
      navy: 'FFE0E0E0',
      blue: 'FFCCCCCC',
      paleBlue: 'FFE5E5E5',
      alternate: 'FFF0F0F0',
      green: 'FFD6D6D6',
      white: 'FFFFFFFF',
      text: 'FF000000',
      border: 'FF666666'
    };

    const border = {
      top: { style: 'thin' as const, color: { argb: colors.border } },
      left: { style: 'thin' as const, color: { argb: colors.border } },
      bottom: { style: 'thin' as const, color: { argb: colors.border } },
      right: { style: 'thin' as const, color: { argb: colors.border } }
    };

    // Seven wide, readable columns: A:G.
    sheet.columns = [
      { width: 12 }, // A: item number / information label
      { width: 18 }, // B: product name
      { width: 18 }, // C: product name continuation
      { width: 12 }, // D: quantity
      { width: 17 }, // E: purchase price / date label
      { width: 14 }, // F: item tax
      { width: 18 }  // G: item total
    ];

    sheet.properties.defaultRowHeight = 25;
    sheet.views = [{
      state: 'normal',
      zoomScale: 90,
      showGridLines: false
    }];

    sheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: false,
      scale: 90,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2
      }
    };
    sheet.headerFooter.oddFooter = '&LMoasher POS & Inventory&CPage &P of &N';

    // HELPER: STYLE A CELL OR MERGED RANGE
    const putCell = (
      rowNumber: number,
      startColumn: number,
      endColumn: number,
      value: unknown,
      options: {
        fill?: string;
        bold?: boolean;
        color?: string;
        size?: number;
        align?: 'left' | 'center' | 'right';
      } = {}
    ): void => {
      if (endColumn > startColumn) {
        sheet.mergeCells(
          rowNumber,
          startColumn,
          rowNumber,
          endColumn
        );
      }

      const fill = options.fill ?? colors.white;
      const fontColor = colors.text;
      const alignment = options.align ?? 'left';

      for (
        let column = startColumn;
        column <= endColumn;
        column++
      ) {
        const cell = sheet.getCell(rowNumber, column);

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fill }
        };

        cell.border = border;
        cell.font = {
          name: 'Arial',
          size: options.size ?? 10,
          bold: options.bold ?? false,
          color: { argb: fontColor }
        };

        cell.alignment = {
          horizontal: alignment,
          vertical: 'middle',
          wrapText: false,
          shrinkToFit: true
        };
      }

      sheet.getCell(rowNumber, startColumn).value = value == null ? '' : value as ExcelJS.CellValue;
    };

    const addGap = (height = 12): void => {
      const row = sheet.addRow([]);
      row.height = height;
    };

    // REPORT TITLE
    const titleRow = sheet.addRow([]);
    const titleNumber = titleRow.number;

    putCell(
      titleNumber, 1, 7,
      'PURCHASE INVOICES',
      {
        fill: 'FFB8B8B8',
        bold: true,
        color: colors.text,
        size: 18,
        align: 'center'
      }
    );

    titleRow.height = 42;
    const subtitleRow = sheet.addRow([]);
    const subtitleNumber = subtitleRow.number;

    putCell(
      subtitleNumber, 1, 7,
      `Moasher POS & Inventory | Currency: ${currency} | ` + `Generated: ${new Date().toLocaleDateString()}`,
      {
        color: 'FF68778A',
        align: 'center'
      }
    );

    subtitleRow.height = 28;
    addGap(16);

    // ONE COMPLETE BLOCK PER INVOICE
    invoices.forEach((invoice, invoiceIndex) => {
      const items = invoice.items || [];

      // Invoice title.
      const bannerRow = sheet.addRow([]);
      const bannerNumber = bannerRow.number;
      
      // Start every new invoice on a fresh printed page.
      if (invoiceIndex > 0) {
        bannerRow.addPageBreak();
      }
      putCell( bannerNumber, 1, 7,`MOASHER POS & INVENTORY  |  PURCHASE INVOICE: ` + `${invoice.invoiceNumber || 'N/A'}  |  ID: ${invoice.id ?? 'N/A'}`,
        {
          fill: colors.white,
          bold: true,
          color: colors.white,
          size: 14
        }
      );

      bannerRow.height = 38;

      // Supplier and date.
      const supplierRow = sheet.addRow([]);
      const supplierNumber = supplierRow.number;

      putCell(supplierNumber, 1, 1, 'SUPPLIER', {
        fill: colors.paleBlue,
        bold: true,
        color: colors.navy
      });

      putCell(
        supplierNumber, 2, 4,
        invoice.supplierName || ''
      );

      putCell(supplierNumber, 5, 5, 'DATE', {
        fill: colors.paleBlue,
        bold: true,
        color: colors.navy
      });

      putCell(
        supplierNumber, 6, 7,
        invoice.invoiceDate || ''
      );
      supplierRow.height = 30;

      // Warehouse and payment status.
      const statusRow = sheet.addRow([]);
      const statusNumber = statusRow.number;

      putCell(statusNumber, 1, 1, 'WAREHOUSE', {
        fill: colors.paleBlue,
        bold: true,
        color: colors.navy
      });

      putCell(
        statusNumber, 2, 4,
        invoice.warehouseId || ''
      );

      putCell(statusNumber, 5, 5, 'PAYMENT', {
        fill: colors.paleBlue,
        bold: true,
        color: colors.navy
      });

      putCell(
        statusNumber, 6, 7,
        invoice.paymentStatus || ''
      );
      statusRow.height = 30;

      // Item count and payment account.
      const accountRow = sheet.addRow([]);
      const accountNumber = accountRow.number;

      putCell(accountNumber, 1, 1, 'ITEMS', {
        fill: colors.paleBlue,
        bold: true,
        color: colors.navy
      });

      putCell(
        accountNumber, 2, 4,
        items.length
      );

      putCell(accountNumber, 5, 5, 'ACCOUNT', {
        fill: colors.paleBlue,
        bold: true,
        color: colors.navy
      });

      putCell(
        accountNumber, 6, 7,
        invoice.paymentAccountName || ''
      );
      accountRow.height = 30;

      // Notes, only if present.
      if (invoice.notes?.trim()) {
        const notesRow = sheet.addRow([]);
        const notesNumber = notesRow.number;

        putCell(notesNumber, 1, 1, 'NOTES', {
          fill: colors.paleBlue,
          bold: true,
          color: colors.navy
        });

        putCell( notesNumber, 2, 7, invoice.notes );
        notesRow.height = 30;
      }
      addGap(10);

      // Item table header.
      const headersRow = sheet.addRow([]);
      const headersNumber = headersRow.number;

      putCell(headersNumber, 1, 1, '#', {
        fill: colors.blue,
        bold: true,
        color: colors.white,
        align: 'center'
      });

      putCell(headersNumber, 2, 3, 'PRODUCT NAME', {
        fill: colors.blue,
        bold: true,
        color: colors.white,
        align: 'left'
      });

      putCell(headersNumber, 4, 4, 'QUANTITY', {
        fill: colors.blue,
        bold: true,
        color: colors.white,
        align: 'center'
      });

      putCell(
        headersNumber, 5, 5,
        `PURCHASE PRICE (${currency})`,
        {
          fill: colors.blue,
          bold: true,
          color: colors.white,
          align: 'center'
        }
      );

      putCell(
        headersNumber, 6, 6,
        `ITEM TAX (${currency})`,
        {
          fill: colors.blue,
          bold: true,
          color: colors.white,
          align: 'center'
        }
      );

      putCell(
        headersNumber, 7, 7,
        `ITEM TOTAL (${currency})`,
        {
          fill: colors.blue,
          bold: true,
          color: colors.white,
          align: 'center'
        }
      );

      headersRow.height = 34;
      const itemsToWrite = items.length > 0 ? items : [null];
      itemsToWrite.forEach((item, itemIndex) => {
        const row = sheet.addRow([]);
        const r = row.number;
        const fill = itemIndex % 2 === 0 ? colors.white : colors.alternate;

        putCell(
          r, 1, 1,
          item ? itemIndex + 1 : '',
          { fill, align: 'center' }
        );

        putCell(
          r, 2, 3,
          item?.productName ??
            (items.length === 0 ? 'No items recorded' : ''),
          { fill }
        );

        putCell(
          r, 4, 4,
          item?.quantity ?? '',
          { fill, align: 'center' }
        );

        putCell(
          r, 5, 5,
          item?.purchasePrice ?? '',
          { fill, align: 'right' }
        );

        putCell(
          r, 6, 6,
          item?.taxAmount ?? '',
          { fill, align: 'right' }
        );

        putCell(
          r, 7, 7,
          item?.total ?? '',
          { fill, align: 'right' }
        );

        [5, 6, 7].forEach(column => {
          const cell = sheet.getCell(r, column);
          if (typeof cell.value === 'number') {
            cell.numFmt = moneyFormat;
          }
        });
        row.height = 29;
      });
      addGap(10);

      // Totals beneath the items.
      const totals = [
        {
          label: 'SUBTOTAL',
          value: Number(invoice.subtotal) || 0,
          fill: colors.paleBlue,
          color: colors.navy
        },
        {
          label: 'TAX TOTAL',
          value: Number(invoice.taxTotal) || 0,
          fill: colors.paleBlue,
          color: colors.navy
        },
        {
          label: 'INVOICE TOTAL',
          value: Number(invoice.total) || 0,
          fill: colors.green,
          color: colors.text
        }
      ];

      totals.forEach((total, index) => {
        const row = sheet.addRow([]);
        const r = row.number;
        const finalTotal = index === 2;

        putCell(r, 1, 5, total.label, {
          fill: total.fill,
          bold: true,
          color: total.color,
          size: finalTotal ? 12 : 10,
          align: 'right'
        });

        putCell(r, 6, 7, total.value, {
          fill: total.fill,
          bold: true,
          color: total.color,
          size: finalTotal ? 13 : 10,
          align: 'right'
        });

        sheet.getCell(r, 6).numFmt = moneyFormat;
        row.height = finalTotal ? 34 : 28;
      });
    });

    // DOWNLOAD EXCEL FILE
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob( [buffer as BlobPart], { type:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchase-invoices-${this.getTodayDate()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => { URL.revokeObjectURL(url); }, 1000);

  } catch (error) {
    console.error( 'Purchase invoices export failed:', error
    );
    this.popupService.showAlert( 'Unable to export purchase invoices. Please try again.', 'warning', 'Export Failed'
    );
  }
}

  // PROFIT
  getItemProfit( item: PurchaseInvoiceItem ): number {
    return (
      item.sellingPrice - item.purchasePrice ) * item.quantity;
  }

  getInvoiceProfit(): number {
    return this.newInvoice.items .reduce( ( total, item ) => total + this.getItemProfit( item ), 0 );
  }

  // ID
  private generateId(): string {
    return (
      Date.now().toString() + Math.random() .toString(36) .substring(2, 8)
    );
  }

  // CLOSE PRODUCT / SUPPLIER / PAYMENT RESULTS
  @HostListener(
    'document:click',
    ['$event']
  )
  onDocumentClick( event: MouseEvent ): void {
    const target = event.target as HTMLElement;
    if (
      !target.closest( '.product-search')
    ) {
      this.showProductResults = false;
    }

    if (
      !target.closest( '.supplier-dropdown' )
    ) {
      this.isSupplierDropdownOpen = false;
    }

    if (
      !target.closest( '.payment-account-dropdown' )
    ) {
      this.isPaymentAccountDropdownOpen = false;
    }
  }
}