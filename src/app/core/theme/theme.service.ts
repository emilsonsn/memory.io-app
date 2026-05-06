import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storageKey = 'memoryia.theme';
  private readonly mediaQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  readonly preference = signal<ThemePreference>(this.readPreference());
  readonly resolvedTheme = signal<ResolvedTheme>(this.resolveTheme(this.preference()));
  readonly isDark = computed(() => this.resolvedTheme() === 'dark');

  constructor() {
    this.applyTheme();

    this.mediaQuery?.addEventListener('change', this.handleSystemThemeChange);
    this.destroyRef.onDestroy(() => {
      this.mediaQuery?.removeEventListener('change', this.handleSystemThemeChange);
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, preference);
    }

    this.applyTheme();
  }

  toggleTheme(): void {
    this.setPreference(this.isDark() ? 'light' : 'dark');
  }

  useSystemTheme(): void {
    this.setPreference('system');
  }

  private readonly handleSystemThemeChange = (): void => {
    if (this.preference() === 'system') {
      this.applyTheme();
    }
  };

  private applyTheme(): void {
    const theme = this.resolveTheme(this.preference());
    const root = this.document.documentElement;

    this.resolvedTheme.set(theme);
    root.dataset['theme'] = theme;
    root.dataset['themePreference'] = this.preference();
    root.style.colorScheme = theme;
  }

  private resolveTheme(preference: ThemePreference): ResolvedTheme {
    if (preference !== 'system') {
      return preference;
    }

    return this.mediaQuery?.matches ? 'dark' : 'light';
  }

  private readPreference(): ThemePreference {
    if (typeof localStorage === 'undefined') {
      return 'system';
    }

    const storedPreference = localStorage.getItem(this.storageKey);

    return storedPreference === 'light' || storedPreference === 'dark' || storedPreference === 'system'
      ? storedPreference
      : 'system';
  }
}
