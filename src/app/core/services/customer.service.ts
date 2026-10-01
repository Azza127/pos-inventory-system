import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Customer } from '../models/customer.model';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/customers';

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.apiUrl).pipe(
      map((customers) =>
        customers.map((customer) => ({
          ...customer,
          id: String(customer.id),
          balance: Number(customer.balance)
        }))
      )
    );
  }

  addCustomer(customer: Omit<Customer, 'id'> | Partial<Customer>): Observable<Customer> {
    return this.http.post<Customer>(this.apiUrl, customer).pipe(
      map((createdCustomer) => ({
        ...createdCustomer,
        id: String(createdCustomer.id),
        balance: Number(createdCustomer.balance)
      }))
    );
  }

  updateCustomer(
    id: string,
    customer: Omit<Customer, 'id'>
  ): Observable<Customer> {
    return this.http.put<Customer>(`${this.apiUrl}/${id}`, customer).pipe(
      map((updatedCustomer) => ({
        ...updatedCustomer,
        id: String(updatedCustomer.id),
        balance: Number(updatedCustomer.balance)
      }))
    );
  }

  deleteCustomer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}