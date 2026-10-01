import {
  Component,
  OnInit,
  inject,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';

import {
  CommonModule,
  DecimalPipe
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  forkJoin,
  Observable,
  of
} from 'rxjs';

import {
  CustomerService
} from '../../core/services/customer.service';

import {
  Customer as CustomerModel
} from '../../core/models/customer.model';

import {
  CustomerTransactionService
} from '../../core/services/customer-transaction.service';

import {
  CustomerTransaction
} from '../../core/models/customer-transaction.model';

import {
  PurchaseInvoiceService
} from '../../core/services/purchase-invoice.service';

import {
  PurchaseInvoice,
  PurchaseInvoicePaymentStatus
} from '../../core/models/purchase-invoice.model';

import {
  ReturnService
} from '../../core/services/return.service';

import {
  ReturnTransaction
} from '../../core/models/return.model';

import {
  OrderService
} from '../../core/services/order.service';

import {
  ProductService
} from '../../core/services/product.service';

import {
  Product
} from '../../core/models/product.model';

// =========================================================
// SALES ORDER RECORD
//
// Accounts only needs the fields required to build the
// customer statement. The existing POS order model may
// contain additional fields that are irrelevant here.
// =========================================================

interface SalesOrderRecord {

  id?: string;

  ticketNumber?: string;

  customerId?: string;

  customerName?: string;

  paymentStatus?: 'Paid' | 'OnAccount';

  paymentAccountId?: string;

  paymentAccountName?: string;

  status?: string;

  createdAt?: string;

  total?: number;

  items?: {

    productId?: string;

    productName?: string;

    name?: string;

    sku?: string;

    quantity?: number;

    price?: number;

    unitPrice?: number;

    total?: number;

  }[];

}


// =========================================================
// CUSTOMER ACCOUNT ITEM
// =========================================================

interface CustomerAccountItem {

  productId?: string;

  productName: string;

  sku?: string;

  quantity: number;

  unitPrice?: number;

  total?: number;

}


// =========================================================
// CUSTOMER ACCOUNT TRANSACTION
// =========================================================

type CustomerAccountTransactionType =
  | 'Sale'
  | 'CustomerCollection'
  | 'SaleReturn';

interface CustomerAccountTransaction {

  id: string;

  type: CustomerAccountTransactionType;

  referenceNumber: string;

  createdAt: string;

  amount: number;

  customerName: string;

  paymentStatus?: 'Paid' | 'OnAccount';

  paymentAccountId?: string;

  paymentAccountName?: string;

  items: CustomerAccountItem[];

}


// =========================================================
// SUPPLIER ACCOUNT TRANSACTION
// =========================================================

interface SupplierAccountTransaction {

  id: string;

  type:
    | 'PurchaseInvoice'
    | 'PurchaseReturn';

  referenceNumber: string;

  createdAt: string;

  amount: number;

  supplierName: string;

  paymentStatus?: PurchaseInvoicePaymentStatus;

  paymentAccountName?: string;

  items: {

    productId?: string;

    productName: string;

    sku?: string;

    quantity: number;

    unitPrice?: number;

    total?: number;

  }[];

}


@Component({
  selector: 'app-accounts',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    DecimalPipe
  ],

  templateUrl: './accounts.html',

  styleUrl: './accounts.css'
})
export class Accounts implements OnInit {


  // =========================================================
  // SERVICES
  // =========================================================

  private readonly customerService =
    inject(CustomerService);

  private readonly customerTransactionService =
    inject(CustomerTransactionService);

  private readonly purchaseInvoiceService =
    inject(PurchaseInvoiceService);

  private readonly returnService =
    inject(ReturnService);

