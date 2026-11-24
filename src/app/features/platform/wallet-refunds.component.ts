import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector:'ns-wallet-refunds',standalone:true,imports:[CommonModule,FormsModule],
  template:`
    <section aria-labelledby="refund-title">
      <h2 id="refund-title">Devoluciones de Premium IA a wallet</h2>
      <p>Se devuelve todo lo pagado como saldo para consultas. Al aprobar, se cierra el Premium de ese período. No se devuelve dinero a PayPal.</p>
      <button type="button" (click)="load()" [disabled]="loading() || busy()">Actualizar solicitudes</button>
      @if (error()) { <p role="alert">{{ error() }}</p> }
      @if (message()) { <p role="status">{{ message() }}</p> }
      @if (loading()) { <p role="status">Cargando solicitudes…</p> }
      @for (r of items(); track r.id) {
        <article>
          <h3>{{ r.buyer_name }}</h3><p>{{ r.buyer_email }}</p>
          <p>{{ r.amount | number:'1.2-2' }} {{ r.currency }} · {{ label(r.status) }}</p>
          @if (r.is_sandbox) { <p>Sandbox · operación de prueba</p> }
          <p>Solicitado: {{ r.created_at | date:'dd/MM/yyyy HH:mm' }}</p>
          <p>Motivo: {{ r.reason }}</p>
          @if (r.status === 'PENDING') {
            @if (selected()?.id === r.id) {
              <p><strong>{{ decision === 'APPROVED' ? 'Confirmar abono total a wallet y cierre de Premium' : 'Confirmar rechazo sin abonar saldo' }}</strong></p>
              <label [for]="'reason-' + r.id">Motivo de la decisión</label>
              <textarea [id]="'reason-' + r.id" [(ngModel)]="reason" maxlength="500" rows="3" [disabled]="busy()"></textarea>
              <button type="button" (click)="confirm()" [disabled]="busy() || reason.trim().length < 3">Confirmar decisión</button>
              <button type="button" (click)="selected.set(null)" [disabled]="busy()">Volver</button>
            } @else {
              <button type="button" (click)="choose(r,'APPROVED')" [disabled]="busy()">Aprobar devolución total</button>
              <button type="button" (click)="choose(r,'REJECTED')" [disabled]="busy()">Rechazar</button>
            }
          } @else { <p>Decisión: {{ r.decision_reason }} · {{ r.decided_at | date:'dd/MM/yyyy HH:mm' }}</p> }
        </article>
      } @empty { @if (!loading()) { <p>No hay solicitudes de devolución.</p> } }
      <p>{{ total() }} solicitudes</p>
      <button type="button" (click)="page(-20)" [disabled]="offset === 0 || busy() || loading()">Anterior</button>
      <button type="button" (click)="page(20)" [disabled]="offset + items().length >= total() || busy() || loading()">Siguiente</button>
    </section>`,
  styles:[`section{background:var(--bg-card,#fff);padding:24px;border-radius:20px}article{border:1px solid #c7d9d5;border-radius:12px;padding:16px;margin:16px 0;overflow-wrap:anywhere}textarea{display:block;width:100%;box-sizing:border-box;margin:8px 0}button{padding:10px;margin:4px;border-radius:8px;cursor:pointer}button:disabled{cursor:default;opacity:.6}[role=alert]{color:#b42318}`],
})
export class WalletRefundsComponent implements OnInit {
  private http=inject(HttpClient);
  private api=environment.apiUrl+'/platform/wallet-refunds';
  items=signal<any[]>([]);total=signal(0);loading=signal(false);busy=signal(false);
  error=signal('');message=signal('');selected=signal<any>(null);
  reason='';decision:'APPROVED'|'REJECTED'='APPROVED';offset=0;
  ngOnInit(){this.load();}
  label(status:string){return ({PENDING:'Pendiente',APPROVED:'Acreditado a wallet',REJECTED:'Rechazado'} as Record<string,string>)[status]||status;}
  page(delta:number){this.offset=Math.max(0,this.offset+delta);this.load();}
  load(){
    if(this.loading()||this.busy())return;
    this.loading.set(true);this.error.set('');
    this.http.get<any>(this.api,{params:{limit:20,offset:this.offset}}).subscribe({
      next:r=>{this.items.set(r.items);this.total.set(r.total);this.loading.set(false);},
      error:e=>{this.loading.set(false);this.error.set(e?.error?.detail||'No se pudieron cargar las solicitudes.');},
    });
  }
  choose(row:any,decision:'APPROVED'|'REJECTED'){this.selected.set(row);this.decision=decision;this.reason='';this.message.set('');}
  confirm(){
    if(this.busy()||!this.selected()||this.reason.trim().length<3)return;
    this.busy.set(true);this.error.set('');
    this.http.post(this.api+'/'+this.selected().id+'/decision',{decision:this.decision,reason:this.reason.trim()}).subscribe({
      next:()=>{this.busy.set(false);this.selected.set(null);this.message.set('Decisión guardada.');this.load();},
      error:e=>{this.busy.set(false);this.error.set(e?.error?.detail||'No se confirmó la decisión. Actualiza antes de reintentar.');},
    });
  }
}
