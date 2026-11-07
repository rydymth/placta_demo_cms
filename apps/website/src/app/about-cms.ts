import { Component } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export const PENDING_IMPROVEMENTS: string[] = [
  'Image and video library',
  'More reusable content sections',
  'Page-level SEO controls and social previews',
  'Accessibility and performance audits',
  'Production monitoring, backups, and analytics',
];

@Component({
  selector: 'app-about-cms',
  template: `
    <main class="about">
      <p class="eyebrow">About this demo</p>
      <h1>A small CMS for thoughtful, structured pages.</h1>
      <p class="lead">Placta lets a signed-in team create, edit, preview, publish, and revise the public pages that visitors see on this site.</p>

      <section>
        <h2>How content changes</h2>
        <p>Editors work on a private draft, arrange supported sections, and tune presentation settings such as theme, spacing, alignment, width, and motion. Publishing creates an immutable revision and makes that snapshot live. Changes made after publishing stay private until the next publish.</p>
      </section>

      <section>
        <h2>Collaboration without collisions</h2>
        <p>Only one signed-in editor can change a page at a time. The editor holds a short renewable lease while working, and everyone else can still view the page in read-only mode until the lease is released or expires.</p>
      </section>

      <section>
        <h2>Implementation</h2>
        <ul>
          <li>Angular powers the editor and server-rendered public website.</li>
          <li>Express and MongoDB provide authenticated APIs, revisions, sessions, and page storage.</li>
          <li>Shared Zod contracts validate page data before it is saved or published.</li>
          <li>Password login and WebAuthn passkeys support secure sign-in.</li>
        </ul>
      </section>

      <section>
        <h2>What we are improving next</h2>
        <ul>
          @for (improvement of pendingImprovements; track improvement) {
            <li>{{ improvement }}</li>
          }
        </ul>
      </section>
    </main>
  `,
  styles: [`
    .about { max-width:48rem; margin:0 auto; padding:clamp(3rem, 9vw, 7rem) 1.5rem 5rem; }
    .eyebrow { margin:0 0 1rem; color:#4567c3; font-size:.8rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:0; color:#152038; font-size:clamp(2.6rem, 7vw, 5rem); letter-spacing:-.06em; line-height:.95; }
    .lead { max-width:42rem; margin:1.5rem 0 3.5rem; color:#53627f; font-size:1.2rem; line-height:1.7; }
    section { padding:1.75rem 0; border-top:1px solid #dfe5f0; }
    h2 { margin:0; color:#1b2c52; font-size:1.35rem; letter-spacing:-.03em; }
    section p, li { color:#53627f; line-height:1.7; }
    ul { padding-left:1.2rem; }
  `],
})
export class AboutCmsComponent {
  readonly pendingImprovements = PENDING_IMPROVEMENTS;

  constructor(title: Title, meta: Meta) {
    title.setTitle('About this CMS');
    meta.updateTag({ name: 'description', content: 'How the Placta CMS demo works.' });
  }
}
