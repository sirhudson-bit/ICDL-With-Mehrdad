"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppError, ERROR_MESSAGES, logError, toUserMessage } from "@/lib/errors";
import { slugify } from "@/lib/persian";
import {
  exportCourseContent,
  importCourseContent,
  logAdminActivity,
  recomputeChapterSearch,
  recomputeFaqSearch,
  recomputeLessonSearch,
  recomputeModuleSearch,
  refreshLessonAndModule,
  validateBlock,
} from "@/services/content-service";
import { keepStoredSecrets, saveSettings } from "@/services/settings-service";
import { resetUserProgress } from "@/services/progress-service";
import { sendMail } from "@/services/mail-service";
import { sendResetLinkToUser } from "@/services/password-reset-service";
import { SETTINGS_SCHEMAS, type SettingsKey } from "@/lib/settings";
import { pruneIconSvg } from "@/lib/svg-icon";
import { ROLES } from "@/types";

/**
 * Admin server actions.
 *
 * Every action re-checks the caller's role on the server — the admin UI hiding
 * a control is a convenience, not a security boundary — validates its input,
 * keeps derived data (search indexes) up to date and writes an audit entry.
 */

export type AdminOutcome<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string };

async function requireAdmin() {
  const user = await assertAdmin();
  return user;
}

function fail(error: unknown, context: string): AdminOutcome<never> {
  if (!(error instanceof AppError)) logError(context, error);
  return { ok: false, message: toUserMessage(error) };
}

function revalidateAdmin(paths: string[] = ["/admin", "/admin/content"]) {
  for (const path of paths) revalidatePath(path);
}

// ─────────────────────────────────────────────────────────────
// Modules
// ─────────────────────────────────────────────────────────────

const moduleSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().min(2, "عنوان ماژول را بنویسید.").max(160),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().min(10, "توضیح ماژول را کامل‌تر بنویسید.").max(1200),
  number: z.coerce.number().int().min(0).max(99),
  icon: z.string().trim().max(60).default("BookOpen"),
  color: z.string().trim().max(30).default("brand"),
  group: z.string().trim().max(40).default("fundamentals"),
  isPublished: z.coerce.boolean().default(false),
  slug: z.string().trim().max(120).optional(),
});

export async function saveModuleAction(formData: FormData): Promise<AdminOutcome> {
  try {
    const user = await requireAdmin();

    const parsed = moduleSchema.safeParse({
      id: formData.get("id") || undefined,
      title: formData.get("title"),
      subtitle: formData.get("subtitle") || undefined,
      description: formData.get("description"),
      number: formData.get("number"),
      icon: formData.get("icon") || undefined,
      color: formData.get("color") || undefined,
      group: formData.get("group") || undefined,
      isPublished: formData.get("isPublished") === "on" || formData.get("isPublished") === "true",
      slug: formData.get("slug") || undefined,
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? ERROR_MESSAGES.validation };
    }

    const data = parsed.data;
    // The slug is stable once created: changing it would break existing links.
    const slug = data.slug?.trim() || slugify(data.title);

    const saved = data.id
      ? await prisma.module.update({
          where: { id: data.id },
          data: {
            title: data.title,
            subtitle: data.subtitle ?? null,
            description: data.description,
            number: data.number,
            icon: data.icon,
            color: data.color,
            group: data.group,
            isPublished: data.isPublished,
          },
        })
      : await prisma.module.create({
          data: {
            slug,
            title: data.title,
            subtitle: data.subtitle ?? null,
            description: data.description,
            number: data.number,
            icon: data.icon,
            color: data.color,
            group: data.group,
            isPublished: data.isPublished,
            order: await nextModuleOrder(),
          },
        });

    await recomputeModuleSearch(saved.id);
    await logAdminActivity(user.id, "CONTENT_UPDATED", `ماژول «${saved.title}» ذخیره شد`, { moduleId: saved.id });
    revalidateAdmin(["/admin", "/admin/content", "/course", `/course/${saved.slug}`]);

    return { ok: true, data: null, message: "ماژول ذخیره شد." };
  } catch (error) {
    return fail(error, "admin:saveModule");
  }
}

async function nextModuleOrder(): Promise<number> {
  const last = await prisma.module.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  return (last?.order ?? -1) + 1;
}

export async function deleteModuleAction(moduleId: string): Promise<AdminOutcome> {
  try {
    const user = await requireAdmin();
    const courseModule = await prisma.module.delete({ where: { id: moduleId }, select: { title: true } });
    await logAdminActivity(user.id, "CONTENT_UPDATED", `ماژول «${courseModule.title}» حذف شد`);
    revalidateAdmin(["/admin", "/admin/content", "/course"]);
    return { ok: true, data: null, message: "ماژول و همه محتوای آن حذف شد." };
  } catch (error) {
    return fail(error, "admin:deleteModule");
  }
}

