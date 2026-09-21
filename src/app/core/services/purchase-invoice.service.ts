import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { PurchaseInvoice, PurchaseInvoiceItem} from '../models/purchase-invoice.model';

@Injectable({ providedIn: 'root' })
export class PurchaseInvoiceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl =
    'http://localhost:3000/purchaseInvoices';

  // Get all purchase invoices
  getPurchaseInvoices(): Observable<PurchaseInvoice[]> {
    return this.http.get<PurchaseInvoice[]>(this.apiUrl)
      .pipe(map((invoices) =>invoices.map((invoice) => ({...invoice, id: String(invoice.id), items: invoice.items.map((item) => 
        ({ ...item, id: String(item.id), productId: String(item.productId)}))
          }))
        )
      );
  }

  // Get single purchase invoice
  getPurchaseInvoice(
    id: string
  ): Observable<PurchaseInvoice> {
    return this.http.get<PurchaseInvoice>( `${this.apiUrl}/${id}` )
      .pipe(map((invoice) => ({ ...invoice, id: String(invoice.id),items: invoice.items
        .map((item) => ({...item,id: String(item.id), productId: String(item.productId)}))
        }))
      );
  }

  // Create purchase invoice
  createPurchaseInvoice(
    invoice: PurchaseInvoice
  ): Observable<PurchaseInvoice> {
    return this.http.post<PurchaseInvoice>( this.apiUrl, invoice )
      .pipe( map((createdInvoice) => ({...createdInvoice, id: String(createdInvoice.id),items: createdInvoice.items
        .map((item) => ({ ...item, id: String(item.id), productId: String(item.productId)}))
        }))
      );
  }

  // Update purchase invoice
  updatePurchaseInvoice( id: string, invoice: PurchaseInvoice ): Observable<PurchaseInvoice> {
    return this.http.put<PurchaseInvoice>( `${this.apiUrl}/${id}`, invoice )
      .pipe(map((updatedInvoice) => ({ ...updatedInvoice, id: String(updatedInvoice.id), items: updatedInvoice.items
        .map((item) => ({ ...item, id: String(item.id), productId: String(item.productId) }))
        }))
      );
  }

  // Delete purchase invoice
  deletePurchaseInvoice(id: string): Observable<void> {
    return this.http.delete<void>( `${this.apiUrl}/${id}`);
  }
}