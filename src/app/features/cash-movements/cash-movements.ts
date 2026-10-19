import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { CashMovement, CashAccountType, CashMovementType, CashMovementReason, CashMovementReferenceType, CASH_DRAWER_ACCOUNT_ID, SAFE_ACCOUNT_ID } from '../../core/models/cash-movement.model';
import { CashMovementService } from '../../core/services/cash-movement.service';
import { PaymentAccount } from '../../core/models/payment-account.model';
import { PaymentAccountService } from '../../core/services/payment-account.service';
import { OwnerBankAccount } from '../../core/models/owner-bank-account.model';
import { OwnerBankAccountService } from '../../core/services/owner-bank-account.service';
import { Customer } from '../../core/models/customer.model';
import { CustomerService } from '../../core/services/customer.service';
import { CustomerTransaction } from '../../core/models/customer-transaction.model';
import { CustomerTransactionService } from '../../core/services/customer-transaction.service';
import { Supplier } from '../../core/models/supplier.model';
import { SupplierService } from '../../core/services/supplier.service';
import { SupplierTransaction } from '../../core/models/supplier-transaction.model';
import { SupplierTransactionService } from '../../core/services/supplier-transaction.service';
import { PurchaseInvoice } from '../../core/models/purchase-invoice.model';
import { PurchaseInvoiceService } from '../../core/services/purchase-invoice.service';
import { ReturnTransaction } from '../../core/models/return.model';
import { ReturnService } from '../../core/services/return.service';
import { Shift } from '../../core/models/shift.model';
import { ShiftService } from '../../core/services/shift.service';
import { StoreSettingsService } from '../../core/services/store-settings.service';
import { PopupService } from '../../core/services/popup.service';

interface CashAccountOption {
  key: string;
  id: string;
  type: CashAccountType;
  name: string;
  balance: number;
}

interface MovementReasonOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-cash-movements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-movements.html',
  styleUrl: './cash-movements.css'
})
export class CashMovements implements OnInit {
  private readonly cashMovementService = inject(CashMovementService);
  private readonly paymentAccountService = inject(PaymentAccountService);
  private readonly ownerBankAccountService = inject(OwnerBankAccountService);
  private readonly customerService = inject(CustomerService);
  private readonly customerTransactionService = inject(CustomerTransactionService);
  private readonly supplierService = inject(SupplierService);
  private readonly supplierTransactionService = inject(SupplierTransactionService);
  private readonly purchaseInvoiceService = inject(PurchaseInvoiceService);
  private readonly returnService = inject(ReturnService);
  private readonly shiftService = inject(ShiftService);
  private readonly storeSettingsService = inject(StoreSettingsService);
  private readonly popupService = inject(PopupService);
  private readonly cdr = inject(ChangeDetectorRef);

  movements: CashMovement[] = [];
  paymentAccounts: PaymentAccount[] = [];
  ownerBankAccounts: OwnerBankAccount[] = [];
  customers: Customer[] = [];
  suppliers: Supplier[] = [];
  private purchaseInvoices: PurchaseInvoice[] = [];
  private purchaseReturns: ReturnTransaction[] = [];
  private supplierTransactions: SupplierTransaction[] = [];
  currentShift: Shift | null = null;

  currencySymbol = 'EGP';
  loading = false;
  loadError = '';
  saving = false;
  showForm = false;
  formError = '';

  showOwnerBankAccountForm = false;
  ownerBankAccountSaving = false;
  ownerBankAccountError = '';
  newBankName = '';
  newBankAccountName = '';
  newBankAccountLast4 = '';

  movementType: CashMovementType = 'CashIn';
  amount = 0;
  movementDateLocal = this.toDateTimeLocal(new Date());
  selectedReason = 'CustomerCollection';
  selectedFromAccountKey = `drawer:${CASH_DRAWER_ACCOUNT_ID}`;
  selectedToAccountKey = `drawer:${CASH_DRAWER_ACCOUNT_ID}`;
  selectedOwnerBankAccountId = '';
  selectedCustomerId = '';
  selectedSupplierId = '';
  note = '';

  searchTerm = '';
  typeFilter: 'all' | CashMovementType = 'all';
  periodFilter: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily';
  openDropdown: string | null = null;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.loadError = '';