/** Moves a courseModule one position up or down in the published order. */
export async function moveModuleAction(moduleId: string, direction: "up" | "down"): Promise<AdminOutcome> {
  try {
    await requireAdmin();
    await swapOrder("module", moduleId, direction);
    revalidateAdmin(["/admin", "/admin/content", "/course"]);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error, "admin:moveModule");
  }
}

// ─────────────────────────────────────────────────────────────
// Chapters
// ─────────────────────────────────────────────────────────────

const chapterSchema = z.object({
  id: z.string().trim().optional(),
  moduleId: z.string().trim().min(1),
  title: z.string().trim().min(2, "عنوان فصل را بنویسید.").max(200),
  description: z.string().trim().max(600).optional(),
  isPublished: z.coerce.boolean().default(false),
  slug: z.string().trim().max(120).optional(),
});

export async function saveChapterAction(formData: FormData): Promise<AdminOutcome> {
  try {
    const user = await requireAdmin();

    const parsed = chapterSchema.safeParse({
      id: formData.get("id") || undefined,
      moduleId: formData.get("moduleId"),
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      isPublished: formData.get("isPublished") === "on",
      slug: formData.get("slug") || undefined,
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? ERROR_MESSAGES.validation };
    }

    const data = parsed.data;
    const slug = data.slug?.trim() || slugify(`${data.title}-${Date.now().toString(36).slice(-4)}`);

    const saved = data.id
      ? await prisma.chapter.update({
          where: { id: data.id },
          data: {
            title: data.title,
            description: data.description ?? null,
            isPublished: data.isPublished,
          },
        })
      : await prisma.chapter.create({
          data: {
            moduleId: data.moduleId,
            slug,
            title: data.title,
            description: data.description ?? null,
            isPublished: data.isPublished,
            order: await nextChildOrder("chapter", data.moduleId),
          },
        });

    await recomputeChapterSearch(saved.id);
    await recomputeModuleSearch(data.moduleId);
    await logAdminActivity(user.id, "CONTENT_UPDATED", `فصل «${saved.title}» ذخیره شد`);
    revalidateAdmin(["/admin", "/admin/content", "/course"]);

    return { ok: true, data: null, message: "فصل ذخیره شد." };
  } catch (error) {
    return fail(error, "admin:saveChapter");
  }
}

export async function deleteChapterAction(chapterId: string): Promise<AdminOutcome> {
  try {
    const user = await requireAdmin();
    const chapter = await prisma.chapter.delete({ where: { id: chapterId }, select: { title: true, moduleId: true } });
    await recomputeModuleSearch(chapter.moduleId);
    await logAdminActivity(user.id, "CONTENT_UPDATED", `فصل «${chapter.title}» حذف شد`);
    revalidateAdmin(["/admin", "/admin/content", "/course"]);
    return { ok: true, data: null, message: "فصل و درس‌های آن حذف شد." };
  } catch (error) {
    return fail(error, "admin:deleteChapter");
  }
}

// ─────────────────────────────────────────────────────────────
// Lessons
// ─────────────────────────────────────────────────────────────

const lessonSchema = z.object({
  id: z.string().trim().optional(),
  chapterId: z.string().trim().min(1),
  title: z.string().trim().min(2, "عنوان درس را بنویسید.").max(200),
  summary: z.string().trim().min(10, "خلاصه درس را کامل‌تر بنویسید.").max(600),
  keywords: z.string().trim().max(500).optional(),
  estimatedMinutes: z.coerce.number().int().min(1).max(300),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  isPublished: z.coerce.boolean().default(false),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(400).optional(),
});

export async function saveLessonAction(formData: FormData): Promise<AdminOutcome<{ lessonId: string }>> {
  try {
    const user = await requireAdmin();

    const parsed = lessonSchema.safeParse({
      id: formData.get("id") || undefined,
      chapterId: formData.get("chapterId"),
      title: formData.get("title"),
      summary: formData.get("summary"),
      keywords: formData.get("keywords") || undefined,
      estimatedMinutes: formData.get("estimatedMinutes"),
      difficulty: formData.get("difficulty"),
      isPublished: formData.get("isPublished") === "on",
      seoTitle: formData.get("seoTitle") || undefined,
      seoDescription: formData.get("seoDescription") || undefined,
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? ERROR_MESSAGES.validation };
    }

    const data = parsed.data;

    const saved = data.id
      ? await prisma.lesson.update({
          where: { id: data.id },
          data: {
            title: data.title,
            summary: data.summary,
            keywords: data.keywords ?? "",
            estimatedMinutes: data.estimatedMinutes,
            difficulty: data.difficulty,
            isPublished: data.isPublished,
            publishedAt: data.isPublished ? new Date() : null,
            seoTitle: data.seoTitle ?? null,
            seoDescription: data.seoDescription ?? null,
            searchText: "",
          },
        })
      : await prisma.lesson.create({
          data: {
            chapterId: data.chapterId,
            slug: slugify(`${data.title}-${Date.now().toString(36).slice(-5)}`),
            title: data.title,
            summary: data.summary,
            keywords: data.keywords ?? "",
            estimatedMinutes: data.estimatedMinutes,
            difficulty: data.difficulty,
            isPublished: data.isPublished,
            publishedAt: data.isPublished ? new Date() : null,
            seoTitle: data.seoTitle ?? null,
            seoDescription: data.seoDescription ?? null,
            order: await nextChildOrder("lesson", data.chapterId),
            searchText: "",
          },
        });

    await refreshLessonAndModule(saved.id);
    await recomputeChapterSearch(data.chapterId);
    await logAdminActivity(user.id, "CONTENT_UPDATED", `درس «${saved.title}» ذخیره شد`, { lessonId: saved.id });
    revalidateAdmin(["/admin", "/admin/content", `/admin/content/lesson/${saved.id}`, "/course"]);

    return { ok: true, data: { lessonId: saved.id }, message: "درس ذخیره شد." };
  } catch (error) {
    return fail(error, "admin:saveLesson");
  }
}

