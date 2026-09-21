import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ReturnTransaction, ReturnType} from '../models/return.model';

@Injectable({ providedIn: 'root' })
export class ReturnService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = 'http://localhost:3000/returns';

  // GET ALL RETURNS
    getReturns(): Observable<ReturnTransaction[]> {
    return this.http
        .get<ReturnTransaction[]>(this.apiUrl)
        .pipe(map((returns) => returns.map((item) => ({ ...item, id: String(item.id), type: item.type,
                referenceId: String(item.referenceId),
                referenceNumber: String(item.referenceNumber),
                createdAt: item.createdAt,
                items: (item.items || []).map((returnItem) => ({...returnItem,
                    productId: String(returnItem.productId),
                    productName: String(returnItem.productName),
                    sku: String(returnItem.sku),
                    quantity: Number(returnItem.quantity || 0),
                    unitPrice: Number(returnItem.unitPrice || 0),
                    costPrice: returnItem.costPrice !== undefined ? Number(returnItem.costPrice) : undefined,
                    total: Number(returnItem.total || 0)
                })
            ),
            total:Number(item.total || 0)
            }))
        )
        );
    }

  // GET RETURNS BY TYPE
    getReturnsByType( type: ReturnType ): Observable<ReturnTransaction[]> {
    return this.getReturns().pipe(
        map((returns) =>returns.filter(
            (item) => item.type === type)
        )
    );
    }

  // GET RETURNS FOR ORIGINAL TRANSACTION
    getReturnsByReference( type: ReturnType, referenceId: string ): Observable<ReturnTransaction[]> {
    return this.getReturns().pipe(
        map((returns) => returns.filter((item) =>
            item.type === type && String(item.referenceId) === String(referenceId))
        )
    );
    }

  // CREATE RETURN
    createReturn(returnTransaction: Omit < ReturnTransaction, 'id' >): Observable<ReturnTransaction> {
    return this.http.post<ReturnTransaction>( this.apiUrl, returnTransaction)
        .pipe( map((createdReturn) => ({...createdReturn,
            id: String(createdReturn.id), referenceId: String( createdReturn.referenceId),
            referenceNumber: String( createdReturn.referenceNumber ),
            items:(createdReturn.items || []).map((item) => ({ ...item,
            productId: String(item.productId), quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            costPrice: item.costPrice !== undefined ? Number(item.costPrice) : undefined,
            total: Number(item.total || 0) })),
            total: Number( createdReturn.total || 0 )
        }))
        );
    }

  // DELETE RETURN
  // We may use this later for an admin/cancel flow.
  // The Returns page itself will NOT delete returns yet.
    deleteReturn(id: string): Observable<void> {
        return this.http.delete<void>( `${this.apiUrl}/${id}`);
    }
}