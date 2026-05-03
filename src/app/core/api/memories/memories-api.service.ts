import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Memory, MemoryPayload } from '../../../shared/models';
import { ApiClientService } from '../api-client.service';

@Injectable({ providedIn: 'root' })
export class MemoriesApiService {
  constructor(private readonly api: ApiClientService) {}

  list(): Observable<Memory[]> {
    return this.api.get<Memory[]>('/memories', { per_page: 100 });
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
