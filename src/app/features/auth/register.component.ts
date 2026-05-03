import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UsersApiService } from '../../core/api/users/users-api.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly usersApi = inject(UsersApiService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }

    const payload = this.form.getRawValue();

    if (payload.password !== payload.password_confirmation) {
      this.error.set('As senhas precisam ser iguais.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.usersApi.register(payload).subscribe({
      next: () => void this.router.navigate(['/login']),
      error: (error: HttpErrorResponse) => {
        const firstError = Object.values((error.error as { errors?: Record<string, string[]> })?.errors ?? {})[0]?.[0];
        this.error.set(firstError ?? 'Nao foi possivel criar o usuario agora.');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
