import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContentType, type HeroComponent, type Page, type PageComponent, type PageDetailDto, type PageSummaryDto, type PasskeyDto, type RevisionDto, type RevisionMetaDto, type TextSectionComponent, type SectionPresentation } from '@placta/contracts';
import { PageRenderer } from '../../../../packages/renderer/src/index';
import { ApiService } from './api.service';

interface EditLock {
  held: boolean;
  ownerName: string;
  expiresAt: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, PageRenderer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy, OnInit {
  readonly api = inject(ApiService);
  private readonly change = inject(ChangeDetectorRef);
  email = '';
  password = '';
  registerName = '';
  registering = false;
  reauthPassword = '';
  passkeyName = '';
  toast: { kind: 'error' | 'success'; message: string } | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  busy = false;
  pages: PageSummaryDto[] = [];
  selected: PageDetailDto | null = null;
  draft: Page | null = null;
  passkeys: PasskeyDto[] = [];
  revisions: RevisionMetaDto[] = [];
  revision: RevisionDto | null = null;
  newTitle = '';
  newSlug = '';
  publicOrigin = '';
  editLock: EditLock | null = null;
  private lockTimer: ReturnType<typeof setInterval> | null = null;

  get canEdit(): boolean {
    return this.editLock?.held === true;
  }

  get aboutUrl(): string {
    return this.publicOrigin ? `${this.publicOrigin.replace(/\/$/, '')}/about` : '';
  }

  presentation(section: PageComponent): SectionPresentation {
    return section.presentation ?? (section.presentation = {});
  }

  setPresentationValue<K extends keyof SectionPresentation>(
    section: PageComponent,
    key: K,
    value: SectionPresentation[K] | '',
  ): void {
    const presentation = this.presentation(section);
    if (value === '') {
      delete presentation[key];
      return;
    }
    presentation[key] = value;
  }

  setAnimationDelay(
    section: PageComponent,
    value: string | number,
  ): void {
    const delay = Number(value);

    if (Number.isInteger(delay) && delay >= 0 && delay <= 1000 && delay % 100 === 0) {
      this.presentation(section).animationDelayMs = delay;
    }
  }

  showToast(kind: 'error' | 'success', message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { kind, message };
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.toastTimer = null;
      this.change.markForCheck();
    }, 5000);
  }

  dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = null;
    this.toastTimer = null;
  }

  ngOnInit(): void {
    this.busy = true;
    void this.api.getPublicSite().then(site => {
      this.publicOrigin = site.publicOrigin;
      this.change.markForCheck();
    });
    this.api.refresh().then(() => this.loadPages()).catch(err => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) this.showToast('error', this.message(err));
    }).finally(() => { this.busy = false; this.change.markForCheck(); });
  }

  private message(err: unknown): string {
    if (err instanceof HttpErrorResponse) return err.error?.error?.message || `Request failed (${err.status || 'network error'})`;
    return err instanceof Error ? err.message : 'Something went wrong';
  }

  async run(action: () => Promise<void>): Promise<void> {
    this.busy = true;
    try { await action(); }
    catch (err) { this.showToast('error', this.message(err)); }
    finally { this.busy = false; this.change.markForCheck(); }
  }

  async loadPages(): Promise<void> {
    const [pages, site] = await Promise.all([
      this.api.request<PageSummaryDto[]>('GET', '/admin/pages'),
      this.api.getPublicOrigin(),
    ]);
    this.pages = pages;
    this.publicOrigin = site.publicOrigin;
  }
  refreshPasskeys(): Promise<void> { return this.run(() => this.loadPasskeys()); }
  async loadPasskeys(): Promise<void> {
    this.passkeys = await this.api.request<PasskeyDto[]>('GET', '/admin/passkeys');
  }
  async loadRevisions(): Promise<void> {
    if (this.selected) this.revisions = await this.api.request<RevisionMetaDto[]>('GET', `/admin/pages/${this.selected.id}/revisions`);
  }
  async login(): Promise<void> {
    await this.run(async () => { await this.api.login(this.email, this.password); this.password = ''; await this.loadPages(); });
  }
  async register(): Promise<void> {
    await this.run(async () => {
      await this.api.register(this.registerName, this.email, this.password);
      this.password = '';
      this.registerName = '';
      await this.loadPages();
      this.showToast('success', 'Account created. You can add a passkey from Passkeys.');
    });
  }
  async loginPasskey(): Promise<void> {
    await this.run(async () => { await this.api.loginPasskey(); await this.loadPages(); });
  }
  async logout(): Promise<void> {
    await this.run(async () => {
      await this.releaseEditLock();
      await this.api.logout();
      this.pages = []; this.selected = null; this.draft = null;
    });
  }
  async open(id: string): Promise<void> {
    await this.run(async () => {
      await this.releaseEditLock();
      this.selected = await this.api.request<PageDetailDto>('GET', `/admin/pages/${id}`);
      this.draft = structuredClone(this.selected.draft);
      this.revision = null;
      this.editLock = await this.api.request<EditLock>('POST', `/admin/pages/${id}/edit-lock`, {});
      this.startLockHeartbeat();
      await this.loadRevisions();
      if (!this.canEdit) this.showToast('error', `${this.editLock.ownerName} is editing this page. It is read-only until their lock expires.`);
    });
  }
  async create(): Promise<void> {
    await this.run(async () => {
      const page: Page = { schemaVersion: 1, title: this.newTitle.trim(), slug: this.newSlug.trim(), components: [] };
      this.selected = await this.api.request<PageDetailDto>('POST', '/admin/pages', page);
      this.draft = structuredClone(this.selected.draft);
      this.editLock = await this.api.request<EditLock>('POST', `/admin/pages/${this.selected.id}/edit-lock`, {});
      this.startLockHeartbeat();
      this.newTitle = ''; this.newSlug = ''; this.revisions = []; this.revision = null;
      await this.loadPages();
      this.showToast('success', 'Page created as a draft.');
    });
  }
  async save(): Promise<void> {
    await this.run(async () => {
      if (!this.selected || !this.draft) return;
      this.selected = await this.api.request<PageDetailDto>('PUT', `/admin/pages/${this.selected.id}/draft`, this.draft);
      this.draft = structuredClone(this.selected.draft);
      await this.loadPages();
      this.showToast('success', 'Draft saved. Publish to update the live website.');
    });
  }
  async publish(): Promise<void> {
    await this.run(async () => {
      if (!this.selected || !this.draft) return;
      this.selected = await this.api.request<PageDetailDto>('PUT', `/admin/pages/${this.selected.id}/draft`, this.draft);
      this.selected = await this.api.request<PageDetailDto>('POST', `/admin/pages/${this.selected.id}/publish`, {});
      this.draft = structuredClone(this.selected.draft);
      await this.loadPages(); await this.loadRevisions();
      this.showToast('success', 'Page published.');
    });
  }
  async unpublish(): Promise<void> {
    await this.run(async () => {
      if (!this.selected) return;
      this.selected = await this.api.request<PageDetailDto>('POST', `/admin/pages/${this.selected.id}/unpublish`, {});
      await this.loadPages();
      this.showToast('success', 'Page unpublished; revision history was retained.');
    });
  }
  async duplicate(): Promise<void> {
    await this.run(async () => {
      if (!this.selected) return;
      const sourceId = this.selected.id;
      const copy = await this.api.request<PageDetailDto>('POST', `/admin/pages/${sourceId}/duplicate`, {});
      await this.api.request('DELETE', `/admin/pages/${sourceId}/edit-lock`);
      this.stopLockHeartbeat();
      this.selected = copy;
      this.draft = structuredClone(this.selected.draft);
      this.editLock = await this.api.request<EditLock>('POST', `/admin/pages/${this.selected.id}/edit-lock`, {});
      this.startLockHeartbeat();
      this.revisions = []; this.revision = null; await this.loadPages();
      this.showToast('success', 'Page duplicated.');
    });
  }
  async remove(): Promise<void> {
    if (!this.selected || !window.confirm('Delete this page and its revision history?')) return;
    await this.run(async () => {
      await this.api.request('DELETE', `/admin/pages/${this.selected!.id}`);
      this.stopLockHeartbeat();
      this.selected = null; this.draft = null; this.revisions = []; this.revision = null;
      await this.loadPages(); this.showToast('success', 'Page deleted.');
    });
  }
  async viewRevision(id: string): Promise<void> {
    await this.run(async () => {
      if (this.selected) this.revision = await this.api.request<RevisionDto>('GET', `/admin/pages/${this.selected.id}/revisions/${id}`);
    });
  }
  async addPasskey(): Promise<void> {
    await this.run(async () => {
      await this.api.registerPasskey(this.reauthPassword, this.passkeyName);
      this.reauthPassword = ''; this.passkeyName = ''; await this.loadPasskeys(); this.showToast('success', 'Passkey added.');
    });
  }
  async revokePasskey(id: string): Promise<void> {
    await this.run(async () => {
      await this.api.request('POST', `/admin/passkeys/${id}/revoke`, { password: this.reauthPassword });
      this.reauthPassword = ''; await this.loadPasskeys(); this.showToast('success', 'Passkey removed.');
    });
  }
  add(type: 'hero' | 'text'): void {
    if (!this.draft) return;
    const id = crypto.randomUUID();
    this.draft.components.push(type === 'hero'
      ? { id, schemaVersion: 1, type: ContentType.hero, content: { heading: 'New heading' }, presentation: {} }
      : { id, schemaVersion: 1, type: ContentType['text-section'], content: { heading: 'New section', body: 'Add text here.' }, presentation: {} });
  }
  move(index: number, offset: number): void {
    if (!this.draft) return;
    const target = index + offset;
    if (target < 0 || target >= this.draft.components.length) return;
    const [item] = this.draft.components.splice(index, 1);
    this.draft.components.splice(target, 0, item);
  }
  duplicateSection(index: number): void {
    if (!this.draft) return;
    const copy = structuredClone(this.draft.components[index]);
    copy.id = crypto.randomUUID();
    this.draft.components.splice(index + 1, 0, copy);
  }
  hero(section: PageComponent): HeroComponent | null { return section.type === ContentType.hero ? section : null; }
  text(section: PageComponent): TextSectionComponent | null { return section.type === ContentType['text-section'] ? section : null; }
  optionalHero(section: HeroComponent, key: 'subTitle' | 'ctaText' | 'ctaHref', value: string): void {
    if (value) section.content[key] = value; else delete section.content[key];
  }

  private startLockHeartbeat(): void {
    this.stopLockHeartbeat();
    this.lockTimer = setInterval(() => { void this.renewEditLock(); }, 30_000);
  }

  private stopLockHeartbeat(): void {
    if (this.lockTimer) clearInterval(this.lockTimer);
    this.lockTimer = null;
  }

  private async renewEditLock(): Promise<void> {
    if (!this.selected || !this.canEdit) return;
    try {
      this.editLock = await this.api.request<EditLock>('PUT', `/admin/pages/${this.selected.id}/edit-lock`, {});
      if (!this.canEdit) {
        this.stopLockHeartbeat();
        this.showToast('error', `${this.editLock.ownerName} is now editing this page. Your editor is read-only.`);
      }
    }
    catch {
      this.stopLockHeartbeat();
      this.editLock = null;
      this.showToast('error', 'Your edit lock could not be renewed. The editor is now read-only.');
    }
  }

  private async releaseEditLock(): Promise<void> {
    this.stopLockHeartbeat();
    if (!this.selected || !this.canEdit) {
      this.editLock = null;
      return;
    }
    try { await this.api.request('DELETE', `/admin/pages/${this.selected.id}/edit-lock`); }
    finally { this.editLock = null; }
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    void this.releaseEditLock();
  }
}
