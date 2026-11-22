import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DocumentService } from '../../core/services/document.service';
import { EmailDocumentComponent } from './email-document.component';

@Component({
  selector: 'ns-subscription-documents', standalone: true, imports: [CommonModule, EmailDocumentComponent],
  template: `<details class="card" style="padding:16px;margin:16px 0" (toggle)="opened($event)">
    <summary>Recibos de suscripción PDF</summary>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (loading()) { <p>Cargando recibos…</p> }
    @for (r of receipts(); track r.id) {
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 0">
        <span>{{ r.plan_name }} · {{ r.amount | number:'1.2-2' }} {{ r.currency }} · {{ r.paid_at | date:'dd/MM/yyyy' }}</span>
        <button class="btn-outline" (click)="download(r.id)">Descargar recibo PDF</button>
        <ns-email-document [pdfPath]="'/subscriptions/receipts/' + r.id + '/pdf'" />
      </div>
    } @empty { @if (!loading()) { <p>Los recibos aparecen después de confirmar el pago.</p> } }
  </details>`,
})
export class SubscriptionDocumentsComponent {
  private http = inject(HttpClient); private documents = inject(DocumentService);
  receipts = signal<any[]>([]); error = signal(''); loading = signal(false);
  opened(event: Event) {
    if (!(event.target as HTMLDetailsElement).open) return;
    this.loading.set(true); this.error.set('');
    this.http.get<any[]>(`${environment.apiUrl}/subscriptions/receipts`).subscribe({
      next: data => { this.receipts.set(data); this.loading.set(false); },
      error: () => { this.error.set('No se pudieron cargar los recibos.'); this.loading.set(false); },
    });
  }
  download(id: string) {
    this.documents.download('/subscriptions/receipts/' + id + '/pdf', 'Recibo_suscripcion_' + id + '.pdf').subscribe({error: () => this.error.set('No se pudo descargar el recibo PDF.')});
  }
}