    forkJoin({
      movements: this.cashMovementService.getCashMovements(),
      paymentAccounts: this.paymentAccountService.getActivePaymentAccounts(),
      ownerBankAccounts: this.ownerBankAccountService.getOwnerBankAccounts().pipe(
        catchError(() => of([] as OwnerBankAccount[]))
      ),
      customers: this.customerService.getCustomers(),
      suppliers: this.supplierService.getSuppliers(),
      purchaseInvoices: this.purchaseInvoiceService.getPurchaseInvoices(),
      purchaseReturns: this.returnService.getReturnsByType('purchase'),
      supplierTransactions: this.supplierTransactionService.getSupplierTransactions(),
      openShifts: this.shiftService.getOpenShifts(),
      settings: this.storeSettingsService.getOrLoadSettings()
    }).subscribe({
      next: ({ movements, paymentAccounts, ownerBankAccounts, customers, suppliers, purchaseInvoices, purchaseReturns, supplierTransactions, openShifts, settings }) => {
        this.movements = [...(movements || [])]
          .map(item => ({
            ...item,
            id: String(item.id),
            amount: Number(item.amount || 0)
          }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        this.paymentAccounts = (paymentAccounts || []).map(account => ({
          ...account,
          id: String(account.id)
        }));
        this.ownerBankAccounts = (ownerBankAccounts || [])
          .map(account => ({ ...account, id: String(account.id) }))
          .filter(account => account.isActive !== false)
          .sort((a, b) => this.getOwnerBankAccountDisplayName(a).localeCompare(this.getOwnerBankAccountDisplayName(b), undefined, { sensitivity: 'base' }));
        this.customers = (customers || []).map(customer => ({
          ...customer,
          id: String(customer.id),
          balance: Number(customer.balance || 0)
        }));
        this.purchaseInvoices = purchaseInvoices || [];
        this.purchaseReturns = purchaseReturns || [];
        this.supplierTransactions = supplierTransactions || [];
        this.suppliers = (suppliers || []).map(supplier => ({
          ...supplier,
          id: String(supplier.id),
          balance: this.calculateSupplierBalance(supplier)
        }));

        const sortedOpenShifts = [...(openShifts || [])].sort(
          (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
        );
        this.currentShift = sortedOpenShifts[0]
          ? { ...sortedOpenShifts[0], id: String(sortedOpenShifts[0].id), openingFloat: Number(sortedOpenShifts[0].openingFloat || 0) }
          : null;

        if (settings) {
          this.currencySymbol = this.storeSettingsService.getCurrencySymbol(settings.currency);
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        console.error('Failed to load cash movements:', error);
        this.loading = false;
        this.loadError = 'Failed to load cash movements. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  get accountOptions(): CashAccountOption[] {
    const accounts: Omit<CashAccountOption, 'balance'>[] = [
      { key: this.accountKey('drawer', CASH_DRAWER_ACCOUNT_ID), id: CASH_DRAWER_ACCOUNT_ID, type: 'drawer', name: 'Cash Drawer' },
      { key: this.accountKey('safe', SAFE_ACCOUNT_ID), id: SAFE_ACCOUNT_ID, type: 'safe', name: 'Safe' }
    ];

    for (const account of this.paymentAccounts) {
      // Cash-type payment accounts are represented by the single Cash Drawer account in POS.
      if (String(account.type).toLowerCase() === 'cash') {
        continue;
      }
      const id = String(account.id);
      accounts.push({
        key: this.accountKey('paymentAccount', id),
        id,
        type: 'paymentAccount',
        name: account.name
      });
    }

    return accounts.map(account => ({
      ...account,
      balance: this.getAccountBalance(account.type, account.id)
    }));
  }

  /**
   * Only physical-money accounts may be selected as the source of Cash Out.
   * Electronic payment accounts are used to show the shift's takings and are
   * transferred to Safe during handover; they are not spending sources.
   */
  get cashOutSourceOptions(): CashAccountOption[] {
    return this.accountOptions.filter(
      account => account.type === 'drawer' || account.type === 'safe'
    );
  }

  get reasonOptions(): MovementReasonOption[] {
    if (this.movementType === 'CashIn') {
      return [
        { value: 'CustomerCollection', label: 'Customer Collection' },
        { value: 'SupplierRefund', label: 'Supplier Refund' }
      ];
    }

    if (this.movementType === 'CashOut') {
      return [
        { value: 'Supplies', label: 'Supplies' },
        { value: 'Utilities', label: 'Utilities' },
        { value: 'Stationery', label: 'Stationery' },
        { value: 'Gratuity', label: 'Gratuity' },
        { value: 'Internet', label: 'Internet' },
        { value: 'SupplierPayment', label: 'Supplier Payment' },
        { value: 'CustomerRefund', label: 'Customer Refund' },
        { value: 'Other', label: 'Other' }
      ];
    }

    return [{ value: 'Other', label: 'Internal Transfer' }];
  }

  /**
   * Movements included in cash review:
   * - Customer collections and supplier refunds (Cash In)
   * - Supplier payments, customer refunds and expenses (Cash Out)
   * - Manual/internal transfers between business accounts
   * POS sales and shift handovers are excluded: sales are handled
   * by POS, while shift handover totals and breakdowns are shown
   * on the Treasury page. Other transfers (for example Safe to bank)
   * remain visible here.
   */
  get periodMovements(): CashMovement[] {
    const { start, endExclusive } = this.getSelectedPeriodRange();

    return this.movements.filter(movement => {
      if (!this.isReviewableMovement(movement)) {
        return false;
      }

      const timestamp = new Date(movement.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp < endExclusive.getTime();
    });
  }

  get filteredMovements(): CashMovement[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.periodMovements.filter(movement => {
      if (this.typeFilter !== 'all' && movement.type !== this.typeFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      const searchable = [
        movement.id,
        movement.type,
        movement.reason,
        movement.category,
        movement.note,
        movement.referenceId,
        movement.fromAccountName,
        movement.toAccountName,
        movement.customerName,
        movement.supplierName
      ].filter(Boolean).join(' ').toLowerCase();

      return searchable.includes(term);
    });
  }

  get totalMoneyIn(): number {
    return this.periodMovements
      .filter(item => item.type === 'CashIn')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

  get totalMoneyOut(): number {
    return this.periodMovements
      .filter(item => item.type === 'CashOut')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

  get totalTransfers(): number {
    return this.periodMovements
      .filter(item => item.type === 'Transfer')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

  private isReviewableMovement(movement: CashMovement): boolean {
    // Shift handovers already have an aggregated record and detailed
    // account breakdown on Treasury, so their individual transfers
    // must not be repeated in this manual cash-movement review.
    // Check both fields to hide older/inconsistent saved records too.
    if (
      movement.reason === 'ShiftHandover' ||
      (movement.type === 'Transfer' && movement.referenceType === 'Shift')
    ) {
      return false;
    }

    // Never show normal POS sales as cash-in rows.
    if (
      movement.reason === 'Sale' ||
      movement.referenceType === 'Order'
    ) {
      return false;
    }

    // Keep other transfers visible (e.g. Safe -> external bank).
    if (movement.type === 'Transfer') {
      return true;
    }

    if (movement.type === 'CashIn') {
      return movement.reason === 'CustomerCollection' || movement.reason === 'SupplierRefund';
    }

    // Cash-out is reserved for payments to suppliers/customers and expenses.
    return movement.type === 'CashOut' && (
      movement.reason === 'SupplierPayment' ||
      movement.reason === 'CustomerRefund' ||
      movement.reason === 'Expense' ||
      movement.reason === 'Other'
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.custom-dropdown')) {
      this.openDropdown = null;
    }
  }

  onModalContentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.custom-dropdown')) {
      this.openDropdown = null;
    }
    event.stopPropagation();
  }

  toggleDropdown(name: string): void {
    if (this.saving) {
      return;
    }
    this.openDropdown = this.openDropdown === name ? null : name;
  }

  setPeriodFilter(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): void {
    this.periodFilter = period;
    this.openDropdown = null;
  }

  getPeriodOptionLabel(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
    const labels: Record<'daily' | 'weekly' | 'monthly' | 'yearly', string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly'
    };
    return labels[period];
  }

  setTypeFilter(type: 'all' | CashMovementType): void {
    this.typeFilter = type;
    this.openDropdown = null;
  }

  getTypeFilterLabel(type: 'all' | CashMovementType): string {
    if (type === 'all') return 'All Types';
    return this.getMovementTypeLabel(type);
  }

  selectAccount(direction: 'from' | 'to', accountKey: string): void {
    if (direction === 'from') {
      this.selectedFromAccountKey = accountKey;
    } else {
      this.selectedToAccountKey = accountKey;
    }
    this.openDropdown = null;
    this.formError = '';
  }

  getAccountOptionLabel(accountKey: string, placeholder: string): string {
    return this.findAccount(accountKey)?.name || placeholder;
  }

  getOwnerBankAccountDisplayName(account: OwnerBankAccount): string {
    const bank = String(account.bankName || '').trim();
    const accountName = String(account.accountName || '').trim();
    const last4 = String(account.accountNumberLast4 || '').trim();
    const mainLabel = bank && accountName && bank.toLowerCase() !== accountName.toLowerCase()
      ? `${bank} — ${accountName}`
      : bank || accountName || 'Bank Account';
    return last4 ? `${mainLabel} •••• ${last4}` : mainLabel;
  }

  get selectedTransferBankAccount(): OwnerBankAccount | undefined {
    return this.ownerBankAccounts.find(account => String(account.id) === String(this.selectedOwnerBankAccountId));
  }

  getSelectedTransferBankAccountLabel(): string {
    const account = this.selectedTransferBankAccount;
    if (account) {
      return this.getOwnerBankAccountDisplayName(account);
    }
    return this.ownerBankAccounts.length > 0 ? 'Select owner bank account' : 'Add a bank account first';
  }

  openOwnerBankAccountForm(): void {
    this.openDropdown = null;
    this.ownerBankAccountError = '';
    this.newBankName = '';
    this.newBankAccountName = '';
    this.newBankAccountLast4 = '';
    this.showOwnerBankAccountForm = true;
    this.cdr.detectChanges();
  }

  closeOwnerBankAccountForm(): void {
    if (this.ownerBankAccountSaving) {
      return;
    }
    this.showOwnerBankAccountForm = false;
    this.ownerBankAccountError = '';
    this.cdr.detectChanges();
  }

  saveOwnerBankAccount(): void {
    if (this.ownerBankAccountSaving) {
      return;
    }

    const bankName = this.newBankName.trim();
    const accountName = this.newBankAccountName.trim();
    const last4 = this.newBankAccountLast4.trim();

    if (!bankName || !accountName) {
      this.ownerBankAccountError = 'Enter the bank name and an account name.';
      return;
    }

    if (last4 && !/^\d{4}$/.test(last4)) {
      this.ownerBankAccountError = 'Enter only the last 4 digits of the account number, or leave it blank.';
      return;
    }

    const duplicate = this.ownerBankAccounts.some(account =>
      account.bankName.trim().toLowerCase() === bankName.toLowerCase() &&
      account.accountName.trim().toLowerCase() === accountName.toLowerCase() &&
      String(account.accountNumberLast4 || '') === last4
    );
    if (duplicate) {
      this.ownerBankAccountError = 'This bank account is already in the list.';
      return;
    }

    this.ownerBankAccountSaving = true;
    this.ownerBankAccountError = '';

    this.ownerBankAccountService.addOwnerBankAccount({
      bankName,
      accountName,
      accountNumberLast4: last4 || undefined,
      isActive: true
    }).subscribe({
      next: createdAccount => {
        const savedAccount: OwnerBankAccount = { ...createdAccount, id: String(createdAccount.id) };
        this.ownerBankAccounts = [...this.ownerBankAccounts, savedAccount]
          .sort((a, b) => this.getOwnerBankAccountDisplayName(a).localeCompare(this.getOwnerBankAccountDisplayName(b), undefined, { sensitivity: 'base' }));
        this.selectedOwnerBankAccountId = String(savedAccount.id);
        this.ownerBankAccountSaving = false;
        this.showOwnerBankAccountForm = false;
        this.ownerBankAccountError = '';
        this.popupService.showAlert('Bank account added successfully.', 'success', 'Saved');
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        console.error('Failed to save owner bank account:', error);
        this.ownerBankAccountSaving = false;
        this.ownerBankAccountError = 'Could not save the bank account. Make sure ownerBankAccounts: [] exists in db.json and json-server has been restarted.';
        this.cdr.detectChanges();
      }
    });
  }

  getReasonOptionLabel(reason: string): string {
    return this.reasonOptions.find(option => option.value === reason)?.label || 'Select category / reason';
  }

  selectReason(reason: string): void {
    this.selectedReason = reason;
    this.selectedCustomerId = '';
    this.selectedSupplierId = '';
    this.openDropdown = null;
    this.formError = '';
  }

  selectCustomer(customerId: string): void {
    this.selectedCustomerId = String(customerId);
    this.openDropdown = null;
    this.formError = '';
  }

  getCustomerOptionLabel(customerId: string, placeholder: string): string {
    return this.customers.find(customer => String(customer.id) === String(customerId))?.name || placeholder;
  }

  selectSupplier(supplierId: string): void {
    this.selectedSupplierId = String(supplierId);
    this.openDropdown = null;
    this.formError = '';
  }

  getSupplierOptionLabel(supplierId: string, placeholder: string): string {
    return this.suppliers.find(supplier => String(supplier.id) === String(supplierId))?.name || placeholder;
  }

  get periodFilterLabel(): string {
    const labels: Record<'daily' | 'weekly' | 'monthly' | 'yearly', string> = {
      daily: 'Today',
      weekly: 'This Week',
      monthly: 'This Month',
      yearly: 'This Year'
    };
    return labels[this.periodFilter];
  }

  private getSelectedPeriodRange(): { start: Date; endExclusive: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (this.periodFilter === 'weekly') {
      // Match the Reports page: the business week starts on Saturday.
      const daysSinceSaturday = (start.getDay() + 1) % 7;
      start.setDate(start.getDate() - daysSinceSaturday);
    } else if (this.periodFilter === 'monthly') {
      start.setDate(1);
    } else if (this.periodFilter === 'yearly') {
      start.setMonth(0, 1);
    }

    const endExclusive = new Date(start);
    if (this.periodFilter === 'daily') {
      endExclusive.setDate(endExclusive.getDate() + 1);
    } else if (this.periodFilter === 'weekly') {
      endExclusive.setDate(endExclusive.getDate() + 7);
    } else if (this.periodFilter === 'monthly') {
      endExclusive.setMonth(endExclusive.getMonth() + 1, 1);
    } else {
      endExclusive.setFullYear(endExclusive.getFullYear() + 1, 0, 1);
    }

    return { start, endExclusive };
  }

  setMovementType(type: CashMovementType): void {
    this.openDropdown = null;
    this.movementType = type;
    this.selectedReason = this.defaultReasonForType(type);
    this.selectedCustomerId = '';
    this.selectedSupplierId = '';
    this.formError = '';

    // Cash spending is allowed only from the physical drawer or Safe.
    // Reset a previously selected electronic account when switching to Cash Out.
    if (type === 'CashOut') {
      const selectedSource = this.accountOptions.find(
        account => account.key === this.selectedFromAccountKey
      );
      if (!selectedSource || (selectedSource.type !== 'drawer' && selectedSource.type !== 'safe')) {
        this.selectedFromAccountKey = this.accountKey('drawer', CASH_DRAWER_ACCOUNT_ID);
      }
    }
  }

  openForm(): void {
    this.openDropdown = null;
    this.formError = '';
    this.selectedOwnerBankAccountId = '';
    this.showForm = true;
    this.movementDateLocal = this.toDateTimeLocal(new Date());
    this.cdr.detectChanges();
  }

  closeForm(): void {
    if (this.saving) {
      return;
    }
    this.showForm = false;
    this.openDropdown = null;
    this.formError = '';
    this.cdr.detectChanges();
  }

  clearFilters(): void {
    this.openDropdown = null;
    this.searchTerm = '';
    this.typeFilter = 'all';
    this.periodFilter = 'daily';
  }

  saveMovement(): void {
    if (this.saving) {
      return;
    }

    this.formError = '';
    const amount = Number(this.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.setFormError('Enter an amount greater than zero.');
      return;
    }

    const roundedAmount = Number(amount.toFixed(2));
    const createdAtDate = new Date(this.movementDateLocal);
    if (!this.movementDateLocal || !Number.isFinite(createdAtDate.getTime())) {
      this.setFormError('Choose a valid movement date and time.');
      return;
    }

    const transferBankAccount = this.movementType === 'Transfer'
      ? this.selectedTransferBankAccount
      : undefined;

    const fromAccount = this.movementType === 'Transfer'
      ? this.findAccount(this.accountKey('safe', SAFE_ACCOUNT_ID))
      : this.movementType === 'CashOut'
        ? this.findAccount(this.selectedFromAccountKey)
        : null;

    const transferDestination: CashAccountOption | null = transferBankAccount
      ? {
          key: this.accountKey('external', `owner-bank:${transferBankAccount.id}`),
          id: `owner-bank:${transferBankAccount.id}`,
          type: 'external',
          name: this.getOwnerBankAccountDisplayName(transferBankAccount),
          balance: Number.POSITIVE_INFINITY
        }
      : null;

    const toAccount = this.movementType === 'Transfer'
      ? transferDestination
      : this.movementType === 'CashIn'
        ? this.findAccount(this.selectedToAccountKey)
        : null;

    if ((this.movementType === 'CashOut' || this.movementType === 'Transfer') && !fromAccount) {
      this.setFormError('Select the source account.');
      return;
    }
    if (this.movementType === 'CashOut' && fromAccount && fromAccount.type !== 'drawer' && fromAccount.type !== 'safe') {
      this.setFormError('Cash Out can only be taken from the Cash Drawer or Safe.');
      return;
    }
    if (this.movementType === 'CashIn' && !toAccount) {
      this.setFormError('Select the destination account.');
      return;
    }
    if (this.movementType === 'CashIn' && toAccount?.type === 'paymentAccount' && !this.currentShift) {
      this.setFormError('An open shift is required to record money in an electronic shift account. Use Safe for money received outside a shift.');
      return;
    }
    if (this.movementType === 'Transfer' && !transferBankAccount) {
      this.setFormError('Add or select the owner bank account that will receive this transfer.');
      return;
    }
    if (this.movementType === 'Transfer' && fromAccount && toAccount && fromAccount.key === toAccount.key) {
      this.setFormError('The source and destination accounts must be different.');
      return;
    }

    if (fromAccount?.type === 'drawer' && !this.currentShift) {
      this.setFormError('An open shift is required for movements from the Cash Drawer.');
      return;
    }
    if (toAccount?.type === 'drawer' && !this.currentShift) {
      this.setFormError('An open shift is required for movements into the Cash Drawer.');
      return;
    }

    if (fromAccount && fromAccount.type !== 'external') {
      const available = this.getAccountBalance(fromAccount.type, fromAccount.id);
      if (roundedAmount > available + 0.000001) {
        this.setFormError(`Insufficient balance in ${fromAccount.name}. Available: ${available.toFixed(2)} ${this.currencySymbol}.`);
        return;
      }
    }

    if (this.movementType === 'CashIn' && this.selectedReason === 'CustomerCollection' && !this.selectedCustomerId) {
      this.setFormError('Select the customer for this collection.');
      return;
    }
    if (this.movementType === 'CashIn' && this.selectedReason === 'SupplierRefund' && !this.selectedSupplierId) {
      this.setFormError('Select the supplier for this refund.');
      return;
    }
    if (this.movementType === 'CashOut' && this.selectedReason === 'SupplierPayment' && !this.selectedSupplierId) {
      this.setFormError('Select the supplier for this payment.');
      return;
    }
    if (this.movementType === 'CashOut' && this.selectedReason === 'CustomerRefund' && !this.selectedCustomerId) {
      this.setFormError('Select the customer receiving this refund.');
      return;
    }

    const createdAt = createdAtDate.toISOString();
    const customer = this.customers.find(item => String(item.id) === String(this.selectedCustomerId));
    const supplier = this.suppliers.find(item => String(item.id) === String(this.selectedSupplierId));

    const reason = this.resolveMovementReason();
    const category = this.resolveMovementCategory();
    const shiftAwareAccounts = [fromAccount, toAccount].filter(
      (account): account is CashAccountOption => !!account && (account.type === 'drawer' || account.type === 'paymentAccount')
    );

    const movement: Omit<CashMovement, 'id'> = {
      createdAt,
      type: this.movementType,
      reason,
      amount: roundedAmount,
      category,
      note: this.note.trim() || undefined,
      fromAccountType: this.movementType === 'CashIn' ? 'external' : fromAccount?.type,
      fromAccountId: this.movementType === 'CashIn' ? 'external' : fromAccount?.id,
      fromAccountName: this.movementType === 'CashIn'
        ? (this.selectedReason === 'CustomerCollection'
          ? customer?.name
          : this.selectedReason === 'SupplierRefund'
            ? supplier?.name
            : 'External / Outside')
        : fromAccount?.name,
      toAccountType: this.movementType === 'CashOut' ? 'external' : toAccount?.type,
      toAccountId: this.movementType === 'CashOut' ? 'external' : toAccount?.id,
      toAccountName: this.movementType === 'CashOut'
        ? (this.selectedReason === 'SupplierPayment'
          ? supplier?.name
          : this.selectedReason === 'CustomerRefund'
            ? customer?.name
            : 'External / Outside')
        : toAccount?.name,
      referenceType: 'Other' as CashMovementReferenceType,
      referenceId: undefined,
      shiftId: this.currentShift && shiftAwareAccounts.length > 0
        ? String(this.currentShift.id)
        : undefined,
      customerId: (
        (this.movementType === 'CashIn' && this.selectedReason === 'CustomerCollection') ||
        (this.movementType === 'CashOut' && this.selectedReason === 'CustomerRefund')
      ) ? customer?.id : undefined,
      customerName: (
        (this.movementType === 'CashIn' && this.selectedReason === 'CustomerCollection') ||
        (this.movementType === 'CashOut' && this.selectedReason === 'CustomerRefund')
      ) ? customer?.name : undefined,
      supplierId: (
        (this.movementType === 'CashOut' && this.selectedReason === 'SupplierPayment') ||
        (this.movementType === 'CashIn' && this.selectedReason === 'SupplierRefund')
      ) ? supplier?.id : undefined,
      supplierName: (
        (this.movementType === 'CashOut' && this.selectedReason === 'SupplierPayment') ||
        (this.movementType === 'CashIn' && this.selectedReason === 'SupplierRefund')
      ) ? supplier?.name : undefined
    };

    this.saving = true;
    if (this.movementType === 'CashIn' && this.selectedReason === 'CustomerCollection') {
      this.saveCustomerCollection(movement, roundedAmount);
      return;
    }
    if (this.movementType === 'CashIn' && this.selectedReason === 'SupplierRefund') {
      this.saveSupplierRefund(movement, roundedAmount);
      return;
    }
    if (this.movementType === 'CashOut' && this.selectedReason === 'SupplierPayment') {
      this.saveSupplierPayment(movement, roundedAmount);
      return;
    }

    this.cashMovementService.createCashMovement(movement).subscribe({
      next: saved => this.finishSave(saved),
      error: (error: unknown) => {
        console.error('Failed to save cash movement:', error);
        this.setFormError('The cash movement could not be saved. No success was recorded.');
      }
    });
  }

  private saveCustomerCollection(
    movement: Omit<CashMovement, 'id'>,
    amount: number
  ): void {
    this.customerService.getCustomers().subscribe({
      next: customers => {
        const customer = (customers || []).find(item => String(item.id) === String(this.selectedCustomerId));
        if (!customer) {
          this.setFormError('The selected customer could not be found.');
          return;
        }

        const currentBalance = Number(customer.balance || 0);
        if (amount > currentBalance + 0.000001) {
          this.setFormError(`The collection exceeds ${customer.name}'s outstanding balance of ${currentBalance.toFixed(2)} ${this.currencySymbol}.`);
          return;
        }

        const referenceNumber = this.createReference('COL');
        const transaction: Omit<CustomerTransaction, 'id'> = {
          customerId: String(customer.id),
          customerName: customer.name,
          type: 'CustomerCollection',
          referenceId: referenceNumber,
          referenceNumber,
          amount,
          paymentAccountId: movement.toAccountType === 'paymentAccount' ? movement.toAccountId : undefined,
          paymentAccountName: movement.toAccountType === 'paymentAccount' ? movement.toAccountName : undefined,
          notes: movement.note,
          createdAt: movement.createdAt
        };

        this.customerTransactionService.addTransaction(transaction).subscribe({
          next: createdTransaction => {
            const updatedCustomer = this.customerPayload(customer, Number((currentBalance - amount).toFixed(2)));
            this.customerService.updateCustomer(String(customer.id), updatedCustomer).subscribe({
              next: () => {
                const linkedMovement: Omit<CashMovement, 'id'> = {
                  ...movement,
                  referenceType: 'CustomerTransaction',
                  referenceId: String(createdTransaction.id),
                  customerId: String(customer.id),
                  customerName: customer.name
                };

                this.cashMovementService.createCashMovement(linkedMovement).subscribe({
                  next: saved => {
                    this.customers = this.customers.map(item => String(item.id) === String(customer.id)
                      ? { ...item, balance: Number((currentBalance - amount).toFixed(2)) }
                      : item);
                    this.finishSave(saved);
                  },
                  error: (error: unknown) => {
                    console.error('Collection movement failed; attempting rollback:', error);
                    this.rollbackCustomerCollection(customer, currentBalance, String(createdTransaction.id));
                  }
                });
              },
              error: (error: unknown) => {
                console.error('Failed to update customer balance:', error);
                this.customerTransactionService.deleteTransaction(String(createdTransaction.id)).subscribe({
                  next: () => this.setFormError('Customer balance was not updated, so the collection transaction was removed.'),
                  error: (rollbackError: unknown) => {
                    console.error('Failed to remove incomplete customer transaction:', rollbackError);
                    this.setFormError('Customer balance update failed and the transaction could not be removed. Check the customer statement before retrying.');
                  }
                });
              }
            });
          },
          error: (error: unknown) => {
            console.error('Failed to create customer collection transaction:', error);
            this.setFormError('The customer collection could not be recorded.');
          }
        });
      },
      error: (error: unknown) => {
        console.error('Failed to refresh customers before collection:', error);
        this.setFormError('Could not verify the customer balance. Please try again.');
      }
    });
  }

  private rollbackCustomerCollection(customer: Customer, originalBalance: number, transactionId: string): void {
    forkJoin({
      customer: this.customerService.updateCustomer(String(customer.id), this.customerPayload(customer, originalBalance)),
      transaction: this.customerTransactionService.deleteTransaction(transactionId)
    }).subscribe({
      next: () => this.setFormError('The cash movement failed. The customer balance and collection transaction were rolled back.'),
      error: (error: unknown) => {
        console.error('Customer collection rollback failed:', error);
        this.setFormError('The cash movement failed and automatic rollback was incomplete. Check the customer balance and transaction before retrying.');
      }
    });
  }

  private saveSupplierPayment(
    movement: Omit<CashMovement, 'id'>,
    amount: number
  ): void {
    this.supplierService.getSuppliers().subscribe({
      next: suppliers => {
        const supplier = (suppliers || []).find(item => String(item.id) === String(this.selectedSupplierId));
        if (!supplier) {
          this.setFormError('The selected supplier could not be found.');
          return;
        }

        const canonicalSupplier = this.suppliers.find(item => String(item.id) === String(supplier.id));
        const currentBalance = Number(canonicalSupplier?.balance ?? supplier.balance ?? 0);
        if (amount > currentBalance + 0.000001) {
          this.setFormError(`The payment exceeds ${supplier.name}'s outstanding balance of ${currentBalance.toFixed(2)} ${this.currencySymbol}.`);
          return;
        }

        const referenceNumber = this.createReference('PAY');
        const transaction: Omit<SupplierTransaction, 'id'> = {
          supplierId: String(supplier.id),
          supplierName: supplier.name,
          type: 'SupplierPayment',
          referenceId: referenceNumber,
          referenceNumber,
          amount,
          paymentAccountId: movement.fromAccountType === 'paymentAccount' ? movement.fromAccountId : undefined,
          paymentAccountName: movement.fromAccountType === 'paymentAccount' ? movement.fromAccountName : undefined,
          createdAt: movement.createdAt
        };

        this.supplierTransactionService.addTransaction(transaction).subscribe({
          next: createdTransaction => {
            const updatedSupplier = this.supplierPayload(supplier, Number((currentBalance - amount).toFixed(2)));
            this.supplierService.updateSupplier(String(supplier.id), updatedSupplier).subscribe({
              next: () => {
                const linkedMovement: Omit<CashMovement, 'id'> = {
                  ...movement,
                  referenceType: 'SupplierTransaction',
                  referenceId: String(createdTransaction.id),
                  supplierId: String(supplier.id),
                  supplierName: supplier.name
                };

                this.cashMovementService.createCashMovement(linkedMovement).subscribe({
                  next: saved => {
                    this.suppliers = this.suppliers.map(item => String(item.id) === String(supplier.id)
                      ? { ...item, balance: Number((currentBalance - amount).toFixed(2)) }
                      : item);
                    this.finishSave(saved);
                  },
                  error: (error: unknown) => {
                    console.error('Supplier payment movement failed; attempting rollback:', error);
                    this.rollbackSupplierPayment(supplier, currentBalance, String(createdTransaction.id));
                  }
                });
              },
              error: (error: unknown) => {
                console.error('Failed to update supplier balance:', error);
                this.supplierTransactionService.deleteTransaction(String(createdTransaction.id)).subscribe({
                  next: () => this.setFormError('Supplier balance was not updated, so the payment transaction was removed.'),
                  error: (rollbackError: unknown) => {
                    console.error('Failed to remove incomplete supplier transaction:', rollbackError);
                    this.setFormError('Supplier balance update failed and the transaction could not be removed. Check the supplier statement before retrying.');
                  }
                });
              }
            });
          },
          error: (error: unknown) => {
            console.error('Failed to create supplier payment transaction:', error);
            this.setFormError('The supplier payment could not be recorded.');
          }
        });
      },
      error: (error: unknown) => {
        console.error('Failed to refresh suppliers before payment:', error);
        this.setFormError('Could not verify the supplier balance. Please try again.');
      }
    });
  }

  private saveSupplierRefund(
    movement: Omit<CashMovement, 'id'>,
    amount: number
  ): void {
    this.supplierService.getSuppliers().subscribe({
      next: suppliers => {
        const supplier = (suppliers || []).find(item => String(item.id) === String(this.selectedSupplierId));
        if (!supplier) {
          this.setFormError('The selected supplier could not be found.');
          return;
        }

        const canonicalSupplier = this.suppliers.find(item => String(item.id) === String(supplier.id));
        const currentBalance = Number(canonicalSupplier?.balance ?? supplier.balance ?? 0);
        if (amount > currentBalance + 0.000001) {
          this.setFormError(`The refund exceeds ${supplier.name}'s outstanding balance of ${currentBalance.toFixed(2)} ${this.currencySymbol}.`);
          return;
        }

        const referenceNumber = this.createReference('REF');
        const transaction: Omit<SupplierTransaction, 'id'> = {
          supplierId: String(supplier.id),
          supplierName: supplier.name,
          type: 'SupplierRefund',
          referenceId: referenceNumber,
          referenceNumber,
          amount,
          paymentAccountId: movement.toAccountType === 'paymentAccount' ? movement.toAccountId : undefined,
          paymentAccountName: movement.toAccountType === 'paymentAccount' ? movement.toAccountName : undefined,
          createdAt: movement.createdAt
        };

        this.supplierTransactionService.addTransaction(transaction).subscribe({
          next: createdTransaction => {
            const updatedSupplier = this.supplierPayload(supplier, Number((currentBalance - amount).toFixed(2)));
            this.supplierService.updateSupplier(String(supplier.id), updatedSupplier).subscribe({
              next: () => {
                const linkedMovement: Omit<CashMovement, 'id'> = {
                  ...movement,
                  referenceType: 'SupplierTransaction',
                  referenceId: String(createdTransaction.id),
                  supplierId: String(supplier.id),
                  supplierName: supplier.name,
                  fromAccountName: supplier.name
                };

                this.cashMovementService.createCashMovement(linkedMovement).subscribe({
                  next: saved => {
                    this.suppliers = this.suppliers.map(item => String(item.id) === String(supplier.id)
                      ? { ...item, balance: Number((currentBalance - amount).toFixed(2)) }
                      : item);
                    this.finishSave(saved);
                  },
                  error: (error: unknown) => {
                    console.error('Supplier refund movement failed; attempting rollback:', error);
                    this.rollbackSupplierRefund(supplier, currentBalance, String(createdTransaction.id));
                  }
                });
              },
              error: (error: unknown) => {
                console.error('Failed to update supplier balance for refund:', error);
                this.supplierTransactionService.deleteTransaction(String(createdTransaction.id)).subscribe({
                  next: () => this.setFormError('Supplier balance was not updated, so the refund transaction was removed.'),
                  error: (rollbackError: unknown) => {
                    console.error('Failed to remove incomplete supplier refund transaction:', rollbackError);
                    this.setFormError('Supplier balance update failed and the refund transaction could not be removed. Check the supplier statement before retrying.');
                  }
                });
              }
            });
          },
          error: (error: unknown) => {
            console.error('Failed to create supplier refund transaction:', error);
            this.setFormError('The supplier refund could not be recorded.');
          }
        });
      },
      error: (error: unknown) => {
        console.error('Failed to refresh suppliers before refund:', error);
        this.setFormError('Could not verify the supplier balance. Please try again.');
      }
    });
  }

  private rollbackSupplierRefund(supplier: Supplier, originalBalance: number, transactionId: string): void {
    forkJoin({
      supplier: this.supplierService.updateSupplier(String(supplier.id), this.supplierPayload(supplier, originalBalance)),
      transaction: this.supplierTransactionService.deleteTransaction(transactionId)
    }).subscribe({
      next: () => this.setFormError('The cash movement failed. The supplier balance and refund transaction were rolled back.'),
      error: (error: unknown) => {
        console.error('Supplier refund rollback failed:', error);
        this.setFormError('The cash movement failed and automatic rollback was incomplete. Check the supplier balance and transaction before retrying.');
      }
    });
  }

  private rollbackSupplierPayment(supplier: Supplier, originalBalance: number, transactionId: string): void {
    forkJoin({
      supplier: this.supplierService.updateSupplier(String(supplier.id), this.supplierPayload(supplier, originalBalance)),
      transaction: this.supplierTransactionService.deleteTransaction(transactionId)
    }).subscribe({
      next: () => this.setFormError('The cash movement failed. The supplier balance and payment transaction were rolled back.'),
      error: (error: unknown) => {
        console.error('Supplier payment rollback failed:', error);
        this.setFormError('The cash movement failed and automatic rollback was incomplete. Check the supplier balance and transaction before retrying.');
      }
    });
  }

  private customerPayload(customer: Customer, balance: number): Omit<Customer, 'id'> {
    return {
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      notes: customer.notes,
      balance,
      status: customer.status
    };
  }

  /** Uses the same outstanding-balance rules as the Supplier Statement. */
  private calculateSupplierBalance(supplier: Supplier): number {
    const supplierName = String(supplier.name || '').trim().toLowerCase();
    const supplierInvoices = this.purchaseInvoices.filter(invoice =>
      String(invoice.supplierName || '').trim().toLowerCase() === supplierName
    );
    const invoiceIds = new Set(supplierInvoices.map(invoice => String(invoice.id)));

    let balance = supplierInvoices.reduce((sum, invoice) => {
      return invoice.paymentStatus === 'OnAccount'
        ? sum + Number(invoice.total || 0)
        : sum;
    }, 0);

    for (const purchaseReturn of this.purchaseReturns) {
      if (
        purchaseReturn.status === 'completed' &&
        invoiceIds.has(String(purchaseReturn.referenceId || ''))
      ) {
        balance -= Number(purchaseReturn.total || 0);
      }
    }

    for (const transaction of this.supplierTransactions) {
      if (String(transaction.supplierName || '').trim().toLowerCase() !== supplierName) {
        continue;
      }
      if (transaction.type === 'SupplierPayment' || transaction.type === 'SupplierRefund') {
        balance -= Number(transaction.amount || 0);
      }
    }

    return Number(balance.toFixed(2));
  }

  private supplierPayload(supplier: Supplier, balance: number): Omit<Supplier, 'id'> {
    return {
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      notes: supplier.notes,
      balance,
      status: supplier.status
    };
  }

  private finishSave(saved: CashMovement): void {
    this.movements = [
      { ...saved, id: String(saved.id), amount: Number(saved.amount || 0) },
      ...this.movements.filter(item => String(item.id) !== String(saved.id))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    this.saving = false;
    this.showForm = false;
    this.openDropdown = null;
    this.formError = '';
    this.amount = 0;
    this.movementType = 'CashIn';
    this.selectedReason = this.defaultReasonForType('CashIn');
    this.selectedCustomerId = '';
    this.selectedSupplierId = '';
    this.note = '';
    this.movementDateLocal = this.toDateTimeLocal(new Date());
    this.selectedFromAccountKey = `drawer:${CASH_DRAWER_ACCOUNT_ID}`;
    this.selectedToAccountKey = `drawer:${CASH_DRAWER_ACCOUNT_ID}`;
    this.selectedOwnerBankAccountId = '';
    this.popupService.showAlert('Cash movement saved successfully.', 'success', 'Saved');
    this.cdr.detectChanges();
  }

  private setFormError(message: string): void {
    this.formError = message;
    this.saving = false;
    this.cdr.detectChanges();
  }

  private defaultReasonForType(type: CashMovementType): string {
    if (type === 'CashIn') return 'CustomerCollection';
    if (type === 'CashOut') return 'Supplies';
    return 'Other';
  }

  private resolveMovementReason(): CashMovementReason {
    if (this.movementType === 'Transfer') {
      return 'Other';
    }
    if (this.movementType === 'CashOut' && ['Supplies', 'Utilities', 'Stationery', 'Gratuity', 'Internet'].includes(this.selectedReason)) {
      return 'Expense';
    }
    return this.selectedReason as CashMovementReason;
  }

  private resolveMovementCategory(): string {
    if (this.movementType === 'Transfer') {
      return 'Internal Transfer';
    }
    return this.reasonOptions.find(option => option.value === this.selectedReason)?.label || this.selectedReason;
  }

  private findAccount(key: string): CashAccountOption | undefined {
    return this.accountOptions.find(account => account.key === key);
  }

  private accountKey(type: CashAccountType, id: string): string {
    return `${type}:${String(id)}`;
  }

  private getAccountBalance(type: CashAccountType, id: string): number {
    if (type === 'external') {
      return Number.POSITIVE_INFINITY;
    }

    // The Cash Drawer and electronic payment accounts are operational shift
    // balances, not lifetime balances. Use only the currently open shift so
    // old, already-handed-over sales cannot inflate today's available amount.
    const isShiftAccount = type === 'drawer' || type === 'paymentAccount';
    const activeShiftId = this.currentShift?.status === 'Open'
      ? String(this.currentShift.id)
      : '';

    if (isShiftAccount && !activeShiftId) {
      return 0;
    }

    let balance = 0;
    for (const movement of this.movements) {
      if (isShiftAccount && String(movement.shiftId || '') !== activeShiftId) {
        continue;
      }

      const amount = Number(movement.amount || 0);
      if (movement.toAccountType === type && String(movement.toAccountId) === String(id)) {
        balance += amount;
      }
      if (movement.fromAccountType === type && String(movement.fromAccountId) === String(id)) {
        balance -= amount;
      }
    }

    // Opening Float is deliberately excluded: it remains in the drawer and
    // is not part of shift-generated funds or the handover total. Safe remains
    // a store-level balance and therefore continues to use all movements.
    return Number(balance.toFixed(2));
  }

  getAccountBalanceForDisplay(account: CashAccountOption): number {
    return this.getAccountBalance(account.type, account.id);
  }

  getSafeBalance(): number {
    return this.getAccountBalance('safe', SAFE_ACCOUNT_ID);
  }

  getMovementTypeLabel(type: CashMovementType): string {
    if (type === 'CashIn') return 'Cash In';
    if (type === 'CashOut') return 'Cash Out';
    return 'Transfer';
  }

  getMovementCategoryLabel(movement: CashMovement): string {
    if (movement.category) return movement.category;
    const labels: Record<string, string> = {
      Sale: 'Sale',
      CustomerCollection: 'Customer Collection',
      SaleReturn: 'Sales Return',
      SupplierPayment: 'Supplier Payment',
      SupplierRefund: 'Supplier Refund',
      CustomerRefund: 'Customer Refund',
      Expense: 'Expense',
      CashIn: 'Cash In',
      CashOut: 'Cash Out',
      ShiftHandover: 'Shift Handover',
      Other: 'Other'
    };
    return labels[movement.reason] || movement.reason;
  }

  getMovementFromLabel(movement: CashMovement): string {
    return movement.fromAccountName || '—';
  }

  getMovementToLabel(movement: CashMovement): string {
    return movement.toAccountName || '—';
  }

  private createReference(prefix: string): string {
    const date = new Date();
    const stamp = date.getTime().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${stamp}-${random}`;
  }

  private dateKey(value: string): string {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toDateTimeLocal(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
}
