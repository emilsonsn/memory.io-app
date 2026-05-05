import { HttpClient, HttpContext } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { MemorySet } from '../../../shared/models';
import { SKIP_API_ERROR_TOAST } from '../api-error.interceptor';
import { SETS_API_BASE_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class SetsApiService {
  constructor(
    private readonly http: HttpClient,
    @Inject(SETS_API_BASE_URL) private readonly setsApiBaseUrl: string | null,
  ) {}

  list(): Observable<MemorySet[]> {
    if (!this.setsApiBaseUrl) {
      return of([]);
    }

    return this.http.get<MemorySet[] | { data: MemorySet[] }>(`${this.setsApiBaseUrl}/sets`, {
      context: new HttpContext().set(SKIP_API_ERROR_TOAST, true),
    }).pipe(map((response) => this.unwrapResponse(response)));
  }

  private unwrapResponse<T>(response: T | { data: T }): T {
    if (response && typeof response === 'object' && 'data' in response) {
      return response.data;
    }

    return response;
  }
}
