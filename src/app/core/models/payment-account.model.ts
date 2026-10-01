export type PaymentAccountType =
  | 'cash'
  | 'card'
  | 'bank'
  | 'wallet';

export interface PaymentAccount {
  id: string;
  name: string;
  type: PaymentAccountType;
  description?: string;
  image?: string;
  isActive: boolean;
}