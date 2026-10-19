import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Shift } from '../models/shift.model';
  
@Injectable({ providedIn: 'root' })

  export class ShiftService {
    // HTTP
    private readonly http = inject(HttpClient);
    // API
    private readonly apiUrl = 'http://localhost:3000/shifts';
    // GET ALL SHIFTS
    getShifts(): Observable<Shift[]> {
      return this.http.get<Shift[]>( this.apiUrl );
    }
    // GET SHIFT BY ID
    getShiftById( id: string ): Observable<Shift> {
      return this.http.get<Shift>( `${this.apiUrl}/${id}`);
    }
    // GET OPEN SHIFTS
    getOpenShifts(): Observable<Shift[]> {
      return this.http.get<Shift[]>( `${this.apiUrl}?status=Open`
      );
    }
  
    // GET OPEN SHIFT FOR EMPLOYEE
    getOpenShiftByEmployee( employeeId: string ): Observable<Shift[]> {
      return this.http.get<Shift[]>( `${this.apiUrl}` + `?employeeId=${encodeURIComponent(employeeId)}` + `&status=Open` );
    }
  
    // CREATE / OPEN SHIFT
    openShift( shift: Omit<Shift, 'id'> ): Observable<Shift> {
      const payload: Omit<  Shift, 'id' > = { ...shift, status: 'Open', openingFloat: Number(shift.openingFloat) || 0 };
      return this.http.post<Shift>( this.apiUrl, payload );
    }
  
    // CLOSE SHIFT
    closeShift( id: string,  closedAt: string, handoverId?: string, note?: string ): Observable<Shift> {
      const payload: Partial<Shift> = { status: 'Closed', closedAt };
      if (handoverId) {
        payload.handoverId = handoverId;
      }
      if (note) { payload.note = note;
      }
      return this.http.patch<Shift>( `${this.apiUrl}/${id}`, payload );
    }
  
    // UPDATE SHIFT
    updateShift( id: string, changes: Partial<Shift> ):
      Observable<Shift> {
      return this.http.patch<Shift>( `${this.apiUrl}/${id}`, changes
      );
    }
  
    // DELETE SHIFT
    deleteShift( id: string ):  Observable<void> {
      return this.http.delete<void>( `${this.apiUrl}/${id}` );
    }
  }