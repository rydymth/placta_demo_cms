import { z } from "zod";
import { componentSchema } from "./components.ts";

// Q: Explain this one

// Single place to maintain routes the apps own. Compare in lowercase.
// Contains all the file/folder struct for website creation!
export const RESERVED_SLUGS = [
  "api",
  "admin",
  "about",
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

// for seo and google bot engine -- better SSR
export const seoSchema = z.strictObject({
  title: z.string().max(70).optional(),
  description: z.string().max(160).optional(),
});

export const pageSchema = z.strictObject({
  schemaVersion: z.literal(1),
  title: z.string().min(1).max(200),
  slug: slugSchema,
  seo: seoSchema.optional(),
  // superRefine: https://zod.dev/api#refinements
  components: z.array(componentSchema).max(100).superRefine((components, ctx) => {
    const seen = new Set<string>();
    components.forEach((component, index) => {
      // duplicate check
      // can make better function
      if (seen.has(component.id)) {
        // add to validation issues!
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



// Pages will have their status!
export const PAGE_STATUSES = [
  "draft",
  "published",
  "unpublished"
] as const;

export const pageStatusSchema = z.enum(PAGE_STATUSES) // Created an enum here only from array
export type PageStatus = z.infer<typeof pageStatusSchema>;