  private readonly orderService =
    inject(OrderService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly productService = inject(ProductService);
  // =========================================================
  // ACCOUNT TYPE
  // =========================================================

  accountType:
    'customer' | 'supplier' =
    'customer';

  isAccountDropdownOpen = false;


  // =========================================================
  // ACCOUNT SELECTION MODAL
  // =========================================================

  isAccountModalOpen = false;

  accountSearchTerm = '';


  // =========================================================
  // CUSTOMER DATA
  // =========================================================

  customers: CustomerModel[] = [];

  selectedCustomer:
    CustomerModel | null = null;

  selectedCustomerId:
    string | null = null;


  // =========================================================
  // SUPPLIER DATA
  // =========================================================

  selectedSupplier: {
    id: string;
    name: string;
  } | null = null;

  selectedSupplierId:
    string | null = null;

  suppliers: {
    id: string;
    name: string;
  }[] = [];

  products: Product[] = [];

  purchaseInvoices:
    PurchaseInvoice[] = [];

  purchaseReturns:
    ReturnTransaction[] = [];

  supplierTransactions:
    SupplierAccountTransaction[] = [];

  supplierDisplayedTransactions:
    SupplierAccountTransaction[] = [];

  supplierOpeningBalance = 0;

  supplierCurrentBalance = 0;

  supplierTotalDebit = 0;

  supplierTotalCredit = 0;

  private supplierRunningBalances =
    new Map<string, number>();


  // =========================================================
  // CUSTOMER ACCOUNT DATA
  // =========================================================

  transactions:
    CustomerAccountTransaction[] = [];

  allTransactions:
    CustomerAccountTransaction[] = [];

  currentBalance = 0;

  totalDebit = 0;

  totalCredit = 0;

  openingBalance = 0;

  private runningBalances =
    new Map<string, number>();


  // =========================================================
  // GENERAL STATE
  // =========================================================

  loading = false;

  errorMessage = '';


  // =========================================================
  // DATE FILTER
  // =========================================================

  fromDate = '';

  toDate = '';


  // =========================================================
  // TRANSACTION DETAILS
  // =========================================================

  expandedTransactionId:
    string | null = null;


  // =========================================================
  // CURRENT PAYMENT ACCOUNT NAMES
  //
  // Orders currently persist the payment account ID.
  // Keep a fallback map so old Paid orders can still show
  // the account name in the statement. If an order already
  // contains paymentAccountName, that value always wins.
  // =========================================================

  private readonly paymentAccountNames:
    Record<string, string> = {
      '1': 'Cash Drawer',
      '2': 'Visa POS',
      '3': 'InstaPay',
      '4': 'Vodafone Cash',
      '5': 'Orange Cash',
      '6': 'Etisalat Cash',
      '7': 'Fawry'
    };


  // =========================================================
  // FILTERED CUSTOMERS
  // =========================================================

  get filteredCustomers(): CustomerModel[] {

    const search =
      this.accountSearchTerm
        .trim()
        .toLowerCase();

    if (!search) {
      return this.customers;
    }

    return this.customers.filter(
      customer =>
        customer.name
          ?.toLowerCase()
          .includes(search) ||
        customer.phone
          ?.toLowerCase()
          .includes(search)
    );

  }


  // =========================================================
  // FILTERED SUPPLIERS
  // =========================================================

  get filteredSuppliers(): {
    id: string;
    name: string;
  }[] {

    const search =
      this.accountSearchTerm
        .trim()
        .toLowerCase();

    if (!search) {
      return this.suppliers;
    }

    return this.suppliers.filter(
      supplier =>
        supplier.name
          ?.toLowerCase()
          .includes(search)
    );

  }


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadCustomers();
  
    this.loadSuppliers();
  
    this.loadProducts();
  
  }


  // =========================================================
  // LOAD CUSTOMERS
  // =========================================================

