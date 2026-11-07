# Task 2 — Shared Page and Component Contracts (detailed guide)

**Goal:** one versioned, runtime-validated page format shared by the API, admin, and SSR website. The package must stay independent of Angular, Express, and MongoDB.

**In scope:** page metadata plus two components, `hero` and `text-section`.
**Out of scope (later tasks):** styling, animations, responsive settings, persistence, publishing, editor UI.

**Estimated time:** about 45 minutes.

> Work through the steps in order. Do the verification at the end of each step before moving on.

---

## Step 0 — Understand the design (2 min)

- Each Zod **schema** is the single source of truth. TypeScript **types** are derived with `z.infer`, so the compile-time type and the runtime check can never drift apart.
- `@placta/contracts` is compiled to plain JavaScript in `dist/`. The API (Node) and the Angular apps then import it like any other package. Pointing consumers at raw `.ts` files would break the API build (`tsc` refuses files outside its `rootDir`, and Node cannot run `.ts` from `node_modules`).
- Consequence: **after changing contracts, rebuild them** (`npm run build -w @placta/contracts`), or keep `npm run dev -w @placta/contracts` (watch mode) running.

Check which Zod version you installed: `npm ls zod`. The code below works on Zod 3.23+ and Zod 4.

---

## Step 1 — Configure the contracts package (10 min)

### 1.1 Install dev tools

From the repo root:

```bash
npm install -D typescript vitest -w @placta/contracts
```

Use the same TypeScript major as `apps/api` if npm offers a choice. Zod should already be under `dependencies` of `packages/contracts/package.json`; confirm it is not in the root package.json.

### 1.2 Replace `packages/contracts/package.json` fields

Keep the `dependencies`/`devDependencies` npm generated and make the rest look like this:

```json
{
  "name": "@placta/contracts",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  }
}
```

### 1.3 Create `packages/contracts/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

This mirrors your API setup: you import with `.ts` extensions and `tsc` rewrites them to `.js` on output.

### 1.4 Fix the root build order

npm workspaces builds apps before packages, but the apps need contracts built first. In the root `package.json`, change the scripts to:

```json
"build:contracts": "npm run build -w @placta/contracts",
"build": "npm run build:contracts && npm run build -w @placta/api -w @placta/admin -w @placta/website"
```

**Verify:** `npm run build:contracts` succeeds and creates `packages/contracts/dist/index.js` and `index.d.ts` (it is already git-ignored via `dist`).

---

## Step 2 — Write the component schemas (10 min)

Create `packages/contracts/src/components.ts`.

### 2.1 Helpers

```ts
import { z } from "zod";

// Only local paths ("/contact") or https URLs are allowed.
// Rejects javascript:, data:, http:, and protocol-relative ("//evil.com").
export function isSafeHref(value: string): boolean {
  if (value.startsWith("/")) {
    return !value.startsWith("//") && !value.includes("\\");
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const hrefSchema = z
  .string()
  .max(2048)
  .refine(isSafeHref, { message: "Must be a local path or an https URL" });

const componentId = z.string().min(1).max(64);
```

### 2.2 Hero

```ts
export const heroContentSchema = z
  .strictObject({
    heading: z.string().min(1).max(200),
    subtitle: z.string().max(500).optional(),
    ctaText: z.string().min(1).max(60).optional(),
    ctaHref: hrefSchema.optional(),
  })
  .refine((c) => (c.ctaText === undefined) === (c.ctaHref === undefined), {
    message: "ctaText and ctaHref must be provided together",
    path: ["ctaHref"],
  });

export const heroSchema = z.strictObject({
  id: componentId,
  type: z.literal("hero"),
  schemaVersion: z.literal(1),
  content: heroContentSchema,
});
```

### 2.3 Text section

```ts
export const textSectionContentSchema = z.strictObject({
  heading: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

export const textSectionSchema = z.strictObject({
  id: componentId,
  type: z.literal("text-section"),
  schemaVersion: z.literal(1),
  content: textSectionContentSchema,
});
```

`body` is **plain text** only. Never store HTML here; the renderer will output it as text, which prevents injection.

### 2.4 Union and types

```ts
export const componentSchema = z.discriminatedUnion("type", [
  heroSchema,
  textSectionSchema,
]);

export type HeroComponent = z.infer<typeof heroSchema>;
export type TextSectionComponent = z.infer<typeof textSectionSchema>;
export type PageComponent = z.infer<typeof componentSchema>;
export type ComponentType = PageComponent["type"];
```

