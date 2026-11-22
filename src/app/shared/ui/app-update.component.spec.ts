import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateComponent } from './app-update.component';

describe('App updates', () => {
  let events: Subject<any>;
  let errors: Subject<any>;
  let updates: any;
  beforeEach(() => {
    events = new Subject();
    errors = new Subject();
    updates = { isEnabled: true, versionUpdates: events, unrecoverable: errors,
      checkForUpdate: vi.fn().mockResolvedValue(false) };
    TestBed.configureTestingModule({ imports: [AppUpdateComponent], providers: [{ provide: SwUpdate, useValue: updates }] });
  });
  it('offers a reload only after the new version is ready', () => {
    const fixture = TestBed.createComponent(AppUpdateComponent);
    events.next({ type: 'VERSION_DETECTED' });
    expect(fixture.componentInstance.ready()).toBe(false);
    events.next({ type: 'VERSION_READY' });
    fixture.detectChanges();
    const reload = vi.spyOn(fixture.componentInstance, 'reload').mockImplementation(() => {});
    fixture.nativeElement.querySelector('button').click();
    expect(reload).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Actualizar ahora');
  });
  it('can retry after an offline update check fails', async () => {
    const fixture = TestBed.createComponent(AppUpdateComponent);
    await fixture.whenStable();
    updates.checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    await fixture.componentInstance.check();
    expect(fixture.componentInstance.ready()).toBe(false);
    updates.checkForUpdate.mockResolvedValueOnce(true);
    await fixture.componentInstance.check();
    expect(fixture.componentInstance.ready()).toBe(true);
  });
  it('offers recovery when a cached version cannot be used', () => {
    const fixture = TestBed.createComponent(AppUpdateComponent);
    errors.next({ reason: 'Missing old chunk' });
    expect(fixture.componentInstance.ready()).toBe(true);
  });
});
