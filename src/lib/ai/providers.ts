import { AppError, ERROR_MESSAGES, logError } from "@/lib/errors";
import {
  contextPassages,
  renderContextForPrompt,
  type LessonContext,
} from "@/lib/ai/context";
import { normalizePersian, meaningfulTokens, truncate } from "@/lib/persian";
import type { ChatbotSettings } from "@/lib/settings";

/**
 * Minimum match score before the assistant will quote a passage in general
 * mode. A heading hit scores 6 and a body hit 2, so 4 means "either the heading
 * matched, or two separate words in the body did".
 */
const GENERAL_MATCH_FLOOR = 4;

/**
 * AI provider abstraction.
 *
 * The chat service depends only on this interface: remotely the assistant talks
 * to GapGPT (an OpenAI-compatible gateway), and when no key is configured it runs
 * entirely offline from the lesson content. Nothing else in the application
 * needs to know which one answered.
 */

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export type AIRequest = {
  /** Fully assembled conversation, including the system prompt. */
  messages: AIMessage[];
  /** Used by the offline provider; ignored by remote providers. */
  question: string;
  context: LessonContext;
  /**
   * "lesson" answers strictly from the lesson the learner is reading.
   * "general" is used outside a lesson (the home page, the course index): the
   * context then holds curriculum-wide material gathered by searching the whole
   * course for the question, so the assistant can still answer.
   */
  mode: "lesson" | "general";
};

export type AIResponse = {
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
};

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  complete(request: AIRequest): Promise<AIResponse>;
}

const REQUEST_TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────────────────────
// GapGPT provider (OpenAI-compatible)
// ─────────────────────────────────────────────────────────────

type GapGPTConfig = {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  apiStyle: "auto" | "chat" | "responses";
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  lessonContextChars: number;
};

/** Carries the HTTP status so the caller can tell "route missing" from "denied". */
class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

export class GapGPTProvider implements AIProvider {
  constructor(private readonly config: GapGPTConfig) {}

  get id(): string {
    return this.config.id;
  }

  get label(): string {
    return this.config.label;
  }

