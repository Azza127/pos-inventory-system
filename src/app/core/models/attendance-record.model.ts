export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  /** Local calendar date on which the employee checked in (YYYY-MM-DD). */
  workDate: string;
  checkInAt: string;
  checkOutAt?: string;
}
