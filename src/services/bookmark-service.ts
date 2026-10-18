import { prisma } from "@/lib/db";
import type { BookmarkType } from "@/types";

/**
 * Bookmarks ("favourites").
 *
 * A favourite can point at a whole module, a single lesson, or a specific block
 * inside a lesson (a tip or a definition). At least one target must be supplied;
 * the caller owns that invariant.
 */

export type BookmarkInput = {
  userId: string;
  type?: BookmarkType;
  lessonId?: string | null;
  moduleId?: string | null;
  blockId?: string | null;
  label: string;
  excerpt?: string | null;
  note?: string | null;
};

export async function listBookmarks(userId: string, type?: BookmarkType) {
  return prisma.bookmark.findMany({
    where: { userId, ...(type ? { type } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      lesson: {
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          chapter: {
            select: {
              title: true,
              module: { select: { slug: true, title: true, color: true, group: true } },
            },
          },
        },
      },
      module: {
        select: { id: true, slug: true, title: true, description: true, icon: true, color: true, group: true },
      },
    },
  });
}

export async function getBookmarkedLessonIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.bookmark.findMany({
    where: { userId, lessonId: { not: null } },
    select: { lessonId: true },
  });
  return new Set(rows.map((row) => row.lessonId!).filter(Boolean));
}

export async function getBookmarkedModuleIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.bookmark.findMany({
    where: { userId, moduleId: { not: null } },
    select: { moduleId: true },
  });
  return new Set(rows.map((row) => row.moduleId!).filter(Boolean));
}

export async function isLessonBookmarked(userId: string, lessonId: string): Promise<boolean> {
  const count = await prisma.bookmark.count({
    where: { userId, lessonId, type: "LESSON" },
  });
  return count > 0;
}

export async function isModuleBookmarked(userId: string, moduleId: string): Promise<boolean> {
  const count = await prisma.bookmark.count({
    where: { userId, moduleId, type: "MODULE" },
  });
  return count > 0;
}

/**
 * Toggles a bookmark.
 *
 * A module favourite is unique per module, a lesson favourite per lesson, and a
 * tip/definition favourite per block — the search below mirrors that, so the
 * same button can add and remove without the caller tracking ids.
 */
export async function toggleBookmark(input: BookmarkInput): Promise<{ bookmarked: boolean; id?: string }> {
  const type = input.type ?? (input.moduleId ? "MODULE" : "LESSON");
  const lessonId = input.lessonId ?? null;
  const moduleId = input.moduleId ?? null;
  const blockId = input.blockId ?? null;

  if (!lessonId && !moduleId) {
    throw new Error("یک مقصد برای نشان‌دار کردن لازم است.");
  }

  const existing = await prisma.bookmark.findFirst({
    where: { userId: input.userId, type, lessonId, moduleId, blockId },
    select: { id: true },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return { bookmarked: false };
  }

  const created = await prisma.bookmark.create({
    data: {
      userId: input.userId,
      type,
      lessonId,
      moduleId,
      blockId,
      label: input.label.slice(0, 300),
      excerpt: input.excerpt?.slice(0, 500) ?? null,
      note: input.note?.slice(0, 500) ?? null,
    },
    select: { id: true },
  });

  return { bookmarked: true, id: created.id };
}

export async function removeBookmark(userId: string, bookmarkId: string): Promise<void> {
  await prisma.bookmark.deleteMany({ where: { id: bookmarkId, userId } });
}

export async function countBookmarks(userId: string): Promise<number> {
  return prisma.bookmark.count({ where: { userId } });
}

/** Grouped listing used by the favourites page. */
export async function groupBookmarks(userId: string) {
  const all = await listBookmarks(userId);

  return {
    modules: all.filter((bookmark) => bookmark.type === "MODULE" && bookmark.module),
    lessons: all.filter((bookmark) => bookmark.type === "LESSON" && bookmark.lesson),
    blocks: all.filter((bookmark) => bookmark.type !== "MODULE" && bookmark.type !== "LESSON"),
    total: all.length,
  };
}
