import { cache } from "react";

import { prisma } from "@/lib/db";
import { getTopSearches } from "@/services/search-service";
import { getTopChatQuestions } from "@/services/chat-service";
import { getQuizOverview } from "@/services/quiz-service";
import { getProgressStats } from "@/services/progress-service";

/**
 * Admin reporting.
 *
 * Aggregates the numbers the dashboard shows. All queries are read-only and
 * scoped to the current request via React's `cache`, so navigating between
 * admin pages does not repeat the same counts.
 */

export const getAdminDashboard = cache(async () => {
  const [
    userCount,
    activeUsers,
    adminCount,
    moduleCount,
    chapterCount,
    lessonCount,
    publishedLessons,
    blockCount,
    questionCount,
    bookmarkCount,
    chatMessageCount,
    faqCount,
    progressStats,
    topSearches,
    topQuestions,
    quizOverview,
    recentActivity,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.module.count(),
    prisma.chapter.count(),
    prisma.lesson.count(),
    prisma.lesson.count({ where: { isPublished: true } }),
    prisma.lessonBlock.count(),
    prisma.question.count(),
    prisma.bookmark.count(),
    prisma.chatMessage.count({ where: { role: "USER" } }),
    prisma.faq.count(),
    getProgressStats(),
    getTopSearches(6),
    getTopChatQuestions(6),
    getQuizOverview(6),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        type: true,
        message: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true, lastActiveAt: true },
    }),
  ]);

  // Per-module completion, used for the bar chart.
  const modules = await prisma.module.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      number: true,
      chapters: {
        select: {
          lessons: { select: { id: true, progress: { where: { status: "COMPLETED" }, select: { id: true } } } },
        },
      },
    },
  });

  const moduleCompletion = modules.map((courseModule) => {
    const lessons = courseModule.chapters.flatMap((chapter) => chapter.lessons);
    const completions = lessons.reduce((total, lesson) => total + lesson.progress.length, 0);
    return {
      label: `م${courseModule.number}`,
      value: completions,
      hint: `${courseModule.title}: ${completions} تکمیل`,
    };
  });

  // Most viewed lessons.
  const mostViewed = await prisma.userProgress.groupBy({
    by: ["lessonId"],
    _count: { lessonId: true },
    orderBy: { _count: { lessonId: "desc" } },
    take: 6,
  });

  const viewedLessons =
    mostViewed.length > 0
      ? await prisma.lesson.findMany({
          where: { id: { in: mostViewed.map((row) => row.lessonId) } },
          select: {
            id: true,
            title: true,
            slug: true,
            chapter: { select: { module: { select: { slug: true } } } },
          },
        })
      : [];

  const topLessons = mostViewed
    .map((row) => {
      const lesson = viewedLessons.find((item) => item.id === row.lessonId);
      return lesson
        ? {
            title: lesson.title,
            href: `/course/${lesson.chapter.module.slug}/${lesson.slug}`,
            views: row._count.lessonId,
          }
        : null;
    })
    .filter((item): item is { title: string; href: string; views: number } => Boolean(item));

  // Quiz attempt outcomes, for the donut.
  const [passedAttempts, failedAttempts] = await Promise.all([
    prisma.quizAttempt.count({ where: { passed: true } }),
    prisma.quizAttempt.count({ where: { passed: false } }),
  ]);

  const totalAttempts = passedAttempts + failedAttempts;
  const completionRate =
    progressStats.totalLessons === 0
      ? 0
      : Math.min(100, Math.round((progressStats.completedLessonRecords / progressStats.totalLessons) * 100));

  return {
    counts: {
      users: userCount,
      activeUsers,
      admins: adminCount,
      modules: moduleCount,
      chapters: chapterCount,
      lessons: lessonCount,
      publishedLessons,
      blocks: blockCount,
      questions: questionCount,
      bookmarks: bookmarkCount,
      chatQuestions: chatMessageCount,
      faqs: faqCount,
      quizAttempts: totalAttempts,
      completionRate,
    },
    progressStats,
    moduleCompletion,
    topLessons,
    topSearches,
    topQuestions,
    quizOverview,
    recentActivity,
    recentUsers,
    quizOutcome: [
      { label: "قبول", value: passedAttempts, color: "var(--success)" },
      { label: "مردود", value: failedAttempts, color: "var(--warning)" },
    ],
  };
});
