import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnInit,
  inject
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import { DecimalPipe } from '@angular/common';

import {
  forkJoin,
  Observable,
  of,
  switchMap
} from 'rxjs';

import { ProductService }
  from '../../core/services/product.service';

import { Product }
  from '../../core/models/product.model';

import { CategoryService }
  from '../../core/services/category.service';

import { Category }
  from '../../core/models/category.model';

import { StoreSettingsService }
  from '../../core/services/store-settings.service';

import { PurchaseInvoiceService }
  from '../../core/services/purchase-invoice.service';

import {
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchaseInvoicePaymentStatus
} from '../../core/models/purchase-invoice.model';

import { SupplierService }
  from '../../core/services/supplier.service';

import {
  Supplier as SupplierModel
} from '../../core/models/supplier.model';

import { SupplierTransactionService }
  from '../../core/services/supplier-transaction.service';

import {
  SupplierTransaction
} from '../../core/models/supplier-transaction.model';

import { PopupService }
  from '../../core/services/popup.service';

import { ReturnService }
  from '../../core/services/return.service';

import {
  ReturnTransaction
} from '../../core/models/return.model';

import { PaymentAccount }
  from '../../core/models/payment-account.model';

import { PaymentAccountService }
  from '../../core/services/payment-account.service';


@Component({
  selector: 'app-purchase-invoices',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe
  ],
  templateUrl: './purchase-invoices.html',
  styleUrl: './purchase-invoices.css'
})


