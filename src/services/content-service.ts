import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import {
  blockToSearchText,
  validateBlockData,
  type BlockData,
  type BlockType,
} from "@/lib/content/blocks";
import { buildSearchText } from "@/lib/persian";

/**
 * Content maintenance.
 *
 * The search layer matches against denormalised `searchText` columns, so they
 * must be rebuilt whenever authored content changes. Keeping that logic here
 * means every write path — admin actions and the importer — stays consistent.
 */

type BlockLike = { type: string; data: unknown };

function blockSearchText(blocks: BlockLike[]): string {
  return blocks
    .filter((block) => block.type !== "divider")
    .map((block) => blockToSearchText(block.type as BlockType, block.data as BlockData))
    .join(" \n ");
}

/** Rebuilds a lesson's search haystack from its title, meta and blocks. */
export async function recomputeLessonSearch(lessonId: string): Promise<void> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      title: true,
      summary: true,
      keywords: true,
      blocks: { select: { type: true, data: true } },
      faqs: { select: { question: true, answer: true } },
      quiz: { select: { questions: { select: { prompt: true, data: true, type: true } } } },
    },
  });

  if (!lesson) return;

  const quizText = lesson.quiz
    ? lesson.quiz.questions.map((question) => `${question.prompt} ${JSON.stringify(question.data)}`).join(" ")
    : "";
  const faqText = lesson.faqs.map((faq) => `${faq.question} ${faq.answer}`).join(" ");

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      searchText: buildSearchText([
        lesson.title,
        lesson.summary,
        lesson.keywords,
        blockSearchText(lesson.blocks),
        quizText,
        faqText,
      ]),
    },
  });
}

/** Rebuilds a module's haystack, which also spans its chapters and lessons. */
export async function recomputeModuleSearch(moduleId: string): Promise<void> {
  const courseModule = await prisma.module.findUnique({
    where: { id: moduleId },
    select: {
      title: true,
      subtitle: true,
      description: true,
      chapters: {
        select: {
          title: true,
          description: true,
          lessons: { select: { title: true, summary: true, keywords: true } },
        },
      },
    },
  });

  if (!courseModule) return;

  const descendants = courseModule.chapters.flatMap((chapter) => [
    chapter.title,
    chapter.description ?? "",
    ...chapter.lessons.map((lesson) => `${lesson.title} ${lesson.summary} ${lesson.keywords}`),
  ]);

  await prisma.module.update({
    where: { id: moduleId },
    data: {
      searchText: buildSearchText([courseModule.title, courseModule.subtitle ?? "", courseModule.description, ...descendants]),
    },
  });
}

/** Recomputes a chapter's own haystack. */
export async function recomputeChapterSearch(chapterId: string): Promise<void> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      title: true,
      description: true,
      lessons: { select: { title: true, summary: true, keywords: true } },
    },
  });

  if (!chapter) return;

  await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      searchText: buildSearchText([
        chapter.title,
        chapter.description ?? "",
        ...chapter.lessons.map((lesson) => `${lesson.title} ${lesson.summary} ${lesson.keywords}`),
      ]),
    },
  });
}

/** Recomputes a FAQ's haystack. */
export async function recomputeFaqSearch(faqId: string): Promise<void> {
  const faq = await prisma.faq.findUnique({ where: { id: faqId }, select: { question: true, answer: true } });
  if (!faq) return;

  await prisma.faq.update({
    where: { id: faqId },
    data: { searchText: buildSearchText([faq.question, faq.answer]) },
  });
}

/** Refreshes a lesson plus its courseModule, used after block-level edits. */
export async function refreshLessonAndModule(lessonId: string): Promise<void> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { chapter: { select: { moduleId: true } } },
  });

  await recomputeLessonSearch(lessonId);
  if (lesson) await recomputeModuleSearch(lesson.chapter.moduleId);
}

// ─────────────────────────────────────────────────────────────
// Validation helpers used by admin write paths
// ─────────────────────────────────────────────────────────────

export type BlockValidation = { ok: true; data: BlockData } | { ok: false; errors: string[] };

/** Validates a block payload, returning Persian error paths. */
export function validateBlock(type: string, data: unknown): BlockValidation {
  const result = validateBlockData(type, data);
  return result.ok ? { ok: true, data: result.data } : { ok: false, errors: result.errors };
}

// ─────────────────────────────────────────────────────────────
// Export / import
// ─────────────────────────────────────────────────────────────

export type ExportedBlock = { type: string; order: number; isVisible: boolean; data: unknown };
export type ExportedLesson = {
  slug: string;
  title: string;
  summary: string;
  keywords: string;
  order: number;
  estimatedMinutes: number;
  difficulty: string;
  isPublished: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  blocks: ExportedBlock[];
  quiz: {
    title: string;
    description: string | null;
    passingScore: number;
    timeLimitMinutes: number | null;
    questions: { type: string; prompt: string; hint: string | null; explanation: string | null; points: number; order: number; data: unknown }[];
  } | null;
  faqs: { question: string; answer: string; category: string | null; order: number }[];
};
export type ExportedChapter = { slug: string; title: string; description: string | null; order: number; isPublished: boolean; lessons: ExportedLesson[] };
export type ExportedModule = {
  slug: string;
  number: number;
  title: string;
  subtitle: string | null;
  description: string;
  icon: string;
  color: string;
  /** Curriculum strand. Optional so exports made before the taxonomy still import. */
  group?: string;
  order: number;
  isPublished: boolean;
  chapters: ExportedChapter[];
};

