import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Category } from '../models/category.model';

@Injectable({
  providedIn: 'root'
})

export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/categories';

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl)
    .pipe(map((categories) => categories.map((category) => ({ id: String(category.id), name: category.name }))) );
  }

  addCategory(category: Omit<Category, 'id'> | Partial<Category>): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, category)
    .pipe(map((createdCategory) => ({ id: String(createdCategory.id), name: createdCategory.name })));
  }

  updateCategory(id: string, category: Omit<Category, 'id'>): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/${id}`, category)
    .pipe( map((updatedCategory) => ({ id: String(updatedCategory.id), name: updatedCategory.name })));
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}