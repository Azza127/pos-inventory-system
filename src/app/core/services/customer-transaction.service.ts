import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { CustomerTransaction } from '../models/customer-transaction.model';

@Injectable({
  providedIn: 'root'
})
export class CustomerTransactionService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    'http://localhost:3000/customerTransactions';

  getTransactions(): Observable<CustomerTransaction[]> {
    return this.http
      .get<CustomerTransaction[]>(this.apiUrl)
      .pipe(
        map((transactions) =>
          transactions.map((transaction) => ({
            ...transaction,
            id: String(transaction.id),
            customerId: String(transaction.customerId),
            amount: Number(transaction.amount)
          }))
        )
      );
  }

  getCustomerTransactions(
    customerId: string
  ): Observable<CustomerTransaction[]> {
    return this.getTransactions().pipe(
      map((transactions) =>
        transactions.filter(
          transaction =>
            String(transaction.customerId) ===
            String(customerId)
        )
      )
    );
  }

  addTransaction(
    transaction: Omit<CustomerTransaction, 'id'>
  ): Observable<CustomerTransaction> {

    return this.http
      .post<CustomerTransaction>(
        this.apiUrl,
        transaction
      )
      .pipe(
        map((createdTransaction) => ({
          ...createdTransaction,
          id: String(createdTransaction.id),
          customerId: String(
            createdTransaction.customerId
          ),
          amount: Number(createdTransaction.amount)
        }))
      );
  }
}