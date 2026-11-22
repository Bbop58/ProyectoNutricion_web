import { PwaInstallComponent } from './shared/ui/pwa-install.component';
import { AppUpdateComponent } from './shared/ui/app-update.component';
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, PwaInstallComponent, AppUpdateComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('web');
}
