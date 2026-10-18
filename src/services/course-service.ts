import { cache } from "react";

import { prisma } from "@/lib/db";

/**
 * Course content access.
 *
 * Every query filters to `isPublished` unless a caller explicitly asks for
 * drafts, which is only the case inside the admin preview.
 */

export type LessonNavItem = {
  id: string;
  slug: string;
  title: string;
  order: number;
  estimatedMinutes: number;
  chapterTitle: string;
  chapterSlug: string;
  moduleTitle: string;
  moduleSlug: string;
  moduleColor: string;
  moduleNumber: number;
};

export type ChapterTreeNode = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  lessons: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    estimatedMinutes: number;
    difficulty: string;
    hasQuiz: boolean;
  }[];
};

export type ModuleTreeNode = {
  id: string;
  slug: string;
  number: number;
  title: string;
  subtitle: string | null;
  description: string;
  icon: string;
  color: string;
  /** Curriculum strand key, resolved to a title via src/lib/topics.ts. */
  group: string;
  estimatedMinutes: number;
  updatedAt: Date;
  chapters: ChapterTreeNode[];
};

const lessonSummarySelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  estimatedMinutes: true,
  difficulty: true,
  order: true,
  quiz: { select: { id: true } },
} as const;

/** The full published course tree, used by navigation and the course index. */
export const getCourseTree = cache(async (includeDrafts = false): Promise<ModuleTreeNode[]> => {
  const modules = await prisma.module.findMany({
    where: includeDrafts ? {} : { isPublished: true },
    orderBy: { order: "asc" },
    include: {
      chapters: {
        where: includeDrafts ? {} : { isPublished: true },
        orderBy: { order: "asc" },
        include: {
          lessons: {
            where: includeDrafts ? {} : { isPublished: true },
            orderBy: { order: "asc" },
            select: lessonSummarySelect,
          },
        },
      },
    },
  });

  return modules.map((courseModule) => ({
    id: courseModule.id,
    slug: courseModule.slug,
    number: courseModule.number,
    title: courseModule.title,
    subtitle: courseModule.subtitle,
    description: courseModule.description,
    icon: courseModule.icon,
    color: courseModule.color,
    group: courseModule.group,
    estimatedMinutes: courseModule.estimatedMinutes,
    updatedAt: courseModule.updatedAt,
    chapters: courseModule.chapters.map((chapter) => ({
      id: chapter.id,
      slug: chapter.slug,
      title: chapter.title,
      description: chapter.description,
      lessons: chapter.lessons.map((lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        estimatedMinutes: lesson.estimatedMinutes,
        difficulty: lesson.difficulty,
        hasQuiz: Boolean(lesson.quiz),
      })),
    })),
  }));
});

/** Flat list of every published lesson in curriculum order. */
export const getLessonSequence = cache(async (): Promise<LessonNavItem[]> => {
  const modules = await prisma.module.findMany({
    where: { isPublished: true },
    orderBy: { order: "asc" },
    select: {
      title: true,
      slug: true,
      color: true,
      number: true,
      chapters: {
        where: { isPublished: true },
        orderBy: { order: "asc" },
        select: {
          title: true,
          slug: true,
          lessons: {
            where: { isPublished: true },
            orderBy: { order: "asc" },
            select: { id: true, slug: true, title: true, order: true, estimatedMinutes: true },
          },
        },
      },
    },
  });

  const sequence: LessonNavItem[] = [];
  for (const courseModule of modules) {
    for (const chapter of courseModule.chapters) {
      for (const lesson of chapter.lessons) {
        sequence.push({
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          order: lesson.order,
          estimatedMinutes: lesson.estimatedMinutes,
          chapterTitle: chapter.title,
          chapterSlug: chapter.slug,
          moduleTitle: courseModule.title,
          moduleSlug: courseModule.slug,
          moduleColor: courseModule.color,
          moduleNumber: courseModule.number,
        });
      }
    }
  }

  return sequence;
});

export type LessonDetail = NonNullable<Awaited<ReturnType<typeof getLessonBySlug>>>;