  isConfigured(): boolean {
    return Boolean(this.config.baseUrl && this.config.apiKey && this.config.model);
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    if (!this.isConfigured()) {
      throw new AppError(ERROR_MESSAGES.aiUnavailable, { code: "AI_UNAVAILABLE" });
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const { instructions, conversation } = this.assemble(request);

    try {
      // GapGPT speaks the OpenAI chat-completions protocol. Some models are only
      // reachable through the newer Responses API, so "auto" tries chat first and
      // switches over when that route is absent.
      const styles: ("chat" | "responses")[] =
        this.config.apiStyle === "auto" ? ["chat", "responses"] : [this.config.apiStyle];

      let lastError: unknown;
      for (const style of styles) {
        try {
          const content =
            style === "chat"
              ? await this.chatCompletions(instructions, conversation, controller.signal)
              : await this.responses(instructions, conversation, controller.signal);

          return {
            content,
            provider: this.id,
            model: this.config.model,
            latencyMs: Date.now() - startedAt,
          };
        } catch (error) {
          lastError = error;
          // Only a missing route justifies trying the other endpoint: an
          // authentication or rate-limit failure applies to both.
          const missingRoute =
            error instanceof ProviderHttpError && (error.status === 404 || error.status === 405);
          if (this.config.apiStyle !== "auto" || !missingRoute) break;
        }
      }

      throw lastError;
    } catch (error) {
      if (error instanceof AppError) throw error;

      if (error instanceof Error && error.name === "AbortError") {
        logError(`ai:${this.config.id}`, new Error("درخواست به دلیل طولانی شدن لغو شد."));
      } else {
        logError(`ai:${this.config.id}`, error);
      }

      throw new AppError(ERROR_MESSAGES.aiUnavailable, { code: "AI_UNAVAILABLE", cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  /** System prompt + lesson context as `instructions`; the chat history as messages. */
  private assemble(request: AIRequest): { instructions: string; conversation: AIMessage[] } {
    const lessonBlock = request.context.lessonTitle
      ? [
          "",
          "---",
          "اطلاعات درس جاری کاربر (فقط بر اساس همین اطلاعات پاسخ بده):",
          renderContextForPrompt(request.context, this.config.lessonContextChars),
        ].join("\n")
      : "";

    return {
      instructions: `${this.config.systemPrompt}${lessonBlock}`,
      conversation: request.messages.filter((message) => message.role !== "system"),
    };
  }

  private url(path: string): string {
    return `${this.config.baseUrl.replace(/\/+$/, "")}${path}`;
  }

  private async chatCompletions(
    instructions: string,
    conversation: AIMessage[],
    signal: AbortSignal,
  ): Promise<string> {
    const payload = await this.post(
      this.url("/chat/completions"),
      {
        model: this.config.model,
        messages: [{ role: "system", content: instructions }, ...conversation],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      },
      signal,
    );

    const content = (payload as { choices?: { message?: { content?: string } }[] })
      .choices?.[0]?.message?.content;
    if (!content?.trim()) throw new Error("پاسخ سرویس خالی بود.");
    return content.trim();
  }

  private async responses(
    instructions: string,
    conversation: AIMessage[],
    signal: AbortSignal,
  ): Promise<string> {
    const payload = await this.post(
      this.url("/responses"),
      {
        model: this.config.model,
        instructions,
        input: conversation.map((message) => ({ role: message.role, content: message.content })),
        temperature: this.config.temperature,
        max_output_tokens: this.config.maxTokens,
      },
      signal,
    );

    const body = payload as {
      output_text?: string;
      output?: { content?: { type?: string; text?: string }[] }[];
    };

    const content =
      (typeof body.output_text === "string" ? body.output_text : "") ||
      (body.output ?? [])
        .flatMap((item) => item.content ?? [])
        .map((part) => part.text ?? "")
        .join("");

    if (!content.trim()) throw new Error("پاسخ سرویس خالی بود.");
    return content.trim();
  }

  private async post(url: string, body: unknown, signal: AbortSignal): Promise<unknown> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ProviderHttpError(response.status, `HTTP ${response.status} — ${truncate(text, 300)}`);
    }

    return response.json();
  }
}

// ─────────────────────────────────────────────────────────────
// Offline provider
// ─────────────────────────────────────────────────────────────

type Intent = "simplify" | "example" | "steps" | "exercise" | "summary" | "definition" | "general";

const INTENT_PATTERNS: { intent: Intent; pattern: RegExp }[] = [
  { intent: "simplify", pattern: /(ساده|آسان|راحت)\s*-?\s?(تر|کن|بگو|توضیح)/ },
  { intent: "example", pattern: /(مثال|نمونه)/ },
  { intent: "steps", pattern: /(مرحله|گام\s?به\s?گام|قدم|چگونه|چطور|روش)/ },
  { intent: "exercise", pattern: /(تمرین|تست|آزمون|سؤال بده|سوال بده)/ },
  { intent: "summary", pattern: /(خلاصه|جمع\s?بندی|نکته مهم)/ },
  { intent: "definition", pattern: /(چیست|یعنی چه|معنی|تعریف|چیه)/ },
];

function detectIntent(question: string): Intent {
  const normalized = normalizePersian(question);
  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(normalized)) return intent;
  }
  return "general";
}

/**
 * Detects greetings and pleasantries.
 *
 * Without this the offline assistant answered "سلام" by quoting whichever
 * lesson passage matched best, which reads as nonsense in a chat window.
 */
function isSmallTalk(question: string): boolean {
  const normalized = normalizePersian(question).trim();
  if (normalized.length === 0 || normalized.length > 32) return false;
  return /^(سلام|درود|های|hi|hello|hey|ممنون|مرسی|سپاس|خوبی|چطوری|چه خبر|ببخشید|کمک می‌خواهم|کمکم کن)/.test(
    normalized,
  );
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?؟؛])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12);
}

