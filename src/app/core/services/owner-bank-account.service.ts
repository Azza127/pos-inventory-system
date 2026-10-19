import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { OwnerBankAccount } from '../models/owner-bank-account.model';

@Injectable({ providedIn: 'root' })
export class OwnerBankAccountService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/ownerBankAccounts';

  getOwnerBankAccounts(): Observable<OwnerBankAccount[]> {
    return this.http.get<OwnerBankAccount[]>(this.apiUrl).pipe(
      map(accounts => (accounts || []).map(account => ({
        ...account,
        id: String(account.id),
        bankName: String(account.bankName || ''),
        accountName: String(account.accountName || ''),
        accountNumberLast4: account.accountNumberLast4 ? String(account.accountNumberLast4) : undefined,
        isActive: account.isActive !== false
      })))
    );
  }

  addOwnerBankAccount(account: Omit<OwnerBankAccount, 'id'>): Observable<OwnerBankAccount> {
    return this.http.post<OwnerBankAccount>(this.apiUrl, account).pipe(
      map(created => ({
        ...created,
        id: String(created.id),
        bankName: String(created.bankName || ''),
        accountName: String(created.accountName || ''),
        accountNumberLast4: created.accountNumberLast4 ? String(created.accountNumberLast4) : undefined,
        isActive: created.isActive !== false
      }))
    );
  }
}
