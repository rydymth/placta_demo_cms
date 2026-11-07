import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import type { ApiSuccess, Page } from '@placta/contracts';
import { PageRenderer } from '../../../../packages/renderer/src/index';

const serverApiOrigin = (): string =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['API_ORIGIN']
  ?? 'http://localhost:6969/api/v1';

@Component({
  selector: 'app-public-page',
  imports: [PageRenderer],
  template: `
    <main>
      @if (page) { <cms-page-renderer [page]="page" /> }
      @else if (error) { <section role="alert"><h1>{{ error }}</h1></section> }
      @else { <p>Loading...</p> }
    </main>`,
  styles: [`main { min-height:70vh; } section { padding:3rem 1.5rem; }`],
})
export class PublicPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly response = inject(RESPONSE_INIT, { optional: true });
  private readonly change = inject(ChangeDetectorRef);
  page: Page | null = null;
  error = '';

  ngOnInit(): void {
    if (this.route.snapshot.routeConfig?.path === "**") {
      this.error = "Page not found";
      this.title.setTitle(this.error);
      if (this.response) this.response.status = 404;
      return;
    }
    const api = isPlatformBrowser(this.platformId) ? '/api/v1' : serverApiOrigin();
    this.http.get<ApiSuccess<Page>>(`${api}/public/pages`, {
      params: { slug: this.route.snapshot.paramMap.get('slug') ?? '/' },
    }).subscribe({
      next: result => {
        this.page = result.data;
        this.error = '';
        this.title.setTitle(result.data.seo?.title || result.data.title);
        this.meta.updateTag({ name: 'description', content: result.data.seo?.description || '' });
        this.change.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.page = null;
        this.error = err.status === 404 ? 'Page not found' : 'Website temporarily unavailable';
        this.title.setTitle(this.error);
        if (this.response) this.response.status = err.status === 404 ? 404 : 503;
        this.change.markForCheck();
      },
    });
  }
}