function scorePassage(passage: { heading: string; text: string }, tokens: string[]): number {
  const haystack = normalizePersian(`${passage.heading} ${passage.text}`);
  let score = 0;
  for (const token of tokens) {
    if (token.length < 3) continue;
    if (normalizePersian(passage.heading).includes(token)) score += 6;
    if (haystack.includes(token)) score += 2;
  }
  return score;
}

/**
 * Answers from the lesson content itself.
 *
 * This is the default provider: it needs no API key, never invents facts, and
 * always grounds its answer in a passage that was authored in the admin panel.
 * Remote providers produce more fluent prose; this one guarantees correctness.
 */
export class LocalKnowledgeProvider implements AIProvider {
  readonly id = "local";
  readonly label = "دستیار داخلی (بدون نیاز به کلید API)";

  isConfigured(): boolean {
    return true;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const startedAt = Date.now();
    const content = this.compose(request);
    return { content, provider: this.id, model: "lesson-knowledge", latencyMs: Date.now() - startedAt };
  }

  private compose(request: AIRequest): string {
    const { context, question, mode } = request;
    const intent = detectIntent(question);
    // Function words are dropped before matching: "چگونه" appears in most FAQ
    // headings and used to make an unrelated passage look like a strong match.
    const tokens = meaningfulTokens(question);
    const passages = contextPassages(context);

    const ranked = passages
      .map((passage) => ({ ...passage, score: scorePassage(passage, tokens) }))
      .sort((a, b) => b.score - a.score)
      .filter((passage) => passage.score > 0);

    const best = ranked[0];

    // Outside a lesson there is no single document to ground the answer in, so
    // the general path is used instead: it searches the whole course and can
    // always say something useful, falling back on the FAQ list. A weak match is
    // treated as no match, because quoting a barely-related passage is worse
    // than admitting the curriculum does not cover the question.
    if (mode === "general") {
      const confident = best && best.score >= GENERAL_MATCH_FLOOR ? best : undefined;
      return this.curriculum(context, question, confident);
    }

    if (!context.lessonTitle && passages.length === 0) {
      return [
        "برای اینکه بتوانم دقیق‌تر کمک کنم، یک درس را باز کنید و از همان‌جا سؤالتان را بپرسید.",
        "",
        "اگر موضوع مشخصی مدنظر دارید، از کادر جستجو استفاده کنید یا در صفحه «راهنما» پرسش‌های پرتکرار را ببینید.",
      ].join("\n");
    }

    switch (intent) {
      case "simplify":
        return this.simplify(best);
      case "example":
        return this.examples(context, best);
      case "steps":
        return this.steps(context, best);
      case "exercise":
        return this.exercise(context);
      case "summary":
        return this.summary(context);
      case "definition":
        return this.definition(context, best);
      default:
        return this.general(context, best);
    }
  }

  /**
   * Answers a question asked outside a lesson.
   *
   * The context was assembled by searching the whole curriculum, so the best
   * passage already carries the lesson it came from in its heading. Greetings
   * get a welcome rather than a quotation, and a genuine miss offers the FAQ
   * list and the closest lessons instead of a dead end.
   */
  private curriculum(context: LessonContext, question: string, passage?: { heading: string; text: string }): string {
    if (isSmallTalk(question)) {
      return [
        "سلام! 👋 من دستیار آموزشی این دوره هستم.",
        "",
        "هر سؤالی درباره مهارت‌های کامپیوتر و ICDL دارید بپرسید؛ مثلاً «فرمول SUM چیست؟»، «چطور فایل را فشرده کنم؟» یا «فیشینگ چیست؟».",
        "",
        "اگر داخل یک درس باشید، پاسخ‌ها دقیقاً بر اساس همان درس داده می‌شود.",
      ].join("\n");
    }

    if (!passage) {
      const questions = context.faq.slice(0, 4).map((item) => `• ${item.question}`);
      const lessons = context.related.slice(0, 4).map((item) => `• ${item.title}`);

      return [
        "در محتوای دوره پاسخ مستقیمی برای این پرسش پیدا نکردم.",
        "",
        questions.length > 0 ? "شاید یکی از این پرسش‌های پرتکرار پاسخ شما باشد:" : "",
        ...questions,
        lessons.length > 0 ? "" : "",
        ...(lessons.length > 0 ? ["نزدیک‌ترین درس‌ها به پرسش شما:", ...lessons] : []),
        "",
        "می‌توانید سؤال را با کلمات دیگری بپرسید، از کادر جستجو استفاده کنید، یا همان موضوع را داخل درس مربوطه بپرسید.",
      ]
        .filter((line) => line !== "")
        .join("\n");
    }

    const sentences = splitSentences(passage.text).slice(0, 4);
    const body = sentences.length > 0 ? sentences.join(" ") : truncate(passage.text, 400);
    const lessons = context.related.slice(0, 3).map((item) => `• ${item.title}`);

    return [
      `**${passage.heading}**`,
      "",
      body,
      ...(lessons.length > 0 ? ["", "این موضوع در این درس‌ها توضیح داده شده است:", ...lessons] : []),
      "",
      "برای توضیح بیشتر، همان درس را باز کنید و از چت‌بات همان‌جا بپرسید تا دقیقاً بر اساس متن درس پاسخ بگیرید.",
    ]
      .filter((line) => line !== "")
      .join("\n");
  }

