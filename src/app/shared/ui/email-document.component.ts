import { Component, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'ns-email-document', standalone: true,
  template: `
    <button type="button" class="btn-outline" (click)="open()" [disabled]="busy() || disabled()">Enviar al correo</button>
    @if (opened()) {
      <div class="email-panel" role="group" aria-label="Enviar documento al correo">
        <label>Correo destinatario
          <input #recipient type="email" required maxlength="254" autocomplete="email"
            [value]="email()" (input)="email.set(recipient.value)" [disabled]="busy()" />
        </label>
        @if (excelPath()) {
          <div class="formats">
            <label><input type="checkbox" [checked]="pdf()" (change)="pdf.set(!pdf())" [disabled]="busy()" /> PDF</label>
            <label><input type="checkbox" [checked]="excel()" (change)="excel.set(!excel())" [disabled]="busy()" /> Excel</label>
          </div>
        }
        <div class="formats">
          <button type="button" class="btn-primary" (click)="recipient.reportValidity() && send()"
            [disabled]="disabled() || busy() || (!pdf() && !excel())">{{ busy() ? 'Enviando…' : 'Enviar' }}</button>
          <button type="button" class="btn-outline" (click)="opened.set(false)" [disabled]="busy()">Cerrar</button>
        </div>
        @if (message()) { <p role="status">{{ message() }}</p> }
        @if (error()) { <p role="alert" class="email-error">{{ error() }}</p> }
      </div>
    }
  `,
  styles: [`:host{display:inline-block;text-align:left;max-width:100%}.email-panel{padding:14px;margin:8px 0;border:1px solid #c9dfdb;border-radius:12px;background:#fff;color:#153f46;min-width:230px;max-width:360px}.email-panel>label{display:grid;gap:6px}input[type=email]{width:100%;box-sizing:border-box;padding:10px;border:1px solid #9cbbb6;border-radius:8px}.formats{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px}p{font-size:13px;white-space:normal}.email-error{color:#b42318}`],
})
export class EmailDocumentComponent {
  readonly pdfPath = input.required<string>();
  readonly excelPath = input('');
  readonly payload = input<unknown>(undefined);
  readonly disabled = input(false);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  opened = signal(false); email = signal(''); busy = signal(false);
  pdf = signal(true); excel = signal(true); message = signal(''); error = signal('');
  open() {
    this.email.set(this.auth.currentUser()?.email ?? '');
    this.message.set(''); this.error.set(''); this.opened.set(true);
  }
  send() {
    if (this.busy() || this.disabled()) return;
    const paths = [ ...(this.pdf() ? [this.pdfPath()] : []), ...(this.excelPath() && this.excel() ? [this.excelPath()] : []) ];
    if (!paths.length) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    const endpoint = this.auth.currentUser()?.role_id === 'SUPERADMIN' ? '/platform/documents/email' : '/documents/email';
    this.http.post<{message: string}>(environment.apiUrl + endpoint,
      {email: this.email().trim(), paths, report_request: this.payload()}).subscribe({
      next: () => { this.busy.set(false); this.message.set('Enviado a ' + this.email().trim() + '.'); },
      error: err => { this.busy.set(false); this.error.set(typeof err?.error?.detail === 'string' ? err.error.detail : 'No se pudo enviar. Revisa el correo e intenta nuevamente.'); },
    });
  }
}
