import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'ns-care-workspace', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './care-workspace.component.html', styleUrl: './care-workspace.component.css',
})
export class CareWorkspaceComponent {
  readonly auth = inject(AuthService);
  private http = inject(HttpClient);
  private api = environment.apiUrl;
  busy = signal(false); error = signal(''); message = signal('');
  patients = signal<any[]>([]); contacts = signal<any[]>([]); result = signal<any>(null);
  assessments = signal<any[]>([]); plans = signal<any[]>([]); reviews = signal<any[]>([]);
  messages = signal<any[]>([]); versions = signal<any[]>([]); preview = signal<any>(null); imported = signal<any>(null);
  tab = 'progress'; patientId = ''; peerId = ''; planId = ''; text = ''; reason = ''; correction = '';
  start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA');
  end = new Date().toLocaleDateString('en-CA');
  measurementDate = this.end; weight: number | null = null; height: number | null = null;
  config: any = null; configReason = ''; csv = ''; fileName = ''; offset = 0; hasMore = false;
  private loaded = false;
  isPatient() { return this.auth.currentUser()?.role_id === 'CLIENTE'; }
  canChat() { return ['CLIENTE','NUTRICIONISTA'].includes(this.auth.currentUser()?.role_id || ''); }
  run<T>(request: Observable<T>, success: (value: T) => void) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    request.subscribe({next: value => { this.busy.set(false); success(value); }, error: e => {
      this.busy.set(false); this.error.set(typeof e?.error?.detail === 'string' ? e.error.detail : 'No se pudo completar la operación. Revisa los datos y tu conexión.');
    }});
  }
  opened(event: Event) {
    if (!(event.target as HTMLDetailsElement).open || this.loaded) return;
    this.loaded = true;
    if (this.isPatient()) {
      const user = this.auth.currentUser()!; this.patientId = user.id; this.patients.set([user]);
    } else {
      this.http.get<any[]>(this.api + '/users/patients').subscribe({next: data => { this.patients.set(data); this.patientId = data[0]?.id || ''; },error: () => this.error.set('No se pudieron cargar los pacientes.')});
      this.loadConfig();
    }
    if (this.canChat()) this.http.get<any[]>(this.api + '/care/contacts').subscribe({next: data => this.contacts.set(data),error: () => this.error.set('No se pudieron cargar los contactos.')});
  }
  selectPatient() { this.result.set(null); this.assessments.set([]); this.plans.set([]); this.reviews.set([]); this.planId = ''; }
  assess() {
    if (!this.patientId || !this.start || !this.end) return;
    this.run(this.http.post<any>(`${this.api}/care/patients/${this.patientId}/assessments`,{start_date:this.start,end_date:this.end}), value => {
      this.result.set(value);
      this.http.get<any[]>(`${this.api}/care/patients/${this.patientId}/assessments`).subscribe({next: rows => this.assessments.set(rows),error: () => this.error.set('No se pudo cargar el historial de evaluaciones.')});
    });
  }
  addMeasurement() {
    if (!this.patientId || !this.weight || !this.height || !this.measurementDate) return;
    const measured = this.measurementDate === new Date().toLocaleDateString('en-CA') ? new Date().toISOString() : this.measurementDate + 'T12:00:00-04:00';
    this.run(this.http.post(`${this.api}/care/patients/${this.patientId}/measurements`,{weight_kg:this.weight,height_cm:this.height,measured_at:measured}), () => {
      this.message.set('Medición guardada en el historial.'); this.result.set(null);
    });
  }
  chartPoints() {
    const rows = this.result()?.measurements || [];
    if (!rows.length) return '';
    const values = rows.map((r: any) => r.weight_kg); const min = Math.min(...values), max = Math.max(...values);
    return rows.map((r: any,i: number) => `${20+i*560/Math.max(rows.length-1,1)},${130-(r.weight_kg-min)*100/Math.max(max-min,1)}`).join(' ');
  }
  loadPlans() {
    if (!this.patientId) return;
    this.run(this.http.get<any[]>(`${this.api}/plans/patient/${this.patientId}`), rows => {this.plans.set(rows);this.planId = rows[0]?.id || '';this.loadReviews();});
  }
  selectedPlan() { return this.plans().find(p => p.id === this.planId); }
  loadReviews() {
    this.reviews.set([]); this.correction = this.selectedPlan()?.clinical_notes || '';
    if (this.planId) this.http.get<any[]>(`${this.api}/care/plans/${this.planId}/reviews`).subscribe({next: rows => this.reviews.set(rows),error: () => this.error.set('No se pudo cargar el historial de decisiones.')});
  }
  review(decision: string) {
    this.run(this.http.post(`${this.api}/care/plans/${this.planId}/reviews`,{decision,reason:this.reason,clinical_notes:this.correction}), () => {
      this.reason = ''; this.message.set('Decisión profesional registrada.'); this.loadPlans();
    });
  }
  loadThread(reset = true) {
    if (!this.peerId) { this.messages.set([]); return; }
    if (reset) this.offset = 0;
    this.run(this.http.get<any>(`${this.api}/care/conversations/${this.peerId}`,{params:{offset:this.offset}}), value => {this.messages.set(value.items);this.hasMore = value.has_more;});
  }
  older() { this.offset += 50; this.loadThread(false); }
  send() {
    if (!this.peerId || !this.text.trim()) return;
    this.run(this.http.post(`${this.api}/care/conversations/${this.peerId}`,{content:this.text}), () => {this.text = '';this.loadThread();});
  }
  loadConfig() {
    this.http.get(this.api + '/care/configuration').subscribe({next: value => this.config = value,error: () => this.error.set('No se pudo cargar la configuración.')});
  }
  saveConfig() {
    this.run(this.http.put(this.api + '/care/configuration',{values:this.config.values,reason:this.configReason}), value => {
      this.config = value;this.configReason = '';this.message.set('Nueva versión guardada. Las evaluaciones anteriores conservan sus parámetros.');this.loadVersions();
    });
  }
  loadVersions() { this.http.get<any[]>(this.api + '/care/configuration/history').subscribe({next: value => this.versions.set(value),error: () => this.error.set('No se pudo cargar el historial de parámetros.')}); }
  async readFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]; this.preview.set(null);this.imported.set(null);this.csv = '';
    if (!file) return;
    if (file.size > 1_000_000 || !file.name.toLowerCase().endsWith('.csv')) {this.error.set('Selecciona un CSV de hasta 1 MB.');return;}
    try {this.csv = await file.text();this.fileName = file.name;this.error.set('');} catch {this.error.set('No se pudo leer el archivo.');}
  }
  template() {
    const url = URL.createObjectURL(new Blob(['full_name,email,password,phone\nPaciente Ejemplo,paciente@ejemplo.com,Cambiar123!,70000000\n'],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a');a.href = url;a.download = 'Plantilla_pacientes.csv';a.click();setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  previewImport() { this.run(this.http.post<any>(this.api + '/care/patient-imports/preview',{csv_content:this.csv}), value => {this.preview.set(value);this.imported.set(null);}); }
  confirmImport() {
    this.run(this.http.post<any>(`${this.api}/care/patient-imports/${this.preview().batch_id}/confirm`,{}), value => {this.imported.set(value);this.preview.set(null);this.csv = '';this.message.set('Importación finalizada.');});
  }
}
