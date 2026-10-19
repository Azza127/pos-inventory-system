import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AttendanceRecord } from '../models/attendance-record.model';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/attendanceRecords';

  getRecords(): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(this.apiUrl).pipe(
      map((records) => (records || []).map((record) => this.normalize(record)))
    );
  }

  createRecord(
    record: Omit<AttendanceRecord, 'id'>
  ): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(this.apiUrl, record).pipe(
      map((created) => this.normalize(created))
    );
  }

  checkOut(id: string, checkOutAt: string): Observable<AttendanceRecord> {
    return this.http.patch<AttendanceRecord>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      { checkOutAt }
    ).pipe(
      map((updated) => this.normalize(updated))
    );
  }

  private normalize(record: AttendanceRecord): AttendanceRecord {
    return {
      ...record,
      id: String(record.id),
      employeeId: String(record.employeeId),
      employeeName: String(record.employeeName || ''),
      workDate: String(record.workDate || ''),
      checkInAt: String(record.checkInAt || ''),
      checkOutAt: record.checkOutAt ? String(record.checkOutAt) : undefined
    };
  }
}
