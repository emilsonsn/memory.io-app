import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const toastr = inject(ToastrService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        toastr.error(extractError(error), 'Erro');
      }

      return throwError(() => error);
    }),
  );
};

function extractError(error: HttpErrorResponse): string {
  const firstError = Object.values((error.error as { errors?: Record<string, string[]> })?.errors ?? {})[0]?.[0];

  return firstError
    ?? (error.error as { message?: string })?.message
    ?? 'Nao foi possivel concluir a requisicao.';
}
