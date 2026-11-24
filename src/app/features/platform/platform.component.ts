import { DocumentService } from '../../core/services/document.service';
import { WalletRefundsComponent } from './wallet-refunds.component';
import { EmailDocumentComponent } from '../../shared/ui/email-document.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PlatformService, PlatformCompany, PlatformPlan, PlatformSubscription } from './platform.service';

@Component({
  selector: 'ns-platform', standalone: true, imports: [CommonModule, FormsModule, EmailDocumentComponent, WalletRefundsComponent],
  template: `
    <div class="platform-shell">
      <aside class="platform-nav">
        <strong class="brand">NutriSalud</strong><span>Administración de plataforma</span>
        <nav aria-label="Administración global">
          @for (item of menu; track item.key) {
            <button [class.active]="tab() === item.key" (click)="navigate(item.key)">{{ item.label }}</button>
          }
        </nav>
        <div class="account"><strong>{{ auth.currentUser()?.full_name }}</strong><small>{{ auth.currentUser()?.email }}</small>
          <button (click)="auth.logout()">Cerrar sesión</button></div>
      </aside>
      <main>
        <header><div><p class="eyebrow">CONSOLA DE PLATAFORMA</p><h1>{{ heading() }}</h1></div>
          <button class="secondary" (click)="load()" [disabled]="loading() || busy()">Actualizar</button></header>
        @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
        @if (message()) { <p role="status" class="success">{{ message() }}</p> }
        @if (loading()) { <p role="status">Cargando información…</p> }
        @if (tab() === 'refunds') { <ns-wallet-refunds /> }
        @if (tab() === 'overview') {
          <form class="panel form-grid" (ngSubmit)="load()">
            <label>Empresa<select name="filterCompany" [(ngModel)]="filterCompany"><option value="">Todas</option>@for (c of filterCompanies(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }</select></label>
            <label>Altas desde<input name="filterStart" type="date" [(ngModel)]="filterStart" /></label><label>Altas hasta<input name="filterEnd" type="date" [(ngModel)]="filterEnd" /></label>
            <button [disabled]="loading()">Aplicar filtros</button>
          </form>
          @if (updatedAt()) { <p>Actualizado: {{ updatedAt() | date:'dd/MM/yyyy HH:mm' }}. {{ metricExplanation() }}</p> }
          <section class="stats">
            @for (card of cards; track card.key) {
              <article><span>{{ card.label }}</span><strong>{{ overview()[card.key] || 0 }}</strong></article>
            }
          </section>
          <section class="panel"><h2>Incidencias de la API</h2><p>Errores inesperados registrados por la API. El período filtra su fecha; las incidencias son globales y no contienen datos clínicos.</p>
            <label>Nota de resolución<input [(ngModel)]="incidentReason" placeholder="Causa corregida o medida aplicada" maxlength="500" /></label>
            <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Ruta</th><th>Error</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
              @for (i of incidents(); track i.id) { <tr><td>{{ i.created_at | date:'dd/MM/yyyy HH:mm' }}</td><td>{{ i.method }} {{ i.route }}</td><td>{{ i.error_type }}</td><td>{{ i.status }} {{ i.resolution || '' }}</td><td>@if (i.status === 'OPEN') { <button (click)="resolve(i.id)" [disabled]="busy() || incidentReason.trim().length < 3">Resolver</button> }</td></tr> }
              @empty { <tr><td colspan="5">No hay incidencias en este período.</td></tr> }
            </tbody></table></div>
          </section>
          <section class="panel"><h2>Empresas y suscripciones</h2><p>Gestiona el estado de las empresas, sus planes comerciales y la vigencia de sus suscripciones.</p>
            <button (click)="navigate('companies')">Ver empresas</button></section>
        }
        @if (tab() === 'companies') {
          <section class="panel"><form class="search" (ngSubmit)="searchCompanies()">
            <label>Buscar empresa<input name="search" [(ngModel)]="search" placeholder="Nombre de la empresa" /></label>
            <button [disabled]="loading()">Buscar</button></form>
            <div class="table-scroll"><table><thead><tr><th>Empresa</th><th>Administrador</th><th>Sucursales</th><th>Plan</th><th>Suscripción</th><th>Estado</th><th></th></tr></thead><tbody>
              @for (c of companies(); track c.id) { <tr><td><strong>{{ c.name }}</strong><small>{{ c.code }}</small></td>
                <td>{{ c.administrator?.name || 'Sin asignar' }}</td><td>{{ c.branch_count }}</td>
                <td>{{ planName(c.subscription?.plan_name) }}</td><td>{{ state(c.subscription?.status) }}</td>
                <td><span class="badge" [class.muted]="!c.is_active">{{ c.is_active ? 'Activa' : 'Inactiva' }}</span></td>
                <td><button class="secondary" (click)="manage(c)">Gestionar</button></td></tr>
              } @empty { <tr><td colspan="7">No hay empresas para esta búsqueda.</td></tr> }
            </tbody></table></div>
          </section>
        }
        @if (tab() === 'plans') {
          <section class="panel"><div class="section-title"><p>Los cambios se aplican a futuras contrataciones.</p><button (click)="newPlan()">Crear plan</button></div>
            <div class="table-scroll"><table><thead><tr><th>Plan</th><th>Precio USD</th><th>Vigencia</th><th>Pacientes</th><th>Sucursales</th><th>Estado</th><th></th></tr></thead><tbody>
              @for (p of plans(); track p.code) { <tr><td><strong>{{ p.display_name }}</strong><small>{{ p.code }}</small></td>
                <td>{{ p.price | number:'1.2-2' }}</td><td>{{ p.duration_days }} días</td><td>{{ p.max_patients ?? 'Sin límite' }}</td>
                <td>{{ p.max_branches ?? 'Sin límite' }}</td><td>{{ p.is_active ? 'Publicado' : 'Archivado' }}</td>
                <td><button class="secondary" (click)="editPlan(p)">Editar</button></td></tr>
              } @empty { <tr><td colspan="7">Todavía no hay planes.</td></tr> }
            </tbody></table></div>
          </section>
        }
        @if (tab() === 'subscriptions') {
          <section class="panel"><div class="table-scroll"><table><thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Vence</th><th>Origen</th><th>Importe</th><th>Documento</th></tr></thead><tbody>
            @for (s of subscriptions(); track s.id) { <tr><td>{{ s.company_name }}</td><td>{{ planName(s.plan_name) }}</td><td>{{ state(s.status) }}</td>
              <td>{{ s.expires_at | date:'dd/MM/yyyy' }}</td><td>{{ s.source === 'MANUAL' ? 'Asignación manual' : 'PayPal' }}</td>
              <td>{{ s.source === 'MANUAL' ? 'Sin cobro' : (s.amount | number:'1.2-2') + ' ' + s.currency }}</td><td>@if (s.source === 'MANUAL') { <button class="secondary" (click)="downloadAssignment(s.id)">Nota PDF</button><ns-email-document [pdfPath]="'/platform/subscriptions/' + s.id + '/pdf'" /> }</td></tr>
            } @empty { <tr><td colspan="7">No hay suscripciones registradas.</td></tr> }
          </tbody></table></div></section>
        }
        @if (tab() === 'audit') {
          <section class="panel"><div class="table-scroll"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Empresa o plan</th><th>Usuario</th><th>Motivo</th></tr></thead><tbody>
            @for (entry of history(); track entry.id) { <tr><td>{{ entry.created_at | date:'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ action(entry.action) }}</td><td>{{ entry.target_name }}</td><td>{{ entry.actor_name }}</td><td>{{ entry.reason }}</td></tr>
            } @empty { <tr><td colspan="5">Los cambios de la plataforma aparecerán aquí.</td></tr> }
          </tbody></table></div></section>
        }
        @if (tab() === 'companies' || tab() === 'subscriptions' || tab() === 'audit') {
          <div class="pagination"><button class="secondary" [disabled]="offset() === 0 || loading()" (click)="page(-50)">Anterior</button>
            <span>{{ total() ? offset() + 1 : 0 }}–{{ Math.min(offset() + 50, total()) }} de {{ total() }}</span>
            <button class="secondary" [disabled]="offset() + 50 >= total() || loading()" (click)="page(50)">Siguiente</button></div>
        }
      </main>
    </div>
    @if (selectedCompany(); as c) {
      <div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="company-title">
        <div class="section-title"><h2 id="company-title">{{ c.name }}</h2><button class="secondary" (click)="selectedCompany.set(null)" [disabled]="busy()">Cerrar</button></div>
        <p>{{ c.administrator?.name || 'Sin administrador' }} · {{ c.administrator?.email }}</p>
        <p>{{ c.branch_count }} sucursales · {{ c.is_active ? 'Empresa activa' : 'Empresa inactiva' }}</p>
        <p>Plan: {{ planName(c.subscription?.plan_name) }} · {{ state(c.subscription?.status) }}</p>
        @if (c.subscription?.expires_at) { <p>Vencimiento: {{ c.subscription?.expires_at | date:'dd/MM/yyyy' }}</p> }
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <label>Motivo del cambio<textarea [(ngModel)]="reason" rows="2" maxlength="500" placeholder="Explica el motivo"></textarea></label>
        <div class="actions"><button class="secondary" (click)="changeStatus(c)" [disabled]="busy() || reason.trim().length < 3">{{ c.is_active ? 'Suspender empresa' : 'Activar empresa' }}</button></div>
        <hr /><h3>Asignar plan</h3><label>Plan publicado<select [(ngModel)]="assignedPlan"><option value="">Selecciona un plan</option>
          @for (p of plans(); track p.code) { @if (p.is_active) { <option [value]="p.code">{{ p.display_name }} · {{ p.duration_days }} días</option> } }
        </select></label><p class="hint">La asignación inicia hoy y reemplaza el plan vigente. No genera un cobro.</p>
        <button (click)="assign(c)" [disabled]="busy() || !assignedPlan || reason.trim().length < 3">Asignar plan</button>
      </section></div>
    }
    @if (draft; as p) {
      <div class="modal-backdrop"><form class="dialog" role="dialog" aria-modal="true" aria-labelledby="plan-title" (ngSubmit)="savePlan()" #form="ngForm">
        <div class="section-title"><h2 id="plan-title">{{ creating ? 'Crear plan' : 'Editar plan' }}</h2><button type="button" class="secondary" (click)="draft = null" [disabled]="busy()">Cerrar</button></div>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <div class="form-grid">
          <label>Nombre<input name="display_name" [(ngModel)]="p.display_name" required minlength="2" maxlength="100" /></label>
          <label>Código<input name="code" [(ngModel)]="p.code" required pattern="[A-Z][A-Z0-9_]{1,49}" [readonly]="!creating" placeholder="EMPRESA_PLUS" /></label>
          <label>Precio en USD<input name="price" type="number" [(ngModel)]="p.price" required min="0.01" max="99999999" step="0.01" /></label>
          <label>Duración en días<input name="duration" type="number" [(ngModel)]="p.duration_days" required min="1" max="366" step="1" /></label>
          <label>Límite de pacientes<input name="patients" type="number" [(ngModel)]="p.max_patients" min="1" step="1" placeholder="Vacío: sin límite" /></label>
          <label>Límite de sucursales<input name="branches" type="number" [(ngModel)]="p.max_branches" min="1" step="1" placeholder="Vacío: sin límite" /></label>
        </div>
        <label class="checkbox"><input name="published" type="checkbox" [(ngModel)]="p.is_active" /> Publicado para nuevas contrataciones</label>
        <label>Motivo<textarea name="reason" [(ngModel)]="reason" required minlength="3" maxlength="500" rows="2"></textarea></label>
        <button [disabled]="busy() || form.invalid || reason.trim().length < 3">{{ busy() ? 'Guardando…' : 'Guardar plan' }}</button>
      </form></div>
    }
  `,
  styles: [`
    :host{display:block;background:var(--bg-page,#f3faf8);min-height:100vh;color:var(--text-primary,#123b3b)}
    .platform-shell{display:grid;grid-template-columns:225px minmax(0,1fr);min-height:100vh}.platform-nav{padding:28px 18px;background:var(--bg-card,#fff);border-right:1px solid var(--border-color,#dfece9);display:flex;flex-direction:column;gap:10px}.brand{font-size:24px;color:#087f75}.platform-nav>span,.eyebrow{font-size:12px;color:var(--text-secondary,#506c71)}nav{display:grid;gap:6px;margin-top:24px}nav button{text-align:left;background:transparent;color:inherit}nav button.active{background:#087f75;color:white}.account{margin-top:auto;padding-top:24px;display:grid;gap:8px}.account small{overflow-wrap:anywhere}
    main{padding:32px;max-width:1500px;width:100%;margin:auto}header,.section-title{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}header{margin-bottom:24px}h1{font-size:28px;margin:4px 0}h2{font-size:20px;margin:0 0 12px}h3{margin:12px 0}.panel,.stats article{background:var(--bg-card,#fff);border:1px solid var(--border-color,#dfece9);border-radius:18px;padding:22px;margin-bottom:20px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:14px}.stats article{display:grid;gap:12px}.stats strong{font-size:32px}.stats span,.hint{color:var(--text-secondary,#506c71);font-size:14px}
    button{font:inherit;border:1px solid transparent;border-radius:10px;padding:10px 16px;background:#087f75;color:white;cursor:pointer;font-weight:600}button:disabled{opacity:.5;cursor:default}.secondary{background:var(--bg-card,#fff);color:var(--text-primary,#123b3b);border-color:var(--border-color,#dfece9)}label{display:grid;gap:7px;font-size:14px;font-weight:600}input,select,textarea{font:inherit;box-sizing:border-box;width:100%;padding:10px;border:1px solid #c7dcd7;border-radius:9px;background:var(--bg-card,#fff);color:inherit}input:focus,select:focus,textarea:focus,button:focus-visible{outline:2px solid #087f75;outline-offset:2px}.search{display:flex;gap:12px;align-items:end;margin-bottom:20px}.search label{flex:1;max-width:500px}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:14px 10px;border-bottom:1px solid var(--border-color,#dfece9);white-space:nowrap}th{color:var(--text-secondary,#506c71)}td small{display:block;color:var(--text-secondary,#506c71);margin-top:4px}.badge{background:#e0f3ee;color:#06685f;border-radius:20px;padding:5px 10px}.badge.muted{background:#fce9e8;color:#9b3434}.error,.success{padding:12px;border-radius:10px;white-space:normal}.error{background:#ffeded;color:#9c2727}.success{background:#e0f3ee;color:#06685f}.pagination{display:flex;justify-content:flex-end;align-items:center;gap:12px;font-size:14px}.modal-backdrop{position:fixed;inset:0;background:#102e3270;z-index:2000;display:grid;place-items:center;padding:20px;overflow:auto}.dialog{box-sizing:border-box;width:min(650px,100%);max-height:90vh;overflow:auto;background:var(--bg-card,#fff);padding:24px;border-radius:20px;display:grid;gap:14px}.dialog p{margin:0;font-size:14px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.checkbox{display:flex;align-items:center}.checkbox input{width:auto}hr{border:0;border-top:1px solid #dfece9;width:100%}.actions{display:flex;gap:10px}
    @media(max-width:800px){.platform-shell{grid-template-columns:1fr}.platform-nav{padding:16px;border-right:0;border-bottom:1px solid #dfece9}nav{display:flex;overflow:auto;margin-top:6px}.account{margin-top:0;padding-top:8px;display:flex;align-items:center;flex-wrap:wrap}.account small{display:none}main{padding:20px}.form-grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}}
  `],
})
export class PlatformComponent implements OnInit {
  readonly auth = inject(AuthService);
  private documents = inject(DocumentService);
  downloadAssignment(id: string) {
    this.documents.download('/platform/subscriptions/' + id + '/pdf', 'Nota_plan_' + id + '.pdf').subscribe({error: () => this.error.set('No se pudo descargar la nota PDF.')});
  }
  private api = inject(PlatformService);
  readonly Math = Math;
  readonly menu = [{ key: 'overview', label: 'Inicio' }, { key: 'companies', label: 'Empresas' }, { key: 'plans', label: 'Planes' }, { key: 'subscriptions', label: 'Suscripciones' }, { key: 'refunds', label: 'Devoluciones a wallet' }, { key: 'audit', label: 'Historial de cambios' }];
  readonly cards = [{ key: 'companies', label: 'Empresas' }, { key: 'active_companies', label: 'Activas' }, { key: 'inactive_companies', label: 'Inactivas' }, { key: 'active_subscriptions', label: 'Suscripciones vigentes' }, { key: 'expiring_subscriptions', label: 'Vencen en 7 días' }];
  tab = signal('overview'); overview = signal<Record<string, number>>({}); companies = signal<PlatformCompany[]>([]);
  plans = signal<PlatformPlan[]>([]); subscriptions = signal<PlatformSubscription[]>([]); history = signal<any[]>([]);
  error = signal(''); message = signal(''); busy = signal(false); loading = signal(false); offset = signal(0); total = signal(0);
  selectedCompany = signal<PlatformCompany | null>(null);
  search = ''; reason = ''; assignedPlan = ''; draft: PlatformPlan | null = null; creating = true;
  private version = 0;
  filterCompany = ''; filterStart = ''; filterEnd = ''; incidentReason = '';
  filterCompanies = signal<PlatformCompany[]>([]); incidents = signal<any[]>([]);
  updatedAt = signal(''); metricExplanation = signal('');
  private monitorFilters() { const p: Record<string,string> = {}; if (this.filterCompany) p['tenant_id'] = this.filterCompany; if (this.filterStart) p['start_date'] = this.filterStart; if (this.filterEnd) p['end_date'] = this.filterEnd; return p; }
  resolve(id: string) { this.mutate(this.api.resolveIncident(id,this.incidentReason.trim()),'Incidencia resuelta.');this.incidentReason = ''; }
  ngOnInit() { this.load(); }
  heading() { return this.menu.find(m => m.key === this.tab())?.label || 'Inicio'; }
  navigate(tab: string) { this.tab.set(tab); this.offset.set(0); this.error.set(''); this.message.set(''); this.load(); }
  page(delta: number) { this.offset.update(n => Math.max(0, n + delta)); this.load(); }
  searchCompanies() { this.offset.set(0); this.load(); }
  load() {
    const version = ++this.version;
    this.loading.set(true); this.error.set('');
    this.api.plans().subscribe({ next: p => this.plans.set(p), error: e => this.fail(e) });
    if (this.tab() === 'overview') {
      this.api.companies().subscribe({next: data => this.filterCompanies.set(data.items),error: e => this.fail(e)});
      const params = this.monitorFilters(); delete params['tenant_id'];
      this.api.incidents(params).subscribe({next: data => { if (version === this.version) this.incidents.set(Array.isArray(data) ? data : []); },error: e => this.fail(e)});
    }
    const complete = () => { if (version === this.version) this.loading.set(false); };
    const fail = (e: any) => { if (version === this.version) { this.fail(e); complete(); } };
    if (this.tab() === 'overview') this.api.overview(this.monitorFilters()).subscribe({ next: data => { if (version === this.version) { this.overview.set(data); this.updatedAt.set(data.generated_at || ''); this.metricExplanation.set(data.explanation || ''); } complete(); }, error: fail });
    else if (this.tab() === 'plans' || this.tab() === 'refunds') complete();
    else if (this.tab() === 'companies') this.api.companies(this.search, this.offset()).subscribe({ next: data => { if (version === this.version) { this.companies.set(data.items); this.total.set(data.total); } complete(); }, error: fail });
    else if (this.tab() === 'subscriptions') this.api.subscriptions(this.offset()).subscribe({ next: data => { if (version === this.version) { this.subscriptions.set(data.items); this.total.set(data.total); } complete(); }, error: fail });
    else this.api.history(this.offset()).subscribe({ next: data => { if (version === this.version) { this.history.set(data.items); this.total.set(data.total); } complete(); }, error: fail });
  }
  manage(c: PlatformCompany) { this.selectedCompany.set(c); this.assignedPlan = ''; this.reason = ''; this.error.set(''); }
  changeStatus(c: PlatformCompany) { this.mutate(this.api.status(c.id, !c.is_active, this.reason.trim()), 'Estado de empresa actualizado.'); }
  assign(c: PlatformCompany) { this.mutate(this.api.assign(c.id, this.assignedPlan, this.reason.trim()), 'Plan asignado sin generar un cobro.'); }
  newPlan() { this.creating = true; this.reason = ''; this.error.set(''); this.draft = { code: '', display_name: '', price: 9.99, currency: 'USD', duration_days: 30, max_patients: null, max_branches: null, is_active: true }; }
  editPlan(p: PlatformPlan) { this.creating = false; this.reason = ''; this.error.set(''); this.draft = { ...p }; }
  savePlan() { if (this.draft) this.mutate(this.api.savePlan(this.draft, this.reason.trim(), this.creating), 'Plan guardado. Las suscripciones existentes conservan sus condiciones.'); }
  private mutate(request: Observable<unknown>, message: string) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    request.subscribe({ next: () => { this.busy.set(false); this.selectedCompany.set(null); this.draft = null; this.message.set(message); this.load(); }, error: e => { this.busy.set(false); this.fail(e); } });
  }
  private fail(e: any) { this.error.set(Array.isArray(e?.error?.errors) ? e.error.errors.map((x: any) => x.message).join('. ') : e?.error?.detail || 'No se pudo completar la solicitud. Intenta nuevamente.'); }
  planName(code?: string) { return this.plans().find(p => p.code === code)?.display_name || code || 'Sin plan'; }
  state(value?: string) { return ({ ACTIVE: 'Vigente', EXPIRED: 'Vencida', CANCELLED: 'Cancelada', PENDING: 'Pendiente', REPLACED: 'Reemplazada', FAILED: 'Fallida' } as Record<string, string>)[value || ''] || value || 'Sin suscripción'; }
  action(value: string) { return ({ EMPRESA_ESTADO: 'Estado de empresa', PLAN_CREADO: 'Plan creado', PLAN_EDITADO: 'Plan editado', PLAN_ASIGNADO: 'Plan asignado' } as Record<string, string>)[value] || value; }
}
