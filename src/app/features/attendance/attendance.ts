import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceRecord } from '../../core/models/attendance-record.model';
import { AttendanceService } from '../../core/services/attendance.service';
import { User } from '../../core/models/user.model';
import { UserService } from '../../core/services/user.service';
import { PopupService } from '../../core/services/popup.service';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.html',
  styleUrl: './attendance.css'
})
export class Attendance implements OnInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly userService = inject(UserService);
  private readonly popupService = inject(PopupService);
  private readonly cdr = inject(ChangeDetectorRef);

  records: AttendanceRecord[] = [];
  users: User[] = [];
  activeEmployees: User[] = [];
  currentUserId = '';
  currentUserName = '';
  currentRole: User['role'] = 'Employee';

  selectedMonth = this.getLocalMonthKey(new Date());
  selectedEmployeeId = 'all';
  searchTerm = '';
  isLoading = true;
  isUsersLoading = true;
  isSaving = false;
  errorMessage = '';
  showEmployeeDropdown = false;

  ngOnInit(): void {
    this.loadCurrentUser();
    if (!this.currentUserId) {
      this.isLoading = false;
      this.errorMessage = 'Unable to identify the logged-in user. Please log in again.';
      return;
    }
    this.loadRecords();
    this.loadUsers();
  }

  private loadCurrentUser(): void {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return;

    try {
      const user = JSON.parse(raw) as Partial<User>;
      this.currentUserId = String(user.id ?? user.username ?? '').trim();
      this.currentUserName = String(user.name ?? user.username ?? '').trim();
      if (user.role === 'Owner' || user.role === 'Manager' || user.role === 'Employee') {
        this.currentRole = user.role;
      }
    } catch (error) {
      console.error('Failed to read current user for attendance:', error);
    }
  }

  get isManager(): boolean {
    return this.currentRole === 'Owner' || this.currentRole === 'Manager';
  }

  loadRecords(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.attendanceService.getRecords().subscribe({
      next: (records) => {
        this.records = [...records].sort(
          (a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime()
        );
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        console.error('Failed to load attendance records:', error);
        this.isLoading = false;
        this.errorMessage = 'Failed to load attendance records. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  private loadUsers(): void {
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = (users || []).map((user) => ({
          ...user,
          id: String(user.id)
        }));
        this.activeEmployees = this.users
          .filter((user) => user.status === 'Active')
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        this.isUsersLoading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        console.error('Failed to load users for attendance:', error);
        this.isUsersLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleEmployeeDropdown(): void {
    this.showEmployeeDropdown = !this.showEmployeeDropdown;
  }

  selectEmployee(employeeId: string): void {
    this.selectedEmployeeId = employeeId;
    this.showEmployeeDropdown = false;
    this.cdr.detectChanges();
  }

  getSelectedEmployeeLabel(): string {
    if (this.selectedEmployeeId === 'all') return 'All employees';

    const selectedUser = this.users.find(
      (user) => String(user.id) === String(this.selectedEmployeeId)
    );

    if (!selectedUser) return 'Select employee';
    return `${selectedUser.name}${selectedUser.status === 'Inactive' ? ' (Inactive)' : ''}`;
  }

  selectEmployeeForReview(employee: User): void {
    if (!this.isManager) return;
    this.selectEmployee(String(employee.id));
  }

  @HostListener('document:click')
  closeEmployeeDropdown(): void {
    this.showEmployeeDropdown = false;
  }

  get currentOpenRecord(): AttendanceRecord | undefined {
    return this.getOpenRecordForEmployee(this.currentUserId);
  }

  get todaysRecord(): AttendanceRecord | undefined {
    return this.getTodaysRecordForEmployee(this.currentUserId);
  }

  getOpenRecordForEmployee(employeeId: string): AttendanceRecord | undefined {
    return this.records
      .filter((record) => String(record.employeeId) === String(employeeId) && !record.checkOutAt)
      .sort((a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime())[0];
  }

  getTodaysRecordForEmployee(employeeId: string): AttendanceRecord | undefined {
    const today = this.getLocalDateKey(new Date());
    return this.records
      .filter((record) => String(record.employeeId) === String(employeeId) && record.workDate === today)
      .sort((a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime())[0];
  }

  getEmployeeIsInProgress(employee: User): boolean {
    return !!this.getOpenRecordForEmployee(String(employee.id));
  }

  getEmployeeHasCompletedToday(employee: User): boolean {
    const todayRecord = this.getTodaysRecordForEmployee(String(employee.id));
    return !!todayRecord?.checkOutAt;
  }

  getEmployeeStatusLabel(employee: User): string {
    if (this.getOpenRecordForEmployee(String(employee.id))) return 'In Progress';
    if (this.getEmployeeHasCompletedToday(employee)) return 'Completed';
    return 'Not Started';
  }

  getEmployeeStatusMessage(employee: User): string {
    const openRecord = this.getOpenRecordForEmployee(String(employee.id));
    if (openRecord) {
      const startDate = openRecord.workDate === this.getLocalDateKey(new Date()) ? 'today' : openRecord.workDate;
      return `Checked in ${startDate} at ${this.formatTime(openRecord.checkInAt)}`;
    }

    const todayRecord = this.getTodaysRecordForEmployee(String(employee.id));
    if (todayRecord?.checkOutAt) {
      return `Completed at ${this.formatTime(todayRecord.checkOutAt)}`;
    }

    return 'No attendance recorded today';
  }

  get canCheckIn(): boolean {
    return !this.isSaving && !this.currentOpenRecord;
  }

  get monthlyRecords(): AttendanceRecord[] {
    return this.records.filter((record) => {
      if (!record.workDate.startsWith(this.selectedMonth)) return false;
      if (!this.isManager && String(record.employeeId) !== String(this.currentUserId)) return false;
      if (this.isManager && this.selectedEmployeeId !== 'all' && String(record.employeeId) !== String(this.selectedEmployeeId)) return false;
      return true;
    });
  }

  get filteredRecords(): AttendanceRecord[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.monthlyRecords.filter((record) => {
      if (!term) return true;
      return record.employeeName.toLowerCase().includes(term) ||
        record.workDate.toLowerCase().includes(term) ||
        (record.checkInAt || '').toLowerCase().includes(term) ||
        (record.checkOutAt || '').toLowerCase().includes(term);
    });
  }

  get monthlyTotalHours(): number {
    return this.monthlyRecords.reduce(
      (sum, record) => sum + (record.checkOutAt ? this.calculateHours(record) : 0),
      0
    );
  }

  get attendanceDays(): number {
    // Count distinct calendar dates. If several employees attend on the same date,
    // the team summary still counts that as one day. Selecting one employee
    // naturally gives that employee's own attendance dates.
    return new Set(this.monthlyRecords.map((record) => record.workDate)).size;
  }

  get completedRecordsCount(): number {
    return this.monthlyRecords.filter((record) => !!record.checkOutAt).length;
  }

  get openRecordsCount(): number {
    return this.monthlyRecords.filter((record) => !record.checkOutAt).length;
  }

  checkIn(employee: User): void {
    if (this.isSaving || this.isLoading || !!this.errorMessage || !employee?.id || employee.status !== 'Active') return;

    const employeeId = String(employee.id);
    const openRecord = this.getOpenRecordForEmployee(employeeId);
    if (openRecord) {
      this.popupService.showAlert(
        `${employee.name} already has an open attendance record. Please check out first.`,
        'warning',
        'Attendance Already Open'
      );
      return;
    }

    const now = new Date();
    const newRecord: Omit<AttendanceRecord, 'id'> = {
      employeeId,
      employeeName: employee.name,
      workDate: this.getLocalDateKey(now),
      checkInAt: now.toISOString()
    };

    this.isSaving = true;
    this.attendanceService.createRecord(newRecord).subscribe({
      next: (created) => {
        this.records = [created, ...this.records].sort(
          (a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime()
        );
        this.isSaving = false;
        this.popupService.showAlert(
          `${employee.name}'s attendance was recorded successfully.`,
          'success',
          'Checked In'
        );
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        console.error('Failed to record check-in:', error);
        this.isSaving = false;
        this.popupService.showAlert(
          `Unable to record check-in for ${employee.name}. Please try again.`,
          'error',
          'Check-In Failed'
        );
        this.cdr.detectChanges();
      }
    });
  }

  checkOut(employee: User): void {
    const employeeId = String(employee.id);
    const openRecord = this.getOpenRecordForEmployee(employeeId);
    if (!openRecord || this.isSaving || this.isLoading || !!this.errorMessage) return;

    const now = new Date();
    const checkInTime = new Date(openRecord.checkInAt).getTime();
    if (!Number.isFinite(checkInTime) || now.getTime() <= checkInTime) {
      this.popupService.showAlert(
        'The check-out time must be later than the check-in time.',
        'warning',
        'Invalid Time'
      );
      return;
    }

    this.isSaving = true;
    this.attendanceService.checkOut(openRecord.id, now.toISOString()).subscribe({
      next: (updated) => {
        this.records = this.records
          .map((record) => record.id === updated.id ? updated : record)
          .sort((a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime());
        this.isSaving = false;
        this.popupService.showAlert(
          `${employee.name}'s attendance is complete. Worked ${this.calculateHours(updated).toFixed(2)} hours.`,
          'success',
          'Checked Out'
        );
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        console.error('Failed to record check-out:', error);
        this.isSaving = false;
        this.popupService.showAlert(
          `Unable to record check-out for ${employee.name}. Please try again.`,
          'error',
          'Check-Out Failed'
        );
        this.cdr.detectChanges();
      }
    });
  }

  calculateHours(record: AttendanceRecord): number {
    if (!record.checkInAt || !record.checkOutAt) return 0;
    const start = new Date(record.checkInAt).getTime();
    const end = new Date(record.checkOutAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return Math.round(((end - start) / 3_600_000) * 100) / 100;
  }

  formatTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  getEmployeeInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  trackByRecordId(_index: number, record: AttendanceRecord): string {
    return record.id;
  }

  trackByUserId(_index: number, user: User): string {
    return String(user.id);
  }


  private getLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getLocalMonthKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  }
}
