import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly apiBaseUrl: string,
  ) {}

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.http.get<T | { data: T }>(`${this.apiBaseUrl}${path}`, {
      params: this.toParams(params),
    }).pipe(map((response) => this.unwrapResponse(response)));
  }

  post<T>(path: string, payload: unknown): Observable<T> {
    return this.http.post<T | { data: T }>(`${this.apiBaseUrl}${path}`, payload).pipe(map((response) => this.unwrapResponse(response)));
  }

  patch<T>(path: string, payload: unknown): Observable<T> {
    return this.http.patch<T | { data: T }>(`${this.apiBaseUrl}${path}`, payload).pipe(map((response) => this.unwrapResponse(response)));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T | { data: T }>(`${this.apiBaseUrl}${path}`).pipe(map((response) => this.unwrapResponse(response)));
  }

  private toParams(params?: Record<string, string | number | boolean>): HttpParams {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params ?? {})) {
      httpParams = httpParams.set(key, String(value));
    }

    return httpParams;
  }

  private unwrapResponse<T>(response: T | { data: T }): T {
    if (response && typeof response === 'object' && 'data' in response) {
      return response.data;
    }

    return response;
  }
}
