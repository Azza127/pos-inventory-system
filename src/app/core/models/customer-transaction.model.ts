export type CustomerTransactionType =
  | 'OnAccountSale'
  | 'CustomerCollection';


export interface CustomerTransactionItem {

  productId: string;

  productName: string;

  quantity: number;

  unitPrice: number;

  total: number;
}


export interface CustomerTransaction {

  id: string;

  customerId: string;

  customerName: string;

  type: CustomerTransactionType;

  referenceId?: string;

  referenceNumber?: string;

  amount: number;

  paymentAccountId?: string;

  paymentAccountName?: string;

  items?: CustomerTransactionItem[];

  notes?: string;

  createdAt: string;
}