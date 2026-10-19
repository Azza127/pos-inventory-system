import { Injectable, inject} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CashMovement, CashMovementReferenceType, ShiftHandover, ShiftHandoverBreakdown} from '../models/cash-movement.model';
  
@Injectable({ providedIn: 'root' })
  export class CashMovementService {
    // HTTP
    private readonly http = inject(HttpClient);

    // API URLS
    private readonly cashMovementsApiUrl = 'http://localhost:3000/cashMovements';
    private readonly handoversApiUrl = 'http://localhost:3000/shiftHandovers';
  
    // CASH MOVEMENTS
    getCashMovements(): Observable<CashMovement[]> {
      return this.http.get<CashMovement[]>( this.cashMovementsApiUrl );
    }
  
    getCashMovementsByShift( shiftId: string ): Observable<CashMovement[]> {
      return this.http.get<CashMovement[]>( `${this.cashMovementsApiUrl}?shiftId=${encodeURIComponent(shiftId)}`);
    }
  
    getCashMovementsByReference( referenceType: CashMovementReferenceType, referenceId: string ):
      Observable<CashMovement[]> {
      return this.http.get<CashMovement[]>(
        `${this.cashMovementsApiUrl}` + `?referenceType=${encodeURIComponent(referenceType)}` + `&referenceId=${encodeURIComponent(referenceId)}`
      );
    }
  
    createCashMovement( movement: Omit<CashMovement, 'id'> ): Observable<CashMovement> {
      const payload: Omit< CashMovement, 'id' > = { ...movement, amount: Number(movement.amount) || 0 };
      return this.http.post<CashMovement>( this.cashMovementsApiUrl, payload);
    }
  
    deleteCashMovement( id: string ): Observable<void> {
      return this.http.delete<void>(`${this.cashMovementsApiUrl}/${id}` );
    }
  
    // SHIFT HANDOVERS
    getShiftHandovers(): Observable<ShiftHandover[]> {
      return this.http.get<ShiftHandover[]>( this.handoversApiUrl);
    }
  
    getShiftHandoverByShift( shiftId: string ): Observable<ShiftHandover[]> {
      return this.http.get<ShiftHandover[]>(
        `${this.handoversApiUrl}?shiftId=${encodeURIComponent(shiftId)}`
      );
    }
  
    createShiftHandover( handover: Omit<ShiftHandover, 'id'> ): Observable<ShiftHandover> {
      const breakdown: ShiftHandoverBreakdown[] = handover.breakdown.map(
          ( item: ShiftHandoverBreakdown ): ShiftHandoverBreakdown => {
            return {
              accountId: item.accountId,
              accountName: item.accountName,
              amount: Number(item.amount) || 0
            };
          }
        );
      const payload: Omit< ShiftHandover, 'id' > = { ...handover, totalAmount: Number(handover.totalAmount) || 0, breakdown };
      return this.http.post<ShiftHandover>( this.handoversApiUrl, payload );
    }
  
    deleteShiftHandover( id: string ): Observable<void> {
      return this.http.delete<void>( `${this.handoversApiUrl}/${id}` );
    }
  }