/** Full lesson payload including its ordered blocks, quiz and FAQs. */
export const getLessonBySlug = cache(async (slug: string, includeDrafts = false) => {
  const lesson = await prisma.lesson.findUnique({
    where: { slug },
    include: {
      blocks: {
        where: includeDrafts ? {} : { isVisible: true },
        orderBy: { order: "asc" },
      },
      quiz: {
        include: { questions: { orderBy: { order: "asc" } } },
      },
      faqs: {
        where: includeDrafts ? {} : { isPublished: true },
        orderBy: { order: "asc" },
      },
      chapter: {
        include: {
          module: true,
        },
      },
    },
  });

  if (!lesson) return null;
  if (!includeDrafts && (!lesson.isPublished || !lesson.chapter.isPublished || !lesson.chapter.module.isPublished)) {
    return null;
  }

  return lesson;
});

export type ModuleDetail = NonNullable<Awaited<ReturnType<typeof getModuleBySlug>>>;

export const getModuleBySlug = cache(async (slug: string, includeDrafts = false) => {
  const courseModule = await prisma.module.findUnique({
    where: { slug },
    include: {
      chapters: {
        where: includeDrafts ? {} : { isPublished: true },
        orderBy: { order: "asc" },
        include: {
          lessons: {
            where: includeDrafts ? {} : { isPublished: true },
            orderBy: { order: "asc" },
            select: lessonSummarySelect,
          },
        },
      },
    },
  });

  if (!courseModule) return null;
  if (!includeDrafts && !courseModule.isPublished) return null;

  return courseModule;
});

/** Previous and next lesson relative to the given lesson, for the footer nav. */
export async function getLessonNeighbours(lessonId: string) {
  const sequence = await getLessonSequence();
  const index = sequence.findIndex((item) => item.id === lessonId);

  if (index === -1) return { previous: null, next: null, index: 0, total: sequence.length };

  return {
    previous: index > 0 ? sequence[index - 1]! : null,
    next: index < sequence.length - 1 ? sequence[index + 1]! : null,
    index,
    total: sequence.length,
  };
}

/** Resolves related-lesson references, accepting either a slug or a path. */
export async function getRelatedLessons(references: string[]) {
  const slugs = references.map((reference) => reference.split("/").filter(Boolean).at(-1) ?? reference);
  if (slugs.length === 0) return [];

  const lessons = await prisma.lesson.findMany({
    where: { slug: { in: slugs }, isPublished: true },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      estimatedMinutes: true,
      chapter: { select: { module: { select: { slug: true, title: true, color: true } } } },
    },
  });

  // Preserve the author-specified order.
  return slugs
    .map((slug) => lessons.find((lesson) => lesson.slug === slug))
    .filter((lesson): lesson is (typeof lessons)[number] => Boolean(lesson));
}

/** Lessons with the most progress records — used for "popular" suggestions. */
export async function getPopularLessons(limit = 5) {
  const grouped = await prisma.userProgress.groupBy({
    by: ["lessonId"],
    _count: { lessonId: true },
    orderBy: { _count: { lessonId: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) {
    return prisma.lesson.findMany({
      where: { isPublished: true },
      orderBy: [{ chapter: { module: { order: "asc" } } }, { order: "asc" }],
      take: limit,
      select: { id: true, slug: true, title: true, summary: true },
    });
  }

  const lessons = await prisma.lesson.findMany({
    where: { id: { in: grouped.map((row) => row.lessonId) } },
    select: { id: true, slug: true, title: true, summary: true },
  });

  return grouped
    .map((row) => lessons.find((lesson) => lesson.id === row.lessonId))
    .filter((lesson): lesson is (typeof lessons)[number] => Boolean(lesson));
}

/** Global help-centre FAQs (those not attached to a lesson). */
export const getGlobalFaqs = cache(async () =>
  prisma.faq.findMany({
    where: { lessonId: null, isPublished: true },
    orderBy: { order: "asc" },
    select: { id: true, question: true, answer: true, category: true },
  }),
);

export const getCourseStats = cache(async () => {
  const [modules, lessons, blocks, questions] = await Promise.all([
    prisma.module.count({ where: { isPublished: true } }),
    prisma.lesson.count({ where: { isPublished: true } }),
    prisma.lessonBlock.count(),
    prisma.question.count(),
  ]);

  const totalMinutes = await prisma.lesson.aggregate({
    where: { isPublished: true },
    _sum: { estimatedMinutes: true },
  });

  return {
    modules,
    lessons,
    blocks,
    questions,
    totalMinutes: totalMinutes._sum.estimatedMinutes ?? 0,
  };
});
