import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';
import { StaffAssistantComponent } from './staff-assistant.component';

describe('Conversational Carlitos', () => {
  let http: HttpTestingController;
  const headers = signal<Record<string,string>>({'X-Workspace-Company':'a','X-Workspace-Branch':'a1'});
  beforeEach(() => {
    headers.set({'X-Workspace-Company':'a','X-Workspace-Branch':'a1'});
    TestBed.configureTestingModule({imports:[StaffAssistantComponent], providers:[provideHttpClient(),provideHttpClientTesting(),
      {provide:WorkspaceContextService,useValue:{headers}}]});
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function setup() { const f = TestBed.createComponent(StaffAssistantComponent); f.detectChanges(); return f; }
  function request() { return http.expectOne(r => r.url.endsWith('/staff-assistant/chat')); }

  it('opens a single labelled composer without AI requests or separate search forms', () => {
    const f = setup();
    expect(f.nativeElement.querySelectorAll('textarea').length).toBe(1);
    expect(f.nativeElement.querySelector('label[for=carlitos-message]')).toBeTruthy();
    expect(f.nativeElement.textContent).not.toContain('Nombre del paciente');
    http.expectNone(() => true);
  });
  it('keeps conversational context and submits ordinal selection and confirmation through the same chat', async () => {
    const f = setup(), c = f.componentInstance;
    c.message='Buscá Alex'; c.submit();
    const first=request(); expect(first.request.body).toEqual({message:'Buscá Alex',context_token:null});
    // expectOne returns the same outstanding request until flushed.
    first.flush({kind:'patients',message:'¿Trabajamos con Alex?',context_token:'patient-context',patients:[{id:'p',full_name:'Alex Demo'}]});
    c.send('sí');
    const yes=request(); expect(yes.request.body).toEqual({message:'sí',context_token:'patient-context'});
    yes.flush({kind:'recipes',message:'Opciones para Alex.',context_token:'recipes-context',recipes:[]});
    c.send('Asignale la segunda');
    request().flush({kind:'confirmation',message:'¿Confirmás asignar la receta a Alex?',context_token:'pending-context'});
    await f.whenStable();
    const button=Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(b=>b.textContent?.trim()==='Confirmar asignación')!;
    button.click(); c.send('Confirmo');
    const confirm=request(); expect(confirm.request.body).toEqual({message:'Confirmo',context_token:'pending-context'});
    confirm.flush({kind:'assigned',message:'Receta asignada.',context_token:'done-context'});
    await f.whenStable();
    expect(c.turns().length).toBe(4);
    expect(f.nativeElement.textContent).toContain('Receta asignada.');
    expect(f.nativeElement.textContent).toContain('Buscá Alex');
    http.expectNone(r=>r.url.endsWith('/confirm') || r.url.endsWith('/query'));
  });
  it('resets conversation and cancels pending work when the workspace changes', async () => {
    const f=setup(),c=f.componentInstance;
    c.send('hola');const pending=request();
    headers.set({'X-Workspace-Company':'a','X-Workspace-Branch':'a2'});
    await f.whenStable();
    expect(pending.cancelled).toBe(true);
    expect(c.turns()).toEqual([]);
    c.send('hola');const fresh=request();expect(fresh.request.body.context_token).toBeNull();
    fresh.flush({kind:'message',message:'Hola',context_token:'new'});
  });
  it('keeps the typed message on error and clears all context for a new chat', () => {
    const f=setup(),c=f.componentInstance;
    c.message='Una cena para Alex';c.submit();request().flush({detail:'Servicio temporalmente ocupado'},{status:503,statusText:'Unavailable'});
    expect(c.message).toBe('Una cena para Alex');expect(c.error()).toContain('ocupado');
    c.reset();c.send('hola');const fresh=request();expect(fresh.request.body.context_token).toBeNull();
    fresh.flush({kind:'message',message:'Hola',context_token:'fresh'});
  });
});
