import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, switchMap, tap, throwError } from 'rxjs';
import { SKIP_API_ERROR_TOAST } from '../api/api-error.interceptor';
import { API_BASE_URL } from '../api/api.config';
import { ApiResponse, AuthData } from '../../shared/models';
import { AuthStore } from './auth.store';

export const SKIP_AUTH_REFRESH = new HttpContextToken<boolean>(() => false);

let refreshRequest$: Observable<AuthData> | null = null;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authStore = inject(AuthStore);
  const http = inject(HttpClient);
  const router = inject(Router);
  const apiBaseUrl = inject(API_BASE_URL);
  const token = authStore.token();

  const authenticatedRequest = token
    ? request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse)
        || error.status !== 401
        || request.context.get(SKIP_AUTH_REFRESH)
        || !token
      ) {
        return throwError(() => error);
      }

      refreshRequest$ ??= http.post<ApiResponse<AuthData>>(
        `${apiBaseUrl}/auth/refresh`,
        {},
        { context: new HttpContext().set(SKIP_AUTH_REFRESH, true).set(SKIP_API_ERROR_TOAST, true) },
      ).pipe(
        map((response) => response.data),
        tap((data) => authStore.setSession(data)),
        finalize(() => refreshRequest$ = null),
      );

      return refreshRequest$.pipe(
        switchMap((data) => next(request.clone({
          setHeaders: {
            Authorization: `Bearer ${data.access_token}`,
          },
        }))),
        catchError((refreshError: unknown) => {
          authStore.clear();
          void router.navigate(['/login']);

          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
