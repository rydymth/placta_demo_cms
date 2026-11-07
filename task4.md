# Task 4 — Page API and Draft/Publish Workflow

**Goal:** expose the page service over a versioned REST API. Admin can list/create/read pages, save drafts, publish/unpublish, and inspect published revisions. The public API returns only a published snapshot.

**Estimated time:** 2–3 hours for a first working implementation.

**Important security boundary:** Task 4 does not add login yet. Keep the API bound to `127.0.0.1`, use it only on your development machine, and do not expose it through a public host or reverse proxy. Add authentication before deploying admin endpoints.

**In scope:** controllers, routes, error handling, revision records, and manual/API tests. Reuse the contracts, repository, and service from Task 3.

---

## Step 1 — Fix the API port value (5 min)

In `apps/api/src/utils/config.ts`, `process.env.PORT` is always a string. `required<Number>("PORT")` only tells TypeScript to pretend the value is a `Number`; it does not convert it. Passing `"3000"` to `listen()` can be interpreted as a socket path rather than TCP port `3000`.

Keep your typed `required` helper if you prefer, but explicitly parse and validate the port:

```ts
const port = process.env.PORT === undefined ? 6969 : Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535");
}
```

Set `port` in the exported config to this `port` variable. The required Mongo URI remains a string.

In `apps/api/src/app.ts`, bind the development server locally:

```ts
app.listen(PORT, "127.0.0.1", () => {
```

This is temporary until authentication is implemented. Do not solve this by adding a hardcoded token to the frontend.

---

## Step 2 — Add immutable publication revisions (25 min)

Create `apps/api/src/models/page-revision.model.ts`:

```ts
import { Schema, model } from "mongoose";

const pageRevisionSchema = new Schema(
  {
    pageId: { type: Schema.Types.ObjectId, ref: "Page", required: true, immutable: true },
    version: { type: Number, required: true, immutable: true },
    snapshot: { type: Schema.Types.Mixed, required: true, immutable: true },
    publishedAt: { type: Date, required: true, immutable: true },
  },
  { versionKey: false },
);

pageRevisionSchema.index({ pageId: 1, version: 1 }, { unique: true });
export const PageRevisionModel = model("PageRevision", pageRevisionSchema);
```

Add a repository `apps/api/src/repositories/page-revisions.repository.ts` with functions to:

- Create a snapshot for a page with the next version number and the current timestamp.
- List revisions for a page, newest first; return only `id`, `version`, and `publishedAt` in the list.
- Get one revision by both page ID and revision ID, returning `null` when it does not belong to that page.
- Delete a just-created revision if the following page update fails. This is only cleanup for a failed publish operation; never expose a normal update/delete endpoint for revisions.

Convert Mongo documents to plain return values as you did for `PageRecord`. Map duplicate-key errors on `{ pageId, version }` to a clear conflict error. `PageModel.init()` starts the page index; also call `PageRevisionModel.init()` before listening so its unique index exists.

**Why a separate collection?** Each revision is a historical snapshot; editing the current draft must not alter a previous publication.

---

## Step 3 — Add repository operations for listing and publication (20 min)

In `pages.repository.ts`, add:

- `listPages()`: return page summaries ordered by `updatedAt` descending. Do not return full draft content in the list.
- `setPublished(id, snapshot, revisionId)`: set `published`, `currentPublishedRevisionId`, and `status: "published"`; return the updated `PageRecord`, or `null` if missing.
- `setUnpublished(id)`: set `published: null`, `currentPublishedRevisionId: null`, and `status: "unpublished"`; return the record or `null`.
- `findPublishedBySlug(slug)`: query for the page with that slug and `status: "published"`; return only its published snapshot (or `null`). Never return a draft from this function.

Do not change `updateDraft`: saving a draft must leave `status`, `published`, and the current revision pointer untouched.

---

## Step 4 — Add the publishing service (20 min)

Extend `apps/api/src/services/pages.service.ts`:

### Publish operation

1. Load the page; throw `PageNotFoundError` if absent.
2. Validate the complete current draft using `pageSchema.parse(record.draft)`.
3. Create a revision containing that exact parsed snapshot.
4. Update the page's published snapshot, current revision ID, and status.
5. If the page update fails or returns `null`, clean up the revision created in step 3 and return an error. Do not report success unless both operations succeeded.
6. Return the updated record and revision metadata.

For this single-admin MVP, concurrent publish requests are not expected. If two publishes race, the unique `{ pageId, version }` index must reject a duplicate version rather than silently overwrite a revision. MongoDB transactions can be added later if deployment uses a replica set.

### Unpublish operation

Call the repository to clear the current published snapshot and pointer and set the status to `unpublished`. Keep old revision documents; unpublishing must not delete publication history. A later publish creates a new revision from the current draft.

### Public lookup

Call `findPublishedBySlug`. If there is no currently published page, return a not-found error. This API must never fall back to `draft`.

---

## Step 5 — Create controllers, routes, and response format (30 min)

Create page controller and route files under `apps/api/src/modules/pages/` (or use your existing `routes/` and `controllers/` folders consistently). Keep controllers thin: read params/body, call service functions, and send responses.

Use the response format from the specification:

```json
{ "success": true, "data": {}, "message": "Operation completed" }
```

