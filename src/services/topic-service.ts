import { cache } from "react";

import { prisma } from "@/lib/db";
import { getTopicGroup } from "@/lib/topics";

/**
 * Related-topic discovery.
 *
 * Mirrors how learners actually browse: sideways to the rest of the current
 * chapter, then out to the sibling applications in the same strand (Word,
 * PowerPoint and Access while reading Excel), then to the other chapters of the
 * current module. Every result carries its group so the UI can show a precise
 * path instead of a bare title.
 */

export type TopicModuleCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  group: string;
  lessonCount: number;
};

export type TopicLessonCard = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  moduleSlug: string;
  moduleTitle: string;
  chapterTitle: string;
  group: string;
};

export type TopicChapterCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  lessonCount: number;
};

export type RelatedTopics = {
  /** Other lessons in the same chapter — the closest neighbours. */
  siblings: TopicLessonCard[];
  /** The next chapters of this module. */
  chapters: TopicChapterCard[];
  /** The other applications/modules in the same curriculum strand. */
  groupModules: TopicModuleCard[];
  /** Modules from a different strand, for a change of subject. */
  otherStrands: TopicModuleCard[];
};

export const getRelatedTopics = cache(
  async (input: {
    lessonId: string;
    moduleId: string;
    chapterId: string;
    group: string;
  }): Promise<RelatedTopics> => {
    const [siblings, chapters, groupModules, otherStrands] = await Promise.all([
      prisma.lesson.findMany({
        where: { chapterId: input.chapterId, isPublished: true, id: { not: input.lessonId } },
        orderBy: { order: "asc" },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          estimatedMinutes: true,
          chapter: {
            select: {
              title: true,
              module: { select: { slug: true, title: true, group: true } },
            },
          },
        },
      }),

      prisma.chapter.findMany({
        where: { moduleId: input.moduleId, isPublished: true, id: { not: input.chapterId } },
        orderBy: { order: "asc" },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          _count: { select: { lessons: true } },
        },
      }),

      prisma.module.findMany({
        where: { group: input.group, isPublished: true, id: { not: input.moduleId } },
        orderBy: { order: "asc" },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          icon: true,
          color: true,
          group: true,
          _count: { select: { chapters: true } },
          chapters: { select: { _count: { select: { lessons: true } } } },
        },
      }),

      // One representative module from each other strand, so a learner who is
      // done with Office still sees where to go next.
      prisma.module.findMany({
        where: { group: { not: input.group }, isPublished: true },
        orderBy: { order: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          icon: true,
          color: true,
          group: true,
          _count: { select: { chapters: true } },
          chapters: { select: { _count: { select: { lessons: true } } } },
        },
      }),
    ]);

    const toModuleCard = (courseModule: (typeof groupModules)[number]): TopicModuleCard => ({
      id: courseModule.id,
      slug: courseModule.slug,
      title: courseModule.title,
      description: courseModule.description,
      icon: courseModule.icon,
      color: courseModule.color,
      group: courseModule.group,
      lessonCount: courseModule.chapters.reduce((total, chapter) => total + chapter._count.lessons, 0),
    });

    // Keep only the first module of each strand to avoid a wall of links.
    const seenStrands = new Set<string>();
    const dedupedStrands = otherStrands.filter((courseModule) => {
      const key = getTopicGroup(courseModule.group).key;
      if (seenStrands.has(key)) return false;
      seenStrands.add(key);
      return true;
    });

    return {
      siblings: siblings.map((lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        estimatedMinutes: lesson.estimatedMinutes,
        moduleSlug: lesson.chapter.module.slug,
        moduleTitle: lesson.chapter.module.title,
        chapterTitle: lesson.chapter.title,
        group: lesson.chapter.module.group,
      })),
      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        slug: chapter.slug,
        title: chapter.title,
        description: chapter.description,
        lessonCount: chapter._count.lessons,
      })),
      groupModules: groupModules.map(toModuleCard),
      otherStrands: dedupedStrands.slice(0, 3).map(toModuleCard),
    };
  },
);

/** Popular searches rendered as topic suggestions on the search page. */
export const getTopicHighlights = cache(async (limit = 6) => {
  const modules = await prisma.module.findMany({
    where: { isPublished: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      group: true,
      icon: true,
      color: true,
      description: true,
      _count: { select: { chapters: true } },
      chapters: { select: { _count: { select: { lessons: true } } } },
    },
    take: limit,
  });

  return modules.map((courseModule) => ({
    id: courseModule.id,
    slug: courseModule.slug,
    title: courseModule.title,
    group: courseModule.group,
    icon: courseModule.icon,
    color: courseModule.color,
    description: courseModule.description,
    lessonCount: courseModule.chapters.reduce((total, chapter) => total + chapter._count.lessons, 0),
  }));
});
