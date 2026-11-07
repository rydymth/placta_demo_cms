import { z } from "zod";

// avoid overcomplication!!!
// interface schemas {
//
// }

// Functions to resolve a good url properly

// section themes
// Better way to write enums
export const SECTION_THEMES = [
  "default",
  "muted",
  "primary",
  "dark"
] as const;

// /*
//   * section alignments left right center
export const SECTION_ALIGNMENTS = [
  "left", "right", "center"
] as const;

//   * spacing compact normal spacious
export const SECTION_SPACING = [
  "compact", "normal", "spacious"
] as const;
//   * width content wide full
export const SECTION_WIDTH = [
  "content", "wide", "full"
] as const;
//   * animations none fade-in fade-up slide-right slide-left
export const SECTION_ANIMATIONS = [
  "fade-in", "fade-up", "slide-right", "slide-left", "none"
] as const;

//   * animation_duration fast normal slow
export const SECTION_DURATION = [
  "fast", "normal", "slow"
] as const;

export const sectionThemeSchema = z.enum(SECTION_THEMES);
export const sectionAlignmentSchema = z.enum(SECTION_ALIGNMENTS);
export const sectionSpacingSchema = z.enum(SECTION_SPACING);
export const sectionWidthSchema = z.enum(SECTION_WIDTH);
export const sectionAnimationSchema = z.enum(SECTION_ANIMATIONS);
export const sectionAnimationDurationSchema = z.enum(SECTION_DURATION);

//   * create sectionSchema from above
export const sectionPresentationSchema = z
  .strictObject({
    theme: sectionThemeSchema.optional(),
    alignment: sectionAlignmentSchema.optional(),
    spacing: sectionSpacingSchema.optional(),
    width: sectionWidthSchema.optional(),
    animation: sectionAnimationSchema.optional(),
    animationDuration: sectionAnimationDurationSchema.optional(),
    // can insert delay in ms
    animationDelayMs: z
      .number()
      .int()
      .min(0)
      .max(1000)
      .multipleOf(100)
      .optional()
  });

export type SectionTheme = z.infer<typeof sectionThemeSchema>;
export type SectionAlignment = z.infer<typeof sectionAlignmentSchema>;
export type SectionSpacing = z.infer<typeof sectionSpacingSchema>;
export type SectionWidth = z.infer<typeof sectionWidthSchema>;
export type SectionAnimation = z.infer<typeof sectionAnimationSchema>;
export type SectionAnimationDuration = z.infer<typeof sectionAnimationDurationSchema>;
export type SectionPresentation = z.infer<typeof sectionPresentationSchema>;

export enum ContentType {
  hero = "hero",
  "text-section" = "text-section"
}

const isSafeHref = (value: string): boolean => {
  // Checks if the url is right!
  // Should be path type and then we resolve to https?
  // Q: How is this exactly working out?
  if (value.startsWith("/"))
    return !value.startsWith("//") &&
      !value.includes("\\");
  try {
    return new URL(value).protocol === "https:";
  }
  catch (e: any) {
    return false;
  }
}

// url schema. Will always use the safeFun to parse.
// Function can be swapped out thanks to the object providing???
export const hrefSchema = z
  .string()
  .max(2048)
  .refine(isSafeHref,
    { message: "Must be a local path or https url" });

// For every component
export const componentId = z.string().min(1).max(64);

/*
 * Provide main section schema.
 * Component rendering
 * Q: Can we make this tight with interface?
 * contains: heading(200),
 * subtitle(500)?,
 * ctaText(60)?
 * ctaHref(hrefSchema)?
 */
export const heroContentSchema = z
  .strictObject({
    heading: z.string().min(1).max(200),
    subTitle: z.string().min(1).max(500).optional(),
    ctaText: z.string().min(1).max(60).optional(),
    ctaHref: hrefSchema.optional()
  })
  .refine(c =>
    (c.ctaHref === undefined) === (c.ctaText === undefined), // already returning, both href and text undefined
    {
      message: "ctaHref and ctaText should be provided together!",
      path: ["ctaHref"]
    }
  );

// Q: can create an enum of litrals?
export const heroSchema = z.strictObject({
  id: componentId,
  type: z.literal(ContentType.hero),
  schemaVersion: z.literal(1),
  content: heroContentSchema,
  presentation: sectionPresentationSchema.optional()
});

// Text section
export const textSectionContentSchema = z.strictObject({
  heading: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

export const textSectionSchema = z.strictObject({
  id: componentId,
  type: z.literal(ContentType["text-section"]),
  schemaVersion: z.literal(1),
  content: textSectionContentSchema,
  presentation: sectionPresentationSchema.optional()
});

export const componentSchema = z.discriminatedUnion("type", [
  heroSchema,
  textSectionSchema,
]);

export type HeroComponent = z.infer<typeof heroSchema>;
export type TextSectionComponent = z.infer<typeof textSectionSchema>;
export type PageComponent = z.infer<typeof componentSchema>;
export type ComponentType = PageComponent["type"];
