import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';
import { StaffAssistantComponent } from './staff-assistant.component';

describe('Professional Carlitos',()=>{
  let http:HttpTestingController;
  const headers=signal<Record<string,string>>({'X-Workspace-Company':'a','X-Workspace-Branch':'a1'});
  const patient={id:'patient',full_name:'Alex Demo'};
  const recipe={id:'recipe',title:'Pollo con arroz',category:'Cena',ingredients:'Pollo y arroz',instructions:'Cocinar.',
    servings:1,calories:400,protein:30,carbohydrates:40,fats:12,reasons:['Proteínas por porción.'],warnings:[],proposal_token:'signed-proposal'};
  beforeEach(()=>{
    headers.set({'X-Workspace-Company':'a','X-Workspace-Branch':'a1'});
    TestBed.configureTestingModule({imports:[StaffAssistantComponent],providers:[provideHttpClient(),provideHttpClientTesting(),
      {provide:WorkspaceContextService,useValue:{headers}}]});
    http=TestBed.inject(HttpTestingController);
  });
  afterEach(()=>http.verify());
  function setup(){const fixture=TestBed.createComponent(StaffAssistantComponent);fixture.detectChanges();return fixture;}
  function button(f:any,label:string){return Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(b=>b.textContent?.trim()===label)!;}

  it('does not request AI on opening and provides a clearly labelled composer',()=>{
    const f=setup();
    expect(f.nativeElement.textContent).toContain('Carlitos');
    expect(f.nativeElement.querySelector('label[for=carlitos-message]')).toBeTruthy();
    http.expectNone(()=>true);
  });
  it('resolves ambiguity through selection and requires two explicit clicks before assigning',async()=>{
    const f=setup(),c=f.componentInstance;
    c.message='Recomendale una cena a Alex';c.submit();
    const query=http.expectOne(r=>r.url.endsWith('/staff-assistant/query'));
    expect(query.request.body.intent).toBeUndefined();
    query.flush({kind:'patients',message:'Elegí el paciente correcto.',patients:[patient,{id:'other',full_name:'Alex Segundo'}],pending_action:'recommend',meal:'Cena'});
    await f.whenStable();expect(f.nativeElement.textContent).toContain('Alex Segundo');
    expect(c.selected()).toBeNull();
    c.selectPatient(patient);
    const selected=http.expectOne(r=>r.url.endsWith('/staff-assistant/query'));
    expect(selected.request.body).toMatchObject({intent:'recommend',meal:'Cena',patient_id:'patient'});
    selected.flush({kind:'recipes',message:'Revisa la propuesta.',patient,recipes:[recipe],meal:'Cena'});
    await f.whenStable();button(f,'Asignar receta').click();await f.whenStable();
    http.expectNone(r=>r.url.endsWith('/confirm'));
    expect(f.nativeElement.textContent).toContain('Confirmar asignación');
    button(f,'Confirmar asignación').click();c.confirm();
    const assignment=http.expectOne(r=>r.url.endsWith('/staff-assistant/confirm'));
    expect(assignment.request.body).toEqual({proposal_token:'signed-proposal'});
    assignment.flush({message:'Receta asignada.'});await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Receta asignada.');
    expect(c.pending()).toBeNull();
  });
  it('searches and requests alternatives without sending chat history or clinical data to the interpreter',()=>{
    const f=setup(),c=f.componentInstance;c.search='Alex';c.searchPatients();
    http.expectOne(r=>r.url.endsWith('/staff-assistant/patients')&&r.params.get('search')==='Alex').flush({patients:[patient],has_more:false});
    c.selectPatient(patient);c.recommend();
    http.expectOne(r=>r.url.endsWith('/query')).flush({kind:'recipes',message:'Opciones.',patient,recipes:[recipe],meal:'Cena'});
    c.more();
    const alternative=http.expectOne(r=>r.url.endsWith('/query'));
    expect(alternative.request.body).toEqual({message:'Mostrar otras recetas',patient_id:'patient',intent:'recommend',meal:'Cena',exclude_recipe_ids:['recipe']});
    alternative.flush({kind:'recipes',message:'No hay más opciones.',patient,recipes:[]});
  });
  it('clears patient, proposals and pending responses when the workspace changes',async()=>{
    const f=setup(),c=f.componentInstance;c.selectPatient(patient);c.recommend();
    const request=http.expectOne(r=>r.url.endsWith('/query'));
    headers.set({'X-Workspace-Company':'a','X-Workspace-Branch':'a2'});
    await f.whenStable();
    expect(request.cancelled).toBe(true);expect(c.selected()).toBeNull();expect(c.reply()).toBeNull();
    expect(c.pending()).toBeNull();expect(c.history()).toEqual([]);expect(c.busy()).toBe(false);
  });
  it('preserves a failed typed query for retry and shows the server error',async()=>{
    const f=setup(),c=f.componentInstance;c.message='Cena para Alex';c.submit();
    http.expectOne(r=>r.url.endsWith('/query')).flush({detail:'IA temporalmente ocupada.'},{status:503,statusText:'Unavailable'});
    await f.whenStable();expect(c.message).toBe('Cena para Alex');
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('IA temporalmente ocupada.');
    expect(c.busy()).toBe(false);
  });
});
