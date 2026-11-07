import type { Page, PageStatus } from "./page.ts";

// Shapes sent over HTTP. Dates are ISO strings.

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export interface PageSummaryDto {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  draftVersion: number;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageDetailDto extends PageSummaryDto {
  draft: Page;
  published: Page | null;
  currentPublishedRevisionId: string | null;
}

export interface RevisionMetaDto {
  id: string;
  pageId: string;
  version: number;
  title: string;
  slug: string;
  publishedAt: string;
}

export interface RevisionDto extends RevisionMetaDto {
  snapshot: Page;
}

export interface NavItemDto {
  title: string;
  slug: string;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor";
}

export interface PasskeyDto {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  deviceType: string;
  backedUp: boolean;
}

export interface SessionDto {
  accessToken: string;
  expiresIn: number;
  user: UserDto;
}