  private simplify(passage?: { heading: string; text: string }): string {
    if (!passage) {
      return "برای این درس توضیح کوتاه‌تری در دسترس نیست. اگر بخش مشخصی برایتان سخت است، همان جمله را برایم بنویسید تا جداگانه توضیح بدهم.";
    }

    const sentences = splitSentences(passage.text);
    const main = sentences.slice(0, 2).join(" ");
    const bullets = sentences
      .slice(2, 6)
      .map((sentence) => `• ${truncate(sentence, 110)}`)
      .join("\n");

    return [
      `**به زبان ساده‌تر (${passage.heading}):**`,
      "",
      main || truncate(passage.text, 220),
      bullets ? `\n${bullets}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private examples(context: LessonContext, passage?: { heading: string; text: string }): string {
    const lines: string[] = ["**یک مثال برای درک بهتر:**", ""];

    if (context.examples.length > 0) {
      lines.push(context.examples.map((item) => truncate(item, 260)).join("\n\n"));
    } else if (context.definitions.length > 0) {
      const item = context.definitions[0]!;
      lines.push(`مثلاً درباره «${item.term}»: ${truncate(item.definition, 220)}`);
    } else if (passage) {
      lines.push(`برای نمونه، در بخش «${passage.heading}»: ${truncate(passage.text, 220)}`);
    } else {
      lines.push("در این درس مثال جداگانه‌ای ثبت نشده است. می‌توانید همان مفهوم را روی کامپیوتر خودتان تمرین کنید.");
    }

    if (context.practice.length > 0) {
      lines.push("", "تمرین مرتبط:", ...context.practice.slice(0, 2).map((item) => `• ${truncate(item, 140)}`));
    }

    return lines.join("\n");
  }

  private steps(context: LessonContext, passage?: { heading: string; text: string }): string {
    if (context.steps.length > 0) {
      const lines = ["**مرحله به مرحله:**", ""];
      context.steps.forEach((item, index) => {
        lines.push(`${index + 1}. **${item.title}** — ${truncate(item.text, 180)}`);
      });
      return lines.join("\n");
    }

    if (passage) {
      const sentences = splitSentences(passage.text).slice(0, 6);
      if (sentences.length > 0) {
        return [
          `**مرحله به مرحله (برگرفته از «${passage.heading}»):**`,
          "",
          ...sentences.map((sentence, index) => `${index + 1}. ${sentence}`),
        ].join("\n");
      }
    }

    return "برای این درس مراحل شماره‌گذاری‌شده‌ای ثبت نشده است. اگر بگویید دقیقاً کدام قسمت را می‌خواهید انجام دهید، همان را مرحله‌به‌مرحله توضیح می‌دهم.";
  }

  private exercise(context: LessonContext): string {
    const items = context.practice.length > 0 ? context.practice : context.summaryPoints;

    if (items.length === 0) {
      return "برای این درس تمرین ثبت نشده است. پیشنهاد می‌کنم آزمون پایین همین صفحه را انجام دهید تا مطمئن شوید مطلب را یاد گرفته‌اید.";
    }

    return [
      "**یک تمرین برای شما:**",
      "",
      ...items.slice(0, 4).map((item, index) => `${index + 1}. ${truncate(item, 180)}`),
      "",
      "پس از انجام تمرین، آزمون همین درس را هم بدهید.",
    ].join("\n");
  }

  private summary(context: LessonContext): string {
    const lines = ["**خلاصه این درس:**", ""];

    if (context.summaryPoints.length > 0) {
      lines.push(...context.summaryPoints.map((point) => `• ${point}`));
    } else {
      const intro = context.sections.slice(0, 3).map((section) => `• ${truncate(section.text, 150)}`);
      lines.push(...intro);
    }

    if (context.steps.length > 0) {
      lines.push("", `این درس ${context.steps.length} مرحله عملی دارد.`);
    }

    return lines.join("\n");
  }

  private definition(context: LessonContext, passage?: { heading: string; text: string }): string {
    const matching = context.definitions[0];
    if (matching) {
      return [`**${matching.term}**`, "", matching.definition].join("\n");
    }
    if (passage) {
      return [`**${passage.heading}**`, "", truncate(passage.text, 400)].join("\n");
    }
    return "تعریف مستقیمی برای این مورد در درس ثبت نشده است. اگر اصطلاح دقیق را بنویسید، همان را توضیح می‌دهم.";
  }

  private general(context: LessonContext, passage?: { heading: string; text: string }): string {
    if (!passage) {
      const titles = context.sections.slice(0, 4).map((section) => `• ${section.heading}`);
      return [
        "در این درس به‌طور مستقیم به این پرسش پاسخ داده نشده است.",
        "",
        context.lessonTitle ? `این درس درباره «${context.lessonTitle}» است و این بخش‌ها را پوشش می‌دهد:` : "",
        ...titles,
        "",
        "می‌توانید سؤال خود را دقیق‌تر بپرسید یا از کادر جستجو استفاده کنید.",
      ]
        .filter(Boolean)
        .join("\n");
    }

    const sentences = splitSentences(passage.text).slice(0, 4);
    const body = sentences.length > 0 ? sentences.join(" ") : truncate(passage.text, 400);

    const related =
      context.related.length > 0
        ? ["", "درس‌های مرتبط:", ...context.related.slice(0, 3).map((item) => `• ${item.title}`)]
        : [];

    return [`**${passage.heading}**`, "", body, ...related].join("\n");
  }
}

// ─────────────────────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────────────────────

/** Builds the provider from the stored chatbot configuration. */
export function resolveAIProvider(settings: ChatbotSettings): AIProvider {
  if (settings.provider === "local") return new LocalKnowledgeProvider();

  const gapgpt = new GapGPTProvider({
    id: "gapgpt",
    label: "GapGPT",
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    apiStyle: settings.apiStyle,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    systemPrompt: settings.systemPrompt,
    lessonContextChars: settings.lessonContextChars,
  });

  if (gapgpt.isConfigured()) return gapgpt;

  // An explicitly chosen GapGPT that is missing its key or model falls back to
  // the offline assistant rather than failing the request, but the reason is
  // logged so a misconfiguration stays visible.
  if (settings.provider === "gapgpt") {
    logError("ai:provider", new Error("GapGPT کامل تنظیم نشده است؛ حالت آفلاین استفاده می‌شود."));
  }

  return new LocalKnowledgeProvider();
}

/** Which services are currently usable — surfaced in the admin panel. */
export function describeAIConfiguration(settings: ChatbotSettings) {
  const gapgptConfigured = Boolean(settings.baseUrl && settings.apiKey && settings.model);

  return {
    services: [
      { id: "gapgpt", label: "GapGPT", configured: gapgptConfigured },
      { id: "local", label: "دستیار داخلی (بدون کلید)", configured: true },
    ],
    /** What the assistant will actually use right now. */
    active: resolveAIProvider(settings).id,
    anyRemoteConfigured: gapgptConfigured,
  };
}