`z.strictObject` rejects unknown keys. `discriminatedUnion("type", ...)` selects the schema by `type`, and an unknown type fails validation with a clear error.

> Later (Task 5), adding a component means: write its schema, add it to the `discriminatedUnion` array. Nothing else in this file changes.

---

## Step 3 — Write the page schema (8 min)

Create `packages/contracts/src/page.ts`.

```ts
import { z } from "zod";
import { componentSchema } from "./components.ts";

// Single place to maintain routes the apps own. Compare in lowercase.
export const RESERVED_SLUGS = [
  "api",
  "admin",
  "health",
  "assets",
  "uploads",
  "static",
  "login",
  "sitemap.xml",
  "robots.txt",
] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .max(100)
  .refine((v) => v === "/" || SLUG_PATTERN.test(v), {
    message: 'Slug must be "/" or lowercase letters, numbers, and hyphens',
  })
  .refine((v) => !(RESERVED_SLUGS as readonly string[]).includes(v.toLowerCase()), {
    message: "This slug is reserved",
  });

export const seoSchema = z.strictObject({
  title: z.string().max(70).optional(),
  description: z.string().max(160).optional(),
});

export const pageSchema = z.strictObject({
  schemaVersion: z.literal(1),
  title: z.string().min(1).max(200),
  slug: slugSchema,
  seo: seoSchema.optional(),
  components: z.array(componentSchema).max(100).superRefine((components, ctx) => {
    const seen = new Set<string>();
    components.forEach((component, index) => {
      if (seen.has(component.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate component id "${component.id}"`,
          path: [index, "id"],
        });
      }
      seen.add(component.id);
    });
  }),
});

export type Page = z.infer<typeof pageSchema>;
export type Seo = z.infer<typeof seoSchema>;
```

Notes:

- Slugs are one segment only (`about-us`), plus `/` for the homepage. Nested paths are deliberately out of scope for v1.
- The slug regex only allows lowercase, so uppercase input like `About` is rejected rather than silently converted.

---

## Step 4 — Add the sample fixture (3 min)

Create `packages/contracts/src/fixtures.ts`:

```ts
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
      type: "hero",
      schemaVersion: 1,
      content: {
        heading: "Welcome to Placta",
        subtitle: "Build pages from structured data",
        ctaText: "Contact us",
        ctaHref: "/contact",
      },
    },
    {
      id: "text-1",
      type: "text-section",
      schemaVersion: 1,
      content: {
        heading: "About us",
        body: "This page is rendered entirely from a JSON configuration.",
      },
    },
  ],
};
```

Typing it as `Page` makes the compiler check the fixture as you write it.

---

## Step 5 — Export the public API (2 min)

Replace `packages/contracts/src/index.ts` (the `CONTRACTS_VERSION` placeholder can go):

```ts
export * from "./components.ts";
export * from "./page.ts";
export { samplePage } from "./fixtures.ts";
```

**Verify:** `npm run build:contracts` has no errors, and `packages/contracts/dist/` contains `index.js`, `components.js`, `page.js`, plus `.d.ts` files.

---

## Step 6 — Write the tests (10 min)

Create `packages/contracts/src/page.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pageSchema } from "./page.ts";
import { samplePage } from "./fixtures.ts";

const clone = () => structuredClone(samplePage) as any;

