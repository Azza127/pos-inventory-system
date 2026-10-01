export type SupplierTransactionType =
  | 'OnAccountPurchase'
  | 'SupplierPayment';

export interface SupplierTransaction {
  id: string;

  supplierId: string;

  supplierName: string;

  type: SupplierTransactionType;

  referenceId?: string;

  referenceNumber?: string;

  amount: number;

  paymentAccountId?: string;

  paymentAccountName?: string;

  createdAt: string;
}