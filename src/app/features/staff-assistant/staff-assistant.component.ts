import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';
import { RecipeImageComponent } from '../../shared/ui/recipe-image.component';
import { IconComponent } from '../../shared/ui/icon.component';

interface Patient { id: string; full_name: string; }
interface Proposal {
  id: string; title: string; image_url?: string; category: string; ingredients: string;
  instructions: string; servings: number; calories: number; protein: number; carbohydrates: number;
  fats: number; reasons: string[]; warnings: string[]; proposal_token: string;
}
interface Reply {
  kind: 'patients' | 'recipes' | 'help'; message: string; patient?: Patient; patients?: Patient[];
  has_more?: boolean; pending_action?: string; meal?: string; recipes?: Proposal[];
  profile?: {goal: string; allergies: string | null; pathologies: string | null; preferences: string | null};
}

@Component({
  imports: [FormsModule, RecipeImageComponent, IconComponent],
  standalone: true,
  selector: 'app-staff-assistant',
  styleUrl: './staff-assistant.component.css',
  templateUrl: './staff-assistant.component.html',
})
export class StaffAssistantComponent {
  private http = inject(HttpClient);
  private workspace = inject(WorkspaceContextService);
  private destroy = inject(DestroyRef);
  private api = environment.apiUrl + '/staff-assistant';
  private request?: Subscription;
  private version = 0;
  private context = '';
  private seen: string[] = [];
  busy = signal(false);
  error = signal('');
  success = signal('');
  selected = signal<Patient | null>(null);
  reply = signal<Reply | null>(null);
  pending = signal<Proposal | null>(null);
  history = signal<{question: string; answer: string}[]>([]);
  showSearch = signal(false);
  message = '';
  search = '';

  constructor() {
    effect(() => {
      const context = JSON.stringify(this.workspace.headers());
      if (context !== this.context) {
        this.context = context;
        untracked(() => this.reset());
      }
    });
    this.destroy.onDestroy(() => {this.version++;this.request?.unsubscribe();});
  }
  reset() {
    this.version++;this.request?.unsubscribe();this.seen=[];
    this.busy.set(false);this.selected.set(null);this.reply.set(null);this.pending.set(null);
    this.history.set([]);this.error.set('');this.success.set('');this.showSearch.set(false);
    this.message='';this.search='';
  }
  private failure(error: any) {
    this.error.set(typeof error?.error?.detail === 'string' ? error.error.detail : 'No se pudo completar la consulta. Intenta de nuevo.');
    this.busy.set(false);this.pending.set(null);
  }
  searchPatients() {
    if (this.busy()) return;
    const version=++this.version;
    this.busy.set(true);this.error.set('');this.success.set('');this.pending.set(null);this.reply.set(null);
    this.request=this.http.get<{patients:Patient[];has_more:boolean}>(this.api+'/patients',{params:{search:this.search.trim()}})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({next:data=>{
        if(version!==this.version)return;
        this.busy.set(false);this.reply.set({...data,kind:'patients',message:data.patients.length?'Elegí el paciente correcto.':'No encontré pacientes autorizados con ese nombre en esta sucursal.'});
      },error:error=>{if(version===this.version)this.failure(error);}});
  }
  selectPatient(patient:Patient) {
    const pendingAction=this.reply()?.pending_action;
    const meal=this.reply()?.meal || '';
    this.selected.set(patient);this.reply.set(null);this.pending.set(null);this.seen=[];
    this.showSearch.set(false);this.error.set('');this.success.set('');
    if(pendingAction==='recommend') this.ask('Recomendar receta','recommend',meal);
  }
  changePatient() {
    this.selected.set(null);this.reply.set(null);this.pending.set(null);this.seen=[];
    this.showSearch.set(true);this.search='';
  }
  submit() {
    if(!this.message.trim() || this.message.length>800 || this.busy())return;
    const text=this.message.trim();this.seen=[];this.ask(text);
  }
  recommend() {this.seen=[];this.ask('Recomendar receta','recommend');}
  more() {
    this.seen=[...new Set([...this.seen,...(this.reply()?.recipes || []).map(r=>r.id)])].slice(-32);
    this.ask('Mostrar otras recetas','recommend',this.reply()?.meal || '');
  }
  private ask(message:string,intent?:'recommend',meal='') {
    if(this.busy())return;
    const version=++this.version;
    this.busy.set(true);this.error.set('');this.success.set('');this.pending.set(null);this.reply.set(null);
    this.request=this.http.post<Reply>(this.api+'/query',{
      message,patient_id:this.selected()?.id || null,...(intent?{intent,meal}:{}),exclude_recipe_ids:this.seen,
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:data=>{
      if(version!==this.version)return;
      this.busy.set(false);this.reply.set(data);
      if(!intent && this.message.trim()===message)this.message='';
      if(data.patient)this.selected.set(data.patient);
      if(data.kind==='patients')this.selected.set(null);
      this.history.update(rows=>[...rows.slice(-3),{question:message,answer:data.message}]);
    },error:error=>{if(version===this.version)this.failure(error);}});
  }
  confirm() {
    const proposal=this.pending();if(!proposal || this.busy())return;
    const version=++this.version;
    this.busy.set(true);this.error.set('');this.success.set('');
    this.request=this.http.post<{message:string}>(this.api+'/confirm',{proposal_token:proposal.proposal_token})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({next:data=>{
        if(version!==this.version)return;
        this.busy.set(false);this.pending.set(null);this.success.set(data.message);
        this.reply.update(value=>value?{...value,recipes:value.recipes?.filter(r=>r.id!==proposal.id)}:null);
      },error:error=>{if(version===this.version)this.failure(error);}});
  }
}
