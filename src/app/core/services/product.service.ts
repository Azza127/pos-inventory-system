import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Product } from '../models/product.model';

@Injectable({providedIn: 'root'})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/products';

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl).pipe(
      map((products) =>products.map((product) => ({...product, id: String(product.id), categoryId: String(product.categoryId)}))));
  }

  createProduct(product: Product): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product)
    .pipe(map((createdProduct) => ({ ...createdProduct, id: String(createdProduct.id), categoryId: String(createdProduct.categoryId) })));
  }

  updateProduct(id: string, product: Product): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, product)
    .pipe(map((updatedProduct) => ({...updatedProduct, id: String(updatedProduct.id), categoryId: String(updatedProduct.categoryId)})));
  }

  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}