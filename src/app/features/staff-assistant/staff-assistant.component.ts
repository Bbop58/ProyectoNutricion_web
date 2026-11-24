import { afterNextRender, Component, DestroyRef, effect, ElementRef, inject, Injector, signal, untracked, viewChild } from '@angular/core';
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
  fats: number; reasons: string[]; warnings: string[];
}
interface Reply {
  kind: 'patients' | 'recipes' | 'message' | 'profile' | 'confirmation' | 'assigned';
  message: string; context_token: string; patient?: Patient; patients?: Patient[]; has_more?: boolean;
  recipes?: Proposal[]; profile_details?: {label: string; value: string | number}[];
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
  private injector = inject(Injector);
  private end = viewChild<ElementRef<HTMLElement>>('chatEnd');
  private api = environment.apiUrl + '/staff-assistant/chat';
  private request?: Subscription;
  private version = 0;
  private workspaceKey = '';
  private contextToken: string | null = null;
  busy = signal(false);
  error = signal('');
  turns = signal<{id: number; question: string; reply: Reply}[]>([]);
  message = '';

  constructor() {
    effect(() => {
      const key = JSON.stringify(this.workspace.headers());
      if (key !== this.workspaceKey) {
        this.workspaceKey = key;
        untracked(() => this.reset());
      }
    });
    this.destroy.onDestroy(() => { this.version++; this.request?.unsubscribe(); });
  }
  reset() {
    this.version++;
    this.request?.unsubscribe();
    this.contextToken = null;
    this.busy.set(false);
    this.turns.set([]);
    this.error.set('');
    this.message = '';
  }
  submit() { this.send(this.message); }
  send(text: string) {
    const message = text.trim();
    if (!message || message.length > 800 || this.busy()) return;
    const version = ++this.version;
    this.busy.set(true);
    this.error.set('');
    this.request = this.http.post<Reply>(this.api, {message, context_token: this.contextToken})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({next: reply => {
        if (version !== this.version) return;
        this.contextToken = reply.context_token;
        this.turns.update(rows => [...rows.slice(-19), {id: version, question: message, reply}]);
        this.busy.set(false);
        if (this.message.trim() === message) this.message = '';
        afterNextRender(() => this.end()?.nativeElement.scrollIntoView?.({block: 'nearest'}), {injector: this.injector});
      }, error: error => {
        if (version !== this.version) return;
        this.error.set(typeof error?.error?.detail === 'string' ? error.error.detail : 'No se pudo completar el mensaje. Podés volver a enviarlo.');
        this.busy.set(false);
      }});
  }
  isLatest(id: number) { return this.turns().at(-1)?.id === id; }
}
