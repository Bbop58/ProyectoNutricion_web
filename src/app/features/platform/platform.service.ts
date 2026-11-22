import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PlatformPlan {
  code: string; display_name: string; price: number; currency: string; duration_days: number;
  max_patients: number | null; max_branches: number | null; is_active: boolean;
}
export interface PlatformSubscription {
  id: string; plan_name: string; status: string; expires_at: string | null; started_at: string | null;
  company_name?: string; amount: number; currency: string; source: string;
}
export interface PlatformCompany {
  id: string; name: string; code: string; is_active: boolean; branch_count: number;
  email: string | null; phone: string | null;
  administrator: { name: string; email: string } | null; subscription: PlatformSubscription | null;
}
export interface Page<T> { items: T[]; total: number; }

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/platform`;
  overview(params: Record<string,string> = {}) { return this.http.get<any>(`${this.api}/overview`,{params}); }
  incidents(params: Record<string,string> = {}) { return this.http.get<any[]>(`${this.api}/incidents`,{params}); }
  resolveIncident(id: string, reason: string) { return this.http.put(`${this.api}/incidents/${id}/resolve`,{reason,is_active:false}); }
  companies(q = '', offset = 0) { return this.http.get<Page<PlatformCompany>>(`${this.api}/companies`, { params: { q, offset } }); }
  plans() { return this.http.get<PlatformPlan[]>(`${this.api}/plans`); }
  subscriptions(offset = 0) { return this.http.get<Page<PlatformSubscription>>(`${this.api}/subscriptions`, { params: { offset } }); }
  history(offset = 0) { return this.http.get<Page<any>>(`${this.api}/audit`, { params: { offset } }); }
  status(id: string, is_active: boolean, reason: string) { return this.http.patch(`${this.api}/companies/${id}/status`, { is_active, reason }); }
  assign(id: string, plan_code: string, reason: string) { return this.http.put(`${this.api}/companies/${id}/subscription`, { plan_code, reason }); }
  savePlan(plan: PlatformPlan, reason: string, creating: boolean) {
    const body = { ...plan, reason };
    return creating ? this.http.post(`${this.api}/plans`, body) : this.http.patch(`${this.api}/plans/${plan.code}`, body);
  }
}