export async function deleteLessonAction(lessonId: string): Promise<AdminOutcome> {
  try {
    const user = await requireAdmin();
    const lesson = await prisma.lesson.delete({
      where: { id: lessonId },
      select: { title: true, chapter: { select: { moduleId: true, id: true } } },
    });
    await recomputeChapterSearch(lesson.chapter.id);
    await recomputeModuleSearch(lesson.chapter.moduleId);
    await logAdminActivity(user.id, "CONTENT_UPDATED", `درس «${lesson.title}» حذف شد`);
    revalidateAdmin(["/admin", "/admin/content", "/course"]);
    return { ok: true, data: null, message: "درس حذف شد." };
  } catch (error) {
    return fail(error, "admin:deleteLesson");
  }
}

export async function moveLessonAction(lessonId: string, direction: "up" | "down"): Promise<AdminOutcome> {
  try {
    await requireAdmin();
    await swapOrder("lesson", lessonId, direction);
    revalidateAdmin(["/admin/content", "/course"]);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error, "admin:moveLesson");
  }
}

/** Toggles the published flag for a courseModule, chapter or lesson. */
export async function togglePublishAction(
  entity: "module" | "chapter" | "lesson",
  id: string,
): Promise<AdminOutcome<{ isPublished: boolean }>> {
  try {
    const user = await requireAdmin();

    if (entity === "module") {
      const current = await prisma.module.findUniqueOrThrow({ where: { id }, select: { isPublished: true, slug: true } });
      const updated = await prisma.module.update({
        where: { id },
        data: { isPublished: !current.isPublished },
        select: { isPublished: true },
      });
      revalidateAdmin(["/admin", "/admin/content", "/course", `/course/${current.slug}`]);
      await logAdminActivity(user.id, "CONTENT_UPDATED", `وضعیت انتشار ماژول تغییر کرد`);
      return { ok: true, data: updated };
    }

    if (entity === "chapter") {
      const current = await prisma.chapter.findUniqueOrThrow({
        where: { id },
        select: { isPublished: true, moduleId: true },
      });
      const updated = await prisma.chapter.update({
        where: { id },
        data: { isPublished: !current.isPublished },
        select: { isPublished: true },
      });
      await recomputeModuleSearch(current.moduleId);
      revalidateAdmin(["/admin", "/admin/content", "/course"]);
      return { ok: true, data: updated };
    }

    const current = await prisma.lesson.findUniqueOrThrow({
      where: { id },
      select: { isPublished: true, chapter: { select: { moduleId: true, id: true } } },
    });
    const updated = await prisma.lesson.update({
      where: { id },
      data: { isPublished: !current.isPublished, publishedAt: !current.isPublished ? new Date() : null },
      select: { isPublished: true },
    });
    await recomputeChapterSearch(current.chapter.id);
    await recomputeModuleSearch(current.chapter.moduleId);
    revalidateAdmin(["/admin", "/admin/content", "/course"]);

    return { ok: true, data: updated };
  } catch (error) {
    return fail(error, "admin:togglePublish");
  }
}

// ─────────────────────────────────────────────────────────────
// Blocks
// ─────────────────────────────────────────────────────────────

