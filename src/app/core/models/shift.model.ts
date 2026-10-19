export type ShiftStatus = | 'Open' | 'Closed';
export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  status: ShiftStatus;
  openingFloat: number;
  openedAt: string;
  closedAt?: string;
  handoverId?: string;
  note?: string;
}