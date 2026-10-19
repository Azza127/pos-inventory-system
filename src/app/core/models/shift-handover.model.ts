export interface ShiftHandover {
  id: string;
  shiftId: string;
  createdAt: string;
  totalAmount: number;
  destinationAccountId: string;
  destinationAccountName: string;
  handedOverByEmployeeId?: string;
  handedOverByEmployeeName?: string;
  note?: string;
  breakdown: { accountId: string; accountName: string; amount: number; }[];
}