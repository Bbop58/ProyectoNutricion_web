import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { PlatformComponent } from './platform.component';
import { AuthService } from '../../core/services/auth.service';
import { operationalGuard, platformGuard } from '../../core/guards/auth.guard';

describe('Platform console', () => {
  const user = signal<any>({ id: 'root', role_id: 'SUPERADMIN', full_name: 'Administrador', email: 'root@example.com' });
  let http: HttpTestingController;
  beforeEach(async () => {
    user.set({ id: 'root', role_id: 'SUPERADMIN', full_name: 'Administrador', email: 'root@example.com' });
    await TestBed.configureTestingModule({ imports: [PlatformComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: AuthService, useValue: { currentUser: user, logout: vi.fn() } },
    ] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function flush() {
    for (const request of http.match(() => true)) {
      if (request.request.url.endsWith('/plans')) request.flush([]);
      else if (request.request.url.endsWith('/overview')) request.flush({ companies: 5, active_companies: 5 });
      else request.flush({ items: [], total: 0 });
    }
  }
  it('shows only the five administrative sections', () => {
    const fixture = TestBed.createComponent(PlatformComponent);
    fixture.detectChanges(); flush(); fixture.detectChanges();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('nav button')).map((b: any) => b.textContent.trim());
    expect(labels).toEqual(['Inicio', 'Empresas', 'Planes', 'Suscripciones', 'Historial de cambios']);
    expect(fixture.nativeElement.querySelector('app-workspace-selector')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Caja y cobros');
  });
  it('redirects the global role away from the clinical dashboard', async () => {
    const result = await firstValueFrom(TestBed.runInInjectionContext(() => operationalGuard({} as any, {} as any)) as Observable<any>);
    expect(result.toString()).toBe('/platform');
    const allowed = await firstValueFrom(TestBed.runInInjectionContext(() => platformGuard({} as any, {} as any)) as Observable<any>);
    expect(allowed).toBe(true);
  });
  it('redirects a company administrator away from the platform console', async () => {
    user.set({ id: 'admin', role_id: 'ADMIN_ORGANIZATION', tenant_id: 'a' });
    const result = await firstValueFrom(TestBed.runInInjectionContext(() => platformGuard({} as any, {} as any)) as Observable<any>);
    expect(result.toString()).toBe('/dashboard');
  });
  it('submits a new plan with an explicit reason and prevents duplicate submission', () => {
    const fixture = TestBed.createComponent(PlatformComponent);
    fixture.detectChanges(); flush();
    const component = fixture.componentInstance;
    component.newPlan(); component.draft!.code = 'PLUS'; component.draft!.display_name = 'Empresa Plus';
    component.reason = 'Nuevo plan comercial';
    component.savePlan(); component.savePlan();
    const requests = http.match(r => r.method === 'POST' && r.url.endsWith('/platform/plans'));
    expect(requests.length).toBe(1);
    expect(requests[0].request.body.reason).toBe('Nuevo plan comercial');
    requests[0].flush({ code: 'PLUS' }); flush();
    expect(component.draft).toBeNull();
    expect(component.busy()).toBe(false);
  });
});
