import { isPlatformBrowser, NgComponentOutlet } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Directive,
  ElementRef,
  HostBinding,
  inject,
  Input,
  OnDestroy,
  PLATFORM_ID,
  type Type,
} from '@angular/core';
import {
  ContentType,
  type HeroComponent,
  type Page,
  type TextSectionComponent,
  type SectionPresentation,
} from '@placta/contracts';

function presentationClasses(
  presentation: SectionPresentation | undefined,
): string {
  const theme = presentation?.theme ?? 'default';
  const alignment = presentation?.alignment ?? 'left';
  const spacing = presentation?.spacing ?? 'normal';
  const width = presentation?.width ?? 'content';
  const animation = presentation?.animation ?? 'none';
  const duration = presentation?.animationDuration ?? 'normal';

  return [
    'cms-section',
    `cms-section--theme-${theme}`,
    `cms-section--align-${alignment}`,
    `cms-section--spacing-${spacing}`,
    `cms-section--width-${width}`,
    `cms-section--animate-${animation}`,
    `cms-section--duration-${duration}`,
  ].join(' ');
}

// delay helper
function animationDelay(
  presentation: SectionPresentation | undefined,
): string {
  return `${presentation?.animationDelayMs ?? 0}ms`;
}

@Directive({
  selector: '[cmsAnimateOnView]',
})
export class AnimateOnViewDirective implements AfterViewInit, OnDestroy {
  @HostBinding('attr.data-cms-animated') animated: '' | null = null;
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);
  private animationTimer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.animated = '';
      return;
    }

    this.animationTimer = setTimeout(() => {
      void this.element.nativeElement.offsetWidth;
      this.animated = '';
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.animationTimer) clearTimeout(this.animationTimer);
  }
}

const sectionStyles = `
  .cms-section {
    --cms-background: #ffffff;
    --cms-foreground: #152038;
    --cms-animation-duration: 400ms;
    --cms-animation-delay: 0ms;

    position: relative;
    isolation: isolate;
    overflow: hidden;
    background: var(--cms-background);
    color: var(--cms-foreground);
  }

  .cms-section--theme-muted {
    --cms-background: #f4f7ff;
  }

  .cms-section--theme-primary {
    --cms-background: radial-gradient(circle at 12% 15%, #547ef5 0, transparent 34%), linear-gradient(135deg, #224dcc, #11285f);
    --cms-foreground: #ffffff;
  }

  .cms-section--theme-dark {
    --cms-background: radial-gradient(circle at 88% 18%, #344a79 0, transparent 28%), linear-gradient(135deg, #152038, #0d1426);
    --cms-foreground: #ffffff;
  }

  .cms-section--align-left { text-align: left; }
  .cms-section--align-center { text-align: center; }
  .cms-section--align-right { text-align: right; }

  .cms-section--spacing-compact { padding-block: 2rem; }
  .cms-section--spacing-normal { padding-block: 4rem; }
  .cms-section--spacing-spacious { padding-block: 6rem; }

  .cms-section--width-content > * {
    max-width: 70rem;
    margin-inline: auto;
  }

  .cms-section--width-wide > * {
    max-width: 90rem;
    margin-inline: auto;
  }

  .cms-section--width-full > * {
    max-width: none;
  }

  .cms-section--duration-fast {
    --cms-animation-duration: 200ms;
  }

  .cms-section--duration-normal {
    --cms-animation-duration: 400ms;
  }

  .cms-section--duration-slow {
    --cms-animation-duration: 700ms;
  }

  .cms-section[data-cms-animated].cms-section--animate-fade-in {
    animation: cms-fade-in var(--cms-animation-duration) ease-out
      var(--cms-animation-delay) both;
  }

  .cms-section[data-cms-animated].cms-section--animate-fade-up {
    animation: cms-fade-up var(--cms-animation-duration) ease-out
      var(--cms-animation-delay) both;
  }

  .cms-section[data-cms-animated].cms-section--animate-slide-left {
    animation: cms-slide-left var(--cms-animation-duration) ease-out
      var(--cms-animation-delay) both;
  }

  .cms-section[data-cms-animated].cms-section--animate-slide-right {
    animation: cms-slide-right var(--cms-animation-duration) ease-out
      var(--cms-animation-delay) both;
  }

  @keyframes cms-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes cms-fade-up {
    from { opacity: 0; transform: translateY(1.5rem); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes cms-slide-left {
    from { opacity: 0; transform: translateX(1.5rem); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes cms-slide-right {
    from { opacity: 0; transform: translateX(-1.5rem); }
    to { opacity: 1; transform: translateX(0); }
  }

  @media (max-width: 48rem) {
    .cms-section--spacing-normal { padding-block: 3rem; }
    .cms-section--spacing-spacious { padding-block: 4rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .cms-section--animate-fade-in,
    .cms-section--animate-fade-up,
    .cms-section--animate-slide-left,
    .cms-section--animate-slide-right {
      animation: none;
    }
  }
`;

