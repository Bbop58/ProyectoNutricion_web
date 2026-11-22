import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { EmailDocumentComponent } from './email-document.component';
import { AuthService } from '../../core/services/auth.service';

describe('Document email', () => {
  const user = signal<any>({ email: 'account@example.com', role_id: 'CLIENTE' });
  let http: HttpTestingController;
  beforeEach(() => {
    user.set({ email: 'account@example.com', role_id: 'CLIENTE' });
    TestBed.configureTestingModule({ imports: [EmailDocumentComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: {currentUser: user} },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('prefills account email, sends edited recipient and both selected report formats once', () => {
    const f = TestBed.createComponent(EmailDocumentComponent);
    f.componentRef.setInput('pdfPath','/reports/export/pdf');
    f.componentRef.setInput('excelPath','/reports/export/excel');
    const query = {entity:'patients',branch_ids:['branch-a'],start_date:'2026-10-01',columns:['full_name']};
    f.componentRef.setInput('payload',query); f.detectChanges();
    f.componentInstance.open(); f.detectChanges();
    expect(f.nativeElement.querySelector('input[type=email]').value).toBe('account@example.com');
    const input = f.nativeElement.querySelector('input[type=email]');
    input.value='edited@gmail.com'; input.dispatchEvent(new Event('input'));
    f.componentInstance.send(); f.componentInstance.send();
    const req = http.expectOne(r => r.url.endsWith('/documents/email'));
    expect(req.request.body).toEqual({email:'edited@gmail.com',paths:['/reports/export/pdf','/reports/export/excel'],report_request:query});
    req.flush({message:'OK'}); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Enviado a edited@gmail.com');
    expect(user().email).toBe('account@example.com');
  });
  it('uses the platform endpoint and displays delivery failure', () => {
    user.set({email:'root@example.com',role_id:'SUPERADMIN'});
    const f=TestBed.createComponent(EmailDocumentComponent);
    f.componentRef.setInput('pdfPath','/platform/subscriptions/sub-a/pdf');
    f.componentInstance.open(); f.componentInstance.send();
    http.expectOne(r=>r.url.endsWith('/platform/documents/email')).flush({detail:'No se pudo enviar.'},{status:503,statusText:'Unavailable'});
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('No se pudo enviar.');
    expect(f.componentInstance.busy()).toBe(false);
  });
});
