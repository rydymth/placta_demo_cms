import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type { ApiSuccess, SessionDto, UserDto } from '@placta/contracts';

const API = '/api/v1';
type RegistrationOptions = Parameters<typeof startRegistration>[0]['optionsJSON'];
type AuthenticationOptions = Parameters<typeof startAuthentication>[0]['optionsJSON'];

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private token = '';
  user: UserDto | null = null;
  private refreshing: Promise<void> | null = null;

  private async raw<T>(method: string, path: string, body?: unknown, authenticated = false): Promise<T> {
    const headers = authenticated && this.token ? new HttpHeaders({ Authorization: `Bearer ${this.token}` }) : undefined;
    const response = await firstValueFrom(this.http.request<ApiSuccess<T>>(method, API + path, { body, headers, withCredentials: true }));
    return response.data;
  }

  private acceptSession(session: SessionDto): void {
    this.token = session.accessToken;
    this.user = session.user;
  }

  async refresh(): Promise<void> {
    if (!this.refreshing) {
      this.refreshing = this.raw<SessionDto>('POST', '/auth/refresh', {}).then(session => this.acceptSession(session)).finally(() => { this.refreshing = null; });
    }
    return this.refreshing;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    try { return await this.raw<T>(method, path, body, true); }
    catch (err) {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) throw err;
      try { await this.refresh(); }
      catch (refreshError) { this.token = ''; this.user = null; throw refreshError; }
      return this.raw<T>(method, path, body, true);
    }
  }

  async login(email: string, password: string): Promise<void> {
    this.acceptSession(await this.raw<SessionDto>('POST', '/auth/login', { email, password }));
  }

  getPublicOrigin(): Promise<{ publicOrigin: string }> {
    return this.request('GET', '/admin/site');
  }

  getPublicSite(): Promise<{ publicOrigin: string }> {
    return this.raw('GET', '/public/site');
  }

  async register(name: string, email: string, password: string): Promise<void> {
    this.acceptSession(await this.raw<SessionDto>('POST', '/auth/register', { name, email, password }));
  }

  async loginPasskey(): Promise<void> {
    const { flowId, options } = await this.raw<{ flowId: string; options: AuthenticationOptions }>('POST', '/auth/passkey/options', {});
    const response = await startAuthentication({ optionsJSON: options });
    this.acceptSession(await this.raw<SessionDto>('POST', '/auth/passkey/verify', { flowId, response }));
  }

  async registerPasskey(password: string, name: string): Promise<void> {
    const { flowId, options } = await this.request<{ flowId: string; options: RegistrationOptions }>('POST', '/admin/passkeys/register/options', { password });
    const response = await startRegistration({ optionsJSON: options });
    await this.request('POST', '/admin/passkeys/register/verify', { flowId, response, name: name.trim() || undefined });
  }

  async logout(): Promise<void> {
    try { await this.raw('POST', '/auth/logout', {}); }
    finally { this.token = ''; this.user = null; }
  }
}
