import { InjectionToken } from '@angular/core';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'https://memory.techsoul.com.br/api',
});

export const SETS_API_BASE_URL = new InjectionToken<string | null>('SETS_API_BASE_URL', {
  providedIn: 'root',
  factory: () => null,
});

// Quando o backend Rust de sets estiver publicado, habilite assim:
// export const SETS_API_BASE_URL = new InjectionToken<string | null>('SETS_API_BASE_URL', {
//   providedIn: 'root',
//   factory: () => 'https://sua-api-rust.com/api',
// });

// export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
//   providedIn: 'root',
//   factory: () => 'http://localhost/api',
// });
