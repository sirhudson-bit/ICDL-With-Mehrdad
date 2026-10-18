import { prisma } from "@/lib/db";
import type { ProgressStatus } from "@/types";

/**
 * Learner progress.
 *
 * Progress is stored per lesson; module and course percentages are derived from
 * those rows rather than kept in sync manually, so they can never drift.
 */

export type LessonProgress = {
  status: ProgressStatus;
  percent: number;
  lastViewedAt: Date;
  completedAt: Date | null;
};

export type CourseProgress = {
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  percent: number;
  completedMinutes: number;
  totalMinutes: number;
};

export type ModuleProgressSummary = {
  moduleId: string;
  moduleSlug: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
};

/** Progress for every lesson the learner has touched, keyed by lesson id. */
export async function getLessonProgressMap(userId: string): Promise<Map<string, LessonProgress>> {
  const rows = await prisma.userProgress.findMany({
    where: { userId },
    select: { lessonId: true, status: true, percent: true, lastViewedAt: true, completedAt: true },
  });

  return new Map(
    rows.map((row) => [
      row.lessonId,
      {
        status: (row.status === "COMPLETED"
          ? "COMPLETED"
          : row.status === "IN_PROGRESS"
            ? "IN_PROGRESS"
            : "NOT_STARTED") as ProgressStatus,
        percent: row.percent,
        lastViewedAt: row.lastViewedAt,
        completedAt: row.completedAt,
      },
    ]),
  );
}

export async function getCourseProgress(userId: string): Promise<CourseProgress> {
  const [lessons, progress] = await Promise.all([
    prisma.lesson.findMany({ where: { isPublished: true }, select: { id: true, estimatedMinutes: true } }),
    prisma.userProgress.findMany({
      where: { userId },
      select: { lessonId: true, status: true },
    }),
  ]);

  const progressByLesson = new Map(progress.map((row) => [row.lessonId, row.status]));

  let completedLessons = 0;
  let inProgressLessons = 0;
  let completedMinutes = 0;

  for (const lesson of lessons) {
    const status = progressByLesson.get(lesson.id);
    if (status === "COMPLETED") {
      completedLessons += 1;
      completedMinutes += lesson.estimatedMinutes;
    } else if (status === "IN_PROGRESS") {
      inProgressLessons += 1;
    }
  }

  const totalMinutes = lessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0);
  const totalLessons = lessons.length;

  return {
    totalLessons,
    completedLessons,
    inProgressLessons,
    percent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    completedMinutes,
    totalMinutes,
  };
}

export async function getModuleProgress(userId: string): Promise<ModuleProgressSummary[]> {
  const modules = await prisma.module.findMany({
    where: { isPublished: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      chapters: {
        where: { isPublished: true },
        select: { lessons: { where: { isPublished: true }, select: { id: true } } },
      },
    },
  });

  const progress = await prisma.userProgress.findMany({
    where: { userId, status: "COMPLETED" },
    select: { lessonId: true },
  });

  const completedIds = new Set(progress.map((row) => row.lessonId));

  return modules.map((courseModule) => {
    const lessonIds = courseModule.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id));
    const completed = lessonIds.filter((id) => completedIds.has(id)).length;
    const total = lessonIds.length;

    return {
      moduleId: courseModule.id,
      moduleSlug: courseModule.slug,
      totalLessons: total,
      completedLessons: completed,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  });
}

/**
 * The lesson the learner should resume: anything explicitly in progress first,
 * then the first unfinished lesson in curriculum order.
 */
