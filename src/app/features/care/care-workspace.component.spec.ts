import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { CareWorkspaceComponent } from './care-workspace.component';
import { AuthService } from '../../core/services/auth.service';

describe('Minimal nutritional care workspace', () => {
  let http: HttpTestingController;
  const user = signal<any>({id:'patient',role_id:'CLIENTE',full_name:'Ana'});
  beforeEach(() => {
    user.set({id:'patient',role_id:'CLIENTE',full_name:'Ana'});
    TestBed.configureTestingModule({imports:[CareWorkspaceComponent],providers:[provideHttpClient(),provideHttpClientTesting(),{provide:AuthService,useValue:{currentUser:user}}]});
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function open() {
    const f = TestBed.createComponent(CareWorkspaceComponent);f.detectChanges();
    f.componentInstance.opened({target:{open:true}} as unknown as Event);
    return f;
  }
  it('loads lazily and a patient can only request their own progress', () => {
    const f = open();http.expectOne(r=>r.url.endsWith('/care/contacts')).flush([]);
    expect(f.nativeElement.textContent).not.toContain('Importar pacientes');
    const c=f.componentInstance;c.start='2026-11-01';c.end='2026-11-22';c.assess();
    const req=http.expectOne(r=>r.url.endsWith('/care/patients/patient/assessments')&&r.method==='POST');
    expect(req.request.body).toEqual({start_date:'2026-11-01',end_date:'2026-11-22'});
    req.flush({adherence_percent:50,registered:4,expected:8,missing_days:['2026-11-02'],configuration:{version:1},inactivity:{alert:false},measurements:[],habits:[],notes:[],days:[],explanation:'Adherencia al registro.'});
    http.expectOne(r=>r.url.endsWith('/care/patients/patient/assessments')).flush([]);
    f.detectChanges();expect(f.nativeElement.textContent).toContain('50% de registro');expect(f.nativeElement.textContent).toContain('1 días sin registros');
  });
  it('previews CSV before confirming and displays rejected rows', () => {
    user.set({id:'admin',role_id:'ADMIN_ORGANIZATION'});
    const f=open();http.expectOne(r=>r.url.endsWith('/users/patients')).flush([]);
    http.expectOne(r=>r.url.endsWith('/care/contacts')).flush([]);
    http.expectOne(r=>r.url.endsWith('/care/configuration')).flush({version:0,values:{}});
    const c=f.componentInstance;c.tab='import';c.csv.set('full_name,email,password\nAna,ana@example.com,Password123!');c.previewImport();
    http.expectOne(r=>r.url.endsWith('/patient-imports/preview')).flush({batch_id:'batch',total:2,accepted:1,rejected:1,rows:[{row:2,full_name:'Ana',email:'ana@example.com',error:null},{row:3,full_name:'Duplicada',email:'ana@example.com',error:'Duplicada'}]});
    f.detectChanges();expect(f.nativeElement.textContent).toContain('Todavía no se crearon pacientes');
    expect(f.nativeElement.textContent).toContain('Duplicada');
    c.confirmImport();http.expectOne(r=>r.url.endsWith('/patient-imports/batch/confirm')).flush({created:1,rejected:1,errors:[]});
    f.detectChanges();expect(f.nativeElement.textContent).toContain('1 pacientes creados');
  });
  function importView() {
    user.set({id:'admin',role_id:'ADMIN_ORGANIZATION'});
    const f=open();
    http.expectOne(r=>r.url.endsWith('/users/patients')).flush([]);
    http.expectOne(r=>r.url.endsWith('/care/configuration')).flush({version:0,values:{}});
    http.expectOne(r=>r.url.endsWith('/care/contacts')).flush([]);
    f.componentInstance.tab='import';f.detectChanges();
    return f;
  }
  it('enables Analyze after asynchronous file reading without another click or manual change detection', async () => {
    const f=importView();
    const content='full_name,email,password\nPaciente Demo,demo@example.com,Password123!';
    let resolve!: (value:string)=>void;
    const pending=new Promise<string>(done=>resolve=done);
    const file={name:'Prueba_CU23_Vitalia.csv',size:content.length,text:()=>pending};
    const input=f.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input,'files',{value:[file]});
    input.dispatchEvent(new Event('change'));
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Leyendo archivo');
    resolve(content);
    await pending;await f.whenStable();
    const button=Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(b=>b.textContent?.includes('Analizar Prueba_CU23_Vitalia.csv'))!;
    expect(button).toBeTruthy();expect(button.disabled).toBe(false);
    button.click();
    const req=http.expectOne(r=>r.url.endsWith('/patient-imports/preview'));
    expect(req.request.body).toEqual({csv_content:content});
    req.flush({batch_id:'preview',total:1,accepted:1,rejected:0,rows:[]});
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('1 aceptadas');
  });
  it('clears previous CSV and reports empty or unreadable files instead of analyzing stale data', async () => {
    const f=importView();const c=f.componentInstance;
    const event=(file:any)=>({target:{files:[file]}} as unknown as Event);
    await c.readFile(event({name:'valid.csv',size:20,text:async()=>'full_name,email,password\n'}));
    expect(c.csv()).not.toBe('');
    await c.readFile(event({name:'empty.csv',size:0,text:async()=>''}));
    await f.whenStable();
    expect(c.csv()).toBe('');expect(c.fileName()).toBe('');
    expect(f.nativeElement.textContent).toContain('CSV está vacío');
    c.previewImport();http.expectNone(r=>r.url.endsWith('/patient-imports/preview'));
    await c.readFile(event({name:'failed.csv',size:20,text:async()=>{throw new Error('read failure');}}));
    await f.whenStable();expect(c.readingFile()).toBe(false);
    expect(f.nativeElement.textContent).toContain('No se pudo leer el archivo');
  });
  it('sends one professional message and refreshes the confirmed history', () => {
    const f=open();http.expectOne(r=>r.url.endsWith('/care/contacts')).flush([{id:'doctor',full_name:'Dra. Ana'}]);
    const c=f.componentInstance;c.peerId='doctor';c.text='Consulta de porciones';c.send();c.send();
    const req=http.expectOne(r=>r.url.endsWith('/care/conversations/doctor')&&r.method==='POST');expect(req.request.body.content).toBe('Consulta de porciones');req.flush({id:'message'});
    http.expectOne(r=>r.url.endsWith('/care/conversations/doctor')).flush({items:[{id:'message',sender_id:'patient',content:'Consulta de porciones'}],has_more:false});
    expect(c.text).toBe('');expect(c.messages().length).toBe(1);
  });
  it('allows the company administrator to use messages alongside clinical tools', () => {
    user.set({id:'admin',role_id:'ADMIN_ORGANIZATION'});
    const f=open();
    http.expectOne(r=>r.url.endsWith('/users/patients')).flush([]);
    http.expectOne(r=>r.url.endsWith('/care/configuration')).flush({version:0,values:{}});
    http.expectOne(r=>r.url.endsWith('/care/contacts')).flush([{id:'patient',full_name:'Ana'}]);
    f.componentInstance.tab='messages';f.detectChanges();
    expect(f.componentInstance.canChat()).toBe(true);
    expect(f.nativeElement.textContent).toContain('Enviar mensaje');
    expect(f.nativeElement.textContent).toContain('Revisión de IA');
    expect(f.nativeElement.textContent).toContain('Parámetros');
    const c=f.componentInstance;c.peerId='patient';c.text='Seguimiento desde administración';c.send();
    http.expectOne(r=>r.url.endsWith('/care/conversations/patient')&&r.method==='POST').flush({id:'m'});
    http.expectOne(r=>r.url.endsWith('/care/conversations/patient')&&r.method==='GET').flush({items:[],has_more:false});
  });
});
