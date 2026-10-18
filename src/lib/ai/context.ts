import type { BlockData, BlockType } from "@/lib/content/blocks";
import { stripHtml, truncate } from "@/lib/persian";

/**
 * Lesson context for the AI assistant.
 *
 * The chatbot answers in the context of whatever lesson the learner is reading,
 * so the raw blocks are flattened into a shape that is cheap to serialise for a
 * remote model and directly queryable by the offline provider.
 */

export type ContextSection = { heading: string; text: string };

export type LessonContext = {
  moduleTitle: string | null;
  chapterTitle: string | null;
  lessonTitle: string | null;
  lessonSummary: string | null;
  lessonUrl: string | null;
  sections: ContextSection[];
  steps: { title: string; text: string }[];
  definitions: { term: string; definition: string }[];
  tips: string[];
  warnings: string[];
  examples: string[];
  practice: string[];
  summaryPoints: string[];
  faq: { question: string; answer: string }[];
  related: { title: string; href: string }[];
};

/**
 * A fresh, empty context.
 *
 * A function rather than a shared constant on purpose. Spreading a shared
 * object copies its array *references*, and `buildLessonContext` appends to
 * those arrays — so a module-level constant was being mutated by every request,
 * making each answer inherit passages from whichever lessons had been built
 * before it in the same process. The first question after a restart looked
 * right; everything after it was contaminated.
 */
export function createEmptyLessonContext(): LessonContext {
  return {
    moduleTitle: null,
    chapterTitle: null,
    lessonTitle: null,
    lessonSummary: null,
    lessonUrl: null,
    sections: [],
    steps: [],
    definitions: [],
    tips: [],
    warnings: [],
    examples: [],
    practice: [],
    summaryPoints: [],
    faq: [],
    related: [],
  };
}

type RawBlock = { id?: string; type: string; data: unknown };

function asText(value: unknown): string {
  return typeof value === "string" ? stripHtml(value) : "";
}

/**
 * Turns the ordered lesson blocks into a structured context.
 *
 * Rich text is stripped of markup because the model does not need it and the
 * offline matcher compares plain text.
 */
export function buildLessonContext(input: {
  lessonTitle?: string | null;
  lessonSummary?: string | null;
  lessonUrl?: string | null;
  moduleTitle?: string | null;
  chapterTitle?: string | null;
  blocks: RawBlock[];
  faqs?: { question: string; answer: string }[];
  related?: { title: string; href: string }[];
}): LessonContext {
  const context: LessonContext = {
    ...createEmptyLessonContext(),
    moduleTitle: input.moduleTitle ?? null,
    chapterTitle: input.chapterTitle ?? null,
    lessonTitle: input.lessonTitle ?? null,
    lessonSummary: input.lessonSummary ?? null,
    lessonUrl: input.lessonUrl ?? null,
    faq: input.faqs ?? [],
    related: input.related ?? [],
  };

  let currentHeading = input.lessonTitle ?? "مقدمه";

  for (const block of input.blocks) {
    const type = block.type as BlockType;
    const data = (block.data ?? {}) as Record<string, unknown>;

    switch (type) {
      case "heading": {
        currentHeading = asText(data.text) || currentHeading;
        break;
      }

      case "text":
      case "callout":
      case "example": {
        const text = asText(data.html);
        if (text) {
          if (type === "example") {
            context.examples.push(text);
          } else {
            context.sections.push({ heading: currentHeading, text });
          }
        }
        break;
      }

      case "definition": {
        const term = asText(data.term);
        const definition = asText(data.definition);
        if (term) context.definitions.push({ term, definition: definition || term });
        break;
      }

      case "tip": {
        const text = asText(data.html);
        if (text) context.tips.push(text);
        break;
      }

      case "warning": {
        const text = asText(data.html);
        if (text) context.warnings.push(text);
        break;
      }

      case "steps": {
        const steps = (data.steps as { title?: string; html?: string; tip?: string }[] | undefined) ?? [];
        for (const item of steps) {
          const text = [asText(item.html), asText(item.tip)].filter(Boolean).join(" ");
          context.steps.push({ title: asText(item.title) || "مرحله", text });
        }
        break;
      }

      case "practice": {
        const text = asText(data.html);
        if (text) context.practice.push(text);
        const checklist = data.checklist as string[] | undefined;
        if (checklist?.length) context.practice.push(...checklist);
        break;
      }

      case "summary": {
        const text = asText(data.html);
        if (text) context.sections.push({ heading: "خلاصه درس", text });
        const points = data.points as string[] | undefined;
        if (points?.length) context.summaryPoints.push(...points);
        break;
      }

      case "table": {
        const caption = asText(data.caption);
        const headers = (data.headers as string[] | undefined) ?? [];
        const rows = (data.rows as string[][] | undefined) ?? [];
        const lines = rows.map((row) => row.map((cell) => asText(cell)).join(" | "));
        const text = [caption, headers.join(" | "), ...lines].filter(Boolean).join("\n");
        if (text) context.sections.push({ heading: currentHeading, text });
        break;
      }

      case "keyboard": {
        const shortcuts = (data.shortcuts as { keys: string[]; description: string }[] | undefined) ?? [];
        const text = shortcuts.map((item) => `${item.keys.join(" + ")}: ${item.description}`).join("\n");
        if (text) context.sections.push({ heading: "میان‌برهای کیبورد", text });
        break;
      }

      case "objectives": {
        const items = (data.items as string[] | undefined) ?? [];
        if (items.length > 0) {
          context.sections.push({ heading: "اهداف درس", text: items.join("، ") });
        }
        break;
      }

      default: {
        // Media, exercise, demo and resource blocks contribute their captions.
        const text = asText(data.title) || asText(data.caption);
        if (text && type !== "divider") {
          context.sections.push({ heading: currentHeading, text });
        }
        break;
      }
    }
  }

  return context;
}

