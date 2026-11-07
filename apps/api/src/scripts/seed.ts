import { ContentType, type Page } from "@placta/contracts";
import { connectDb, disconnectDb } from "../database/connection.ts";
import { PageModel } from "../models/page.model.ts";
import { UserModel } from "../models/user.model.ts";
import { findPageBySlug } from "../repositories/pages.repository.ts";
import * as pagesService from "../services/pages.service.ts";

const starterPages: Page[] = [
  {
    schemaVersion: 1,
    title: "Northstar Studio",
    slug: "/",
    seo: {
      title: "Northstar Studio | Clear ideas, beautifully made",
      description: "A thoughtful digital studio for ambitious teams and meaningful work.",
    },
    components: [
      {
        id: "home-hero",
        type: ContentType.hero,
        schemaVersion: 1,
        content: {
          heading: "Clear ideas. Beautifully made.",
          subTitle: "Northstar Studio helps ambitious teams turn important ideas into clear, confident digital experiences.",
          ctaText: "Explore our services",
          ctaHref: "/services",
        },
        presentation: {
          theme: "primary",
          alignment: "center",
          spacing: "spacious",
          width: "wide",
          animation: "fade-up",
          animationDuration: "slow",
          animationDelayMs: 200,
        },
      },
      {
        id: "home-intro",
        type: ContentType["text-section"],
        schemaVersion: 1,
        content: {
          heading: "Built for the work that matters",
          body: "We bring strategy, design, and technology into one focused process. The result is a digital presence that feels simple to use, memorable to experience, and ready to grow with your team.",
        },
        presentation: {
          theme: "muted",
          alignment: "center",
          spacing: "normal",
          width: "content",
          animation: "fade-in",
          animationDuration: "normal",
          animationDelayMs: 300,
        },
      },
      {
        id: "home-invitation",
        type: ContentType.hero,
        schemaVersion: 1,
        content: {
          heading: "Start with a good conversation.",
          subTitle: "Tell us what you are building, where you want to go, and what is getting in the way.",
          ctaText: "Contact the studio",
          ctaHref: "/contact",
        },
        presentation: {
          theme: "dark",
          alignment: "left",
          spacing: "normal",
          width: "wide",
          animation: "slide-left",
          animationDuration: "normal",
          animationDelayMs: 100,
        },
      },
    ],
  },
  {
    schemaVersion: 1,
    title: "Services",
    slug: "services",
    seo: {
      title: "Services | Northstar Studio",
      description: "Strategy, design, and digital foundations for growing teams.",
    },
    components: [
      {
        id: "services-hero",
        type: ContentType.hero,
        schemaVersion: 1,
        content: {
          heading: "A focused partner for your next chapter.",
          subTitle: "From first idea to a confident launch, we make the complicated feel clear.",
          ctaText: "Start a project",
          ctaHref: "/contact",
        },
        presentation: {
          theme: "dark",
          alignment: "center",
          spacing: "spacious",
          width: "wide",
          animation: "fade-up",
          animationDuration: "slow",
          animationDelayMs: 100,
        },
      },
      {
        id: "services-detail",
        type: ContentType["text-section"],
        schemaVersion: 1,
        content: {
          heading: "Strategy, design, and a durable foundation",
          body: "We help teams clarify their message, shape a flexible visual system, and build a web presence that is straightforward to manage. Start small or bring us into a larger transformation; either way, the work stays practical, collaborative, and grounded in your goals.",
        },
        presentation: {
          theme: "default",
          alignment: "left",
          spacing: "spacious",
          width: "content",
          animation: "fade-in",
          animationDuration: "normal",
          animationDelayMs: 200,
        },
      },
    ],
  },
  {
    schemaVersion: 1,
    title: "Contact",
    slug: "contact",
    seo: {
      title: "Contact | Northstar Studio",
      description: "Start a conversation with Northstar Studio.",
    },
    components: [
      {
        id: "contact-hero",
        type: ContentType.hero,
        schemaVersion: 1,
        content: {
          heading: "Let’s make something useful.",
          subTitle: "Have a project, question, or early idea? We would love to hear what you are working on.",
          ctaText: "Email hello@northstar.studio",
          ctaHref: "https://example.com",
        },
        presentation: {
          theme: "primary",
          alignment: "center",
          spacing: "spacious",
          width: "content",
          animation: "fade-up",
          animationDuration: "slow",
          animationDelayMs: 200,
        },
      },
      {
        id: "contact-note",
        type: ContentType["text-section"],
        schemaVersion: 1,
        content: {
          heading: "A small note before you write",
          body: "The best starting point is simple: what are you trying to make better, and why does it matter now? A few honest details are more than enough for a useful first conversation.",
        },
        presentation: {
          theme: "muted",
          alignment: "center",
          spacing: "normal",
          width: "content",
          animation: "fade-in",
          animationDuration: "normal",
          animationDelayMs: 300,
        },
      },
    ],
  },
];

async function seedPage(page: Page, publisherId: string | null): Promise<void> {
  const existing = await findPageBySlug(page.slug);
  const record = existing
    ? await pagesService.saveDraft(existing.id, page)
    : await pagesService.createPage(page);

  if (!publisherId) {
    console.info(`${existing ? "Updated" : "Created"} draft: ${page.title}`);
    return;
  }

  await pagesService.publishPage(record.id, publisherId);
  console.info(`${existing ? "Updated" : "Created"} and published: ${page.title}`);
}

try {
  await connectDb();
  await Promise.all([PageModel.init(), UserModel.init()]);

  const publisher = await UserModel.findOne({ isActive: { $ne: false } }).sort({ createdAt: 1 }).lean();
  for (const page of starterPages) await seedPage(page, publisher ? String(publisher._id) : null);

  if (!publisher) console.info("No user exists yet, so the starter pages remain drafts. Create an account, then publish them from the admin.");
}
finally {
  await disconnectDb();
}
