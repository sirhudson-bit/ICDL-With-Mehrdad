import { AppError, ERROR_MESSAGES, logError } from "@/lib/errors";
import {
  buildLessonContext,
  toRawBlocks,
  type ContextSection,
  type LessonContext,
} from "@/lib/ai/context";
import { resolveAIProvider, type AIMessage } from "@/lib/ai/providers";
import { prisma } from "@/lib/db";
import { stripPersianStopWords } from "@/lib/persian";
import { getGlobalFaqs, getLessonBySlug } from "@/services/course-service";
import { searchContent } from "@/services/search-service";
import { getSettings } from "@/services/settings-service";
import type { ChatRole } from "@/types";

/**
 * Chat orchestration.
 *
 * Responsibilities: ownership of conversations, assembling the lesson-aware
 * context, calling whichever provider is configured, and persisting the
 * exchange so history survives reloads and admins can review what learners ask.
 */

export type ChatTurn = {
  id: string;
  role: ChatRole;
  content: string;
  provider: string | null;
  createdAt: string;
};

export type ChatReply = {
  sessionId: string;
  turn: ChatTurn;
  provider: string;
  contextLabel: string | null;
  degraded: boolean;
};

function toTurn(message: {
  id: string;
  role: string;
  content: string;
  provider: string | null;
  createdAt: Date;
}): ChatTurn {
  return {
    id: message.id,
    role: message.role === "ASSISTANT" ? "ASSISTANT" : message.role === "SYSTEM" ? "SYSTEM" : "USER",
    content: message.content,
    provider: message.provider,
    createdAt: message.createdAt.toISOString(),
  };
}

/** Finds the learner's open conversation for a lesson, or creates one. */
export async function getOrCreateSession(
  userId: string,
  lessonId: string | null,
  title?: string | null,
) {
  const existing = await prisma.chatSession.findFirst({
    where: { userId, lessonId },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) return existing;

  return prisma.chatSession.create({
    data: { userId, lessonId, title: title ?? null },
  });
}

export async function getSessionMessages(
  userId: string,
  sessionId: string,
  limit = 40,
): Promise<ChatTurn[]> {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });

  if (!session) throw new AppError(ERROR_MESSAGES.notFound, { code: "NOT_FOUND" });

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId, role: { not: "SYSTEM" } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return messages.map(toTurn);
}

