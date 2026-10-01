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
  Supplier
} from '../models/supplier.model';


@Injectable({
  providedIn: 'root'
})
export class SupplierService {

  private readonly http =
    inject(HttpClient);

  private readonly apiUrl =
    'http://localhost:3000/suppliers';


  // =========================================================
  // GET SUPPLIERS
  // =========================================================

  getSuppliers(): Observable<Supplier[]> {

    return this.http
      .get<Supplier[]>(this.apiUrl)
      .pipe(

        map((suppliers) =>
          suppliers.map((supplier) => ({

            ...supplier,

            id:
              String(supplier.id),

            balance:
              Number(supplier.balance || 0)

          }))
        )

      );

  }


  // =========================================================
  // GET SINGLE SUPPLIER
  // =========================================================

  getSupplier(
    id: string
  ): Observable<Supplier> {

    return this.http
      .get<Supplier>(
        `${this.apiUrl}/${id}`
      )
      .pipe(

        map((supplier) => ({

          ...supplier,

          id:
            String(supplier.id),

          balance:
            Number(supplier.balance || 0)

        }))

      );

  }


  // =========================================================
  // ADD SUPPLIER
  // =========================================================

  addSupplier(
    supplier:
      Omit<Supplier, 'id'> |
      Partial<Supplier>
  ): Observable<Supplier> {

    return this.http
      .post<Supplier>(
        this.apiUrl,
        supplier
      )
      .pipe(

        map((createdSupplier) => ({

          ...createdSupplier,

          id:
            String(
              createdSupplier.id
            ),

          balance:
            Number(
              createdSupplier.balance || 0
            )

        }))

      );

  }


  // =========================================================
  // UPDATE SUPPLIER
  // =========================================================

  updateSupplier(
    id: string,

    supplier:
      Omit<Supplier, 'id'>
  ): Observable<Supplier> {

    return this.http
      .put<Supplier>(
        `${this.apiUrl}/${id}`,
        supplier
      )
      .pipe(

        map((updatedSupplier) => ({

          ...updatedSupplier,

          id:
            String(
              updatedSupplier.id
            ),

          balance:
            Number(
              updatedSupplier.balance || 0
            )

        }))

      );

  }


  // =========================================================
  // DELETE SUPPLIER
  // =========================================================

  deleteSupplier(
    id: string
  ): Observable<void> {

    return this.http
      .delete<void>(
        `${this.apiUrl}/${id}`
      );

  }

}

