# Task 3 — MongoDB Connection and Page Persistence

**Goal:** the API connects to MongoDB and can create, read, and update a page draft, with the data surviving restarts.

**In scope:** DB connection, `Page` model, repository, service, seed and smoke scripts.
**Out of scope (Task 4):** HTTP routes, auth, publishing, revisions.

**Estimated time:** about 1 hour 15 minutes.

---

## Step 0 — Design (read first)

Three layers. Only the repository touches Mongoose.

```text
service      validates input with @placta/contracts, applies business rules
   |
repository   Mongoose queries; returns plain objects (never Mongoose docs / ObjectIds)
   |
model        Mongoose schema + indexes
```

Rules this task must guarantee:

1. **Validate before every write.** The service parses input with `pageSchema`; the DB layer never sees unvalidated data.
2. **Slug is unique at the database level** (unique index), not only in code. Two simultaneous requests cannot both succeed.
3. **Saving a draft never touches `published` or `status`.** This is the draft/published boundary the whole CMS relies on.
4. `title` and `slug` are stored at the top level for listing and lookup, copied from the draft on every write, so they cannot drift.

---

## Step 1 — Run MongoDB (5 min)

Pick one:

- **Docker (recommended):**
  ```bash
  docker run -d --name placta-mongo -p 27017:27017 -v placta-mongo-data:/data/db mongo:7
  ```
  The named volume keeps data across container restarts.
- **Homebrew (macOS):** `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
- **MongoDB Atlas free tier:** use the connection string it gives you.

Add to **`apps/api/.env`** (your API loads this file; never commit it):

```text
MONGODB_URI=mongodb://localhost:27017/placta
```

---

## Step 2 — Add the page status to contracts (5 min)

Both the API and the admin app will need the status values, so define them once. In `packages/contracts/src/page.ts` add:

```ts
export const PAGE_STATUSES = ["draft", "published", "unpublished"] as const;
export const pageStatusSchema = z.enum(PAGE_STATUSES);
export type PageStatus = z.infer<typeof pageStatusSchema>;
```

Then rebuild: `npm run build:contracts`. (`index.ts` already re-exports everything from `page.ts`.)

---

## Step 3 — Install Mongoose and harden config (10 min)

```bash
npm install mongoose -w @placta/api
```

Replace `apps/api/src/utils/config.ts`:

```ts
import { existsSync } from "node:fs";

// Production injects real environment variables, so a missing .env is fine.
if (existsSync(".env")) process.loadEnvFile();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const config = {
  port: Number(process.env.PORT) || 6969,
  mongodbUri: required("MONGODB_URI"),
};

export default config;
```

The app now fails immediately at startup if the URI is missing, rather than failing later with a confusing error.

---

## Step 4 — Database connection (5 min)

Create `apps/api/src/database/connection.ts`:

```ts
import mongoose from "mongoose";
import config from "../utils/config.ts";

