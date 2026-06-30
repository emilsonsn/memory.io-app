import { HttpClient, HttpResponse } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Category, CategoryPayload, Memory } from '../../../shared/models';
import { API_BASE_URL } from '../api.config';
import { ApiClientService } from '../api-client.service';

export interface CategoryListFilters {
  text?: string;
  color?: string | null;
  sortBy?: 'label' | 'color' | 'created_at' | 'updated_at';
  sortDirection?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  constructor(
    private readonly api: ApiClientService,
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly apiBaseUrl: string,
  ) {}

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

  export(id: string): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.apiBaseUrl}/categories/${id}/export`, {}, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  importMemories(id: string, files: File[]): Observable<Memory[]> {
    const formData = new FormData();

    for (const file of files) {
      formData.append('files[]', file);
    }

    return this.api.post<Memory[]>(`/categories/${id}/import`, formData);
  }

  delete(id: string): Observable<null> {
    return this.api.delete<null>(`/categories/${id}`);
  }
}
