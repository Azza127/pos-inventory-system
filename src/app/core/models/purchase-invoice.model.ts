export type PurchaseInvoicePaymentStatus =
  | 'Paid'
  | 'OnAccount';


export interface PurchaseInvoice {

  id: string;

  supplierId?: string;

  supplierName: string;

  invoiceNumber: string;

  invoiceDate: string;

  warehouseId?: string;

  notes?: string;

  subtotal: number;

  taxTotal: number;

  total: number;

  items: PurchaseInvoiceItem[];

  createdAt?: string;

  // =========================================================
  // PAYMENT
  // =========================================================

  paymentStatus?:
    PurchaseInvoicePaymentStatus;

  paymentAccountId?: string;

  paymentAccountName?: string;

}


export interface PurchaseInvoiceItem {

  id: string;

  productId: string;

  productName: string;

  sku: string;

  quantity: number;

  expiryDate?: string;

  purchasePrice: number;

  sellingPrice: number;

  taxRate: number;

  taxAmount: number;

  subtotal: number;

  total: number;

}
