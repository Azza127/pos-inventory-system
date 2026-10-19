import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable} from 'rxjs';
import { ShiftHandover } from '../models/shift-handover.model';

@Injectable({ providedIn: 'root' })

  export class ShiftHandoverService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = 'http://localhost:3000/shiftHandovers';
    getHandovers(): Observable<ShiftHandover[]> {
      return this.http.get<ShiftHandover[]>(
        this.apiUrl
      );
    }
  
    getHandoversByShiftId( shiftId: string ): Observable<ShiftHandover[]> {
      return this.http.get<ShiftHandover[]>(`${this.apiUrl}?shiftId=${encodeURIComponent(shiftId)}`
      );
    }
  
    createHandover( handover: Omit<ShiftHandover, 'id'> ): Observable<ShiftHandover> {
      return this.http.post<ShiftHandover>( this.apiUrl, handover );
    }
  }