describe("pageSchema", () => {
  it("accepts the sample page", () => {
    expect(pageSchema.safeParse(samplePage).success).toBe(true);
  });

  it("rejects an unknown component type", () => {
    const page = clone();
    page.components[0].type = "carousel";
    expect(pageSchema.safeParse(page).success).toBe(false);
  });

  it.each(["About Us", "/about", "about/us", "ABOUT", "-about", ""])(
    "rejects invalid slug %j",
    (slug) => {
      const page = clone();
      page.slug = slug;
      expect(pageSchema.safeParse(page).success).toBe(false);
    },
  );

  it.each(["api", "admin"])("rejects reserved slug %s", (slug) => {
    const page = clone();
    page.slug = slug;
    expect(pageSchema.safeParse(page).success).toBe(false);
  });

  it("allows the homepage slug", () => {
    const page = clone();
    page.slug = "/";
    expect(pageSchema.safeParse(page).success).toBe(true);
  });

  it("rejects duplicate component ids and reports the path", () => {
    const page = clone();
    page.components[1].id = page.components[0].id;
    const result = pageSchema.safeParse(page);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Duplicate component id");
      expect(result.error.issues[0].path).toEqual(["components", 1, "id"]);
    }
  });

  it("rejects unexpected fields", () => {
    const page = clone();
    page.components[0].content.html = "<script>alert(1)</script>";
    expect(pageSchema.safeParse(page).success).toBe(false);

    const topLevel = clone();
    topLevel.extra = true;
    expect(pageSchema.safeParse(topLevel).success).toBe(false);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html;base64,AAAA",
    "//evil.com",
    "http://insecure.example",
    "contact",
  ])("rejects unsafe ctaHref %j", (href) => {
    const page = clone();
    page.components[0].content.ctaHref = href;
    expect(pageSchema.safeParse(page).success).toBe(false);
  });

  it.each(["/contact", "https://example.com/path"])("accepts safe ctaHref %j", (href) => {
    const page = clone();
    page.components[0].content.ctaHref = href;
    expect(pageSchema.safeParse(page).success).toBe(true);
  });

  it("requires ctaText and ctaHref together", () => {
    const page = clone();
    delete page.components[0].content.ctaHref;
    expect(pageSchema.safeParse(page).success).toBe(false);
  });
});
```

Run: `npm test -w @placta/contracts`. Every test should pass. If one fails, read the failing assertion before changing the schema or the test: the expectation is usually right.

---

## Step 7 — Wire the contracts into the three apps (5 min)

### 7.1 Declare the dependency

Add this to `dependencies` in **each** of `apps/api/package.json`, `apps/admin/package.json`, and `apps/website/package.json`:

```json
"@placta/contracts": "*"
```

Then from the repo root run `npm install`. npm links the local workspace instead of fetching it from the registry. Confirm with `ls -l node_modules/@placta` (it should show a symlink to `packages/contracts`).

### 7.2 Smoke test from the API

Temporarily add to the top of `apps/api/src/app.ts`:

```ts
import { pageSchema, samplePage } from "@placta/contracts";
console.info("contracts ok:", pageSchema.safeParse(samplePage).success);
```

Run `npm run dev:api`; expect `contracts ok: true`. Then run `npm run build -w @placta/api`; it must compile. **Remove the two lines afterward**.

### 7.3 Smoke test from the website (optional but recommended)

Temporarily import `samplePage` in `apps/website/src/app/app.ts`, log it, and make sure `npm run build -w @placta/website` succeeds. Remove it afterward. This confirms Angular's SSR build can consume the contracts package, which Task 5 depends on.

---

## Common problems

| Symptom | Likely cause / fix |
|---|---|
| `Cannot find module '@placta/contracts'` | Contracts not built (`npm run build:contracts`) or `npm install` not re-run after adding the dependency. |
| `TS5097` / extension errors in contracts | `rewriteRelativeImportExtensions` missing in `packages/contracts/tsconfig.json`. |
| Schema changes not visible in the API | Contracts `dist/` is stale; rebuild or run `npm run dev -w @placta/contracts`. |
| `z.strictObject is not a function` | Very old Zod. Run `npm ls zod`; use 3.23+ or 4.x. |
| `ctx.addIssue` typing error | Use `code: "custom"` exactly as shown. |
| Vitest picks up files from `dist` | Make sure the test file ends `.test.ts` and `dist` is not committed; add `exclude: ["dist/**"]` in a `vitest.config.ts` if needed. |

---

## Definition of done

- [ ] `npm run build:contracts` succeeds.
- [ ] `npm test -w @placta/contracts` passes all cases (valid sample; unknown type, bad/reserved slug, duplicate IDs, unexpected fields, and unsafe URLs all rejected).
- [ ] `@placta/api`, `@placta/admin`, and `@placta/website` each list `@placta/contracts` as a dependency, and the API and website can import it.
- [ ] Contracts contain no Angular, Express, or Mongoose code.
- [ ] Temporary smoke-test code is removed from the apps.
- [ ] `package-lock.json` is committed and is the only lockfile.

Push when done and ask for a review. Task 3 (MongoDB connection and page persistence) will store pages in this exact shape.