/** Most recent conversation for a lesson, so reopening a lesson resumes the chat. */
export async function getLessonConversation(userId: string, lessonId: string | null) {
  const session = await prisma.chatSession.findFirst({
    where: { userId, lessonId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (!session) return { sessionId: null, messages: [] as ChatTurn[] };

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id, role: { not: "SYSTEM" } },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  return { sessionId: session.id, messages: messages.map(toTurn) };
}

/**
 * Builds the context that grounds the assistant's answer.
 *
 * With a lesson slug the context is that lesson and nothing else, so answers
 * cannot drift outside it. Without one — the home page, the course index — the
 * whole curriculum is searched for the question and the matching lessons are
 * folded into the context, because answering from an empty context made the
 * assistant reply "open a lesson" to every question asked outside one.
 */
async function buildContextForLesson(
  lessonSlug: string | null | undefined,
  question: string,
): Promise<{
  context: LessonContext;
  lessonId: string | null;
  label: string | null;
  mode: "lesson" | "general";
}> {
  if (!lessonSlug) {
    return { ...(await buildGeneralContext(question)), mode: "general" };
  }

  const lesson = await getLessonBySlug(lessonSlug);
  if (!lesson) {
    return { ...(await buildGeneralContext(question)), mode: "general" };
  }

  const relatedBlocks = lesson.blocks.filter((block) => block.type === "relatedLessons");
  const relatedSlugs = relatedBlocks.flatMap((block) => {
    const data = block.data as { lessonSlugs?: string[] } | null;
    return data?.lessonSlugs ?? [];
  });

  const relatedLessons =
    relatedSlugs.length > 0
      ? await prisma.lesson.findMany({
          where: {
            slug: {
              in: relatedSlugs.map((slug) => slug.split("/").filter(Boolean).at(-1) ?? slug),
            },
            isPublished: true,
          },
          select: { title: true, slug: true, chapter: { select: { module: { select: { slug: true } } } } },
        })
      : [];

  const context = buildLessonContext({
    lessonTitle: lesson.title,
    lessonSummary: lesson.summary,
    lessonUrl: `/course/${lesson.chapter.module.slug}/${lesson.slug}`,
    moduleTitle: lesson.chapter.module.title,
    chapterTitle: lesson.chapter.title,
    blocks: toRawBlocks(lesson.blocks),
    faqs: lesson.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
    related: relatedLessons.map((item) => ({
      title: item.title,
      href: `/course/${item.chapter.module.slug}/${item.slug}`,
    })),
  });

  return {
    context,
    lessonId: lesson.id,
    label: [lesson.chapter.module.title, lesson.chapter.title, lesson.title].join(" › "),
    mode: "lesson",
  };
}

/**
 * Context for a question asked outside any lesson.
 *
 * Runs the learner's question through the same search the site uses, loads the
 * lessons that matched, and flattens their passages into the context — each
 * heading prefixed with the lesson it came from, so the answer can attribute
 * itself. The published FAQs are appended so the most common questions are
 * always answerable even when the search finds nothing.
 */
async function buildGeneralContext(question: string): Promise<{
  context: LessonContext;
  lessonId: null;
  label: null;
}> {
  const trimmed = question.trim();
  // Searching the meaningful words only: a full natural-language question
  // ("چگونه در ورد جدول بسازم؟") returned nothing at all, while "ورد جدول"
  // finds the lessons that actually cover tables.
  const searchQuery = stripPersianStopWords(trimmed) || trimmed;

  const [faqs, result] = await Promise.all([
    getGlobalFaqs(),
    searchQuery.length >= 2
      ? searchContent(searchQuery, { types: ["lesson", "faq"], limit: 4 })
      : Promise.resolve(null),
  ]);

  const sections: ContextSection[] = [];
  const related: { title: string; href: string }[] = [];

  const lessonHits = (result?.hits ?? []).filter((hit) => hit.type === "lesson");
  if (lessonHits.length > 0) {
    const slugs = lessonHits.map((hit) => hit.href.split("/").filter(Boolean).at(-1) ?? "");
    const lessons = await prisma.lesson.findMany({
      where: { slug: { in: slugs.filter(Boolean) }, isPublished: true },
      select: {
        slug: true,
        title: true,
        blocks: { where: { isVisible: true }, orderBy: { order: "asc" }, select: { type: true, data: true } },
        chapter: { select: { module: { select: { slug: true } } } },
      },
    });

    for (const lesson of lessons) {
      const lessonContext = buildLessonContext({
        lessonTitle: lesson.title,
        blocks: toRawBlocks(lesson.blocks),
      });

      for (const part of lessonContext.sections) {
        sections.push({ heading: `${lesson.title} › ${part.heading}`, text: part.text });
      }
      for (const item of lessonContext.definitions) {
        sections.push({ heading: `${lesson.title} › اصطلاح: ${item.term}`, text: item.definition });
      }
      for (const item of lessonContext.steps) {
        sections.push({ heading: `${lesson.title} › مرحله: ${item.title}`, text: item.text });
      }

      related.push({ title: lesson.title, href: `/course/${lesson.chapter.module.slug}/${lesson.slug}` });
    }
  }

  for (const hit of (result?.hits ?? []).filter((item) => item.type === "faq")) {
    sections.push({ heading: `پرسش پرتکرار: ${hit.title}`, text: hit.snippet });
  }

  const context = buildLessonContext({
    blocks: [],
    faqs: faqs.slice(0, 12).map((faq) => ({ question: faq.question, answer: faq.answer })),
    related,
  });
  context.sections = sections;

  return { context, lessonId: null, label: null };
}

export async function sendChatMessage(input: {
  userId: string;
  message: string;
  lessonSlug?: string | null;
  sessionId?: string | null;
}): Promise<ChatReply> {
  const settings = await getSettings("chatbot");

  if (!settings.enabled) {
    throw new AppError("چت‌بات در حال حاضر غیرفعال است.", { code: "FORBIDDEN" });
  }

  const question = input.message.trim().slice(0, 2000);
  if (question.length === 0) {
    throw new AppError("متن پرسش خالی است.", { code: "VALIDATION" });
  }

  const { context, lessonId, label, mode } = await buildContextForLesson(input.lessonSlug, question);

  // Resolve the conversation, validating ownership when a session id is given.
  let sessionId = input.sessionId ?? null;
  if (sessionId) {
    const owned = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId: input.userId },
      select: { id: true },
    });
    if (!owned) sessionId = null;
  }

  if (!sessionId) {
    const session = await getOrCreateSession(
      input.userId,
      lessonId,
      context.lessonTitle ? `گفتگو درباره ${context.lessonTitle}` : null,
    );
    sessionId = session.id;
  }

  await prisma.chatMessage.create({
    data: { sessionId, role: "USER", content: question },
  });

  const historyLimit = settings.historyLimit;
  const history = historyLimit
    ? await prisma.chatMessage.findMany({
        where: { sessionId, role: { not: "SYSTEM" } },
        orderBy: { createdAt: "desc" },
        take: historyLimit + 1,
      })
    : [];

  const messages: AIMessage[] = history
    .slice(1) // the current question is appended separately
    .reverse()
    .filter((message) => message.role === "USER" || message.role === "ASSISTANT")
    .map((message) => ({
      role: message.role === "ASSISTANT" ? ("assistant" as const) : ("user" as const),
      content: message.content,
    }));

  messages.push({ role: "user", content: question });

  const provider = resolveAIProvider(settings);

  let reply: Awaited<ReturnType<typeof provider.complete>>;
  let degraded = false;

  try {
    reply = await provider.complete({ messages, question, context, mode });
  } catch (error) {
    // A remote provider outage should still give the learner an answer.
    if (provider.id !== "local") {
      logError("chat:provider-fallback", error);
      const { LocalKnowledgeProvider } = await import("@/lib/ai/providers");
      const fallback = new LocalKnowledgeProvider();
      reply = await fallback.complete({ messages, question, context, mode });
      degraded = true;
    } else {
      throw error;
    }
  }

  const saved = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "ASSISTANT",
      content: reply.content,
      provider: reply.provider,
      model: reply.model,
      latencyMs: reply.latencyMs,
    },
  });

  await prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });

  return { sessionId, turn: toTurn(saved), provider: reply.provider, contextLabel: label, degraded };
}

export async function clearConversation(userId: string, sessionId: string): Promise<void> {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!session) throw new AppError(ERROR_MESSAGES.notFound, { code: "NOT_FOUND" });

  await prisma.chatMessage.deleteMany({ where: { sessionId } });
}

/** Admin insight: the questions learners ask the assistant most often. */
export async function getTopChatQuestions(limit = 8) {
  const messages = await prisma.chatMessage.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { content: true },
  });

  const counts = new Map<string, { sample: string; count: number }>();

  for (const message of messages) {
    const key = message.content.trim().toLowerCase().slice(0, 60);
    if (!key) continue;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { sample: message.content.trim(), count: 1 });
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => ({ question: entry.sample, count: entry.count }));
}
