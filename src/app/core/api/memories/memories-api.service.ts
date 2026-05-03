import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Memory, MemoryPayload } from '../../../shared/models';
import { ApiClientService } from '../api-client.service';

export interface MemoryListFilters {
  categoryIds?: string[];
  withoutCategories?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MemoriesApiService {
  constructor(private readonly api: ApiClientService) {}

  list(filters: MemoryListFilters = {}): Observable<Memory[]> {
    const params: Record<string, string | number | boolean> = { per_page: 100 };

    if (filters.withoutCategories) {
      params['without_categories'] = true;
    } else if (filters.categoryIds?.length) {
      params['category_ids'] = filters.categoryIds.join(',');
    }

    return this.api.get<Memory[]>('/memories', params);
  }

  create(payload: MemoryPayload): Observable<Memory> {
    return this.api.post<Memory>('/memories', payload);
  }

  update(id: string, payload: MemoryPayload): Observable<Memory> {
    return this.api.patch<Memory>(`/memories/${id}`, payload);
  }

  delete(id: string): Observable<null> {
    return this.api.delete<null>(`/memories/${id}`);
  }
}
