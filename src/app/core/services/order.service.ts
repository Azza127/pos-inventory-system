import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/orders';

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl);
  }

  getOrderById(id: string | number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${id}`);
  }

  createOrder(order: Order): Observable<Order> {
    return this.http.post<Order>(this.apiUrl, order);
  }

  updateOrder(id: string | number, order: Partial<Order>): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/${id}`, {
      ...order,
      id: String(id)
    });
  }

  updateOrderStatus(id: string | number, status: string): Observable<Order> {
    return this.http.patch<Order>(`${this.apiUrl}/${id}`, { status });
  }

  /** Remove an unsold Pending invoice; do not convert it into a Cancelled sale. */
  deleteOrder(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