Create these endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/admin/pages` | List summaries |
| `POST` | `/api/v1/admin/pages` | Validate and create a draft page |
| `GET` | `/api/v1/admin/pages/:id` | Get a page, including its draft |
| `PUT` | `/api/v1/admin/pages/:id/draft` | Validate and save draft |
| `POST` | `/api/v1/admin/pages/:id/publish` | Publish current draft as a snapshot |
| `POST` | `/api/v1/admin/pages/:id/unpublish` | Remove current public version, retain revisions |
| `GET` | `/api/v1/admin/pages/:id/revisions` | List revision metadata |
| `GET` | `/api/v1/admin/pages/:id/revisions/:revisionId` | Retrieve a revision snapshot |
| `GET` | `/api/v1/public/pages/:slug` | Retrieve a published page by slug |
| `GET` | `/api/v1/public/pages?slug=%2F` | Retrieve the published homepage |

The homepage has slug `/`, so it cannot be represented as a single `:slug` path segment. Handle it explicitly with the query endpoint above. Reject a missing or invalid slug query rather than defaulting to draft data.

Mount routers under `/api/v1`. Keep health at `/api/health` for now.

**Validation:** pass untrusted request bodies to service functions as `unknown`. The service parses with the shared `pageSchema`; do not trust TypeScript types as runtime validation. For `:id` and `:revisionId`, validate Mongo ObjectId syntax and return 404 for invalid/nonexistent IDs.

---

## Step 6 — Add one centralized error handler (15 min)

Create `apps/api/src/middleware/error-handler.middleware.ts` and register it **after all routes**. It should map known errors:

| Error | HTTP status | Error code |
|---|---:|---|
| Zod validation error | 400 | `VALIDATION_ERROR` |
| `PageNotFoundError` | 404 | `NOT_FOUND` |
| `SlugTakenError` | 409 | `SLUG_TAKEN` |
| Duplicate revision version/conflict | 409 | `CONFLICT` |
| Malformed JSON body | 400 | `INVALID_JSON` |
| Anything else | 500 | `INTERNAL_ERROR` |

Use this shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  }
}
```

Include safe Zod issue paths/messages in `details`. Do not send stack traces, database errors, or internal exception messages to clients. Log unexpected errors on the server. Do not swallow errors or return success-shaped fallbacks.

---

## Step 7 — Verify the draft/publish boundary (30 min)

You can verify with curl or an API client. Use your actual API port; the examples use `6969`.

1. Create a page with slug `about-us`:
   ```bash
   curl -i -X POST http://127.0.0.1:6969/api/v1/admin/pages \
     -H 'Content-Type: application/json' \
     -d '{"schemaVersion":1,"title":"About","slug":"about-us","components":[{"id":"hero-1","type":"hero","schemaVersion":1,"content":{"heading":"About us"}}]}'
   ```
   Save the returned page `id`.
2. Before publishing, `GET /api/v1/public/pages/about-us` must return 404.
3. Publish using `POST /api/v1/admin/pages/<id>/publish`. The response should include a revision ID/version.
4. Public `GET /api/v1/public/pages/about-us` should now return the published page, with no draft/version/database fields.
5. Change the draft heading with `PUT /api/v1/admin/pages/<id>/draft`. Confirm the public GET still returns the old heading.
6. Publish again. Confirm a new revision exists and public GET now returns the new heading.
7. Unpublish. Confirm public GET returns 404, and the revision list still contains both snapshots.
8. Confirm `GET /api/v1/public/pages?slug=%2F` returns the homepage only if `/` has been published. The seeded draft alone is not public.
9. Try invalid page JSON and a duplicate slug; expect 400 and 409 respectively.

Add focused automated tests for at least: draft is invisible before publish; draft edits do not change the live snapshot; publish changes live content; unpublish makes it unavailable. A table-driven test is fine.

---

## Common issues

| Symptom | Likely cause / fix |
|---|---|
| API listens on a file/socket path | `PORT` was passed as a string. Convert with `Number()` before `listen()`. |
| `Cannot GET /api/v1/...` | Router was not mounted, or path prefix differs. Check `app.ts` and route method. |
| Public route returns draft | Repository queried `draft` or falls back to it. Public lookup must filter `status: "published"` and return `published` only. |
| Page not found after publishing | The current revision pointer/status was not updated, or public lookup is using a stale slug. |
| Revision count/index errors | Ensure `PageRevisionModel.init()` runs and the unique `{ pageId, version }` index exists. |
| Validation errors become 500 | Register the error handler last and map Zod errors explicitly. |

## Definition of done

- [ ] Admin page endpoints validate data and use the service/repository layers.
- [ ] Public endpoints return only published snapshots; draft-only and unpublished pages return 404.
- [ ] Publishing creates a new immutable revision; later draft edits do not change it.
- [ ] Unpublishing hides the page but preserves revision history.
- [ ] Homepage lookup works for slug `/`.
- [ ] Known errors map to the documented status/response shape; unexpected errors do not leak internals.
- [ ] Local-only admin API is not exposed publicly; authentication is required before deployment.
- [ ] `npm run build:contracts && npm run build -w @placta/api` succeeds.

Push when done and request a review. The next step can connect the admin UI to these endpoints and add authentication before any public deployment.


## Next: login and passkeys

After this local-only API task, complete [Task 5 — Administrator Login, Passwords and Passkeys](task5-auth.md). Password and passkey authentication are both in scope. All admin endpoints must remain local-only until backend authorization is implemented; do not expose them just because the UI has a login screen.
