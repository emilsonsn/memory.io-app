import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Memory, MemoryPayload } from '../../../shared/models';
import { ApiClientService } from '../api-client.service';

export interface MemoryListFilters {
  categoryIds?: string[];
  withoutCategories?: boolean;
  categoryPresence?: 'all' | 'without';
  text?: string;
  color?: string | null;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: 'title' | 'color' | 'due_date' | 'created_at' | 'updated_at';
  sortDirection?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class MemoriesApiService {
  constructor(private readonly api: ApiClientService) {}

  list(filters: MemoryListFilters = {}): Observable<Memory[]> {
    const params: Record<string, string | number | boolean> = { per_page: 100 };

    if (filters.withoutCategories) {
      params['without_categories'] = true;
    } else if (filters.categoryPresence === 'without') {
      params['without_categories'] = true;
    } else if (filters.categoryIds?.length) {
      params['category_ids'] = filters.categoryIds.join(',');
    }

    this.addParam(params, 'text', filters.text);
    this.addParam(params, 'color', filters.color);
    this.addParam(params, 'created_from', filters.createdFrom);
    this.addParam(params, 'created_to', filters.createdTo);
    this.addParam(params, 'updated_from', filters.updatedFrom);
    this.addParam(params, 'updated_to', filters.updatedTo);
    this.addParam(params, 'due_from', filters.dueFrom);
    this.addParam(params, 'due_to', filters.dueTo);
    this.addParam(params, 'sort_by', filters.sortBy);
    this.addParam(params, 'sort_direction', filters.sortDirection);

    return this.api.get<Memory[]>('/memories', params);
  }

  create(payload: MemoryPayload): Observable<Memory> {
    return this.api.post<Memory>('/memories', payload);
  }

  duplicate(id: string): Observable<Memory> {
    return this.api.post<Memory>(`/memories/${id}/duplicate`, {});
  }

  update(id: string, payload: MemoryPayload): Observable<Memory> {
    return this.api.patch<Memory>(`/memories/${id}`, payload);
  }

  delete(id: string): Observable<null> {
    return this.api.delete<null>(`/memories/${id}`);
  }

  private addParam(params: Record<string, string | number | boolean>, key: string, value?: string | null): void {
    if (value) {
      params[key] = value;
    }
  }
}