  loadCustomers(): void {

    this.customerService
      .getCustomers()
      .subscribe({

        next: customers => {

          this.customers =
            customers || [];

          this.loading = false;

          this.cdr.detectChanges();

        },

        error: () => {

          this.errorMessage =
            'Failed to load customers.';

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }


  // =========================================================
  // LOAD SUPPLIERS
  // =========================================================

  loadSuppliers(): void {

    this.purchaseInvoiceService
      .getPurchaseInvoices()
      .subscribe({

        next: invoices => {

          this.purchaseInvoices =
            [
              ...(invoices || [])
            ];

          const supplierMap =
            new Map<string, string>();

          for (
            const invoice of
            this.purchaseInvoices
          ) {

            const name =
              invoice.supplierName?.trim();

            if (!name) {
              continue;
            }

            const key =
              name.toLowerCase();

            if (!supplierMap.has(key)) {

              supplierMap.set(
                key,
                name
              );

            }

          }

          this.suppliers =
            Array.from(
              supplierMap.entries()
            ).map(([id, name]) => ({
              id,
              name
            }));

          this.returnService
            .getReturnsByType('purchase')
            .subscribe({

              next: returns => {

                this.purchaseReturns =
                  returns || [];

                this.cdr.detectChanges();

              },

              error: () => {

                this.errorMessage =
                  'Failed to load purchase returns.';

                this.cdr.detectChanges();

              }

            });

        },

        error: () => {

          this.errorMessage =
            'Failed to load purchase invoices.';

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }

  // =========================================================
// LOAD PRODUCTS
// USED TO RESOLVE CURRENT INVENTORY PRODUCT IMAGES
// =========================================================

loadProducts(): void {

  this.productService
    .getProducts()
    .subscribe({

      next: products => {

        this.products =
          products || [];

        this.cdr.detectChanges();

      },

      error: () => {

        this.products = [];

      }

    });

}

  // =========================================================
  // TOGGLE ACCOUNT TYPE DROPDOWN
  // =========================================================

  toggleAccountDropdown(): void {

    this.isAccountDropdownOpen =
      !this.isAccountDropdownOpen;

  }


  // =========================================================
  // SELECT ACCOUNT TYPE
  // =========================================================

  selectAccountType(
    type:
      'customer' | 'supplier'
  ): void {

    this.accountType = type;

    this.isAccountDropdownOpen = false;

    this.accountSearchTerm = '';

    this.clearSelectedAccount();

    this.isAccountModalOpen = true;

  }


  // =========================================================
  // OPEN ACCOUNT MODAL
  // =========================================================

  openAccountModal(): void {

    this.accountSearchTerm = '';

    this.isAccountModalOpen = true;

  }


  // =========================================================
  // CLOSE ACCOUNT MODAL
  // =========================================================

  closeAccountModal(): void {

    this.isAccountModalOpen = false;

    this.accountSearchTerm = '';

  }


  // =========================================================
  // SELECT CUSTOMER FROM MODAL
  // =========================================================

  selectCustomerFromModal(
    customer: CustomerModel
  ): void {

    this.accountType = 'customer';

    this.selectedCustomer =
      customer;

    this.selectedCustomerId =
      String(customer.id);

    this.selectedSupplier = null;

    this.selectedSupplierId = null;

    this.fromDate = '';

    this.toDate = '';

    this.expandedTransactionId =
      null;

    this.currentBalance =
      Number(
        customer.balance || 0
      );

    this.closeAccountModal();

    this.loadTransactions(
      customer
    );

  }


  // =========================================================
  // SELECT SUPPLIER FROM MODAL
  // =========================================================

  selectSupplierFromModal(
    supplier: {
      id: string;
      name: string;
    }
  ): void {

    this.accountType = 'supplier';

    this.selectedSupplier =
      supplier;

    this.selectedSupplierId =
      String(supplier.id);

    this.selectedCustomer = null;

    this.selectedCustomerId = null;

    this.fromDate = '';

    this.toDate = '';

    this.expandedTransactionId =
      null;

    this.closeAccountModal();

    this.loadSupplierTransactions(
      supplier
    );

  }


  // =========================================================
  // CLEAR SELECTED ACCOUNT
  // =========================================================

  private clearSelectedAccount(): void {

    this.selectedCustomer = null;
    this.selectedCustomerId = null;

    this.selectedSupplier = null;
    this.selectedSupplierId = null;

    this.transactions = [];
    this.allTransactions = [];

    this.supplierTransactions = [];
    this.supplierDisplayedTransactions = [];

    this.currentBalance = 0;
    this.openingBalance = 0;

    this.supplierCurrentBalance = 0;
    this.supplierOpeningBalance = 0;

    this.totalDebit = 0;
    this.totalCredit = 0;

    this.supplierTotalDebit = 0;
    this.supplierTotalCredit = 0;

    this.runningBalances.clear();
    this.supplierRunningBalances.clear();

    this.fromDate = '';
    this.toDate = '';

    this.expandedTransactionId = null;

  }


  // =========================================================
  // CLOSE ACCOUNT DROPDOWN ON OUTSIDE CLICK
  // =========================================================

  @HostListener(
    'document:click',
    ['$event']
  )
  onDocumentClick(
    event: MouseEvent
  ): void {

    const target =
      event.target as Element | null;

    if (
      !target ||
      !target.closest('.account-type-dropdown')
    ) {

      this.isAccountDropdownOpen = false;

    }

  }


  // =========================================================
  // LOAD CUSTOMER TRANSACTIONS
  //
  // Sources:
  // 1. CustomerTransactionService -> On Account Sale
  // 2. CustomerTransactionService -> Customer Collection
  // 3. OrderService -> Paid sales
  // 4. ReturnService -> Sale returns
  // =========================================================

  loadTransactions(
    customer: CustomerModel
  ): void {

    this.loading = true;

    this.errorMessage = '';

    this.customerTransactionService
      .getCustomerTransactions(
        customer.id
      )
      .pipe()
      .subscribe({

        next: customerTransactions => {

          forkJoin({

            orders:
              this.loadOrderRecords(),

            saleReturns:
              this.returnService
                .getReturnsByType('sale')

          }).subscribe({

            next: ({
              orders,
              saleReturns
            }) => {

              const accountTransactions =
                this.buildCustomerAccountTransactions(
                  customer,
                  customerTransactions || [],
                  orders || [],
                  saleReturns || []
                );

              this.allTransactions =
                this.sortCustomerTransactions(
                  accountTransactions
                );

              this.transactions =
                [
                  ...this.allTransactions
                ];

              this.currentBalance =
                Number(
                  customer.balance || 0
                );

              this.calculateStatementBalances();

              this.loading = false;

              this.cdr.detectChanges();

            },

            error: () => {

              this.errorMessage =
                'Failed to load customer account transactions.';

              this.loading = false;

              this.cdr.detectChanges();

            }

          });

        },

        error: () => {

          this.errorMessage =
            'Failed to load customer transactions.';

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }


  // =========================================================
  // LOAD ORDERS THROUGH EXISTING ORDER SERVICE
  //
  // Supports the current `getOrders()` API and also keeps
  // compatibility with a possible `getAllOrders()` naming
  // already used by the project.
  // =========================================================

  private loadOrderRecords():
    Observable<SalesOrderRecord[]> {

    const service =
      this.orderService as unknown as {

        getOrders?: () => Observable<unknown>;

        getAllOrders?: () => Observable<unknown>;

      };

    if (service.getOrders) {

      return service.getOrders()
        .pipe(
          // The Accounts mapping narrows the exact fields it needs.
          // The existing OrderService remains the source of truth.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (source: Observable<unknown>) => source
        ) as Observable<SalesOrderRecord[]>;

    }

    if (service.getAllOrders) {

      return service.getAllOrders()
        .pipe(
          (source: Observable<unknown>) => source
        ) as Observable<SalesOrderRecord[]>;

    }

    return of([]);

  }


  // =========================================================
  // BUILD CUSTOMER ACCOUNT TRANSACTIONS
  // =========================================================

  private buildCustomerAccountTransactions(
    customer: CustomerModel,
    customerTransactions: CustomerTransaction[],
    orders: SalesOrderRecord[],
    saleReturns: ReturnTransaction[]
  ): CustomerAccountTransaction[] {

    const result:
      CustomerAccountTransaction[] = [];


    // -------------------------------------------------------
    // ON ACCOUNT SALES + CUSTOMER COLLECTIONS
    // -------------------------------------------------------

    for (
      const transaction of
      customerTransactions
    ) {

      if (
        transaction.type ===
        'OnAccountSale'
      ) {

        result.push({

          id:
            `customer-sale-${transaction.id}`,

          type:
            'Sale',

          referenceNumber:
            transaction.referenceNumber ||
            transaction.referenceId ||
            transaction.id,

          createdAt:
            transaction.createdAt,

          amount:
            Number(
              transaction.amount || 0
            ),

          customerName:
            customer.name,

          paymentStatus:
            'OnAccount',

          items:
            (transaction.items || []).map(item => ({
              productId:
                item.productId,
              productName:
                item.productName,
              quantity:
                Number(item.quantity || 0),
              unitPrice:
                Number(item.unitPrice || 0),
              total:
                Number(item.total || 0)
            }))

        });

        continue;
      }

      if (
        transaction.type ===
        'CustomerCollection'
      ) {

        result.push({

          id:
            `customer-collection-${transaction.id}`,

          type:
            'CustomerCollection',

          referenceNumber:
            transaction.referenceNumber ||
            transaction.referenceId ||
            transaction.id,

          createdAt:
            transaction.createdAt,

          amount:
            Number(
              transaction.amount || 0
            ),

          customerName:
            customer.name,

          paymentAccountId:
            transaction.paymentAccountId,

          paymentAccountName:
            transaction.paymentAccountName,

          items: []

        });

      }

    }


    // -------------------------------------------------------
    // PAID SALES FROM ORDERS
    //
    // On Account orders are intentionally ignored here
    // because those already exist in customerTransactions.
    // -------------------------------------------------------

    for (
      const order of
      orders
    ) {

      const orderCustomerId =
        order.customerId;

      if (
        !orderCustomerId ||
        String(orderCustomerId) !==
        String(customer.id)
      ) {
        continue;
      }

      if (
        order.paymentStatus !==
        'Paid'
      ) {
        continue;
      }

      if (
        order.status &&
        order.status.toLowerCase() !==
        'completed'
      ) {
        continue;
      }

      const createdAt =
        order.createdAt;

      if (!createdAt) {
        continue;
      }

      result.push({

        id:
          `paid-sale-${order.id || order.ticketNumber || createdAt}`,

        type:
          'Sale',

        referenceNumber:
          order.ticketNumber ||
          order.id ||
          '—',

        createdAt,

        amount:
          Number(
            order.total || 0
          ),

        customerName:
          customer.name,

        paymentStatus:
          'Paid',

        paymentAccountId:
          order.paymentAccountId,

        paymentAccountName:
          order.paymentAccountName ||
          this.getPaymentAccountNameById(
            order.paymentAccountId
          ),

        items:
          (order.items || []).map(item => ({

            productId:
              item.productId,

            productName:
              item.productName ||
              item.name ||
              'Product',

            sku:
              item.sku,

            quantity:
              Number(
                item.quantity || 0
              ),

            unitPrice:
              Number(
                item.unitPrice ??
                item.price ??
                0
              ),

            total:
              Number(
                item.total || 0
              )

          }))

      });

    }


    // -------------------------------------------------------
    // SALE RETURNS
    //
    // Returns store the order reference, not the customer ID.
    // Resolve the referenced order and then make sure the
    // order belongs to the selected customer.
    // -------------------------------------------------------

    for (
      const returnTransaction of
      saleReturns
    ) {

      if (
        returnTransaction.status !==
        'completed'
      ) {
        continue;
      }

      const order =
        orders.find(
          candidate =>
            String(candidate.id) ===
            String(returnTransaction.referenceId)
        ) ||
        orders.find(
          candidate =>
            String(candidate.ticketNumber) ===
            String(returnTransaction.referenceId)
        );

      if (!order) {
        continue;
      }

      if (
        String(order.customerId) !==
        String(customer.id)
      ) {
        continue;
      }

      result.push({

        id:
          `sale-return-${returnTransaction.id}`,

        type:
          'SaleReturn',

        referenceNumber:
          returnTransaction.referenceNumber ||
          returnTransaction.referenceId,

        createdAt:
          returnTransaction.createdAt,

        amount:
          Number(
            returnTransaction.total || 0
          ),

        customerName:
          customer.name,

          items:
          (returnTransaction.items || [])
            .map(item => ({
        
              productId:
                item.productId,
        
              productName:
                item.productName,
        
              sku:
                item.sku,
        
              quantity:
                Number(
                  item.quantity || 0
                ),
        
              unitPrice:
                Number(
                  item.unitPrice || 0
                ),
        
              total:
                Number(
                  item.total || 0
                )
        
            }))

      });

    }


    return result;

  }


  // =========================================================
  // PAYMENT ACCOUNT NAME FALLBACK
  // =========================================================

  getPaymentAccountNameById(
    paymentAccountId?: string
  ): string {

    if (!paymentAccountId) {
      return '';
    }

    return (
      this.paymentAccountNames[
        String(paymentAccountId)
      ] ||
      `Account ${paymentAccountId}`
    );

  }


  // =========================================================
  // SORT CUSTOMER TRANSACTIONS
  // OLDEST -> NEWEST
  // =========================================================

  sortCustomerTransactions(
    transactions:
      CustomerAccountTransaction[]
  ): CustomerAccountTransaction[] {

    return [
      ...transactions
    ].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    );

  }


  // =========================================================
  // CUSTOMER TRANSACTION LABEL
  // =========================================================

  getCustomerTransactionLabel(
    transaction:
      CustomerAccountTransaction
  ): string {

    switch (transaction.type) {

      case 'Sale':
        return 'Sale';

      case 'CustomerCollection':
        return 'Customer Collection';

      case 'SaleReturn':
        return 'Sale Return';

      default:
        return 'Transaction';

    }

  }


  // =========================================================
  // CUSTOMER TRANSACTION DEBIT
  // =========================================================

  getCustomerTransactionDebit(
    transaction:
      CustomerAccountTransaction
  ): number {

    /*
     * Paid sales are visible in the statement but they are
     * already settled. Therefore they must not increase debt.
     */
    if (
      transaction.type === 'Sale' &&
      transaction.paymentStatus === 'Paid'
    ) {
      return 0;
    }

    if (
      transaction.type === 'Sale' &&
      transaction.paymentStatus === 'OnAccount'
    ) {
      return Number(
        transaction.amount || 0
      );
    }

    return 0;

  }


  // =========================================================
  // CUSTOMER TRANSACTION CREDIT
  // =========================================================

  getCustomerTransactionCredit(
    transaction:
      CustomerAccountTransaction
  ): number {

    if (
      transaction.type === 'CustomerCollection' ||
      transaction.type === 'SaleReturn'
    ) {
      return Number(
        transaction.amount || 0
      );
    }

    return 0;

  }


  // =========================================================
  // CUSTOMER STATEMENT BALANCES
  // =========================================================

  calculateStatementBalances(): void {

    this.totalDebit = 0;
    this.totalCredit = 0;

    this.runningBalances.clear();


    for (
      const transaction of
      this.transactions
    ) {

      this.totalDebit +=
        this.getCustomerTransactionDebit(
          transaction
        );

      this.totalCredit +=
        this.getCustomerTransactionCredit(
          transaction
        );

    }


    this.totalDebit =
      Number(
        this.totalDebit.toFixed(2)
      );

    this.totalCredit =
      Number(
        this.totalCredit.toFixed(2)
      );


    if (
      this.transactions.length === 0
    ) {

      this.openingBalance =
        this.currentBalance;

      return;

    }


    const firstDisplayedTransaction =
      this.transactions[0];

    const firstDisplayedTime =
      new Date(
        firstDisplayedTransaction.createdAt
      ).getTime();


    let futureDebit = 0;
    let futureCredit = 0;


    for (
      const transaction of
      this.allTransactions
    ) {

      const transactionTime =
        new Date(
          transaction.createdAt
        ).getTime();

      if (
        transactionTime >=
        firstDisplayedTime
      ) {

        futureDebit +=
          this.getCustomerTransactionDebit(
            transaction
          );

        futureCredit +=
          this.getCustomerTransactionCredit(
            transaction
          );

      }

    }


    this.openingBalance =
      Number(
        (
          this.currentBalance -
          futureDebit +
          futureCredit
        ).toFixed(2)
      );


    let runningBalance =
      this.openingBalance;


    for (
      const transaction of
      this.transactions
    ) {

      const debit =
        this.getCustomerTransactionDebit(
          transaction
        );

      const credit =
        this.getCustomerTransactionCredit(
          transaction
        );

      runningBalance =
        Number(
          (
            runningBalance +
            debit -
            credit
          ).toFixed(2)
        );

      this.runningBalances.set(
        transaction.id,
        runningBalance
      );

    }

  }


  // =========================================================
  // CUSTOMER RUNNING BALANCE
  // =========================================================

  getRunningBalance(
    transaction:
      CustomerAccountTransaction
  ): number {

    return (
      this.runningBalances.get(
        transaction.id
      ) ??
      this.openingBalance
    );

  }


  // =========================================================
  // CUSTOMER DATE FILTER
  // =========================================================

  filterByDate(): void {

    let filtered = [
      ...this.allTransactions
    ];


    if (this.fromDate) {

      filtered =
        filtered.filter(
          transaction =>
            transaction.createdAt.substring(
              0,
              10
            ) >= this.fromDate
        );

    }


    if (this.toDate) {

      filtered =
        filtered.filter(
          transaction =>
            transaction.createdAt.substring(
              0,
              10
            ) <= this.toDate
        );

    }


    this.transactions =
      this.sortCustomerTransactions(
        filtered
      );

    this.expandedTransactionId =
      null;

    this.calculateStatementBalances();

    this.cdr.detectChanges();

  }


  // =========================================================
  // CLEAR CUSTOMER FROM DATE
  // =========================================================

  clearFromDate(): void {

    this.fromDate = '';

    this.filterByDate();

  }


  // =========================================================
  // CLEAR CUSTOMER TO DATE
  // =========================================================

  clearToDate(): void {

    this.toDate = '';

    this.filterByDate();

  }


  // =========================================================
  // CLEAR DATE FILTER
  // =========================================================

  clearDateFilter(): void {

    this.fromDate = '';
    this.toDate = '';

    if (
      this.accountType === 'customer'
    ) {

      this.transactions =
        [
          ...this.allTransactions
        ];

      this.calculateStatementBalances();

    } else {

      this.supplierDisplayedTransactions =
        [
          ...this.supplierTransactions
        ];

      this.calculateSupplierStatementBalances();

    }

    this.expandedTransactionId =
      null;

    this.cdr.detectChanges();

  }


  // =========================================================
  // TOGGLE CUSTOMER TRANSACTION DETAILS
  // =========================================================

  toggleTransaction(
    transaction:
      CustomerAccountTransaction
  ): void {

    if (
      this.expandedTransactionId ===
      transaction.id
    ) {

      this.expandedTransactionId =
        null;

      return;

    }

    this.expandedTransactionId =
      transaction.id;

  }


  // =========================================================
  // IS CUSTOMER TRANSACTION EXPANDED
  // =========================================================

  isTransactionExpanded(
    transaction:
      CustomerAccountTransaction
  ): boolean {

    return (
      this.expandedTransactionId ===
      transaction.id
    );

  }


  // =========================================================
  // HAS CUSTOMER TRANSACTION ITEMS
  // =========================================================

  hasTransactionItems(
    transaction:
      CustomerAccountTransaction
  ): boolean {

    return (
      transaction.items.length > 0
    );

  }


  // =========================================================
  // LOAD SUPPLIER TRANSACTIONS
  // =========================================================

  loadSupplierTransactions(
    supplier: {
      id: string;
      name: string;
    }
  ): void {

    this.loading = true;

    this.errorMessage = '';

    const supplierName =
      supplier.name
        .trim()
        .toLowerCase();


    const invoiceTransactions:
      SupplierAccountTransaction[] =

      this.purchaseInvoices
        .filter(invoice =>
          invoice.supplierName
            ?.trim()
            .toLowerCase() ===
          supplierName
        )
        .map(invoice => ({

          id:
            String(invoice.id),

          type:
            'PurchaseInvoice',

          referenceNumber:
            invoice.invoiceNumber,

          createdAt:
            invoice.invoiceDate,

          amount:
            Number(invoice.total || 0),

          supplierName:
            invoice.supplierName,

          paymentStatus:
            invoice.paymentStatus,

          paymentAccountName:
            invoice.paymentAccountName,

            items:
            (invoice.items || [])
              .map(item => ({
          
                productId:
                  item.productId,
          
                productName:
                  item.productName,
          
                sku:
                  item.sku,
          
                quantity:
                  Number(
                    item.quantity || 0
                  ),
          
                unitPrice:
                  Number(
                    item.purchasePrice || 0
                  ),
          
                total:
                  Number(
                    item.total || 0
                  )
          
              }))

        }));


    const returnTransactions:
      SupplierAccountTransaction[] =

      this.purchaseReturns
        .filter(returnTransaction => {

          const invoice =
            this.purchaseInvoices.find(
              item =>
                String(item.id) ===
                String(
                  returnTransaction.referenceId
                )
            );

          return (
            invoice?.supplierName
              ?.trim()
              .toLowerCase() ===
            supplierName
          );

        })
        .map(returnTransaction => ({

          id:
            String(
              returnTransaction.id
            ),

          type:
            'PurchaseReturn',

          referenceNumber:
            returnTransaction.referenceNumber,

          createdAt:
            returnTransaction.createdAt,

          amount:
            Number(
              returnTransaction.total || 0
            ),

          supplierName:
            supplier.name,

            items:
            (returnTransaction.items || [])
              .map(item => ({
          
                productId:
                  item.productId,
          
                productName:
                  item.productName,
          
                sku:
                  item.sku,
          
                quantity:
                  Number(
                    item.quantity || 0
                  ),
          
                unitPrice:
                  Number(
                    item.unitPrice || 0
                  ),
          
                total:
                  Number(
                    item.total || 0
                  )
          
              }))

        }));


    this.supplierTransactions =
      [
        ...invoiceTransactions,
        ...returnTransactions
      ].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
      );


    this.supplierDisplayedTransactions =
      [
        ...this.supplierTransactions
      ];


    this.supplierCurrentBalance =
      this.supplierTransactions.reduce(
        (balance, transaction) =>
          balance +
          this.getSupplierTransactionDebit(
            transaction
          ) -
          this.getSupplierTransactionCredit(
            transaction
          ),
        0
      );

    this.supplierCurrentBalance =
      Number(
        this.supplierCurrentBalance.toFixed(2)
      );

    this.calculateSupplierStatementBalances();

    this.loading = false;

    this.cdr.detectChanges();

  }


  // =========================================================
  // SUPPLIER DEBIT
  // =========================================================

  getSupplierTransactionDebit(
    transaction:
      SupplierAccountTransaction
  ): number {

    if (
      transaction.type !==
      'PurchaseInvoice'
    ) {
      return 0;
    }

    if (
      transaction.paymentStatus ===
      'Paid'
    ) {
      return 0;
    }

    return Number(
      transaction.amount || 0
    );

  }


  // =========================================================
  // SUPPLIER CREDIT
  // =========================================================

  getSupplierTransactionCredit(
    transaction:
      SupplierAccountTransaction
  ): number {

    return (
      transaction.type ===
      'PurchaseReturn'
    )
      ? Number(
          transaction.amount || 0
        )
      : 0;

  }


  // =========================================================
  // SUPPLIER STATEMENT BALANCES
  // =========================================================

  calculateSupplierStatementBalances(): void {

    this.supplierTotalDebit = 0;
    this.supplierTotalCredit = 0;

    this.supplierRunningBalances.clear();


    for (
      const transaction of
      this.supplierDisplayedTransactions
    ) {

      this.supplierTotalDebit +=
        this.getSupplierTransactionDebit(
          transaction
        );

      this.supplierTotalCredit +=
        this.getSupplierTransactionCredit(
          transaction
        );

    }


    this.supplierTotalDebit =
      Number(
        this.supplierTotalDebit.toFixed(2)
      );

    this.supplierTotalCredit =
      Number(
        this.supplierTotalCredit.toFixed(2)
      );


    if (
      this.supplierDisplayedTransactions.length === 0
    ) {

      this.supplierOpeningBalance =
        this.supplierCurrentBalance;

      return;

    }


    const firstDisplayedTransaction =
      this.supplierDisplayedTransactions[0];

    const firstDisplayedTime =
      new Date(
        firstDisplayedTransaction.createdAt
      ).getTime();


    let futureDebit = 0;
    let futureCredit = 0;


    for (
      const transaction of
      this.supplierTransactions
    ) {

      const transactionTime =
        new Date(
          transaction.createdAt
        ).getTime();

      if (
        transactionTime >=
        firstDisplayedTime
      ) {

        futureDebit +=
          this.getSupplierTransactionDebit(
            transaction
          );

        futureCredit +=
          this.getSupplierTransactionCredit(
            transaction
          );

      }

    }


    this.supplierOpeningBalance =
      Number(
        (
          this.supplierCurrentBalance -
          futureDebit +
          futureCredit
        ).toFixed(2)
      );


    let runningBalance =
      this.supplierOpeningBalance;

    for (
      const transaction of
      this.supplierDisplayedTransactions
    ) {

      const debit =
        this.getSupplierTransactionDebit(
          transaction
        );

      const credit =
        this.getSupplierTransactionCredit(
          transaction
        );

      runningBalance =
        Number(
          (
            runningBalance +
            debit -
            credit
          ).toFixed(2)
        );

      this.supplierRunningBalances.set(
        transaction.id,
        runningBalance
      );

    }

  }


  // =========================================================
  // SUPPLIER RUNNING BALANCE
  // =========================================================

  getSupplierRunningBalance(
    transaction:
      SupplierAccountTransaction
  ): number {

    return (
      this.supplierRunningBalances.get(
        transaction.id
      ) ??
      this.supplierOpeningBalance
    );

  }


  // =========================================================
  // SUPPLIER DATE FILTER
  // =========================================================

  filterSupplierByDate(): void {

    let filtered = [
      ...this.supplierTransactions
    ];


    if (this.fromDate) {

      filtered =
        filtered.filter(
          transaction =>
            transaction.createdAt.substring(
              0,
              10
            ) >= this.fromDate
        );

    }


    if (this.toDate) {

      filtered =
        filtered.filter(
          transaction =>
            transaction.createdAt.substring(
              0,
              10
            ) <= this.toDate
        );

    }


    this.supplierDisplayedTransactions =
      this.sortSupplierTransactions(
        filtered
      );

    this.expandedTransactionId =
      null;

    this.calculateSupplierStatementBalances();

    this.cdr.detectChanges();

  }


  // =========================================================
  // SORT SUPPLIER TRANSACTIONS
  // =========================================================

  sortSupplierTransactions(
    transactions:
      SupplierAccountTransaction[]
  ):
    SupplierAccountTransaction[] {

    return [
      ...transactions
    ].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    );

  }


  // =========================================================
  // CLEAR SUPPLIER FROM DATE
  // =========================================================

  clearSupplierFromDate(): void {

    this.fromDate = '';

    this.filterSupplierByDate();

  }


  // =========================================================
  // CLEAR SUPPLIER TO DATE
  // =========================================================

  clearSupplierToDate(): void {

    this.toDate = '';

    this.filterSupplierByDate();

  }


  // =========================================================
  // CUSTOMER TRANSACTION HELPERS FOR TEMPLATE
  // =========================================================

  getTransactionItems(
    transaction:
      CustomerAccountTransaction
  ): CustomerAccountItem[] {

    return transaction.items || [];

  }


  getCustomerPaymentAccountName(
    transaction:
      CustomerAccountTransaction
  ): string {

    return (
      transaction.paymentAccountName ||
      this.getPaymentAccountNameById(
        transaction.paymentAccountId
      ) ||
      'Payment Account'
    );

  }

// =========================================================
// GET PRODUCT IMAGE FROM INVENTORY
// =========================================================

getProductImage(
  productId?: string
): string {

  if (!productId) {
    return '';
  }

  const product =
    this.products.find(
      item =>
        String(item.id) ===
        String(productId)
    );

  return product?.image || '';

}

  // =========================================================
  // CHECK SELECTED CUSTOMER / SUPPLIER
  // =========================================================

  isCustomerSelected(
    customerId: CustomerModel['id']
  ): boolean {

    return (
      String(customerId) ===
      String(this.selectedCustomerId)
    );

  }


  isSupplierSelected(
    supplierId: string
  ): boolean {

    return (
      String(supplierId) ===
      String(this.selectedSupplierId)
    );

  }

}
