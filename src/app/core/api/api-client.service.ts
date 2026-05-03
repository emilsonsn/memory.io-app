import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../../shared/models';
import { API_BASE_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly apiBaseUrl: string,
  ) {}

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.http.get<ApiResponse<T>>(`${this.apiBaseUrl}${path}`, {
      params: this.toParams(params),
    }).pipe(map((response) => response.data));
  }

  post<T>(path: string, payload: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(`${this.apiBaseUrl}${path}`, payload).pipe(map((response) => response.data));
  }

  patch<T>(path: string, payload: unknown): Observable<T> {
    return this.http.patch<ApiResponse<T>>(`${this.apiBaseUrl}${path}`, payload).pipe(map((response) => response.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<ApiResponse<T>>(`${this.apiBaseUrl}${path}`).pipe(map((response) => response.data));
  }

  private toParams(params?: Record<string, string | number | boolean>): HttpParams {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params ?? {})) {
      httpParams = httpParams.set(key, String(value));
    }

    return httpParams;
  }
}
