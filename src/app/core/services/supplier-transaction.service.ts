import {
    Injectable,
    inject
  } from '@angular/core';
  
  import {
    HttpClient
  } from '@angular/common/http';
  
  import {
    Observable,
    map
  } from 'rxjs';
  
  import {
    SupplierTransaction
  } from '../models/supplier-transaction.model';
  
  
  @Injectable({
    providedIn: 'root'
  })
  export class SupplierTransactionService {
  
    private readonly http =
      inject(HttpClient);
  
    private readonly apiUrl =
      'http://localhost:3000/supplierTransactions';
  
  
    // =========================================================
    // GET ALL SUPPLIER TRANSACTIONS
    // =========================================================
  
    getSupplierTransactions():
      Observable<SupplierTransaction[]> {
  
      return this.http
        .get<SupplierTransaction[]>(
          this.apiUrl
        )
        .pipe(
  
          map((transactions) =>
            (transactions || []).map(
              (transaction) => ({
  
                ...transaction,
  
                id:
                  String(
                    transaction.id
                  ),
  
                supplierId:
                  String(
                    transaction.supplierId
                  ),
  
                amount:
                  Number(
                    transaction.amount || 0
                  )
  
              })
            )
          )
  
        );
  
    }
  
  
    // =========================================================
    // GET TRANSACTIONS BY SUPPLIER
    // =========================================================
  
    getSupplierTransactionsBySupplier(
      supplierId: string
    ): Observable<SupplierTransaction[]> {
  
      return this.http
        .get<SupplierTransaction[]>(
          `${this.apiUrl}?supplierId=${supplierId}`
        )
        .pipe(
  
          map((transactions) =>
            (transactions || []).map(
              (transaction) => ({
  
                ...transaction,
  
                id:
                  String(
                    transaction.id
                  ),
  
                supplierId:
                  String(
                    transaction.supplierId
                  ),
  
                amount:
                  Number(
                    transaction.amount || 0
                  )
  
              })
            )
          )
  
        );
  
    }
  
  
    // =========================================================
    // ADD TRANSACTION
    // =========================================================
  
    addTransaction(
      transaction:
        Omit<SupplierTransaction, 'id'> |
        Partial<SupplierTransaction>
    ): Observable<SupplierTransaction> {
  
      return this.http
        .post<SupplierTransaction>(
          this.apiUrl,
          transaction
        )
        .pipe(
  
          map((createdTransaction) => ({
  
            ...createdTransaction,
  
            id:
              String(
                createdTransaction.id
              ),
  
            supplierId:
              String(
                createdTransaction.supplierId
              ),
  
            amount:
              Number(
                createdTransaction.amount || 0
              )
  
          }))
  
        );
  
    }
  
  
    // =========================================================
    // DELETE TRANSACTION
    // =========================================================
  
    deleteTransaction(
      id: string
    ): Observable<void> {
  
      return this.http
        .delete<void>(
          `${this.apiUrl}/${id}`
        );
  
    }
  
  }