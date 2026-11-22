import { ApplicationRef, Component, DestroyRef, NgZone, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { DOCUMENT } from '@angular/common';
import { filter, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'ns-app-update',
  standalone: true,
  template: `
    @if (ready()) {
      <aside class="update-notice" role="status" aria-live="polite">
        <span>Hay una nueva versión de NutriSalud. Guarda lo que estés editando y actualiza.</span>
        <button type="button" (click)="reload()">Actualizar ahora</button>
      </aside>
    }
  `,
  styles: [`
    .update-notice { position: fixed; bottom: 20px; left: 16px; right: 16px; z-index: 10000;
      max-width: 760px; margin: auto; padding: 16px; border-radius: 16px; background: #123b3b;
      color: white; box-shadow: 0 8px 24px #0003; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    button { border: 0; padding: 10px 16px; border-radius: 10px; background: white; color: #123b3b;
      font: inherit; font-weight: 700; cursor: pointer; }
  `],
})
export class AppUpdateComponent {
  readonly ready = signal(false);
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private checking = false;

  constructor() {
    if (!this.updates?.isEnabled) return;
    this.updates.versionUpdates.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.type === 'VERSION_READY') this.ready.set(true);
    });
    this.updates.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => this.ready.set(true));
    const zone = inject(NgZone);
    const win = this.document.defaultView;
    const check = () => { if (this.document.visibilityState === 'visible') void this.check(); };
    inject(ApplicationRef).isStable.pipe(filter(Boolean), take(1), takeUntilDestroyed()).subscribe(() => {
      void this.check();
      zone.runOutsideAngular(() => {
        const timer = win?.setInterval(check, 5 * 60 * 1000);
        win?.addEventListener('focus', check);
        win?.addEventListener('online', check);
        this.document.addEventListener('visibilitychange', check);
        this.destroyRef.onDestroy(() => {
          win?.clearInterval(timer);
          win?.removeEventListener('focus', check);
          win?.removeEventListener('online', check);
          this.document.removeEventListener('visibilitychange', check);
        });
      });
    });
  }

  async check(): Promise<void> {
    if (!this.updates?.isEnabled || this.checking || this.ready()) return;
    this.checking = true;
    try {
      if (await this.updates.checkForUpdate()) this.ready.set(true);
    } catch {
      // Offline use stays available; a later focus/online event retries the check.
    } finally {
      this.checking = false;
    }
  }

  reload(): void {
    this.document.defaultView?.location.reload();
  }
}
