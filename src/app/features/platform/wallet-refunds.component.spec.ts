import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting,HttpTestingController } from '@angular/common/http/testing';
import { WalletRefundsComponent } from './wallet-refunds.component';

describe('Wallet refunds',()=>{
  let http:HttpTestingController;
  beforeEach(()=>{TestBed.configureTestingModule({imports:[WalletRefundsComponent],providers:[provideHttpClient(),provideHttpClientTesting()]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());
  it('requires a reason and sends a single confirmed decision without a client amount',()=>{
    const f=TestBed.createComponent(WalletRefundsComponent);f.detectChanges();
    const row={id:'r',buyer_name:'Cliente',amount:5,currency:'USD',status:'PENDING'};
    http.expectOne(r=>r.url.endsWith('/platform/wallet-refunds')).flush({items:[row],total:1});
    const c=f.componentInstance;c.choose(row,'APPROVED');c.confirm();
    http.expectNone(r=>r.method==='POST');c.reason='Revisión realizada';c.confirm();c.confirm();
    const req=http.expectOne(r=>r.method==='POST');
    expect(req.request.body).toEqual({decision:'APPROVED',reason:'Revisión realizada'});
    req.flush({status:'APPROVED'});
    http.expectOne(r=>r.method==='GET').flush({items:[{...row,status:'APPROVED'}],total:1});
    f.detectChanges();expect(f.nativeElement.textContent).toContain('Acreditado a wallet');
  });
});