@Component({
  selector: 'cms-hero',
  imports: [AnimateOnViewDirective],
  template: `
    <section
      [class]="presentationClass(data.presentation)"
      [style.--cms-animation-delay]="animationDelay(data.presentation)"
      cmsAnimateOnView
    >
      <div class="hero__content">
        <h1>{{ data.content.heading }}</h1>
        @if (data.content.subTitle) { <p>{{ data.content.subTitle }}</p> }
        @if (data.content.ctaHref && data.content.ctaText) {
          <a [href]="data.content.ctaHref">{{ data.content.ctaText }}</a>
        }
      </div>
    </section>`,
  styles: [
    sectionStyles,
    `
      .hero__content {
        position: relative;
        z-index: 1;
        padding-inline: 1.5rem;
      }

      h1 {
        font-size: clamp(2.5rem, 6vw, 5rem);
        letter-spacing: -0.05em;
        line-height: .98;
        margin: 0;
      }

      p {
        margin: 1rem 0 0;
        font-size: 1.125rem;
        opacity: .84;
      }

      a {
        display: inline-block;
        margin-top: 1.5rem;
        padding: 0.7rem 1rem;
        border-radius: 999px;
        background: #224dcc;
        color: #ffffff;
        text-decoration: none;
        box-shadow: 0 .75rem 1.5rem rgb(0 0 0 / 15%);
        transition: box-shadow 150ms ease, transform 150ms ease;
      }

      a:hover {
        transform: translateY(-1px);
        box-shadow: 0 1rem 2rem rgb(0 0 0 / 22%);
      }

      .cms-section--theme-primary a,
      .cms-section--theme-dark a {
        background: #ffffff;
        color: #152038;
      }
    `,
  ],
})
export class HeroRenderer {
  @Input({ required: true }) data!: HeroComponent;
  // Passing as delegate
  readonly presentationClass = presentationClasses;
  readonly animationDelay = animationDelay;
}

@Component({
  selector: 'cms-text-section',
  imports: [AnimateOnViewDirective],
  template: `
    <section
      [class]="presentationClass(data.presentation)"
      [style.--cms-animation-delay]="animationDelay(data.presentation)"
      cmsAnimateOnView
    >
      <div class="text-section__content">
        <h2>{{ data.content.heading }}</h2>
        <p>{{ data.content.body }}</p>
      </div>
    </section>
  `,
  styles: [
    sectionStyles,
    `
      .text-section__content {
        padding-inline: 1.5rem;
      }

      h2 {
        margin: 0;
        font-size: clamp(1.75rem, 3vw, 2.5rem);
        letter-spacing: -0.03em;
      }

      p {
        margin: 1rem 0 0;
        font-size: 1.0625rem;
        line-height: 1.75;
        white-space: pre-wrap;
      }
    `,
  ],
})
export class TextSectionRenderer {
  @Input({ required: true }) data!: TextSectionComponent;
  readonly presentationClass = presentationClasses;
  readonly animationDelay = animationDelay;
}

const registry: Readonly<Record<string, Type<unknown>>> = {
  [ContentType.hero]: HeroRenderer,
  [ContentType['text-section']]: TextSectionRenderer,
};

@Component({
  selector: 'cms-page-renderer',
  imports: [NgComponentOutlet],
  template: `
    @for (section of page.components; track section.id) {
      @if (registry[section.type]; as component) {
        <ng-container *ngComponentOutlet="component; inputs: { data: section }" />
      } @else {
        <p>Unsupported section: {{ section.type }}</p>
      }
    }`,
})
export class PageRenderer {
  @Input({ required: true }) page!: Page;
  readonly registry = registry;
}