export async function createBlockAction(
  lessonId: string,
  type: string,
  data: unknown,
): Promise<AdminOutcome<{ blockId: string }>> {
  try {
    const user = await requireAdmin();

    const check = validateBlock(type, data);
    if (!check.ok) return { ok: false, message: `محتوای بلوک معتبر نیست: ${check.errors.join(", ")}` };

    const last = await prisma.lessonBlock.findFirst({
      where: { lessonId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const created = await prisma.lessonBlock.create({
      data: {
        lessonId,
        type,
        order: (last?.order ?? -1) + 1,
        data: check.data as object,
        isVisible: true,
      },
      select: { id: true },
    });

    await refreshLessonAndModule(lessonId);
    await logAdminActivity(user.id, "CONTENT_UPDATED", `بلوک ${type} اضافه شد`, { lessonId });
    revalidateAdmin(["/admin/content", `/admin/content/lesson/${lessonId}`]);

    return { ok: true, data: { blockId: created.id }, message: "بلوک اضافه شد." };
  } catch (error) {
    return fail(error, "admin:createBlock");
  }
}

export async function updateBlockAction(blockId: string, data: unknown): Promise<AdminOutcome> {
  try {
    await requireAdmin();

    const block = await prisma.lessonBlock.findUnique({ where: { id: blockId }, select: { type: true, lessonId: true } });
    if (!block) throw new AppError(ERROR_MESSAGES.notFound, { code: "NOT_FOUND" });

    const check = validateBlock(block.type, data);
    if (!check.ok) return { ok: false, message: `محتوای بلوک معتبر نیست: ${check.errors.join(", ")}` };

    await prisma.lessonBlock.update({ where: { id: blockId }, data: { data: check.data as object } });
    await refreshLessonAndModule(block.lessonId);
    revalidateAdmin(["/admin/content", `/admin/content/lesson/${block.lessonId}`]);

    return { ok: true, data: null, message: "بلوک ذخیره شد." };
  } catch (error) {
    return fail(error, "admin:updateBlock");
  }
}

export async function deleteBlockAction(blockId: string): Promise<AdminOutcome> {
  try {
    await requireAdmin();
    const block = await prisma.lessonBlock.delete({ where: { id: blockId }, select: { lessonId: true } });
    await refreshLessonAndModule(block.lessonId);
    revalidateAdmin(["/admin/content", `/admin/content/lesson/${block.lessonId}`]);
    return { ok: true, data: null, message: "بلوک حذف شد." };
  } catch (error) {
    return fail(error, "admin:deleteBlock");
  }
}

export async function duplicateBlockAction(blockId: string): Promise<AdminOutcome<{ blockId: string }>> {
  try {
    await requireAdmin();

    const block = await prisma.lessonBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new AppError(ERROR_MESSAGES.notFound, { code: "NOT_FOUND" });

    // Shift everything below the source block down one position.
    await prisma.lessonBlock.updateMany({
      where: { lessonId: block.lessonId, order: { gt: block.order } },
      data: { order: { increment: 1 } },
    });

    const created = await prisma.lessonBlock.create({
      data: {
        lessonId: block.lessonId,
        type: block.type,
        order: block.order + 1,
        data: block.data as object,
        isVisible: block.isVisible,
      },
      select: { id: true },
    });

    await refreshLessonAndModule(block.lessonId);
    revalidateAdmin(["/admin/content", `/admin/content/lesson/${block.lessonId}`]);

    return { ok: true, data: { blockId: created.id }, message: "یک نسخه کپی ساخته شد." };
  } catch (error) {
    return fail(error, "admin:duplicateBlock");
  }
}

export async function toggleBlockVisibilityAction(blockId: string): Promise<AdminOutcome<{ isVisible: boolean }>> {
  try {
    await requireAdmin();
    const block = await prisma.lessonBlock.findUniqueOrThrow({
      where: { id: blockId },
      select: { isVisible: true, lessonId: true },
    });
    const updated = await prisma.lessonBlock.update({
      where: { id: blockId },
      data: { isVisible: !block.isVisible },
      select: { isVisible: true },
    });
    revalidateAdmin(["/admin/content", `/admin/content/lesson/${block.lessonId}`]);
    return { ok: true, data: updated };
  } catch (error) {
    return fail(error, "admin:toggleBlockVisibility");
  }
}

/** Persists a drag-and-drop reorder of a lesson's blocks. */
export async function reorderBlocksAction(lessonId: string, orderedIds: string[]): Promise<AdminOutcome> {
  try {
    await requireAdmin();

    const existing = await prisma.lessonBlock.findMany({
      where: { lessonId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((block) => block.id));

    // Ignore ids that do not belong to this lesson.
    const valid = orderedIds.filter((id) => existingIds.has(id));
    if (valid.length !== existing.length) {
      return { ok: false, message: "فهرست بلوک‌ها با محتوای فعلی هم‌خوانی ندارد. صفحه را دوباره بارگذاری کنید." };
    }

    await prisma.$transaction(
      valid.map((id, index) =>
        prisma.lessonBlock.update({ where: { id }, data: { order: index } }),
      ),
    );

    await refreshLessonAndModule(lessonId);
    revalidateAdmin(["/admin/content", `/admin/content/lesson/${lessonId}`]);

    return { ok: true, data: null };
  } catch (error) {
    return fail(error, "admin:reorderBlocks");
  }
}

// ─────────────────────────────────────────────────────────────
// Quizzes
// ─────────────────────────────────────────────────────────────

const quizSchema = z.object({
  lessonId: z.string().trim().min(1),
  title: z.string().trim().min(2, "عنوان آزمون را بنویسید.").max(200),
  description: z.string().trim().max(600).optional(),
  passingScore: z.coerce.number().int().min(0).max(100),
  timeLimitMinutes: z.coerce.number().int().min(1).max(240).optional(),
});

export async function saveQuizAction(formData: FormData): Promise<AdminOutcome> {
  try {
    await requireAdmin();

    const timeLimit = String(formData.get("timeLimitMinutes") ?? "").trim();
    const parsed = quizSchema.safeParse({
      lessonId: formData.get("lessonId"),
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      passingScore: formData.get("passingScore"),
      timeLimitMinutes: timeLimit ? timeLimit : undefined,
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? ERROR_MESSAGES.validation };
    }

    const data = parsed.data;

    await prisma.quiz.upsert({
      where: { lessonId: data.lessonId },
      create: {
        lessonId: data.lessonId,
        title: data.title,
        description: data.description ?? null,
        passingScore: data.passingScore,
        timeLimitMinutes: data.timeLimitMinutes ?? null,
      },
      update: {
        title: data.title,
        description: data.description ?? null,
        passingScore: data.passingScore,
        timeLimitMinutes: data.timeLimitMinutes ?? null,
      },
    });

    await recomputeLessonSearch(data.lessonId);
    revalidateAdmin(["/admin/content", `/admin/content/lesson/${data.lessonId}`]);

    return { ok: true, data: null, message: "آزمون ذخیره شد." };
  } catch (error) {
    return fail(error, "admin:saveQuiz");
  }
}

export async function deleteQuizAction(quizId: string): Promise<AdminOutcome> {
  try {
    await requireAdmin();
    const quiz = await prisma.quiz.delete({ where: { id: quizId }, select: { lessonId: true } });
    await recomputeLessonSearch(quiz.lessonId);
    revalidateAdmin(["/admin/content", `/admin/content/lesson/${quiz.lessonId}`]);
    return { ok: true, data: null, message: "آزمون حذف شد." };
  } catch (error) {
    return fail(error, "admin:deleteQuiz");
  }
}

const questionSchema = z.object({
  quizId: z.string().trim().min(1),
  id: z.string().trim().optional(),
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_BLANK", "MATCHING", "PRACTICAL"]),
  prompt: z.string().trim().min(5, "متن پرسش را کامل بنویسید.").max(1000),
  hint: z.string().trim().max(300).optional(),
  explanation: z.string().trim().max(1000).optional(),
  points: z.coerce.number().int().min(1).max(20),
  // The payload shape differs per question type, so it is validated below.
  data: z.string().trim().min(2),
});

export async function saveQuestionAction(formData: FormData): Promise<AdminOutcome> {
  try {
    await requireAdmin();

    const parsed = questionSchema.safeParse({
      quizId: formData.get("quizId"),
      id: formData.get("id") || undefined,
      type: formData.get("type"),
      prompt: formData.get("prompt"),
      hint: formData.get("hint") || undefined,
      explanation: formData.get("explanation") || undefined,
      points: formData.get("points"),
      data: formData.get("data"),
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? ERROR_MESSAGES.validation };
    }

    const data = parsed.data;

    let payload: unknown;
    try {
      payload = JSON.parse(data.data);
    } catch {
      return { ok: false, message: "ساختار پاسخ‌های پرسش معتبر نیست (JSON نامعتبر)." };
    }

    // Reuse the block-level question validation so the two paths cannot drift.
    const check = validateQuestionPayload(data.type, payload);
    if (!check.ok) return { ok: false, message: check.message };

    if (data.id) {
      await prisma.question.update({
        where: { id: data.id },
        data: {
          type: data.type,
          prompt: data.prompt,
          hint: data.hint ?? null,
          explanation: data.explanation ?? null,
          points: data.points,
          data: payload as object,
        },
      });
    } else {
      const last = await prisma.question.findFirst({
        where: { quizId: data.quizId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      await prisma.question.create({
        data: {
          quizId: data.quizId,
          type: data.type,
          prompt: data.prompt,
          hint: data.hint ?? null,
          explanation: data.explanation ?? null,
          points: data.points,
          order: (last?.order ?? -1) + 1,
          data: payload as object,
        },
      });
    }

    const quiz = await prisma.quiz.findUnique({ where: { id: data.quizId }, select: { lessonId: true } });
    if (quiz) await recomputeLessonSearch(quiz.lessonId);

    revalidateAdmin(["/admin/content"]);

    return { ok: true, data: null, message: "پرسش ذخیره شد." };
  } catch (error) {
    return fail(error, "admin:saveQuestion");
  }
}

function validateQuestionPayload(type: string, payload: unknown): { ok: true } | { ok: false; message: string } {
  const object = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;

  switch (type) {
    case "MULTIPLE_CHOICE": {
      const options = object.options as { id?: string; text?: string }[] | undefined;
      if (!Array.isArray(options) || options.length < 2) {
        return { ok: false, message: "پرسش چند گزینه‌ای به حداقل دو گزینه نیاز دارد." };
      }
      if (typeof object.correctOptionId !== "string" || !options.some((option) => option.id === object.correctOptionId)) {
        return { ok: false, message: "گزینه درست را انتخاب کنید." };
      }
      return { ok: true };
    }
    case "TRUE_FALSE":
      return typeof object.isTrue === "boolean"
        ? { ok: true }
        : { ok: false, message: "برای پرسش درست/غلط، پاسخ درست را مشخص کنید." };
    case "FILL_BLANK": {
      const accepted = object.accepted as unknown;
      return Array.isArray(accepted) && accepted.length > 0
        ? { ok: true }
        : { ok: false, message: "حداقل یک پاسخ پذیرفته‌شده برای جای خالی وارد کنید." };
    }
    case "MATCHING": {
      const pairs = object.pairs as unknown;
      return Array.isArray(pairs) && pairs.length >= 2
        ? { ok: true }
        : { ok: false, message: "پرسش تطبیق به حداقل دو جفت نیاز دارد." };
    }
    case "PRACTICAL": {
      const checklist = object.checklist as unknown;
      return Array.isArray(checklist) && checklist.length > 0
        ? { ok: true }
        : { ok: false, message: "حداقل یک مورد برای چک‌لیست تمرین عملی وارد کنید." };
    }
    default:
      return { ok: false, message: "نوع پرسش پشتیبانی نمی‌شود." };
  }
}

export async function deleteQuestionAction(questionId: string): Promise<AdminOutcome> {
  try {
    await requireAdmin();
    const question = await prisma.question.delete({
      where: { id: questionId },
      select: { quiz: { select: { lessonId: true } } },
    });
    await recomputeLessonSearch(question.quiz.lessonId);
    revalidateAdmin(["/admin/content"]);
    return { ok: true, data: null, message: "پرسش حذف شد." };
  } catch (error) {
    return fail(error, "admin:deleteQuestion");
  }
}

// ─────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────

const userSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(2, "نام کاربر را بنویسید.").max(120),
  role: z.enum(ROLES),
  isActive: z.coerce.boolean(),
});

export async function updateUserAction(formData: FormData): Promise<AdminOutcome> {
  try {
    const admin = await requireAdmin();

    const parsed = userSchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      role: formData.get("role"),
      isActive: formData.get("isActive") === "on",
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? ERROR_MESSAGES.validation };
    }

    const data = parsed.data;

    // Guard against locking every administrator out of the panel.
    if (data.id === admin.id && (data.role !== "ADMIN" || !data.isActive)) {
      return { ok: false, message: "نمی‌توانید نقش یا وضعیت حساب خودتان را تغییر دهید." };
    }

    await prisma.user.update({
      where: { id: data.id },
      data: { name: data.name, role: data.role, isActive: data.isActive },
    });

    await logAdminActivity(admin.id, "USER_UPDATED", `اطلاعات کاربر به‌روزرسانی شد`, { userId: data.id });
    revalidateAdmin(["/admin", "/admin/users"]);

    return { ok: true, data: null, message: "اطلاعات کاربر ذخیره شد." };
  } catch (error) {
    return fail(error, "admin:updateUser");
  }
}

export async function resetUserProgressAction(userId: string): Promise<AdminOutcome> {
  try {
    const admin = await requireAdmin();
    await resetUserProgress(userId);
    await logAdminActivity(admin.id, "USER_UPDATED", "پیشرفت یک کاربر بازنشانی شد", { userId });
    revalidateAdmin(["/admin", "/admin/users"]);
    return { ok: true, data: null, message: "پیشرفت کاربر بازنشانی شد." };
  } catch (error) {
    return fail(error, "admin:resetUserProgress");
  }
}

export async function deleteUserAction(userId: string): Promise<AdminOutcome> {
  try {
    const admin = await requireAdmin();

    if (userId === admin.id) {
      return { ok: false, message: "حساب خودتان را نمی‌توانید حذف کنید." };
    }

    const user = await prisma.user.delete({ where: { id: userId }, select: { email: true } });
    await logAdminActivity(admin.id, "USER_UPDATED", `کاربر ${user.email} حذف شد`);
    revalidateAdmin(["/admin", "/admin/users"]);

    return { ok: true, data: null, message: "کاربر حذف شد." };
  } catch (error) {
    return fail(error, "admin:deleteUser");
  }
}

/**
 * Emails a learner (or another administrator) a fresh password-reset link.
 * Useful when someone is locked out and cannot run the self-service flow.
 */
export async function sendUserPasswordResetAction(userId: string): Promise<AdminOutcome> {
  try {
    const admin = await requireAdmin();

    const result = await sendResetLinkToUser(userId);
    if (!result) return { ok: false, message: "کاربر فعالی با این شناسه پیدا نشد." };

    await logAdminActivity(admin.id, "USER_UPDATED", "پیوند بازیابی رمز عبور برای کاربر ارسال شد", { userId });
    revalidateAdmin(["/admin", "/admin/users"]);

    return {
      ok: true,
      data: null,
      message: result.delivered
        ? "پیوند بازیابی رمز عبور برای کاربر ایمیل شد."
        : "سرور SMTP تنظیم نشده است؛ پیوند بازیابی در گزارش سرور ثبت شد.",
    };
  } catch (error) {
    return fail(error, "admin:sendUserPasswordReset");
  }
}

/**
 * Sends a test message so an administrator can confirm the SMTP settings work
 * before relying on them for password resets.
 */
export async function sendTestEmailAction(to: string): Promise<AdminOutcome> {
  try {
    const admin = await requireAdmin();

    const email = to.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, message: "نشانی ایمیل مقصد معتبر نیست." };
    }

    const result = await sendMail({
      to: email,
      subject: "ایمیل آزمایشی — ICDL With Mehrdad",
      text: "این یک ایمیل آزمایشی است. اگر آن را دریافت کردید، تنظیمات ارسال ایمیل درست کار می‌کند.",
      html: '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:2">این یک ایمیل آزمایشی است.<br />اگر آن را دریافت کردید، تنظیمات ارسال ایمیل درست کار می‌کند.</div>',
    });

    if (!result.ok) {
      return { ok: false, message: `ارسال ایمیل ناموفق بود: ${result.error}` };
    }

    await logAdminActivity(admin.id, "SETTINGS_UPDATED", "ایمیل آزمایشی ارسال شد", {
      to: email,
      transport: result.transport,
    });

    return {
      ok: true,
      data: null,
      message: result.delivered
        ? "ایمیل آزمایشی ارسال شد. صندوق ورودی مقصد را بررسی کنید."
        : "سرور SMTP تنظیم نشده است؛ متن ایمیل در گزارش سرور ثبت شد.",
    };
  } catch (error) {
    return fail(error, "admin:sendTestEmail");
  }
}

// ─────────────────────────────────────────────────────────────
// FAQs
// ─────────────────────────────────────────────────────────────

const faqSchema = z.object({
  id: z.string().trim().optional(),
  lessonId: z.string().trim().optional(),
  question: z.string().trim().min(5, "متن پرسش را کامل بنویسید.").max(400),
  answer: z.string().trim().min(5, "متن پاسخ را بنویسید.").max(4000),
  category: z.string().trim().max(80).optional(),
  isPublished: z.coerce.boolean().default(true),
});

export async function saveFaqAction(formData: FormData): Promise<AdminOutcome> {
  try {
    const user = await requireAdmin();

    const parsed = faqSchema.safeParse({
      id: formData.get("id") || undefined,
      lessonId: formData.get("lessonId") || undefined,
      question: formData.get("question"),
      answer: formData.get("answer"),
      category: formData.get("category") || undefined,
      isPublished: formData.get("isPublished") === "on",
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? ERROR_MESSAGES.validation };
    }

    const data = parsed.data;

    const saved = data.id
      ? await prisma.faq.update({
          where: { id: data.id },
          data: {
            question: data.question,
            answer: data.answer,
            category: data.category ?? null,
            isPublished: data.isPublished,
          },
          select: { id: true },
        })
      : await prisma.faq.create({
          data: {
            lessonId: data.lessonId ?? null,
            question: data.question,
            answer: data.answer,
            category: data.category ?? null,
            isPublished: data.isPublished,
            order: await nextFaqOrder(data.lessonId ?? null),
            searchText: "",
          },
          select: { id: true },
        });

    await recomputeFaqSearch(saved.id);
    await logAdminActivity(user.id, "CONTENT_UPDATED", "پرسش پرتکرار ذخیره شد");
    revalidateAdmin(["/admin", "/admin/faqs", "/help"]);

    return { ok: true, data: null, message: "پرسش ذخیره شد." };
  } catch (error) {
    return fail(error, "admin:saveFaq");
  }
}

async function nextFaqOrder(lessonId: string | null): Promise<number> {
  const last = await prisma.faq.findFirst({
    where: { lessonId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function deleteFaqAction(faqId: string): Promise<AdminOutcome> {
  try {
    const user = await requireAdmin();
    await prisma.faq.delete({ where: { id: faqId } });
    await logAdminActivity(user.id, "CONTENT_UPDATED", "پرسش پرتکرار حذف شد");
    revalidateAdmin(["/admin", "/admin/faqs", "/help"]);
    return { ok: true, data: null, message: "پرسش حذف شد." };
  } catch (error) {
    return fail(error, "admin:deleteFaq");
  }
}

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────

export async function saveSettingsAction(key: string, values: Record<string, unknown>): Promise<AdminOutcome> {
  try {
    const user = await requireAdmin();

    if (!(key in SETTINGS_SCHEMAS)) {
      return { ok: false, message: "گروه تنظیمات ناشناخته است." };
    }

    // Secrets arrive masked, so anything left as-is must not overwrite the real
    // value that is already stored.
    const merged = await keepStoredSecrets(key as SettingsKey, values);
    const result = await saveSettings(key as SettingsKey, merged);
    if (!result.ok) {
      return { ok: false, message: `تنظیمات معتبر نیست: ${result.errors.join("، ")}` };
    }

    await logAdminActivity(user.id, "SETTINGS_UPDATED", `تنظیمات «${key}» به‌روزرسانی شد`);

    // Saving the navigation group is the moment the stored values and the icon
    // files on disk can be reconciled.
    if (key === "navigation") {
      const saved = result.data as { socialLinks?: { iconUrl?: string }[] };
      await pruneIconSvg((saved.socialLinks ?? []).map((link) => link.iconUrl ?? "").filter(Boolean));
    }

    revalidatePath("/", "layout");

    return { ok: true, data: null, message: "تنظیمات ذخیره شد." };
  } catch (error) {
    return fail(error, "admin:saveSettings");
  }
}

// ─────────────────────────────────────────────────────────────
// Import / export
// ─────────────────────────────────────────────────────────────

export async function exportContentAction(): Promise<AdminOutcome<{ json: string; filename: string }>> {
  try {
    await requireAdmin();
    const payload = await exportCourseContent();
    return {
      ok: true,
      data: {
        json: JSON.stringify(payload, null, 2),
        filename: `icdl-content-${new Date().toISOString().slice(0, 10)}.json`,
      },
    };
  } catch (error) {
    return fail(error, "admin:exportContent");
  }
}

export async function importContentAction(
  json: string,
  replaceBlocks: boolean,
): Promise<AdminOutcome<{ summary: string }>> {
  try {
    const user = await requireAdmin();

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, message: "فایل ورودی JSON معتبر نیست." };
    }

    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { modules?: unknown }).modules)) {
      return { ok: false, message: "ساختار فایل ورودی درست نیست؛ کلید modules لازم است." };
    }

    const summary = await importCourseContent(parsed as { modules: never[] }, { replaceBlocks });

    await logAdminActivity(user.id, "CONTENT_PUBLISHED", "محتوای دوره وارد شد", summary);
    revalidateAdmin(["/admin", "/admin/content", "/course", "/"]);

    return {
      ok: true,
      data: {
        summary: `${summary.modules} ماژول، ${summary.chapters} فصل، ${summary.lessons} درس، ${summary.blocks} بلوک، ${summary.questions} پرسش وارد شد.`,
      },
      message: summary.skipped.length > 0 ? `${summary.skipped.length} مورد رد شد.` : undefined,
    };
  } catch (error) {
    return fail(error, "admin:importContent");
  }
}

// ─────────────────────────────────────────────────────────────
// Ordering helper
// ─────────────────────────────────────────────────────────────

/** Swaps the `order` of an item with its neighbour, used by the move buttons. */
async function swapOrder(
  entity: "module" | "chapter" | "lesson",
  id: string,
  direction: "up" | "down",
): Promise<void> {
  if (entity === "module") {
    const current = await prisma.module.findUniqueOrThrow({ where: { id }, select: { order: true } });
    const neighbour = await prisma.module.findFirst({
      where: direction === "up" ? { order: { lt: current.order } } : { order: { gt: current.order } },
      orderBy: { order: direction === "up" ? "desc" : "asc" },
      select: { id: true, order: true },
    });
    if (!neighbour) return;

    await prisma.$transaction([
      prisma.module.update({ where: { id }, data: { order: neighbour.order } }),
      prisma.module.update({ where: { id: neighbour.id }, data: { order: current.order } }),
    ]);
    return;
  }

  if (entity === "chapter") {
    const current = await prisma.chapter.findUniqueOrThrow({
      where: { id },
      select: { order: true, moduleId: true },
    });
    const neighbour = await prisma.chapter.findFirst({
      where: {
        moduleId: current.moduleId,
        ...(direction === "up" ? { order: { lt: current.order } } : { order: { gt: current.order } }),
      },
      orderBy: { order: direction === "up" ? "desc" : "asc" },
      select: { id: true, order: true },
    });
    if (!neighbour) return;

    await prisma.$transaction([
      prisma.chapter.update({ where: { id }, data: { order: neighbour.order } }),
      prisma.chapter.update({ where: { id: neighbour.id }, data: { order: current.order } }),
    ]);
    return;
  }

  const current = await prisma.lesson.findUniqueOrThrow({
    where: { id },
    select: { order: true, chapterId: true },
  });
  const neighbour = await prisma.lesson.findFirst({
    where: {
      chapterId: current.chapterId,
      ...(direction === "up" ? { order: { lt: current.order } } : { order: { gt: current.order } }),
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbour) return;

  await prisma.$transaction([
    prisma.lesson.update({ where: { id }, data: { order: neighbour.order } }),
    prisma.lesson.update({ where: { id: neighbour.id }, data: { order: current.order } }),
  ]);
}

async function nextChildOrder(entity: "chapter" | "lesson", parentId: string): Promise<number> {
  if (entity === "chapter") {
    const last = await prisma.chapter.findFirst({
      where: { moduleId: parentId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return (last?.order ?? -1) + 1;
  }

  const last = await prisma.lesson.findFirst({
    where: { chapterId: parentId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}
