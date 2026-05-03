import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Category, CategoryPayload } from '../../../shared/models';
import { ApiClientService } from '../api-client.service';

export interface CategoryListFilters {
  text?: string;
  color?: string | null;
  sortBy?: 'label' | 'color' | 'created_at' | 'updated_at';
  sortDirection?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  constructor(private readonly api: ApiClientService) {}

  list(filters: CategoryListFilters = {}): Observable<Category[]> {
    const params: Record<string, string | number | boolean> = {
      per_page: 100,
    };

    if (filters.text) {
      params['text'] = filters.text;
    }

    if (filters.color) {
      params['color'] = filters.color;
    }

    if (filters.sortBy) {
      params['sort_by'] = filters.sortBy;
    }

    if (filters.sortDirection) {
      params['sort_direction'] = filters.sortDirection;
    }

    return this.api.get<Category[]>('/categories', params);
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