export async function connectDb(): Promise<void> {
  mongoose.connection.on("error", (err) => console.error("MongoDB error:", err));
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 5000 });
  console.info(`MongoDB connected: ${mongoose.connection.name}`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
```

`serverSelectionTimeoutMS` makes a missing database fail in 5 seconds instead of hanging for 30.

---

## Step 5 — The Page model (10 min)

Create `apps/api/src/models/page.model.ts`:

```ts
import { Schema, model } from "mongoose";
import { PAGE_STATUSES } from "@placta/contracts";

const pageDbSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    status: { type: String, enum: [...PAGE_STATUSES], default: "draft", required: true },
    // Page content is validated by Zod (@placta/contracts), so Mongoose just stores it.
    draft: { type: Schema.Types.Mixed, required: true },
    published: { type: Schema.Types.Mixed, default: null },
    currentPublishedRevisionId: { type: Schema.Types.ObjectId, default: null },
    draftVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const PageModel = model("Page", pageDbSchema);
```

Notes:

- `published` and `currentPublishedRevisionId` stay `null` until publishing exists (Task 4).
- `timestamps: true` adds `createdAt` and `updatedAt` automatically.
- `unique: true` creates the unique index. Step 8 makes sure it exists before the first insert.

---

## Step 6 — The repository (15 min)

Create `apps/api/src/repositories/pages.repository.ts`:

```ts
import mongoose from "mongoose";
import type { Page, PageStatus } from "@placta/contracts";
import { PageModel } from "../models/page.model.ts";

export interface PageRecord {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  draft: Page;
  published: Page | null;
  currentPublishedRevisionId: string | null;
  draftVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Slug "${slug}" is already in use`);
    this.name = "SlugTakenError";
  }
}

// Convert a Mongo document into a plain object so Mongoose details don't leak upward.
function toRecord(doc: any): PageRecord {
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    status: doc.status,
    draft: doc.draft,
    published: doc.published ?? null,
    currentPublishedRevisionId: doc.currentPublishedRevisionId
      ? String(doc.currentPublishedRevisionId)
      : null,
    draftVersion: doc.draftVersion,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// 11000 is MongoDB's duplicate key error code.
function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

export async function createPage(page: Page): Promise<PageRecord> {
  try {
    const doc = await PageModel.create({ title: page.title, slug: page.slug, draft: page });
    return toRecord(doc.toObject());
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugTakenError(page.slug);
    throw err;
  }
}

export async function findPageById(id: string): Promise<PageRecord | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await PageModel.findById(id).lean();
  return doc ? toRecord(doc) : null;
}

export async function findPageBySlug(slug: string): Promise<PageRecord | null> {
  const doc = await PageModel.findOne({ slug }).lean();
  return doc ? toRecord(doc) : null;
}

export async function updateDraft(id: string, page: Page): Promise<PageRecord | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  try {
    const doc = await PageModel.findByIdAndUpdate(
      id,
      // Only draft-related fields. Never touch `published` or `status` here.
      { $set: { title: page.title, slug: page.slug, draft: page }, $inc: { draftVersion: 1 } },
      { new: true },
    ).lean();
    return doc ? toRecord(doc) : null;
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugTakenError(page.slug);
    throw err;
  }
}
```

---

## Step 7 — The service (10 min)

Create `apps/api/src/services/pages.service.ts`:

```ts
import { pageSchema } from "@placta/contracts";
import * as pagesRepository from "../repositories/pages.repository.ts";
import type { PageRecord } from "../repositories/pages.repository.ts";

export class PageNotFoundError extends Error {
  constructor(id: string) {
    super(`Page "${id}" not found`);
    this.name = "PageNotFoundError";
  }
}

export async function createPage(input: unknown): Promise<PageRecord> {
  const page = pageSchema.parse(input); // throws ZodError when invalid
  return pagesRepository.createPage(page);
}

export async function getPage(id: string): Promise<PageRecord> {
  const record = await pagesRepository.findPageById(id);
  if (!record) throw new PageNotFoundError(id);
  return record;
}

export async function saveDraft(id: string, input: unknown): Promise<PageRecord> {
  const page = pageSchema.parse(input);
  const record = await pagesRepository.updateDraft(id, page);
  if (!record) throw new PageNotFoundError(id);
  return record;
}
```

In Task 4 the error handler will map these to HTTP responses: `ZodError` → 400, `SlugTakenError` → 409, `PageNotFoundError` → 404. Keep these error names stable.

---

## Step 8 — Connect on startup (10 min)

Update `apps/api/src/app.ts`: replace the bare `app.listen(...)` with a startup function.

```ts
import { connectDb, disconnectDb } from "./database/connection.ts";
import { PageModel } from "./models/page.model.ts";

async function start() {
  await connectDb();
  await PageModel.init(); // builds the unique slug index before any request is served

  const server = app.listen(PORT, () => {
    console.info(`Server has started at PORT: ${PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
```

Optional, small: make `getHealth` also return the DB state, `db: mongoose.connection.readyState === 1 ? "up" : "down"`.

---

## Step 9 — Seed and smoke scripts (15 min)

Add to `apps/api/package.json` scripts:

```json
"seed": "tsx src/scripts/seed.ts",
"smoke": "tsx src/scripts/smoke.ts"
```

### `apps/api/src/scripts/seed.ts`

```ts
import { samplePage } from "@placta/contracts";
import { connectDb, disconnectDb } from "../database/connection.ts";
import { PageModel } from "../models/page.model.ts";
import { findPageBySlug } from "../repositories/pages.repository.ts";
import * as pagesService from "../services/pages.service.ts";

await connectDb();
await PageModel.init();

const existing = await findPageBySlug(samplePage.slug);
const record = existing
  ? await pagesService.saveDraft(existing.id, samplePage)
  : await pagesService.createPage(samplePage);

console.info(existing ? "Updated" : "Created", record.id, "draftVersion", record.draftVersion);
await disconnectDb();
```

Running it repeatedly updates the same page rather than creating duplicates.

### `apps/api/src/scripts/smoke.ts`

```ts
import assert from "node:assert/strict";
import { samplePage } from "@placta/contracts";
import { connectDb, disconnectDb } from "../database/connection.ts";
import { PageModel } from "../models/page.model.ts";
import { SlugTakenError } from "../repositories/pages.repository.ts";
import * as pagesService from "../services/pages.service.ts";

await connectDb();
await PageModel.init();

const page = { ...samplePage, slug: `smoke-${Date.now()}` };
const created = await pagesService.createPage(page);

// duplicate slug is rejected by the database
await assert.rejects(() => pagesService.createPage(page), SlugTakenError);

// invalid content never reaches the database
await assert.rejects(() => pagesService.createPage({ ...page, slug: "api" }), { name: "ZodError" });

// saving a draft bumps the version and leaves published state alone
const saved = await pagesService.saveDraft(created.id, { ...page, title: "Changed" });
assert.equal(saved.draftVersion, 2);
assert.equal(saved.published, null);
assert.equal(saved.status, "draft");

const reloaded = await pagesService.getPage(created.id);
assert.equal(reloaded.draft.title, "Changed");

await PageModel.deleteOne({ _id: created.id });
console.info("smoke ok");
await disconnectDb();
```

---

## Step 10 — Verify (10 min)

1. `npm run build:contracts`
2. `npm run smoke -w @placta/api` prints `smoke ok`.
3. `npm run seed -w @placta/api` prints `Created ...`. Run it again: `Updated ...` with the **same id**.
4. Restart the database and confirm the data survived:
   ```bash
   docker restart placta-mongo
   docker exec placta-mongo mongosh placta --quiet --eval 'db.pages.find().toArray()'
   docker exec placta-mongo mongosh placta --quiet --eval 'db.pages.getIndexes()'
   ```
   You should see one page, and an index named `slug_1` with `unique: true`.
5. `npm run dev:api`, then `curl localhost:6969/api/health` (use your port) still works.
6. `npm run build -w @placta/api` compiles.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `MongooseServerSelectionError` / `ECONNREFUSED` | MongoDB isn't running, or the URI/port is wrong (`docker ps`). |
| `Missing required environment variable: MONGODB_URI` | Add it to `apps/api/.env`. The file is read from the API's working directory. |
| `PAGE_STATUSES` undefined / `has no exported member` | Contracts `dist` is stale. Run `npm run build:contracts`. |
| `E11000 duplicate key` outside `SlugTakenError` | An error path isn't going through the repository's `isDuplicateKey` check. |
| Duplicate slugs *are* accepted | The unique index wasn't built. Make sure `PageModel.init()` ran, and drop any old `pages` collection created before the index existed. |

---

## Definition of done

- [ ] `npm run smoke -w @placta/api` passes.
- [ ] Seeding twice produces one page, and the data survives a MongoDB restart.
- [ ] A unique `slug_1` index exists.
- [ ] Only the repository imports Mongoose models; services use `PageRecord` and contracts types.
- [ ] `.env` is not committed; `MONGODB_URI` is documented in `.env.example`.
- [ ] `npm run build` succeeds, and `build` uses `&&` (not `;`) in the root `package.json`.

Push and ask for a review. Task 4 adds the validated admin and public routes, plus draft → publish.