export async function getContinueLearning(userId: string) {
  const inProgress = await prisma.userProgress.findFirst({
    where: { userId, status: "IN_PROGRESS", lesson: { isPublished: true } },
    orderBy: { lastViewedAt: "desc" },
    include: {
      lesson: {
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          estimatedMinutes: true,
          chapter: { select: { title: true, module: { select: { slug: true, title: true, color: true } } } },
        },
      },
    },
  });

  if (inProgress) {
    return { lesson: inProgress.lesson, percent: inProgress.percent, reason: "in_progress" as const };
  }

  const completed = await prisma.userProgress.findMany({
    where: { userId, status: "COMPLETED" },
    select: { lessonId: true },
  });
  const completedIds = completed.map((row) => row.lessonId);

  const nextLesson = await prisma.lesson.findFirst({
    where: { isPublished: true, id: { notIn: completedIds.length > 0 ? completedIds : ["__none__"] } },
    orderBy: [{ chapter: { module: { order: "asc" } } }, { chapter: { order: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      estimatedMinutes: true,
      chapter: { select: { title: true, module: { select: { slug: true, title: true, color: true } } } },
    },
  });

  if (!nextLesson) {
    // Everything is complete — offer the first lesson for revision.
    const first = await prisma.lesson.findFirst({
      where: { isPublished: true },
      orderBy: [{ chapter: { module: { order: "asc" } } }, { chapter: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        estimatedMinutes: true,
        chapter: { select: { title: true, module: { select: { slug: true, title: true, color: true } } } },
      },
    });
    return first ? { lesson: first, percent: 0, reason: "completed" as const } : null;
  }

  return { lesson: nextLesson, percent: 0, reason: "next" as const };
}

export async function getRecentlyViewed(userId: string, limit = 6) {
  const rows = await prisma.userProgress.findMany({
    where: { userId, lesson: { isPublished: true } },
    orderBy: { lastViewedAt: "desc" },
    take: limit,
    include: {
      lesson: {
        select: {
          id: true,
          slug: true,
          title: true,
          estimatedMinutes: true,
          chapter: { select: { module: { select: { slug: true, title: true, color: true } } } },
        },
      },
    },
  });

  return rows.map((row) => ({
    lesson: row.lesson,
    percent: row.percent,
    status: row.status,
    lastViewedAt: row.lastViewedAt,
  }));
}

/** Records that a lesson was opened, without clobbering an existing status. */
export async function markLessonViewed(userId: string, lessonId: string): Promise<void> {
  await prisma.userProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, status: "IN_PROGRESS", percent: 5 },
    update: { lastViewedAt: new Date() },
  });
}

export async function setLessonStatus(
  userId: string,
  lessonId: string,
  status: ProgressStatus,
): Promise<void> {
  const now = new Date();

  await prisma.userProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      status,
      percent: status === "COMPLETED" ? 100 : status === "IN_PROGRESS" ? 10 : 0,
      completedAt: status === "COMPLETED" ? now : null,
      lastViewedAt: now,
    },
    update: {
      status,
      percent: status === "COMPLETED" ? 100 : status === "IN_PROGRESS" ? 10 : 0,
      completedAt: status === "COMPLETED" ? now : null,
      lastViewedAt: now,
    },
  });

  if (status === "COMPLETED") {
    await recordStreak(userId);
    await prisma.activityLog.create({
      data: {
        userId,
        type: "LESSON_COMPLETED",
        message: "یک درس تکمیل شد",
        metadata: { lessonId },
      },
    });
  }
}

/** Increments the learner's streak once per calendar day. */
async function recordStreak(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakCount: true, lastStreakDate: true },
  });
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const last = user.lastStreakDate ? new Date(user.lastStreakDate) : null;
  if (last) {
    last.setHours(0, 0, 0, 0);
    if (last.getTime() === today.getTime()) return;
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const continues = last !== null && last.getTime() === yesterday.getTime();

  await prisma.user.update({
    where: { id: userId },
    data: {
      streakCount: continues ? user.streakCount + 1 : 1,
      lastStreakDate: today,
    },
  });
}

export async function resetUserProgress(userId: string): Promise<void> {
  await prisma.userProgress.deleteMany({ where: { userId } });
  await prisma.quizAttempt.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { streakCount: 0, lastStreakDate: null },
  });
  await prisma.activityLog.create({
    data: { userId, type: "USER_UPDATED", message: "پیشرفت کاربر بازنشانی شد" },
  });
}

/** Completion and quiz statistics shown on the admin dashboard. */
export async function getProgressStats() {
  const [totalLessons, completed, activeLearners, attempts] = await Promise.all([
    prisma.lesson.count({ where: { isPublished: true } }),
    prisma.userProgress.count({ where: { status: "COMPLETED" } }),
    prisma.userProgress.groupBy({ by: ["userId"], _count: { userId: true } }),
    prisma.quizAttempt.findMany({ select: { passed: true, score: true, maxScore: true } }),
  ]);

  const passed = attempts.filter((attempt) => attempt.passed).length;
  const averageScore =
    attempts.length === 0
      ? 0
      : Math.round(
          attempts.reduce(
            (total, attempt) => total + (attempt.maxScore === 0 ? 0 : (attempt.score / attempt.maxScore) * 100),
            0,
          ) / attempts.length,
        );

  return {
    totalLessons,
    completedLessonRecords: completed,
    learnersWithProgress: activeLearners.length,
    quizAttempts: attempts.length,
    quizPassRate: attempts.length === 0 ? 0 : Math.round((passed / attempts.length) * 100),
    averageQuizScore: averageScore,
  };
}
