export type PaymentStatus = 'Paid' | 'OnAccount';

export interface OrderItem {
  id?: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  costPrice?: number;
  total: number;
}

export interface Order {
  id?: number;
  ticketNumber?: string;
  customerId?: string;
  customerName?: string;
  items: OrderItem[];
  subtotal?: number;
  tax?: number;
  total: number;
  totalAmount?: number;
  paymentStatus: PaymentStatus;
  paymentAccountId?: string;
  status: 'Completed' | 'Pending' | 'Cancelled';
  createdAt: string;
}