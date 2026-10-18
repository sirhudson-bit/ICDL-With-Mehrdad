import { cache } from "react";

import { prisma } from "@/lib/db";

/**
 * Curriculum sequence and lesson access.
 *
 * The course is meant to be taken in order, so the canonical order of every
 * published lesson is derived once per request (module → chapter → lesson) and
 * used to work out whether a learner may open a given lesson.
 */

export type SequenceStep = {
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  moduleSlug: string;
  moduleTitle: string;
  moduleNumber: number;
  moduleIcon: string;
  moduleColor: string;
  chapterTitle: string;
  /** 1-based position in the whole curriculum. */
  position: number;
};

/** Every published lesson, in the order the course is meant to be studied. */
export const getLessonSequence = cache(async (): Promise<SequenceStep[]> => {
  const lessons = await prisma.lesson.findMany({
    where: {
      isPublished: true,
      chapter: { isPublished: true, module: { isPublished: true } },
    },
    orderBy: [
      { chapter: { module: { order: "asc" } } },
      { chapter: { order: "asc" } },
      { order: "asc" },
    ],
    select: {
      id: true,
      slug: true,
      title: true,
      chapter: {
        select: {
          title: true,
          module: { select: { slug: true, title: true, number: true, icon: true, color: true } },
        },
      },
    },
  });

  return lessons.map((lesson, index) => ({
    lessonId: lesson.id,
    lessonSlug: lesson.slug,
    lessonTitle: lesson.title,
    moduleSlug: lesson.chapter.module.slug,
    moduleTitle: lesson.chapter.module.title,
    moduleNumber: lesson.chapter.module.number,
    moduleIcon: lesson.chapter.module.icon,
    moduleColor: lesson.chapter.module.color,
    chapterTitle: lesson.chapter.title,
    position: index + 1,
  }));
});

export type LessonAccess = {
  allowed: boolean;
  /** The lesson that must be finished first, when access is refused. */
  prerequisite: SequenceStep | null;
  /** The lesson after this one, for the "next" action. */
  next: SequenceStep | null;
  position: number;
  total: number;
  /** How many lessons of the curriculum this learner has finished. */
  completedCount: number;
};

/**
 * Whether a learner may open a lesson.
 *
 * Access requires every earlier lesson in the sequence to be completed, which is
 * stricter than only checking the immediately preceding one: a learner who
 * skipped ahead before this rule existed would otherwise keep an open door in
 * the middle of the course. The lesson reported as the prerequisite is the
 * first unfinished one, so the message always points at the real next step.
 */
export async function getLessonAccess(userId: string | null, lessonId: string): Promise<LessonAccess> {
  const sequence = await getLessonSequence();
  const index = sequence.findIndex((step) => step.lessonId === lessonId);

  if (index === -1) {
    // Not part of the published sequence (an unpublished draft, say) — the page
    // itself decides what to do; nothing to gate here.
    return { allowed: true, prerequisite: null, next: null, position: 0, total: sequence.length, completedCount: 0 };
  }

  const next = sequence[index + 1] ?? null;

  if (!userId) {
    return {
      allowed: index === 0,
      prerequisite: index === 0 ? null : sequence[0]!,
      next,
      position: index + 1,
      total: sequence.length,
      completedCount: 0,
    };
  }

  const earlier = sequence.slice(0, index);
  const completedRows = earlier.length
    ? await prisma.userProgress.findMany({
        where: {
          userId,
          status: "COMPLETED",
          lessonId: { in: earlier.map((step) => step.lessonId) },
        },
        select: { lessonId: true },
      })
    : [];

  const completed = new Set(completedRows.map((row) => row.lessonId));
  const firstUnfinished = earlier.find((step) => !completed.has(step.lessonId)) ?? null;

  const totalCompleted = await prisma.userProgress.count({
    where: { userId, status: "COMPLETED", lessonId: { in: sequence.map((step) => step.lessonId) } },
  });

  return {
    allowed: firstUnfinished === null,
    prerequisite: firstUnfinished,
    next,
    position: index + 1,
    total: sequence.length,
    completedCount: totalCompleted,
  };
}

/** The first lesson a learner has not finished — where "continue" should go. */
export async function getNextUnlockedLesson(userId: string): Promise<SequenceStep | null> {
  const sequence = await getLessonSequence();
  if (sequence.length === 0) return null;

  const completedRows = await prisma.userProgress.findMany({
    where: { userId, status: "COMPLETED", lessonId: { in: sequence.map((step) => step.lessonId) } },
    select: { lessonId: true },
  });

  const completed = new Set(completedRows.map((row) => row.lessonId));
  return sequence.find((step) => !completed.has(step.lessonId)) ?? null;
}

/** Per-lesson lock state for a whole module, so listings can show padlocks. */
export async function getLessonLockMap(userId: string | null) {
  const sequence = await getLessonSequence();
  const completed = new Set<string>();

  if (userId) {
    const rows = await prisma.userProgress.findMany({
      where: { userId, status: "COMPLETED", lessonId: { in: sequence.map((step) => step.lessonId) } },
      select: { lessonId: true },
    });
    for (const row of rows) completed.add(row.lessonId);
  }

  const locks = new Map<string, { locked: boolean; position: number; prerequisite: SequenceStep | null }>();

  let firstUnfinished: SequenceStep | null = null;
  for (const step of sequence) {
    if (!completed.has(step.lessonId)) {
      firstUnfinished = step;
      break;
    }
  }

  for (const step of sequence) {
    const locked = !completed.has(step.lessonId) && step.lessonId !== firstUnfinished?.lessonId;
    locks.set(step.lessonId, {
      locked,
      position: step.position,
      prerequisite: locked ? firstUnfinished : null,
    });
  }

  return { locks, nextLesson: firstUnfinished, sequence };
}
