import { describe, it, expect } from "vitest"
import { pageSchema } from "./page.ts"
import { samplePage } from "./fixtures.ts"

const clone = () => structuredClone(samplePage) as any

describe("pageSchema", () => {

  it("accepts a valid sample page", () => {
    expect(pageSchema.safeParse(samplePage).success).toBe(true)
  })

  describe("slug validation", () => {
    const cases = [
      { name: "spaces", slug: "About Us", valid: false },
      { name: "leading slash", slug: "/about", valid: false },
      { name: "nested path", slug: "about/us", valid: false },
      { name: "uppercase", slug: "ABOUT", valid: false },
      { name: "leading hyphen", slug: "-about", valid: false },
      { name: "empty slug", slug: "", valid: false },
      { name: "reserved api", slug: "api", valid: false },
      { name: "reserved admin", slug: "admin", valid: false },
      { name: "homepage", slug: "/", valid: true },
    ]

    it.each(cases)(
      "validates $name ($slug)",
      ({ slug, valid }) => {
        const page = clone()
        page.slug = slug

        expect(pageSchema.safeParse(page).success).toBe(valid)
      }
    )
  })

  describe("component validation", () => {
    it("rejects duplicate component IDs", () => {
      const page = clone()
      page.components[1].id = page.components[0].id

      const result = pageSchema.safeParse(page)

      expect(result.success).toBe(false)

      if (!result.success) {
        expect(result.error.issues[0].message)
          .toBe(`Duplicate component id "${page.components[1].id}"`)
      }
    })
  })

  describe("CTA href validation", () => {
    const cases = [
      { name: "javascript protocol", href: "javascript:alert(1)" },
      { name: "data protocol", href: "data:text/html;base64,AAAA" },
      { name: "protocol-relative URL", href: "//evil.com" },
      { name: "insecure HTTP", href: "http://insecure.example" },
      { name: "relative path without slash", href: "contact" },
    ]

    it.each(cases)(
      "rejects $name ($href)",
      ({ href }) => {
        const page = clone()
        page.components[0].content.ctaHref = href

        expect(pageSchema.safeParse(page).success).toBe(false)
      }
    )
  })

  describe("CTA href and text together test", () => {
    const cases = [
      // either or test case
      {
        name: "text ok href undefined",
        text: "test1",
        href: undefined,
        exp: false
      },
      {
        name: "text undefined href ok",
        text: undefined,
        href: "/test",
        exp: false
      },
      {
        name: "text undefined href undefined",
        text: undefined,
        href: undefined,
        exp: true // this case is true
      },
    ]

    it.each(cases)(
      "rejects $name with text: $text; href: $href",
      ({ text, href, exp }) => {
        const page = clone();
        page.components[0].content.ctaText = text;
        page.components[0].content.ctaHref = href;
        expect(pageSchema.safeParse(page).success)
          .toBe(exp);
      }
    )
  })

  describe("presentation validation", () => {
    it("accepts a complete presentation configuration", () => {
      const page = clone()
      page.components[0].presentation = {
        theme: "dark",
        alignment: "center",
        spacing: "spacious",
        width: "wide",
        animation: "fade-up",
        animationDuration: "normal",
        animationDelayMs: 200,
      }

      expect(pageSchema.safeParse(page).success).toBe(true)
    })

    it.each([
      { name: "unsupported theme", presentation: { theme: "rainbow" } },
      { name: "unsupported animation", presentation: { animation: "spin" } },
      { name: "negative delay", presentation: { animationDelayMs: -100 } },
      { name: "delay above the maximum", presentation: { animationDelayMs: 1100 } },
      { name: "delay outside 100ms increments", presentation: { animationDelayMs: 150 } },
      { name: "unknown presentation field", presentation: { customCss: "color: red" } },
    ])("rejects $name", ({ presentation }) => {
      const page = clone()
      page.components[0].presentation = presentation

      expect(pageSchema.safeParse(page).success).toBe(false)
    })

    it("accepts pages without presentation settings", () => {
      expect(pageSchema.safeParse(samplePage).success).toBe(true)
    })
  })
})