/** Serialises the context into a prompt section within a character budget. */
export function renderContextForPrompt(context: LessonContext, maxChars: number): string {
  const parts: string[] = [];

  if (context.moduleTitle) parts.push(`ماژول: ${context.moduleTitle}`);
  if (context.chapterTitle) parts.push(`فصل: ${context.chapterTitle}`);
  if (context.lessonTitle) parts.push(`درس: ${context.lessonTitle}`);
  if (context.lessonSummary) parts.push(`خلاصه درس: ${context.lessonSummary}`);

  for (const section of context.sections) {
    parts.push(`— ${section.heading}: ${section.text}`);
  }

  if (context.definitions.length > 0) {
    parts.push(
      `اصطلاح‌ها:\n${context.definitions.map((item) => `• ${item.term}: ${item.definition}`).join("\n")}`,
    );
  }

  if (context.steps.length > 0) {
    parts.push(
      `مراحل:\n${context.steps.map((item, index) => `${index + 1}. ${item.title} — ${item.text}`).join("\n")}`,
    );
  }

  if (context.tips.length > 0) parts.push(`نکته‌ها: ${context.tips.join(" | ")}`);
  if (context.warnings.length > 0) parts.push(`هشدارها: ${context.warnings.join(" | ")}`);
  if (context.practice.length > 0) parts.push(`تمرین‌ها: ${context.practice.join(" | ")}`);

  if (context.faq.length > 0) {
    parts.push(
      `پرسش و پاسخ‌های همین درس:\n${context.faq
        .map((item) => `پرسش: ${item.question}\nپاسخ: ${stripHtml(item.answer)}`)
        .join("\n")}`,
    );
  }

  let rendered = parts.join("\n\n");

  // Trim from the end so the lesson identity is always preserved.
  if (rendered.length > maxChars) {
    rendered = `${rendered.slice(0, maxChars)}\n…`;
  }

  return rendered;
}

/** Plain searchable text, used by the offline provider to rank passages. */
export function contextPassages(context: LessonContext): { heading: string; text: string }[] {
  const passages: { heading: string; text: string }[] = [];

  for (const section of context.sections) passages.push(section);

  for (const item of context.definitions) {
    passages.push({ heading: `اصطلاح: ${item.term}`, text: item.definition });
  }
  for (const item of context.steps) {
    passages.push({ heading: `مرحله: ${item.title}`, text: item.text });
  }
  for (const item of context.tips) passages.push({ heading: "نکته", text: item });
  for (const item of context.warnings) passages.push({ heading: "هشدار", text: item });
  for (const item of context.examples) passages.push({ heading: "مثال", text: item });
  for (const item of context.practice) passages.push({ heading: "تمرین", text: item });
  for (const item of context.faq) {
    passages.push({ heading: `پرسش: ${item.question}`, text: stripHtml(item.answer) });
  }

  return passages.filter((passage) => passage.text.trim().length > 0);
}

/** Compact context summary shown as a chip above the chat composer. */
export function describeContext(context: LessonContext): string | null {
  if (!context.lessonTitle) return null;
  const parts = [context.moduleTitle, context.chapterTitle, context.lessonTitle].filter(Boolean);
  return truncate(parts.join(" › "), 90);
}

/** Narrows unknown JSON from Prisma into a typed block list. */
export function toRawBlocks(
  blocks: { type: string; data: unknown }[],
): { type: BlockType; data: BlockData }[] {
  return blocks.map((block) => ({
    type: block.type as BlockType,
    data: block.data as BlockData,
  }));
}
