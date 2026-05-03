import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Category, CategoryPayload } from '../../../shared/models';
import { ApiClientService } from '../api-client.service';

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  constructor(private readonly api: ApiClientService) {}

  list(): Observable<Category[]> {
    return this.api.get<Category[]>('/categories', { per_page: 100 });
  }

  create(payload: CategoryPayload): Observable<Category> {
    return this.api.post<Category>('/categories', payload);
  }

  update(id: string, payload: CategoryPayload): Observable<Category> {
    return this.api.patch<Category>(`/categories/${id}`, payload);
  }

  delete(id: string): Observable<null> {
    return this.api.delete<null>(`/categories/${id}`);
  }
}
