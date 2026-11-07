import { ContentType } from "./components.ts";
import type { Page } from "./page.ts";

export const samplePage: Page = {
  schemaVersion: 1,
  title: "Home",
  slug: "/",
  seo: {
    title: "Placta | Home",
    description: "Welcome to Placta.",
  },
  components: [
    {
      id: "hero-1",
      type: ContentType.hero,
      schemaVersion: 1,
      content: {
        heading: "Welcome to Placta",
        subTitle: "Build pages from structured data",
        ctaText: "Contact us",
        ctaHref: "/contact",
      },
    },
    {
      id: "text-1",
      type: ContentType["text-section"],
      schemaVersion: 1,
      content: {
        heading: "About us",
        body: "This page is rendered entirely from a JSON configuration.",
      },
    },
  ],
};
