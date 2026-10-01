import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { PaymentAccount } from '../models/payment-account.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentAccountService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    'http://localhost:3000/paymentAccounts';


  // =========================================================
  // GET PAYMENT ACCOUNTS
  // =========================================================

  getPaymentAccounts(): Observable<PaymentAccount[]> {

    return this.http
      .get<PaymentAccount[]>(this.apiUrl)
      .pipe(
        map((accounts) =>
          accounts.map((account) => ({
            ...account,
            id: String(account.id)
          }))
        )
      );
  }


  // =========================================================
  // GET ACTIVE PAYMENT ACCOUNTS
  // =========================================================

  getActivePaymentAccounts(): Observable<PaymentAccount[]> {

    return this.getPaymentAccounts().pipe(
      map((accounts) =>
        accounts.filter(account => account.isActive)
      )
    );
  }


  // =========================================================
  // ADD PAYMENT ACCOUNT
  // =========================================================

  addPaymentAccount(
    account: Omit<PaymentAccount, 'id'>
  ): Observable<PaymentAccount> {

    return this.http
      .post<PaymentAccount>(this.apiUrl, account)
      .pipe(
        map((createdAccount) => ({
          ...createdAccount,
          id: String(createdAccount.id)
        }))
      );
  }


  // =========================================================
  // UPDATE PAYMENT ACCOUNT
  // =========================================================

  updatePaymentAccount(
    id: string,
    account: Omit<PaymentAccount, 'id'>
  ): Observable<PaymentAccount> {

    return this.http
      .put<PaymentAccount>(
        `${this.apiUrl}/${id}`,
        account
      )
      .pipe(
        map((updatedAccount) => ({
          ...updatedAccount,
          id: String(updatedAccount.id)
        }))
      );
  }


  // =========================================================
  // DELETE PAYMENT ACCOUNT
  // =========================================================

  deletePaymentAccount(id: string): Observable<void> {

    return this.http.delete<void>(
      `${this.apiUrl}/${id}`
    );
  }

}