/** Full course export as structured JSON, safe to commit or hand-edit. */
export async function exportCourseContent(): Promise<{ version: number; exportedAt: string; modules: ExportedModule[] }> {
  const modules = await prisma.module.findMany({
    orderBy: { order: "asc" },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: {
              blocks: { orderBy: { order: "asc" } },
              quiz: { include: { questions: { orderBy: { order: "asc" } } } },
              faqs: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    modules: modules.map((courseModule) => ({
      slug: courseModule.slug,
      number: courseModule.number,
      title: courseModule.title,
      subtitle: courseModule.subtitle,
      description: courseModule.description,
      icon: courseModule.icon,
      color: courseModule.color,
      group: courseModule.group,
      order: courseModule.order,
      isPublished: courseModule.isPublished,
      chapters: courseModule.chapters.map((chapter) => ({
        slug: chapter.slug,
        title: chapter.title,
        description: chapter.description,
        order: chapter.order,
        isPublished: chapter.isPublished,
        lessons: chapter.lessons.map((lesson) => ({
          slug: lesson.slug,
          title: lesson.title,
          summary: lesson.summary,
          keywords: lesson.keywords,
          order: lesson.order,
          estimatedMinutes: lesson.estimatedMinutes,
          difficulty: lesson.difficulty,
          isPublished: lesson.isPublished,
          seoTitle: lesson.seoTitle,
          seoDescription: lesson.seoDescription,
          blocks: lesson.blocks.map((block) => ({
            type: block.type,
            order: block.order,
            isVisible: block.isVisible,
            data: block.data,
          })),
          quiz: lesson.quiz
            ? {
                title: lesson.quiz.title,
                description: lesson.quiz.description,
                passingScore: lesson.quiz.passingScore,
                timeLimitMinutes: lesson.quiz.timeLimitMinutes,
                questions: lesson.quiz.questions.map((question) => ({
                  type: question.type,
                  prompt: question.prompt,
                  hint: question.hint,
                  explanation: question.explanation,
                  points: question.points,
                  order: question.order,
                  data: question.data,
                })),
              }
            : null,
          faqs: lesson.faqs.map((faq) => ({
            question: faq.question,
            answer: faq.answer,
            category: faq.category,
            order: faq.order,
          })),
        })),
      })),
    })),
  };
}

export type ImportSummary = {
  modules: number;
  chapters: number;
  lessons: number;
  blocks: number;
  questions: number;
  skipped: string[];
};

/**
 * Imports course content.
 *
 * Additive by default: existing lessons are updated in place keyed by slug and
 * new ones are created, so an import never silently destroys authored content.
 * `replaceBlocks` controls whether a lesson's block list is overwritten.
 */
export async function importCourseContent(
  payload: { modules?: ExportedModule[] },
  options: { replaceBlocks?: boolean } = {},
): Promise<ImportSummary> {
  const summary: ImportSummary = { modules: 0, chapters: 0, lessons: 0, blocks: 0, questions: 0, skipped: [] };

  for (const courseModule of payload.modules ?? []) {
    if (!courseModule.slug || !courseModule.title) {
      summary.skipped.push(`ماژول بدون نامک یا عنوان رد شد.`);
      continue;
    }

    const savedModule = await prisma.module.upsert({
      where: { slug: courseModule.slug },
      create: {
        slug: courseModule.slug,
        number: courseModule.number ?? 0,
        title: courseModule.title,
        subtitle: courseModule.subtitle ?? null,
        description: courseModule.description ?? "",
        icon: courseModule.icon ?? "BookOpen",
        color: courseModule.color ?? "brand",
        group: courseModule.group ?? "fundamentals",
        order: courseModule.order ?? 0,
        isPublished: courseModule.isPublished ?? true,
      },
      update: {
        number: courseModule.number ?? 0,
        title: courseModule.title,
        subtitle: courseModule.subtitle ?? null,
        description: courseModule.description ?? "",
        icon: courseModule.icon ?? "BookOpen",
        color: courseModule.color ?? "brand",
        // Older exports omit `group`; keep the existing value in that case.
        ...(courseModule.group ? { group: courseModule.group } : {}),
        order: courseModule.order ?? 0,
        isPublished: courseModule.isPublished ?? true,
      },
    });
    summary.modules += 1;

    for (const chapter of courseModule.chapters ?? []) {
      if (!chapter.slug || !chapter.title) {
        summary.skipped.push(`فصلی در ماژول ${courseModule.slug} بدون نامک رد شد.`);
        continue;
      }

      const savedChapter = await prisma.chapter.upsert({
        where: { slug: chapter.slug },
        create: {
          moduleId: savedModule.id,
          slug: chapter.slug,
          title: chapter.title,
          description: chapter.description ?? null,
          order: chapter.order ?? 0,
          isPublished: chapter.isPublished ?? true,
        },
        update: {
          moduleId: savedModule.id,
          title: chapter.title,
          description: chapter.description ?? null,
          order: chapter.order ?? 0,
          isPublished: chapter.isPublished ?? true,
        },
      });
      summary.chapters += 1;

      for (const lesson of chapter.lessons ?? []) {
        if (!lesson.slug || !lesson.title) {
          summary.skipped.push(`درسی در فصل ${chapter.slug} بدون نامک رد شد.`);
          continue;
        }

        const savedLesson = await prisma.lesson.upsert({
          where: { slug: lesson.slug },
          create: {
            chapterId: savedChapter.id,
            slug: lesson.slug,
            title: lesson.title,
            summary: lesson.summary ?? "",
            keywords: lesson.keywords ?? "",
            order: lesson.order ?? 0,
            estimatedMinutes: lesson.estimatedMinutes ?? 10,
            difficulty: lesson.difficulty ?? "BEGINNER",
            isPublished: lesson.isPublished ?? true,
            publishedAt: (lesson.isPublished ?? true) ? new Date() : null,
            seoTitle: lesson.seoTitle ?? null,
            seoDescription: lesson.seoDescription ?? null,
          },
          update: {
            chapterId: savedChapter.id,
            title: lesson.title,
            summary: lesson.summary ?? "",
            keywords: lesson.keywords ?? "",
            order: lesson.order ?? 0,
            estimatedMinutes: lesson.estimatedMinutes ?? 10,
            difficulty: lesson.difficulty ?? "BEGINNER",
            isPublished: lesson.isPublished ?? true,
            seoTitle: lesson.seoTitle ?? null,
            seoDescription: lesson.seoDescription ?? null,
          },
        });
        summary.lessons += 1;

        // Validate every block before writing any of them for this lesson.
        const validBlocks: { type: string; order: number; isVisible: boolean; data: BlockData }[] = [];
        let blockError = false;

        for (const block of lesson.blocks ?? []) {
          const check = validateBlock(block.type, block.data);
          if (!check.ok) {
            summary.skipped.push(
              `بلوک ${block.type} در درس ${lesson.slug} نامعتبر است: ${check.errors.join(", ")}`,
            );
            blockError = true;
            break;
          }
          validBlocks.push({
            type: block.type,
            order: block.order ?? validBlocks.length,
            isVisible: block.isVisible ?? true,
            data: check.data,
          });
        }

        if (!blockError && validBlocks.length > 0 && (options.replaceBlocks ?? true)) {
          await prisma.lessonBlock.deleteMany({ where: { lessonId: savedLesson.id } });
          await prisma.lessonBlock.createMany({
            data: validBlocks.map((block) => ({
              lessonId: savedLesson.id,
              type: block.type,
              order: block.order,
              isVisible: block.isVisible,
              data: block.data as object,
            })),
          });
          summary.blocks += validBlocks.length;
        }

        if (lesson.quiz?.questions?.length) {
          const savedQuiz = await prisma.quiz.upsert({
            where: { lessonId: savedLesson.id },
            create: {
              lessonId: savedLesson.id,
              title: lesson.quiz.title ?? `آزمون ${lesson.title}`,
              description: lesson.quiz.description ?? null,
              passingScore: lesson.quiz.passingScore ?? 70,
              timeLimitMinutes: lesson.quiz.timeLimitMinutes ?? null,
            },
            update: {
              title: lesson.quiz.title ?? `آزمون ${lesson.title}`,
              description: lesson.quiz.description ?? null,
              passingScore: lesson.quiz.passingScore ?? 70,
              timeLimitMinutes: lesson.quiz.timeLimitMinutes ?? null,
            },
          });

          await prisma.question.deleteMany({ where: { quizId: savedQuiz.id } });
          await prisma.question.createMany({
            data: lesson.quiz.questions.map((question, index) => ({
              quizId: savedQuiz.id,
              type: question.type,
              prompt: question.prompt,
              hint: question.hint ?? null,
              explanation: question.explanation ?? null,
              points: question.points ?? 1,
              order: question.order ?? index,
              data: question.data as object,
            })),
          });
          summary.questions += lesson.quiz.questions.length;
        }

        if (lesson.faqs?.length) {
          await prisma.faq.deleteMany({ where: { lessonId: savedLesson.id } });
          await prisma.faq.createMany({
            data: lesson.faqs.map((faq, index) => ({
              lessonId: savedLesson.id,
              question: faq.question,
              answer: faq.answer,
              category: faq.category ?? null,
              order: faq.order ?? index,
            })),
          });
        }

        await refreshLessonAndModule(savedLesson.id);
      }

      await recomputeChapterSearch(savedChapter.id);
    }

    await recomputeModuleSearch(savedModule.id);
  }

  return summary;
}

/** Logs an admin action so the dashboard can show recent activity. */
export async function logAdminActivity(
  userId: string,
  type: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: { userId, type, message, metadata: (metadata ?? {}) as object },
    });
  } catch (error) {
    logError("admin:activity", error);
  }
}
