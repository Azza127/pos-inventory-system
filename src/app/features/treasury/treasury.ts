import { Component, OnInit, ChangeDetectorRef, inject} from '@angular/core';
import { CommonModule} from '@angular/common';
import { forkJoin} from 'rxjs';
import { StoreSettingsService} from '../../core/services/store-settings.service';
import { ShiftService} from '../../core/services/shift.service';
import { Shift} from '../../core/models/shift.model';
import { ShiftHandover} from '../../core/models/shift-handover.model';
import { ShiftHandoverService} from '../../core/services/shift-handover.service';
import { CashMovement, SAFE_ACCOUNT_ID} from '../../core/models/cash-movement.model';
import { CashMovementService} from '../../core/services/cash-movement.service';

type TreasuryTableRow = | { kind: 'handover'; id: string; createdAt: string; handover: ShiftHandover; } | { kind: 'movement'; id: string; createdAt: string; movement: CashMovement;};
@Component({
  selector: 'app-treasury',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './treasury.html',
  styleUrl: './treasury.css'
})

export class Treasury implements OnInit {
  // SERVICES
  private readonly shiftHandoverService = inject(ShiftHandoverService);
  private readonly cashMovementService = inject(CashMovementService);
  private readonly shiftService = inject(ShiftService);
  private readonly storeSettingsService = inject(StoreSettingsService);
  private readonly cdr = inject(ChangeDetectorRef);

  // HANDOVERS
  handovers: ShiftHandover[] = [];
  filteredHandovers: ShiftHandover[] = [];
  filteredCashMovements: CashMovement[] = [];
  // CASH MOVEMENTS
  cashMovements: CashMovement[] = [];
  // SHIFTS
  shifts: Shift[] = [];
  private readonly shiftMap =  new Map<string, Shift>();
  // TREASURY SUMMARY
  treasuryBalance = 0;
  totalMoneyIn = 0;
  totalMoneyOut = 0;
  // PERIOD SUMMARY
  periodOpeningBalance = 0;
  periodMoneyIn = 0;
  periodMoneyOut = 0;
  periodClosingBalance = 0;
  // HANDOVER SUMMARY
  totalHandovers = 0;
  todayHandoverTotal = 0;
  // SETTINGS
  currencySymbol = 'EGP';
  // FILTERS
  searchTerm = '';
  fromDate = '';
  toDate = '';
  // UI STATE
  loading = false;
  errorMessage = '';
  selectedHandover: ShiftHandover | null = null;

  // COMBINED TABLE ROWS
  get tableRows(): TreasuryTableRow[] {
    const handoverRows: TreasuryTableRow[] = this.filteredHandovers.map((handover) => ({ kind: 'handover', id: `handover-${handover.id}`, createdAt: handover.createdAt, handover }));
    const movementRows: TreasuryTableRow[] = this.filteredCashMovements.map((movement) => ({ kind: 'movement', id: `movement-${movement.id}`, createdAt: movement.createdAt, movement }));
    return [...handoverRows, ...movementRows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // INIT
  ngOnInit(): void {
    this.loadTreasury();
  }

  // LOAD TREASURY
  loadTreasury(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      handovers: this.shiftHandoverService.getHandovers(),
      cashMovements: this.cashMovementService.getCashMovements(),
      shifts: this.shiftService.getShifts(),
      settings: this.storeSettingsService.getOrLoadSettings()

    }).subscribe({
      next: ({ handovers, cashMovements, shifts, settings }) => {
        // HANDOVERS
        const uniqueHandovers = new Map<string, ShiftHandover>();
        for ( const handover of handovers || [] ){
          const shiftKey = String( handover.shiftId );
          if (!uniqueHandovers.has(shiftKey)) {uniqueHandovers.set(shiftKey, handover);}
        }
        this.handovers = Array.from(uniqueHandovers.values()).sort((a, b) => new Date(b.createdAt)
        .getTime() - new Date(a.createdAt).getTime());
        // CASH MOVEMENTS
        this.cashMovements = cashMovements || [];
        // SHIFTS
        this.shifts =shifts || [];
        this.shiftMap.clear();
        this.shifts.forEach((shift: Shift) => {this.shiftMap.set(String(shift.id), shift);}
        );

        // CURRENCY
        if (settings) {
          this.currencySymbol = this.storeSettingsService.getCurrencySymbol(settings.currency);
        }

        // CALCULATIONS
        this.calculateTreasuryBalance();
        this.calculateHandoverSummary();
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges(); },
      error: ( error: unknown ) => {
        console.error( 'Error loading treasury:', error );
        this.loading = false;
        this.errorMessage ='Failed to load treasury data.';
        this.cdr.detectChanges();
      }
    });
  }

