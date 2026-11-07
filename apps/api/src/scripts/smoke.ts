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

// dupe slug
await assert.rejects(() => pagesService.createPage(page), SlugTakenError);

// invalid content
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
