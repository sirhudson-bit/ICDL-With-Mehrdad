import type { DemoKind, ExerciseData } from "../../src/lib/content/blocks";
import type { SeedBlock, SeedFaq, SeedQuestion, SeedQuiz } from "./types";

/**
 * Terse constructors used by the curriculum files.
 *
 * They keep the content readable as prose while still producing fully typed
 * block payloads that the same Zod schemas validate at seed time.
 */

export function objectives(items: string[], title = "در این درس یاد می‌گیرید"): SeedBlock {
  return { type: "objectives", data: { title, items } };
}

export function heading(text: string, level: 2 | 3 | 4 = 2): SeedBlock {
  return { type: "heading", data: { text, level } };
}

export function text(html: string): SeedBlock {
  return { type: "text", data: { html } };
}

export function definition(term: string, def: string, example?: string): SeedBlock {
  return { type: "definition", data: { term, definition: def, example } };
}

export function callout(
  html: string,
  options: { title?: string; tone?: "info" | "success" | "warning" | "danger" | "neutral" } = {},
): SeedBlock {
  return {
    type: "callout",
    data: { html, tone: options.tone ?? "info", title: options.title },
  };
}

export function tip(html: string, title = "نکته"): SeedBlock {
  return { type: "tip", data: { html, title } };
}

export function warning(html: string, title = "هشدار"): SeedBlock {
  return { type: "warning", data: { html, title } };
}

export function example(html: string, title = "مثال"): SeedBlock {
  return { type: "example", data: { html, title } };
}

export function image(url: string, alt: string, caption?: string): SeedBlock {
  return { type: "image", data: { url, alt, caption } };
}

export function gallery(images: { url: string; alt: string; caption?: string }[], columns: 2 | 3 = 2): SeedBlock {
  return { type: "gallery", data: { images, columns } };
}

export function video(url: string, title?: string, caption?: string): SeedBlock {
  return { type: "video", data: { url, title, caption } };
}

export function table(headers: string[], rows: string[][], caption?: string): SeedBlock {
  return { type: "table", data: { headers, rows, caption } };
}

export function keyboard(
  shortcuts: { keys: string[]; description: string }[],
  title = "میان‌برهای کیبورد",
): SeedBlock {
  return { type: "keyboard", data: { title, shortcuts } };
}

export function code(code: string, language = "", caption?: string): SeedBlock {
  return { type: "code", data: { code, language, caption } };
}

export function step(title: string, html: string, options: { imageUrl?: string; tip?: string } = {}) {
  return { title, html, imageUrl: options.imageUrl, tip: options.tip };
}

export function steps(title: string, items: ReturnType<typeof step>[]): SeedBlock {
  return { type: "steps", data: { title, steps: items } };
}

export function practice(html: string, checklist: string[] = [], title = "تمرین کنید"): SeedBlock {
  return { type: "practice", data: { html, checklist, title } };
}

export function exercise(
  title: string,
  instructions: string,
  payload: ExerciseData,
  maxAttempts = 3,
): SeedBlock {
  return { type: "exercise", data: { title, instructions, exercise: payload, maxAttempts } };
}

export function demo(kind: DemoKind, options: Record<string, unknown> = {}, title = "نمایش تعاملی", instructions?: string): SeedBlock {
  return {
    type: "demo",
    data: {
      title,
      instructions,
      // Payload is validated by the demo schema at seed time.
      demo: { kind, ...options } as never,
    },
  };
}

export function faqBlock(items: { question: string; answer: string }[], title = "پرسش‌های پرتکرار"): SeedBlock {
  return { type: "faq", data: { title, items } };
}

export function resources(
  items: { label: string; url: string; kind?: "pdf" | "doc" | "sheet" | "slide" | "zip" | "link"; size?: string }[],
  title = "فایل‌های تمرین",
): SeedBlock {
  return {
    type: "resource",
    data: {
      title,
      items: items.map((item) => ({ ...item, kind: item.kind ?? "link" })),
    },
  };
}

export function summary(html: string, points: string[] = [], title = "خلاصه درس"): SeedBlock {
  return { type: "summary", data: { html, points, title } };
}

export function related(lessonSlugs: string[], title = "درس‌های مرتبط"): SeedBlock {
  return { type: "relatedLessons", data: { title, lessonSlugs } };
}

export function divider(): SeedBlock {
  return { type: "divider", data: {} };
}

// ── Question constructors ────────────────────────────────────

/**
 * Optional metadata shared by every question.
 *
 * Declared as a narrow object rather than `Partial<SeedQuestion>` so the
 * discriminated union of question types survives the spread below — with a
 * partial union TypeScript can no longer tell which variant is being built.
 */
type QuestionExtras = {
  hint?: string;
  explanation?: string;
  points?: number;
};

export function mc(
  prompt: string,
  options: string[],
  correctIndex = 0,
  extra: QuestionExtras = {},
): SeedQuestion {
  const list = options.map((text, index) => ({ id: String.fromCharCode(97 + index), text }));
  return {
    type: "MULTIPLE_CHOICE",
    prompt,
    options: list,
    correctOptionId: list[correctIndex]?.id ?? "a",
    ...extra,
  };
}

export function tf(prompt: string, isTrue: boolean, extra: QuestionExtras = {}): SeedQuestion {
  return { type: "TRUE_FALSE", prompt, isTrue, ...extra };
}

export function fill(prompt: string, accepted: string[], extra: QuestionExtras = {}): SeedQuestion {
  return { type: "FILL_BLANK", prompt, accepted, ...extra };
}

export function match(
  prompt: string,
  pairs: [string, string][],
  extra: QuestionExtras = {},
): SeedQuestion {
  const left = pairs.map((pair, index) => ({ id: `l${index + 1}`, text: pair[0] }));
  const right = pairs.map((pair, index) => ({ id: `r${index + 1}`, text: pair[1] }));
  return {
    type: "MATCHING",
    prompt,
    left,
    // Reverse the right column so it does not line up with the left by default.
    right: [...right].reverse(),
    pairs: left.map((item, index) => [item.id, right[index]!.id] as [string, string]),
    ...extra,
  };
}

export function practical(prompt: string, checklist: string[], extra: QuestionExtras = {}): SeedQuestion {
  return { type: "PRACTICAL", prompt, checklist, ...extra };
}

export function quiz(questions: SeedQuestion[], options: Omit<SeedQuiz, "questions"> = {}): SeedQuiz {
  return {
    title: options.title ?? "آزمون این درس",
    description: options.description,
    passingScore: options.passingScore ?? 70,
    timeLimitMinutes: options.timeLimitMinutes,
    questions,
  };
}

export function faqItems(items: { question: string; answer: string; category?: string }[]): SeedFaq[] {
  return items;
}