export class PurchaseInvoices
  implements OnInit {


  // =========================================================
  // SERVICES
  // =========================================================

  private readonly productService =
    inject(ProductService);

  private readonly categoryService =
    inject(CategoryService);

  private readonly purchaseInvoiceService =
    inject(PurchaseInvoiceService);

  private readonly supplierService =
    inject(SupplierService);

  private readonly supplierTransactionService =
    inject(SupplierTransactionService);

  private readonly paymentAccountService =
    inject(PaymentAccountService);

  private readonly popupService =
    inject(PopupService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly storeSettingsService =
    inject(StoreSettingsService);

  private readonly returnService =
    inject(ReturnService);


  // =========================================================
  // DATA
  // =========================================================

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


  // =========================================================
  // PURCHASE RETURNS
  // =========================================================

  purchaseReturns: ReturnTransaction[] = [];


  // =========================================================
  // STORE SETTINGS / CURRENCY
  // =========================================================

  currency = 'EGP';

  currencySymbol = 'EGP';


  // =========================================================
  // SEARCH / FILTERS
  // =========================================================

  searchTerm = '';

  invoiceSearchTerm = '';

  invoiceDateFilter = '';


  // =========================================================
  // MODAL
  // =========================================================

  showInvoiceForm = false;

  editingInvoiceId: string | null = null;


  // =========================================================
  // PRODUCT SEARCH
  // =========================================================

  productSearchTerm = '';

  productSearchResults: Product[] = [];

  showProductResults = false;


  // =========================================================
  // QUICK ADD PRODUCT
  // =========================================================

  showQuickAddProduct = false;

  categories: Category[] = [];

  quickProduct: Product =
    this.createEmptyQuickProduct();


  // =========================================================
  // FORM
  // =========================================================

  newInvoice: PurchaseInvoice =
    this.createEmptyInvoice();


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadInvoices();

    this.loadProducts();

    this.loadCategories();

    this.loadStoreSettings();

    this.loadPurchaseReturns();

    this.loadPaymentAccounts();

  }


  // =========================================================
  // LOAD STORE SETTINGS
  // =========================================================

  private loadStoreSettings(): void {

    this.storeSettingsService
      .getOrLoadSettings()
      .subscribe({

        next: (settings) => {

          if (!settings) {
            return;
          }


          this.currency =
            settings.currency;


          this.currencySymbol =
            this.storeSettingsService
              .getCurrencySymbol(
                settings.currency
              );


          this.cdr.markForCheck();

        },


        error: (error: unknown) => {

          console.error(
            'Failed to load store settings:',
            error
          );

        }

      });

  }


  // =========================================================
  // LOAD INVOICES
  // =========================================================

  loadInvoices(): void {

    this.purchaseInvoiceService
      .getPurchaseInvoices()
      .subscribe({

        next: (invoices) => {

          this.invoices =
            [...(invoices || [])].sort(
              (a, b) =>
                new Date(
                  b.invoiceDate
                ).getTime() -
                new Date(
                  a.invoiceDate
                ).getTime()
            );


          this.invoicesLoaded =
            true;


          this.cdr.markForCheck();


          this.trySyncSupplierBalances();

        },


        error: (error) => {

          console.error(
            'Error loading purchase invoices:',
            error
          );

        }

      });

  }


  // =========================================================
  // LOAD SUPPLIERS
  // REGISTERED SUPPLIERS + HISTORICAL SUPPLIERS
  // =========================================================

  loadSuppliers(): void {

    this.supplierService
      .getSuppliers()
      .subscribe({

        next: (suppliers) => {

          const collator =
            new Intl.Collator(
              'ar',
              {
                sensitivity: 'base',
                numeric: true
              }
            );


          this.suppliers =
            [...(suppliers || [])].sort(
              (a, b) =>
                collator.compare(
                  a.name.trim(),
                  b.name.trim()
                )
            );


          this.suppliersLoaded =
            true;


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


  // =========================================================
  // LOAD ACTIVE PAYMENT ACCOUNTS
  // =========================================================

  loadPaymentAccounts(): void {

    this.paymentAccountService
      .getActivePaymentAccounts()
      .subscribe({

        next: (accounts) => {

          this.paymentAccounts =
            [...(accounts || [])];


          /*
           * Only new Paid invoices get
           * an automatic default account.
           *
           * During Edit we keep the
           * original payment account.
           */

          if (
            !this.editingInvoiceId &&
            this.newInvoice.paymentStatus ===
              'Paid' &&
            !this.selectedPaymentAccountId &&
            this.paymentAccounts.length > 0
          ) {

            this.selectedPaymentAccountId =
              String(
                this.paymentAccounts[0].id
              );

          }


          this.cdr.markForCheck();

        },


        error: (error: unknown) => {

          console.error(
            'Failed to load payment accounts:',
            error
          );


          this.popupService.showAlert(
            'Failed to load payment accounts.',
            'error',
            'Payment Accounts Error'
          );

        }

      });

  }


  // =========================================================
  // PAYMENT ACCOUNT DROPDOWN
  // =========================================================

  togglePaymentAccountDropdown(): void {

    /*
     * Payment account is not editable
     * when editing an existing invoice.
     */

    if (this.editingInvoiceId) {
      return;
    }


    this.isPaymentAccountDropdownOpen =
      !this.isPaymentAccountDropdownOpen;

  }


  selectPaymentAccount(
    account: PaymentAccount
  ): void {

    /*
     * Payment account belongs only
     * to the creation/payment flow.
     */

    if (this.editingInvoiceId) {
      return;
    }


    this.selectedPaymentAccountId =
      String(account.id);


    this.isPaymentAccountDropdownOpen =
      false;


    this.cdr.markForCheck();

  }


  isSelectedPaymentAccount(
    account: PaymentAccount
  ): boolean {

    return (
      String(account.id) ===
      String(this.selectedPaymentAccountId)
    );

  }


  getSelectedPaymentAccountLabel(): string {

    if (
      !this.selectedPaymentAccountId
    ) {

      return 'Select payment account';

    }


    const account =
      this.paymentAccounts.find(
        item =>
          String(item.id) ===
          String(
            this.selectedPaymentAccountId
          )
      );


    return (
      account?.name ||
      'Select payment account'
    );

  }


  // =========================================================
  // PAYMENT STATUS
  // =========================================================

  onPaymentStatusChange(
    status: PurchaseInvoicePaymentStatus
  ): void {

    /*
     * Payment status cannot be changed
     * while editing an existing invoice.
     */

    if (this.editingInvoiceId) {
      return;
    }


    this.newInvoice.paymentStatus =
      status;


    /*
     * On Account:
     * no payment account is used.
     */

    if (
      status === 'OnAccount'
    ) {

      this.selectedPaymentAccountId =
        '';

      this.isPaymentAccountDropdownOpen =
        false;

      return;

    }


    /*
     * Paid:
     * select first active account
     * when nothing is selected.
     */

    if (
      status === 'Paid' &&
      !this.selectedPaymentAccountId &&
      this.paymentAccounts.length > 0
    ) {

      this.selectedPaymentAccountId =
        String(
          this.paymentAccounts[0].id
        );

    }

  }


  // =========================================================
  // MIGRATE HISTORICAL SUPPLIERS
  // =========================================================

  private migrateHistoricalSuppliers(): void {

    this.supplierService
      .getSuppliers()
      .subscribe({

        next: (registeredSuppliers) => {

          const currentSuppliers =
            [...(registeredSuppliers || [])];


          this.suppliers =
            currentSuppliers;


          const supplierByName =
            new Map<
              string,
              SupplierModel
            >();


          for (
            const supplier of
            currentSuppliers
          ) {

            const normalizedName =
              supplier.name
                .trim()
                .toLowerCase();


            if (
              normalizedName &&
              !supplierByName.has(
                normalizedName
              )
            ) {

              supplierByName.set(
                normalizedName,
                supplier
              );

            }

          }


          const historicalNames =
            new Map<
              string,
              string
            >();


          for (
            const invoice of
            this.invoices
          ) {

            const supplierName =
              invoice.supplierName?.trim();


            if (!supplierName) {
              continue;
            }


            const normalizedName =
              supplierName
                .toLowerCase();


            if (
              !historicalNames.has(
                normalizedName
              )
            ) {

              historicalNames.set(
                normalizedName,
                supplierName
              );

            }

          }


          const missingSuppliers =
            Array.from(
              historicalNames.entries()
            )
            .filter(
              ([normalizedName]) =>
                !supplierByName.has(
                  normalizedName
                )
            );


          if (
            missingSuppliers.length === 0
          ) {

            this.linkPurchaseInvoicesToSuppliers();

            return;

          }


          const createRequests =
            missingSuppliers.map(
              ([normalizedName, supplierName]) => {

                return this.supplierService
                  .addSupplier({

                    name:
                      supplierName,

                    phone:
                      '',

                    address:
                      undefined,

                    notes:
                      'Created from historical purchase invoices.',

                    balance:
                      0,

                    status:
                      'Active'

                  });

              }
            );


          forkJoin(createRequests)
            .subscribe({

              next: (createdSuppliers) => {

                for (
                  const supplier of
                  createdSuppliers
                ) {

                  const normalizedName =
                    supplier.name
                      .trim()
                      .toLowerCase();


                  supplierByName.set(
                    normalizedName,
                    supplier
                  );

                }


                this.suppliers =
                  Array.from(
                    supplierByName.values()
                  );


                this.cdr.markForCheck();


                this.linkPurchaseInvoicesToSuppliers(
                  supplierByName
                );

              },


              error: (error) => {

                console.error(
                  'Failed to migrate historical suppliers:',
                  error
                );


                this.popupService.showAlert(
                  'Some historical suppliers could not be migrated.',
                  'error',
                  'Supplier Migration Failed'
                );

              }

            });

        },


        error: (error) => {

          console.error(
            'Failed to load suppliers for migration:',
            error
          );

        }

      });

  }


  // =========================================================
  // LINK PURCHASE INVOICES TO SUPPLIER IDS
  // =========================================================

  private linkPurchaseInvoicesToSuppliers(
    supplierMap?: Map<
      string,
      SupplierModel
    >
  ): void {

    const lookup =
      supplierMap ??
      new Map(
        this.suppliers.map(
          supplier => [
            supplier.name
              .trim()
              .toLowerCase(),
            supplier
          ]
        )
      );


    const invoicesToUpdate =
      this.invoices.filter(
        invoice =>
          !invoice.supplierId &&
          !!invoice.supplierName?.trim()
      );


    if (
      invoicesToUpdate.length === 0
    ) {

      return;

    }


    const updateRequests =
      invoicesToUpdate
        .map(invoice => {

          const normalizedName =
            invoice.supplierName
              .trim()
              .toLowerCase();


          const supplier =
            lookup.get(
              normalizedName
            );


          if (!supplier) {

            console.warn(
              `No supplier record found for invoice ${invoice.id} (${invoice.supplierName}).`
            );


            return null;

          }


          const updatedInvoice:
            PurchaseInvoice = {

            ...invoice,

            supplierId:
              String(supplier.id)

          };


          return this.purchaseInvoiceService
            .updatePurchaseInvoice(
              invoice.id,
              updatedInvoice
            );

        })
        .filter(
          (
            request
          ): request is
            Observable<PurchaseInvoice> =>
            request !== null
        );


    if (
      updateRequests.length === 0
    ) {

      return;

    }


    forkJoin(updateRequests)
      .subscribe({

        next: (updatedInvoices) => {

          const updatedMap =
            new Map(
              updatedInvoices.map(
                invoice => [
                  String(invoice.id),
                  invoice
                ]
              )
            );


          this.invoices =
            this.invoices.map(
              invoice =>
                updatedMap.get(
                  String(invoice.id)
                ) ??
                invoice
            );


          this.trySyncSupplierBalances();


          this.cdr.markForCheck();


          console.log(
            `Supplier migration completed. ${updatedInvoices.length} purchase invoice(s) linked.`
          );

        },


        error: (error) => {

          console.error(
            'Failed to link purchase invoices to suppliers:',
            error
          );


          this.popupService.showAlert(
            'Suppliers were created, but some purchase invoices could not be linked.',
            'error',
            'Invoice Linking Failed'
          );

        }

      });

  }


  // =========================================================
  // SUPPLIER DROPDOWN
  // =========================================================

  isSupplierDropdownOpen = false;


  toggleSupplierDropdown(): void {

    /*
     * Supplier is treated as part of
     * the invoice/account relationship,
     * so it cannot be changed during Edit.
     */

    if (this.editingInvoiceId) {
      return;
    }


    this.isSupplierDropdownOpen =
      !this.isSupplierDropdownOpen;

  }


  selectSupplier(
    supplier: SupplierModel
  ): void {

    if (this.editingInvoiceId) {
      return;
    }


    this.newInvoice.supplierId =
      String(supplier.id);


    this.newInvoice.supplierName =
      supplier.name;


    this.isSupplierDropdownOpen =
      false;


    this.cdr.markForCheck();

  }


  isSelectedSupplier(
    supplier: SupplierModel
  ): boolean {

    return (
      String(supplier.id) ===
      String(
        this.newInvoice.supplierId
      )
    );

  }


  getSelectedSupplierLabel(): string {

    if (
      !this.newInvoice.supplierId
    ) {

      return 'Select supplier';

    }


    const supplier =
      this.suppliers.find(
        item =>
          String(item.id) ===
          String(
            this.newInvoice.supplierId
          )
      );


    if (supplier) {
      return supplier.name;
    }


    return (
      this.newInvoice.supplierName ||
      'Select supplier'
    );

  }


  onSupplierChange(
    supplierId: string
  ): void {

    if (this.editingInvoiceId) {
      return;
    }


    const supplier =
      this.suppliers.find(
        item =>
          item.id === supplierId
      );


    this.newInvoice.supplierId =
      supplierId;


    this.newInvoice.supplierName =
      supplier?.name || '';

  }


  // =========================================================
  // LOAD PRODUCTS
  // =========================================================

  loadProducts(): void {

    this.productService
      .getProducts()
      .subscribe({

        next: (products) => {

          this.products =
            products;


          this.cdr.markForCheck();

        },


        error: (error: unknown) => {

          console.error(
            'Failed to load products:',
            error
          );


          this.popupService.showAlert(
            'Failed to load products.',
            'error',
            'Loading Error'
          );

        }

      });

  }


  // =========================================================
  // LOAD CATEGORIES
  // =========================================================

  loadCategories(): void {

    this.categoryService
      .getCategories()
      .subscribe({

        next: (categories) => {

          this.categories =
            categories.map(
              category => ({
                ...category,
                id:
                  String(category.id)
              })
            );


          this.cdr.markForCheck();

        },


        error: (error: unknown) => {

          console.error(
            'Failed to load categories:',
            error
          );


          this.popupService.showAlert(
            'Failed to load product categories.',
            'error',
            'Loading Error'
          );

        }

      });

  }


  // =========================================================
  // LOAD PURCHASE RETURNS
  // =========================================================

  loadPurchaseReturns(): void {

    this.returnService
      .getReturnsByType('purchase')
      .subscribe({

        next: (returns) => {

          this.purchaseReturns =
            returns || [];


          this.purchaseReturnsLoaded =
            true;


          this.cdr.markForCheck();


          this.trySyncSupplierBalances();

        },


        error: (error: unknown) => {

          console.error(
            'Failed to load purchase returns:',
            error
          );

        }

      });

  }


  // =========================================================
  // TRY SYNC SUPPLIER BALANCES
  // =========================================================

  private trySyncSupplierBalances(): void {

    if (
      !this.suppliersLoaded ||
      !this.invoicesLoaded ||
      !this.purchaseReturnsLoaded
    ) {

      return;

    }


    this.syncSupplierBalances();

  }


  // =========================================================
  // SYNC SUPPLIER BALANCES
  // =========================================================

  private syncSupplierBalances(): void {

    /*
     * Supplier balance is now treated
     * as the current/opening balance.
     *
     * Purchase invoices update it
     * incrementally according to
     * payment status.
     */

    this.supplierBalanceSyncInProgress =
      false;


    this.cdr.markForCheck();

  }


  // =========================================================
  // CHECK IF THE WHOLE PURCHASE INVOICE
  // WAS RETURNED
  // =========================================================

  isInvoiceFullyReturned(
    invoice: PurchaseInvoice
  ): boolean {

    if (
      !invoice.items ||
      invoice.items.length === 0
    ) {

      return false;

    }


    const completedReturns =
      this.purchaseReturns.filter(
        returnTransaction =>
          returnTransaction.type ===
            'purchase' &&
          returnTransaction.status ===
            'completed' &&
          String(
            returnTransaction.referenceId
          ) ===
            String(invoice.id)
      );


    if (
      completedReturns.length === 0
    ) {

      return false;

    }


    return invoice.items.every(
      (invoiceItem) => {

        const returnedQuantity =
          completedReturns.reduce(
            (
              total,
              returnTransaction
            ) =>
              total +
              (
                returnTransaction.items ||
                []
              )
              .filter(
                returnItem =>
                  String(
                    returnItem.productId
                  ) ===
                  String(
                    invoiceItem.productId
                  )
              )
              .reduce(
                (
                  itemTotal,
                  returnItem
                ) =>
                  itemTotal +
                  Number(
                    returnItem.quantity ||
                    0
                  ),
                0
              ),
            0
          );


        return (
          returnedQuantity >=
          Number(
            invoiceItem.quantity || 0
          )
        );

      }
    );

  }


  // =========================================================
  // OPEN NEW INVOICE
  // =========================================================

  showNewInvoiceForm(): void {

    this.editingInvoiceId =
      null;


    this.newInvoice =
      this.createEmptyInvoice();


    this.selectedPaymentAccountId =
      '';


    this.isPaymentAccountDropdownOpen =
      false;


    this.productSearchTerm =
      '';


    this.productSearchResults =
      [];


    this.showProductResults =
      false;


    this.isSupplierDropdownOpen =
      false;


    this.showInvoiceForm =
      true;


    this.loadSuppliers();

    this.loadPaymentAccounts();

  }


  // =========================================================
  // CANCEL INVOICE
  // =========================================================

  cancelInvoiceForm(): void {

    this.showInvoiceForm =
      false;


    this.editingInvoiceId =
      null;


    this.productSearchTerm =
      '';


    this.productSearchResults =
      [];


    this.showProductResults =
      false;


    this.isSupplierDropdownOpen =
      false;


    this.isPaymentAccountDropdownOpen =
      false;


    this.selectedPaymentAccountId =
      '';


    this.newInvoice =
      this.createEmptyInvoice();

  }


  // =========================================================
  // CREATE EMPTY INVOICE
  // =========================================================

  private createEmptyInvoice():
    PurchaseInvoice {

    return {

      id: '',

      supplierId: '',

      supplierName: '',

      invoiceNumber: '',

      invoiceDate:
        this.getTodayDate(),

      warehouseId: '',

      notes: '',

      subtotal: 0,

      taxTotal: 0,

      total: 0,

      items: [],

      paymentStatus:
        'Paid'

    };

  }


  // =========================================================
  // TODAY DATE
  // =========================================================

  private getTodayDate(): string {

    return new Date()
      .toISOString()
      .split('T')[0];

  }


  // =========================================================
  // PRODUCT SEARCH
  // =========================================================

  searchProducts(
    term: string
  ): void {

    this.productSearchTerm =
      term;


    const normalizedTerm =
      term
        .trim()
        .toLowerCase();


    if (
      normalizedTerm === ''
    ) {

      this.productSearchResults =
        [];

      this.showProductResults =
        false;

      return;

    }


    this.productSearchResults =
      this.products
        .filter(
          (product) => {

            const name =
              product.name
                .toLowerCase();

            const sku =
              product.sku
                .toLowerCase();


            return (
              name.includes(
                normalizedTerm
              ) ||
              sku.includes(
                normalizedTerm
              )
            );

          }
        )
        .slice(0, 8);


    this.showProductResults =
      this.productSearchResults.length >
      0;

  }


  // =========================================================
  // SCAN / ENTER PRODUCT CODE
  // =========================================================

  scanProductByCode(
    code: string
  ): void {

    /*
     * Existing invoice items are immutable
     * during Edit.
     */

    if (this.editingInvoiceId) {
      return;
    }


    const normalizedCode =
      code
        .trim()
        .toLowerCase();


    if (
      normalizedCode === ''
    ) {

      return;

    }


    const product =
      this.products.find(
        item =>
          item.sku
            .trim()
            .toLowerCase() ===
          normalizedCode
      );


    if (product) {

      this.selectProduct(
        product
      );

      return;

    }


    this.popupService.showAlert(
      `No product was found with code "${code}".`,
      'warning',
      'Product Not Found'
    );

  }


  // =========================================================
  // SELECT PRODUCT
  // =========================================================

  selectProduct(
    product: Product
  ): void {

    /*
     * Products/items cannot be changed
     * during Edit.
     */

    if (this.editingInvoiceId) {
      return;
    }


    const existingItem =
      this.newInvoice.items.find(
        item =>
          item.productId ===
          product.id
      );


    if (existingItem) {

      existingItem.quantity += 1;

      this.recalculateInvoice();

      this.clearProductSearch();

      return;

    }


    const item:
      PurchaseInvoiceItem = {

      id:
        this.generateId(),

      productId:
        product.id,

      productName:
        product.name,

      sku:
        product.sku,

      quantity:
        1,

      expiryDate:
        '',

      purchasePrice:
        product.costPrice ?? 0,

      sellingPrice:
        product.price,

      taxRate:
        0,

      taxAmount:
        0,

      subtotal:
        0,

      total:
        0

    };


    this.newInvoice.items = [
      ...this.newInvoice.items,
      item
    ];


    this.recalculateInvoice();


    this.clearProductSearch();

  }


  // =========================================================
  // CLEAR PRODUCT SEARCH
  // =========================================================

  clearProductSearch(): void {

    this.productSearchTerm =
      '';

    this.productSearchResults =
      [];

    this.showProductResults =
      false;

  }


  // =========================================================
  // QUICK ADD PRODUCT
  // =========================================================

  openQuickAddProduct(): void {

    /*
     * Quick adding a product changes
     * the invoice items, so it is disabled
     * during Edit.
     */

    if (this.editingInvoiceId) {
      return;
    }


    this.quickProduct =
      this.createEmptyQuickProduct();


    const searchValue =
      this.productSearchTerm
        .trim();


    if (
      searchValue !== ''
    ) {

      const looksLikeSku =
        /^[A-Za-z0-9_-]+$/
          .test(searchValue);


      if (looksLikeSku) {

        this.quickProduct.sku =
          searchValue;

      } else {

        this.quickProduct.name =
          searchValue;

      }

    }


    this.showProductResults =
      false;


    this.showQuickAddProduct =
      true;


    this.cdr.markForCheck();

  }


  // =========================================================
  // CLOSE QUICK ADD PRODUCT
  // =========================================================

  closeQuickAddProduct(): void {

    this.showQuickAddProduct =
      false;


    this.quickProduct =
      this.createEmptyQuickProduct();


    this.cdr.markForCheck();

  }


  // =========================================================
  // CREATE EMPTY QUICK PRODUCT
  // =========================================================

  private createEmptyQuickProduct():
    Product {

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


  // =========================================================
  // VALIDATE QUICK PRODUCT
  // =========================================================

  isQuickProductValid(): boolean {

    const name =
      this.quickProduct.name
        .trim();


    const sku =
      this.quickProduct.sku
        .trim();


    const categoryId =
      String(
        this.quickProduct.categoryId ||
        ''
      )
      .trim();


    const price =
      Number(
        this.quickProduct.price
      );


    const minStock =
      Number(
        this.quickProduct.minStock
      );


    const maxStock =
      Number(
        this.quickProduct.maxStock
      );


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
      !Number.isFinite(minStock) ||
      minStock < 0
    ) {

      return false;

    }


    if (
      !Number.isFinite(maxStock) ||
      maxStock <= 0
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


  // =========================================================
  // SAVE QUICK PRODUCT
  // =========================================================

  saveQuickProduct(): void {

    if (this.editingInvoiceId) {
      return;
    }


    if (
      !this.isQuickProductValid()
    ) {

      this.popupService.showAlert(
        'Please complete the required product information.',
        'warning',
        'Incomplete Product'
      );

      return;

    }


    const productToSave:
      Product = {

      ...this.quickProduct,

      name:
        this.quickProduct.name
          .trim(),

      sku:
        this.quickProduct.sku
          .trim(),

      categoryId:
        String(
          this.quickProduct.categoryId
        ),

      stock:
        0,

      minStock:
        Number(
          this.quickProduct.minStock ||
          0
        ),

      maxStock:
        Number(
          this.quickProduct.maxStock ||
          0
        ),

      price:
        Number(
          this.quickProduct.price ||
          0
        ),

      image:
        this.quickProduct.image
          ?.trim() ?? '',

      description:
        this.quickProduct.description
          ?.trim() ?? ''

    };


    this.productService
      .createProduct(
        productToSave
      )
      .subscribe({

        next: (
          createdProduct: Product
        ) => {

          const normalizedProduct:
            Product = {

            ...createdProduct,

            id:
              String(
                createdProduct.id
              ),

            categoryId:
              String(
                createdProduct.categoryId
              ),

            stock:
              Number(
                createdProduct.stock ||
                0
              )

          };


          this.products = [
            ...this.products,
            normalizedProduct
          ];


          this.selectProduct(
            normalizedProduct
          );


          this.showQuickAddProduct =
            false;


          this.quickProduct =
            this.createEmptyQuickProduct();


          this.clearProductSearch();


          this.popupService.showAlert(
            'Product added successfully and added to the current purchase invoice.',
            'success',
            'Product Added'
          );


          this.cdr.markForCheck();

        },


        error: (error: unknown) => {

          console.error(
            'Failed to create product:',
            error
          );


          this.popupService.showAlert(
            'Failed to add the product.',
            'error',
            'Add Product Failed'
          );

        }

      });

  }


  // =========================================================
  // REMOVE ITEM
  // =========================================================

  removeInvoiceItem(
    itemId: string
  ): void {

    /*
     * Existing invoice value must not
     * be modified during Edit.
     */

    if (this.editingInvoiceId) {
      return;
    }


    this.newInvoice.items =
      this.newInvoice.items.filter(
        item =>
          item.id !== itemId
      );


    this.recalculateInvoice();

  }


  // =========================================================
  // UPDATE ITEM
  // =========================================================

  updateItem(
    item: PurchaseInvoiceItem
  ): void {

    /*
     * Existing invoice item values are
     * immutable during Edit.
     */

    if (this.editingInvoiceId) {
      return;
    }


    if (
      item.quantity < 1
    ) {

      item.quantity = 1;

    }


    if (
      item.purchasePrice < 0
    ) {

      item.purchasePrice = 0;

    }


    if (
      item.sellingPrice < 0
    ) {

      item.sellingPrice = 0;

    }


    if (
      item.taxRate < 0
    ) {

      item.taxRate = 0;

    }


    this.recalculateInvoice();

  }


  // =========================================================
  // RECALCULATE INVOICE
  // =========================================================

  recalculateInvoice(): void {

    /*
     * Never recalculate an existing invoice
     * during Edit.
     */

    if (this.editingInvoiceId) {
      return;
    }


    let subtotal = 0;

    let taxTotal = 0;


    this.newInvoice.items
      .forEach(
        (item) => {

          item.subtotal =
            item.quantity *
            item.purchasePrice;


          item.taxAmount =
            item.subtotal *
            (
              item.taxRate /
              100
            );


          item.total =
            item.subtotal +
            item.taxAmount;


          subtotal +=
            item.subtotal;


          taxTotal +=
            item.taxAmount;

        }
      );


    this.newInvoice.subtotal =
      subtotal;


    this.newInvoice.taxTotal =
      taxTotal;


    this.newInvoice.total =
      subtotal +
      taxTotal;


    this.cdr.markForCheck();

  }


  // =========================================================
  // UPDATE ONE PRODUCT STOCK
  // =========================================================

  private updateProductStock(
    product: Product,
    quantityDelta: number
  ): Observable<Product> {

    const currentStock =
      Number(
        product.stock ?? 0
      );


    const newStock =
      Math.max(
        0,
        currentStock +
        quantityDelta
      );


    const updatedProduct:
      Product = {

      ...product,

      stock:
        newStock

    };


    return this.productService
      .updateProduct(
        product.id,
        updatedProduct
      );

  }


  // =========================================================
  // ADD PURCHASE QUANTITIES TO STOCK
  // =========================================================

  private addInvoiceStock(
    invoice: PurchaseInvoice
  ): Observable<Product[]> {

    if (
      invoice.items.length === 0
    ) {

      return of([]);

    }


    return this.productService
      .getProducts()
      .pipe(

        switchMap(
          (latestProducts) => {

            const updates:
              Observable<Product>[] =
              [];


            invoice.items.forEach(
              (item) => {

                const product =
                  latestProducts.find(
                    product =>
                      String(
                        product.id
                      ) ===
                      String(
                        item.productId
                      )
                  );


                if (!product) {

                  throw new Error(
                    `Product ${item.productId} was not found while updating stock.`
                  );

                }


                updates.push(
                  this.updateProductStock(
                    product,
                    Number(
                      item.quantity ||
                      0
                    )
                  )
                );

              }
            );


            if (
              updates.length === 0
            ) {

              return of([]);

            }


            return forkJoin(
              updates
            );

          }
        )

      );

  }


  // =========================================================
  // UPDATE STOCK AFTER EDITING INVOICE
  // =========================================================

  private updateStockAfterInvoiceEdit(
    oldInvoice: PurchaseInvoice,
    newInvoice: PurchaseInvoice
  ): Observable<Product[]> {

    /*
     * Kept for backward compatibility with
     * the existing component structure.
     *
     * Edit no longer calls this method because
     * invoice items/value are not editable.
     */

    return of([]);

  }


  // =========================================================
  // SUPPLIER ACCOUNT
  // =========================================================

  private updateSupplierBalance(
    supplierId: string,
    balanceDelta: number
  ): Observable<SupplierModel> {

    return this.supplierService
      .getSupplier(
        String(supplierId)
      )
      .pipe(

        switchMap(
          (supplier) => {

            const updatedSupplier:
              Omit<
                SupplierModel,
                'id'
              > = {

              name:
                supplier.name,

              phone:
                supplier.phone,

              address:
                supplier.address,

              notes:
                supplier.notes,

              balance:
                Math.max(
                  0,
                  Number(
                    supplier.balance ||
                    0
                  ) +
                  Number(
                    balanceDelta ||
                    0
                  )
                ),

              status:
                supplier.status

            };


            return this.supplierService
              .updateSupplier(
                supplier.id,
                updatedSupplier
              );

          }
        )

      );

  }


  // =========================================================
  // CREATE SUPPLIER PURCHASE TRANSACTION
  // =========================================================

  private createSupplierPurchaseTransaction(
    invoice: PurchaseInvoice
  ): Observable<SupplierTransaction> {

    const transaction:
      Omit<
        SupplierTransaction,
        'id'
      > = {

      supplierId:
        String(
          invoice.supplierId
        ),

      supplierName:
        invoice.supplierName,

      type:
        'OnAccountPurchase',

      referenceId:
        String(
          invoice.id
        ),

      referenceNumber:
        invoice.invoiceNumber,

      amount:
        Number(
          invoice.total.toFixed(2)
        ),

      createdAt:
        new Date().toISOString()

    };


    return this.supplierTransactionService
      .addTransaction(
        transaction
      );

  }


  // =========================================================
  // ADD PURCHASE TO SUPPLIER ACCOUNT
  // =========================================================

  private addPurchaseToSupplierAccount(
    invoice: PurchaseInvoice
  ): Observable<SupplierTransaction> {

    const supplierId =
      String(
        invoice.supplierId ||
        ''
      )
      .trim();


    if (!supplierId) {

      throw new Error(
        `Supplier ID is missing for invoice ${invoice.invoiceNumber}.`
      );

    }


    return this.updateSupplierBalance(
      supplierId,
      invoice.total
    )
    .pipe(

      switchMap(
        () =>
          this.createSupplierPurchaseTransaction(
            invoice
          )
      )

    );

  }


  // =========================================================
  // REMOVE PURCHASE FROM SUPPLIER ACCOUNT
  // =========================================================

  private removePurchaseFromSupplierAccount(
    invoice: PurchaseInvoice
  ): Observable<unknown> {

    const supplierId =
      String(
        invoice.supplierId ||
        ''
      )
      .trim();


    if (!supplierId) {

      throw new Error(
        `Supplier ID is missing for invoice ${invoice.invoiceNumber}.`
      );

    }


    return this.updateSupplierBalance(
      supplierId,
      -Number(
        invoice.total ||
        0
      )
    )
    .pipe(

      switchMap(
        () =>
          this.supplierTransactionService
            .getSupplierTransactionsBySupplier(
              supplierId
            )
      ),


      switchMap(
        (transactions) => {

          const invoiceTransaction =
            transactions.find(
              transaction =>
                transaction.type ===
                  'OnAccountPurchase' &&
                String(
                  transaction.referenceId
                ) ===
                  String(
                    invoice.id
                  )
            );


          if (
            !invoiceTransaction
          ) {

            return of(null);

          }


          return this.supplierTransactionService
            .deleteTransaction(
              invoiceTransaction.id
            );

        }
      )

    );

  }


  // =========================================================
  // SAVE INVOICE
  // =========================================================

  saveInvoice(): void {

    if (
      !this.isInvoiceValid()
    ) {

      this.popupService.showAlert(
        'Please complete all required invoice information and add at least one product.',
        'warning',
        'Incomplete Invoice'
      );

      return;

    }


    /*
     * Only NEW invoices are recalculated.
     *
     * Existing invoices keep their original
     * financial values.
     */

    if (!this.editingInvoiceId) {

      this.recalculateInvoice();

    }


    const selectedPaymentAccount =
      this.paymentAccounts.find(
        account =>
          String(account.id) ===
          String(
            this.selectedPaymentAccountId
          )
      );


    const paymentStatus:
      PurchaseInvoicePaymentStatus =
      this.newInvoice.paymentStatus ||
      'Paid';


    const invoiceToSave:
      PurchaseInvoice = {

      ...this.newInvoice,

      supplierId:
        String(
          this.newInvoice.supplierId ||
          ''
        ),

      supplierName:
        this.newInvoice.supplierName
          .trim(),

      invoiceNumber:
        this.newInvoice.invoiceNumber
          .trim(),

      notes:
        this.newInvoice.notes
          ?.trim() ?? '',

      items:
        this.newInvoice.items.map(
          item => ({
            ...item
          })
        ),

      paymentStatus,

      paymentAccountId:
        paymentStatus === 'Paid'
          ? String(
              selectedPaymentAccount?.id ||
              ''
            )
          : undefined,

      paymentAccountName:
        paymentStatus === 'Paid'
          ? selectedPaymentAccount?.name
          : undefined

    };


    // =======================================================
    // UPDATE EXISTING INVOICE
    // =======================================================

    if (
      this.editingInvoiceId
    ) {

      const oldInvoice =
        this.invoices.find(
          invoice =>
            String(invoice.id) ===
            String(
              this.editingInvoiceId
            )
        );


      if (!oldInvoice) {

        this.popupService.showAlert(
          'The original invoice could not be found.',
          'error',
          'Update Failed'
        );

        return;

      }


      /*
       * IMPORTANT:
       *
       * Edit can change ONLY:
       * - Invoice Number
       * - Invoice Date
       * - Warehouse
       * - Notes
       *
       * Everything financial is restored
       * from the original invoice:
       * - Supplier
       * - Items
       * - Subtotal
       * - Tax
       * - Total
       * - Payment Status
       * - Payment Account
       */

      const editedInvoice:
        PurchaseInvoice = {

        ...oldInvoice,

        supplierId:
          oldInvoice.supplierId,

        supplierName:
          oldInvoice.supplierName,

        invoiceNumber:
          this.newInvoice.invoiceNumber
            .trim(),

        invoiceDate:
          this.newInvoice.invoiceDate,

        warehouseId:
          this.newInvoice.warehouseId,

        notes:
          this.newInvoice.notes
            ?.trim() ?? '',

        subtotal:
          oldInvoice.subtotal,

        taxTotal:
          oldInvoice.taxTotal,

        total:
          oldInvoice.total,

        items:
          oldInvoice.items.map(
            item => ({
              ...item
            })
          ),

        paymentStatus:
          oldInvoice.paymentStatus,

        paymentAccountId:
          oldInvoice.paymentAccountId,

        paymentAccountName:
          oldInvoice.paymentAccountName

      };


      this.purchaseInvoiceService
        .updatePurchaseInvoice(
          this.editingInvoiceId,
          editedInvoice
        )
        .subscribe({

          next: (
            updatedInvoice
          ) => {

            /*
             * No stock update.
             *
             * No supplier balance update.
             *
             * No supplier transaction.
             *
             * No payment action.
             */

            this.invoices =
              this.invoices.map(
                invoice =>
                  String(
                    invoice.id
                  ) ===
                  String(
                    updatedInvoice.id
                  )
                    ? updatedInvoice
                    : invoice
              );


            this.cancelInvoiceForm();


            this.popupService.showAlert(
              'Purchase invoice details were updated successfully.',
              'success',
              'Invoice Updated'
            );


            this.cdr.markForCheck();

          },


          error: (
            error: unknown
          ) => {

            console.error(
              'Failed to update purchase invoice:',
              error
            );


            this.popupService.showAlert(
              'Failed to update purchase invoice.',
              'error',
              'Update Failed'
            );

          }

        });


      return;

    }


    // =======================================================
    // CREATE NEW INVOICE
    // =======================================================

    this.purchaseInvoiceService
      .createPurchaseInvoice(
        invoiceToSave
      )
      .subscribe({

        next: (
          createdInvoice
        ) => {

          // ---------------------------------------------------
          // STEP 1:
          // Add purchased quantities to inventory stock.
          // ---------------------------------------------------

          this.addInvoiceStock(
            createdInvoice
          )
          .subscribe({

            next: (
              updatedProducts
            ) => {

              if (
                updatedProducts.length > 0
              ) {

                const updatedMap =
                  new Map(
                    updatedProducts.map(
                      product => [
                        String(
                          product.id
                        ),
                        product
                      ]
                    )
                  );


                this.products =
                  this.products.map(
                    product =>
                      updatedMap.get(
                        String(
                          product.id
                        )
                      ) ??
                      product
                  );

              }


              // ------------------------------------------------
              // STEP 2:
              // Only On Account invoices affect supplier balance.
              // ------------------------------------------------

              if (
                createdInvoice.paymentStatus ===
                'OnAccount'
              ) {

                this.addPurchaseToSupplierAccount(
                  createdInvoice
                )
                .subscribe({

                  next: () => {

                    this.invoices = [
                      createdInvoice,
                      ...this.invoices
                    ];


                    this.loadSuppliers();


                    this.cancelInvoiceForm();


                    this.popupService.showAlert(
                      'Purchase invoice created, inventory updated, and supplier account updated successfully.',
                      'success',
                      'Invoice Created'
                    );


                    this.cdr.markForCheck();

                  },


                  error: (
                    error: unknown
                  ) => {

                    console.error(
                      'Failed to update supplier account after creating invoice:',
                      error
                    );


                    this.invoices = [
                      createdInvoice,
                      ...this.invoices
                    ];


                    this.loadSuppliers();


                    this.cancelInvoiceForm();


                    this.popupService.showAlert(
                      'The purchase invoice and inventory were saved, but the supplier account could not be updated.',
                      'error',
                      'Supplier Account Update Failed'
                    );


                    this.cdr.markForCheck();

                  }

                });


                return;

              }


              // ------------------------------------------------
              // PAID INVOICE
              //
              // No supplier balance update.
              // Payment account is stored on invoice.
              // ------------------------------------------------

              this.invoices = [
                createdInvoice,
                ...this.invoices
              ];


              this.loadSuppliers();


              this.cancelInvoiceForm();


              this.popupService.showAlert(
                'Purchase invoice created and inventory stock updated successfully.',
                'success',
                'Invoice Created'
              );


              this.cdr.markForCheck();

            },


            error: (
              error: unknown
            ) => {

              console.error(
                'Failed to update inventory stock after creating invoice:',
                error
              );


              this.invoices = [
                createdInvoice,
                ...this.invoices
              ];


              this.cancelInvoiceForm();


              this.popupService.showAlert(
                'The purchase invoice was created, but the inventory stock could not be updated.',
                'error',
                'Inventory Update Failed'
              );


              this.cdr.markForCheck();

            }

          });

        },


        error: (
          error: unknown
        ) => {

          console.error(
            'Failed to create purchase invoice:',
            error
          );


          this.popupService.showAlert(
            'Failed to create purchase invoice.',
            'error',
            'Save Failed'
          );

        }

      });

  }


  // =========================================================
  // VALIDATION
  // =========================================================

  isInvoiceValid(): boolean {

    if (
      !this.newInvoice.supplierId ||
      !this.newInvoice.invoiceNumber
        .trim() ||
      !this.newInvoice.invoiceDate
    ) {

      return false;

    }


    /*
     * During Edit we validate only the
     * editable invoice header data.
     *
     * Existing financial data is preserved.
     */

    if (
      this.editingInvoiceId
    ) {

      return true;

    }


    /*
     * New invoice must contain items.
     */

    if (
      this.newInvoice.items.length === 0
    ) {

      return false;

    }


    /*
     * Paid requires an active
     * payment account.
     */

    if (
      this.newInvoice.paymentStatus ===
        'Paid' &&
      !this.selectedPaymentAccountId
    ) {

      return false;

    }


    return this.newInvoice.items.every(
      item =>
        item.productId !== '' &&
        item.quantity > 0 &&
        item.purchasePrice >= 0 &&
        item.sellingPrice >= 0 &&
        item.taxRate >= 0
    );

  }


  // =========================================================
  // EDIT INVOICE
  // =========================================================

  editInvoice(
    invoice: PurchaseInvoice
  ): void {

    this.editingInvoiceId =
      String(invoice.id);


    /*
     * Preserve the invoice exactly as
     * it is stored.
     *
     * No artificial payment status is
     * introduced for legacy invoices.
     */

    this.newInvoice = {

      ...invoice,

      supplierId:
        invoice.supplierId ||
        this.findSupplierIdByName(
          invoice.supplierName
        ),

      supplierName:
        invoice.supplierName,

      invoiceNumber:
        invoice.invoiceNumber,

      invoiceDate:
        invoice.invoiceDate,

      warehouseId:
        invoice.warehouseId,

      notes:
        invoice.notes || '',

      subtotal:
        invoice.subtotal,

      taxTotal:
        invoice.taxTotal,

      total:
        invoice.total,

      items:
        invoice.items.map(
          item => ({
            ...item
          })
        ),

      paymentStatus:
        invoice.paymentStatus,

      paymentAccountId:
        invoice.paymentAccountId,

      paymentAccountName:
        invoice.paymentAccountName

    };


    /*
     * Payment account is displayed only
     * when the existing invoice already
     * has a Paid payment record.
     */

    this.selectedPaymentAccountId =
      invoice.paymentStatus === 'Paid'
        ? String(
            invoice.paymentAccountId ||
            ''
          )
        : '';


    this.isSupplierDropdownOpen =
      false;


    this.isPaymentAccountDropdownOpen =
      false;


    this.showInvoiceForm =
      true;


    this.loadSuppliers();

    this.loadPaymentAccounts();

  }


  // =========================================================
  // DELETE INVOICE
  // =========================================================

  deleteInvoice(
    invoice: PurchaseInvoice
  ): void {

    this.popupService
      .showConfirm(
        `Are you sure you want to delete invoice "${invoice.invoiceNumber}"? This action cannot be undone.`,
        'Delete Purchase Invoice'
      )
      .subscribe(
        (
          confirmed
        ) => {

          if (!confirmed) {
            return;
          }


          this.performDeleteInvoice(
            invoice
          );

        }
      );

  }


  // =========================================================
  // FIND SUPPLIER ID BY NAME
  // =========================================================

  private findSupplierIdByName(
    supplierName: string
  ): string {

    const normalizedName =
      supplierName
        .trim()
        .toLowerCase();


    const supplier =
      this.suppliers.find(
        item =>
          item.name
            .trim()
            .toLowerCase() ===
          normalizedName
      );


    return supplier
      ? String(supplier.id)
      : '';

  }


  // =========================================================
  // PERFORM DELETE
  // =========================================================

  private performDeleteInvoice(
    invoice: PurchaseInvoice
  ): void {

    /*
     * First remove the purchased quantities
     * from Inventory.
     *
     * Then delete the invoice.
     */

    const reverseStockChanges =
      invoice.items.map(
        item => ({
          productId:
            String(
              item.productId
            ),

          quantity:
            Number(
              item.quantity ||
              0
            )

        })
      );


    this.productService
      .getProducts()
      .pipe(

        switchMap(
          (latestProducts) => {

            const updates:
              Observable<Product>[] =
              [];


            reverseStockChanges.forEach(
              (change) => {

                const product =
                  latestProducts.find(
                    item =>
                      String(
                        item.id
                      ) ===
                      change.productId
                  );


                if (!product) {

                  throw new Error(
                    `Product ${change.productId} was not found while reversing invoice stock.`
                  );

                }


                updates.push(
                  this.updateProductStock(
                    product,
                    -change.quantity
                  )
                );

              }
            );


            if (
              updates.length === 0
            ) {

              return of([]);

            }


            return forkJoin(
              updates
            );

          }
        )

      )
      .subscribe({

        next: () => {

          this.purchaseInvoiceService
            .deletePurchaseInvoice(
              invoice.id
            )
            .subscribe({

              next: () => {

                this.invoices =
                  this.invoices.filter(
                    item =>
                      item.id !==
                      invoice.id
                  );


                this.trySyncSupplierBalances();


                this.loadProducts();


                this.popupService.showAlert(
                  `Invoice "${invoice.invoiceNumber}" was deleted and inventory stock was updated successfully.`,
                  'success',
                  'Invoice Deleted'
                );


                this.cdr.markForCheck();

              },


              error: (
                error: unknown
              ) => {

                console.error(
                  'Failed to delete purchase invoice:',
                  error
                );


                this.popupService.showAlert(
                  'Inventory was updated, but the purchase invoice could not be deleted.',
                  'error',
                  'Delete Failed'
                );

              }

            });

        },


        error: (
          error: unknown
        ) => {

          console.error(
            'Failed to reverse inventory stock:',
            error
          );


          this.popupService.showAlert(
            'The purchase invoice was not deleted because the inventory stock could not be updated.',
            'error',
            'Inventory Update Failed'
          );

        }

      });

  }


  // =========================================================
  // FILTER INVOICES
  // =========================================================

  get filteredInvoices():
    PurchaseInvoice[] {

    const searchTerm =
      this.invoiceSearchTerm
        .trim()
        .toLowerCase();


    const selectedDate =
      this.invoiceDateFilter;


    return this.invoices.filter(
      (invoice) => {

        const matchesSearch =
          searchTerm === '' ||
          invoice.invoiceNumber
            .toLowerCase()
            .includes(searchTerm) ||
          invoice.supplierName
            .toLowerCase()
            .includes(searchTerm) ||
          invoice.items.some(
            (item) =>
              item.productName
                .toLowerCase()
                .includes(searchTerm) ||
              item.sku
                .toLowerCase()
                .includes(searchTerm)
          );


        const matchesDate =
          selectedDate === '' ||
          this.normalizeInvoiceDate(
            invoice.invoiceDate
          ) ===
            selectedDate;


        return (
          matchesSearch &&
          matchesDate
        );

      }
    );

  }


  // =========================================================
  // NORMALIZE INVOICE DATE
  // =========================================================

  private normalizeInvoiceDate(
    date: string
  ): string {

    if (!date) {
      return '';
    }


    return new Date(date)
      .toISOString()
      .split('T')[0];

  }


  // =========================================================
  // CLEAR INVOICE FILTERS
  // =========================================================

  clearInvoiceFilters(): void {

    this.invoiceSearchTerm =
      '';

    this.invoiceDateFilter =
      '';


    this.cdr.markForCheck();

  }


  // =========================================================
  // EXPORT INVOICES
  // =========================================================

  exportInvoices(): void {

    const invoicesToExport =
      this.filteredInvoices;


    if (
      invoicesToExport.length === 0
    ) {

      this.popupService.showAlert(
        'There are no invoices to export.',
        'warning',
        'Nothing to Export'
      );


      return;

    }


    const headers = [

      'Invoice',

      'Supplier',

      'Date',

      'Items',

      'Subtotal',

      'Tax',

      'Total'

    ];


    const rows =
      invoicesToExport.map(
        (invoice) => [

          invoice.invoiceNumber,

          invoice.supplierName,

          invoice.invoiceDate,

          invoice.items.length,

          invoice.subtotal,

          invoice.taxTotal,

          invoice.total

        ]
      );


    const csvContent =
      [
        headers,
        ...rows
      ]
      .map(
        row =>
          row
            .map(
              value =>
                `"${String(value)
                  .replace(
                    /"/g,
                    '""'
                  )}"`
            )
            .join(',')
      )
      .join('\n');


    const blob =
      new Blob(
        [
          csvContent
        ],
        {
          type:
            'text/csv;charset=utf-8;'
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        'a'
      );


    link.href =
      url;


    link.download =
      `purchase-invoices-${this.getTodayDate()}.csv`;


    link.click();


    URL.revokeObjectURL(
      url
    );

  }


  // =========================================================
  // PROFIT
  // =========================================================

  getItemProfit(
    item: PurchaseInvoiceItem
  ): number {

    return (
      item.sellingPrice -
      item.purchasePrice
    ) *
    item.quantity;

  }


  getInvoiceProfit(): number {

    return this.newInvoice.items
      .reduce(
        (
          total,
          item
        ) =>
          total +
          this.getItemProfit(
            item
          ),
        0
      );

  }


  // =========================================================
  // ID
  // =========================================================

  private generateId(): string {

    return (
      Date.now().toString() +
      Math.random()
        .toString(36)
        .substring(2, 8)
    );

  }


  // =========================================================
  // CLOSE PRODUCT / SUPPLIER / PAYMENT RESULTS
  // =========================================================

  @HostListener(
    'document:click',
    ['$event']
  )
  onDocumentClick(
    event: MouseEvent
  ): void {

    const target =
      event.target as HTMLElement;


    if (
      !target.closest(
        '.product-search'
      )
    ) {

      this.showProductResults =
        false;

    }


    if (
      !target.closest(
        '.supplier-dropdown'
      )
    ) {

      this.isSupplierDropdownOpen =
        false;

    }


    if (
      !target.closest(
        '.payment-account-dropdown'
      )
    ) {

      this.isPaymentAccountDropdownOpen =
        false;

    }

  }

}