  // TREASURY BALANCE
  private calculateTreasuryBalance(): void {
    let moneyIn = 0;
    let moneyOut = 0;

    for ( const movement of this.cashMovements ) {
      const amount = Number( movement.amount ) || 0;
      const enteredTreasury = movement.toAccountType === 'safe' || movement.toAccountId === SAFE_ACCOUNT_ID;
      const leftTreasury = movement.fromAccountType === 'safe' || movement.fromAccountId === SAFE_ACCOUNT_ID;
      if (enteredTreasury) { moneyIn += amount;}
      if (leftTreasury) { moneyOut += amount; }
    }

    this.totalMoneyIn = Number( moneyIn.toFixed(2) );
    this.totalMoneyOut = Number( moneyOut.toFixed(2));
    this.treasuryBalance = Number((moneyIn - moneyOut).toFixed(2) );
    this.calculatePeriodSummary();
  }

  // PERIOD SUMMARY
  private calculatePeriodSummary(): void {
    let openingBalance = 0;
    let periodMoneyIn = 0;
    let periodMoneyOut = 0;
    for ( const movement of this.cashMovements) {
      const amount = Number( movement.amount ) || 0;
      const movementDate = this.getDateKey( movement.createdAt );
      const enteredTreasury = movement.toAccountType === 'safe' || movement.toAccountId === SAFE_ACCOUNT_ID;
      const leftTreasury = movement.fromAccountType === 'safe' || movement.fromAccountId === SAFE_ACCOUNT_ID;
      const movementEffect = ( enteredTreasury ? amount  : 0 ) -( leftTreasury ? amount  : 0 );

      // BEFORE FROM DATE
      if (
        this.fromDate && movementDate < this.fromDate
      ) {
        openingBalance += movementEffect;
        continue;
      }

      // AFTER TO DATE
      if ( this.toDate && movementDate > this.toDate ) {
        continue;
      }

      // CURRENT PERIOD
      if (enteredTreasury) { periodMoneyIn += amount; }
      if (leftTreasury) {periodMoneyOut += amount;}}
    this.periodOpeningBalance = Number( openingBalance.toFixed(2));
    this.periodMoneyIn = Number( periodMoneyIn.toFixed(2) );
    this.periodMoneyOut = Number( periodMoneyOut.toFixed(2));
    this.periodClosingBalance = Number((this.periodOpeningBalance + this.periodMoneyIn - this.periodMoneyOut).toFixed(2) );}

  // HANDOVER SUMMARY
  private calculateHandoverSummary(): void {
    this.totalHandovers = this.handovers.length;
    const today = this.getTodayKey();
    this.todayHandoverTotal = Number( this.handovers.filter(( handover: ShiftHandover) => 
    this.getDateKey( handover.createdAt ) === today)
        .reduce(( sum: number, handover: ShiftHandover) => sum + (Number( handover.totalAmount ) || 0 ), 0).toFixed(2)
      );}

  // FILTERS
  applyFilters(): void {
    this.calculatePeriodSummary();
    const search = this.searchTerm.trim().toLowerCase();
    this.filteredHandovers = this.handovers.filter((handover: ShiftHandover) => {
          const shift = this.shiftMap.get( String( handover.shiftId ));
          // OPENED BY
          const openedByName = shift?.employeeName ?.toLowerCase() || '';
          // HANDOVER BY
          const handedOverByName = handover.handedOverByEmployeeName ?.toLowerCase() || '';
          // SHIFT ID
          const shiftId = String( handover.shiftId).toLowerCase();
          // DESTINATION
          const destinationName = handover .destinationAccountName ?.toLowerCase() || '';
          // BREAKDOWN
          const breakdownMatches = ( handover.breakdown || []).some( account => account.accountName?.toLowerCase().includes(search));
          // SEARCH
          const matchesSearch = !search || openedByName.includes(search) || handedOverByName.includes(search) || shiftId.includes(search) || destinationName.includes(search) || breakdownMatches;
          // DATE FILTERS
          const movementDate = this.getDateKey(handover.createdAt );
          const matchesFrom = !this.fromDate || movementDate >= this.fromDate;
          const matchesTo = !this.toDate || movementDate <= this.toDate;
          return ( matchesSearch && matchesFrom && matchesTo);
        });

    // Show only direct movements that affect Safe / Treasury.
    // Shift handovers are excluded here because each is already
    // represented by its single aggregated handover record.
    this.filteredCashMovements = this.cashMovements.filter((movement: CashMovement) => {
        if (!this.isTreasuryMovement(movement)) { return false; }
        const movementDate = this.getDateKey(movement.createdAt);
        const matchesFrom = !this.fromDate || movementDate >= this.fromDate;
        const matchesTo = !this.toDate || movementDate <= this.toDate;
        const search = this.searchTerm.trim().toLowerCase();
        const searchableText = [ movement.id, movement.type, movement.reason, movement.category, movement.note,
          movement.referenceType, movement.referenceId, movement.fromAccountName, movement.toAccountName, 
          movement.customerName, movement.supplierName ].filter(Boolean).join(' ') .toLowerCase();
        const matchesSearch = !search || searchableText.includes(search);
        return matchesFrom && matchesTo && matchesSearch;
      });}

