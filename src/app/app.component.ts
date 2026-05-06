import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { AppLoadingService } from './core/loading/app-loading.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly loadingService = inject(AppLoadingService);
  private readonly themeService = inject(ThemeService);

  title = 'MemoryIA';

  constructor() {
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.loadingService.start();
          return;
        }

        if (
          event instanceof NavigationEnd
          || event instanceof NavigationCancel
          || event instanceof NavigationError
        ) {
          this.loadingService.stop();
        }
      });
  }
}
