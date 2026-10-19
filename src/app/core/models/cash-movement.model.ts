export type CashAccountType =
  | 'drawer'
  | 'safe'
  | 'paymentAccount'
  | 'external';

export type CashMovementType =
  | 'CashIn'
  | 'CashOut'
  | 'Transfer';

  export type CashMovementReason =
  | 'Sale'
  | 'CustomerCollection'
  | 'SaleReturn'
  | 'SupplierPayment'
  | 'SupplierRefund'
  | 'CustomerRefund'
  | 'Expense'
  | 'CashIn'
  | 'CashOut'
  | 'ShiftHandover'
  | 'Other';

export type CashMovementReferenceType =
  | 'Order'
  | 'Return'
  | 'CustomerTransaction'
  | 'SupplierTransaction'
  | 'Expense'
  | 'Shift'
  | 'Other';

export const CASH_DRAWER_ACCOUNT_ID = 'cash-drawer';

export const SAFE_ACCOUNT_ID = 'safe';

export interface CashMovement {
  id: string;
  createdAt: string;
  type: CashMovementType;
  reason: CashMovementReason;
  amount: number;
  fromAccountType?: CashAccountType;
  fromAccountId?: string;
  fromAccountName?: string;
  toAccountType?: CashAccountType;
  toAccountId?: string;
  toAccountName?: string;
  referenceType?: CashMovementReferenceType;
  referenceId?: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  category?: string;
  shiftId?: string;
  note?: string;
}

export interface ShiftHandoverBreakdown {
  accountId: string;
  accountName: string;
  amount: number;
}

export interface ShiftHandover {
  id: string;
  shiftId: string;
  createdAt: string;
  totalAmount: number;
  destinationAccountId: string;
  destinationAccountName: string;
  breakdown: ShiftHandoverBreakdown[];
  note?: string;
}