  // TREASURY MOVEMENT FILTER / DISPLAY HELPERS
  private isTreasuryMovement(movement: CashMovement): boolean {
    // Handover transfer rows are already included as one aggregate.
    if ( movement.reason === 'ShiftHandover' || movement.referenceType === 'Shift' ) { return false; }
    // receipts, payments, and movements affecting Safe.
    if ( movement.reason === 'Sale' || movement.referenceType === 'Order' ) { return false; }
    const entersSafe = movement.toAccountType === 'safe' || String(movement.toAccountId) === SAFE_ACCOUNT_ID;
    const leavesSafe = movement.fromAccountType === 'safe' ||
      String(movement.fromAccountId) === SAFE_ACCOUNT_ID;
    if (movement.type === 'CashIn') { return entersSafe && !leavesSafe; }
    if (movement.type === 'CashOut') { return leavesSafe && !entersSafe; }

    // Transfer: display it only if one side is Safe.
    return entersSafe || leavesSafe;
  }

  getDestinationBankName(accountName: string | undefined): string {
    const name = String(accountName || '').trim();
    if (!name) { return '—'; }
    return name.split(' — ')[0].trim() || name;
  }

  getMovementTypeLabel(type: CashMovement['type']): string {
    if (type === 'CashIn') { return 'Cash In'; }
    if (type === 'CashOut') { return 'Cash Out'; }
    return 'Transfer';
  }

  getTreasuryMovementSign(movement: CashMovement): number {
    const entersSafe = movement.toAccountType === 'safe' || String(movement.toAccountId) === SAFE_ACCOUNT_ID;
    const leavesSafe = movement.fromAccountType === 'safe' || String(movement.fromAccountId) === SAFE_ACCOUNT_ID;
    if (entersSafe && !leavesSafe) { return 1; }
    if (leavesSafe && !entersSafe) { return -1; }
    return 0;
  }

  // DATE HELPERS
  private getDateKey( value: string ): string {
    const date = new Date( value );
    const year = date.getFullYear();
    const month = String( date.getMonth() + 1 ).padStart( 2, '0');
    const day = String( date.getDate() ).padStart( 2, '0' );
    return `${year}-${month}-${day}`;
  }

  getTodayKey(): string {
    return this.getDateKey( new Date().toISOString());
  }

  // SHIFT HELPERS
  getShift( shiftId: string ): Shift | undefined {
    return this.shiftMap.get(String( shiftId ));
  }

  // OPENED BY
  getEmployeeName( shiftId: string): string {
    return ( this.getShift( shiftId )?.employeeName || 'Unknown' );
  }

  // HANDOVER BY
  getHandoverEmployeeName( handover: ShiftHandover ): string {
    return ( handover.handedOverByEmployeeName ||  '—' );
  }

  // HANDOVER DETAILS
  toggleHandover(handover: ShiftHandover): void {
    if (this.selectedHandover?.id === handover.id) {
      this.selectedHandover = null;
      return;
    }
    this.selectedHandover = handover;
  }

  isHandoverSelected(handover: ShiftHandover): boolean {
    return ( this.selectedHandover?.id === handover.id );
  }

  // CLEAR FILTERS
  clearFilters(): void {
    this.searchTerm = '';
    this.fromDate = '';
    this.toDate ='';
    this.applyFilters();
  }
}