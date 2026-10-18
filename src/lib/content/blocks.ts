import { z } from "zod";

/**
 * Content block contracts.
 *
 * A lesson body is an ordered list of typed blocks. Every block payload is
 * validated with Zod before it is written to the database, so the admin
 * builder, the importer and the seed script all share one source of truth.
 *
 * Client components that only render blocks should import these as types
 * (`import type { ... }`) so Zod stays out of the browser bundle.
 */

// ─────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────

/** Rich text produced by the inline editor. Sanitised on write. */
const html = z.string().trim().max(40_000);
const label = z.string().trim().max(300);

/**
 * A URL a block may point at.
 *
 * These values are rendered straight into `src` and `href` attributes, so a
 * scheme that can execute script is a stored-XSS vector — for administrator-authored
 * content and, just as importantly, for an imported content JSON. Relative paths
 * and scheme-less hostnames (used by the simulated-browser exercises) stay valid;
 * only the executable schemes are refused.
 */
const url = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) => {
      // Browsers ignore whitespace and control characters inside a scheme, so
      // "java\tscript:" must be judged as "javascript:".
      const normalized = value.replace(/[\u0000-\u0020\u007f]+/g, "").toLowerCase();
      return !/^(javascript|data|vbscript|file):/.test(normalized);
    },
    { message: "این نشانی مجاز نیست." },
  );

const toneSchema = z.enum(["info", "success", "warning", "danger", "neutral"]);
export type CalloutTone = z.infer<typeof toneSchema>;

const imageSchema = z.object({
  url,
  alt: label.default(""),
  caption: label.optional(),
});

const idSchema = z.string().trim().min(1).max(120);

// ─────────────────────────────────────────────────────────────
// Block kinds
// ─────────────────────────────────────────────────────────────

export const BLOCK_TYPES = [
  "objectives",
  "heading",
  "text",
  "definition",
  "callout",
  "tip",
  "warning",
  "example",
  "image",
  "gallery",
  "video",
  "table",
  "keyboard",
  "code",
  "steps",
  "practice",
  "exercise",
  "demo",
  "quiz",
  "faq",
  "resource",
  "summary",
  "relatedLessons",
  "divider",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/** Blocks that produce searchable text for the search index. */
export const TEXT_BEARING_BLOCKS: BlockType[] = [
  "objectives",
  "heading",
  "text",
  "definition",
  "callout",
  "tip",
  "warning",
  "example",
  "table",
  "keyboard",
  "code",
  "steps",
  "practice",
  "summary",
  "faq",
  "relatedLessons",
];

// ─────────────────────────────────────────────────────────────
// Exercise payloads (inline, ungraded practice)
// ─────────────────────────────────────────────────────────────

export const EXERCISE_KINDS = [
  "mcq",
  "trueFalse",
  "fillBlank",
  "matching",
  "orderSteps",
  "excelFormula",
  "wordFormat",
  "browserSearch",
  "fileExplorer",
  "emailCompose",
] as const;

export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

const mcqExercise = z.object({
  kind: z.literal("mcq"),
  options: z
    .array(z.object({ id: idSchema, text: label }))
    .min(2)
    .max(8),
  correctOptionId: idSchema,
});

const trueFalseExercise = z.object({
  kind: z.literal("trueFalse"),
  statement: label,
  isTrue: z.boolean(),
});

const fillBlankExercise = z.object({
  kind: z.literal("fillBlank"),
  /** Sentences containing `___` placeholders, one per blank. */
  template: label,
  blanks: z
    .array(
      z.object({
        accepted: z.array(label).min(1),
        hint: label.optional(),
      }),
    )
    .min(1),
  caseSensitive: z.boolean().default(false),
});

const matchingExercise = z.object({
  kind: z.literal("matching"),
  left: z.array(z.object({ id: idSchema, text: label })).min(2).max(8),
  right: z.array(z.object({ id: idSchema, text: label })).min(2).max(8),
  /** [leftId, rightId] */
  pairs: z.array(z.tuple([idSchema, idSchema])).min(2),
});

const orderStepsExercise = z.object({
  kind: z.literal("orderSteps"),
  /** Items are listed in the correct order; the UI shuffles them. */
  items: z.array(z.object({ id: idSchema, text: label })).min(2).max(10),
});

const excelFormulaExercise = z.object({
  kind: z.literal("excelFormula"),
  columns: z.array(label).min(1).max(8),
  /** Cell contents; numbers are numeric cells, strings are text. */
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))).min(1).max(20),
  /** 0-based target cell the learner must fill. */
  targetRow: z.number().int().min(0),
  targetColumn: z.number().int().min(0),
  /** Accepted formulas, normalised before comparison, e.g. "=SUM(A2:A4)". */
  acceptedFormulas: z.array(label).min(1),
  /** Accepted numeric results, as a fallback for learners who compute it manually. */
  acceptedValues: z.array(z.number()).default([]),
});

const wordFormatExercise = z.object({
  kind: z.literal("wordFormat"),
  text: label,
  tasks: z
    .array(
      z.object({
        id: idSchema,
        kind: z.enum([
          "bold",
          "italic",
          "underline",
          "alignRight",
          "alignCenter",
          "bulletList",
          "numberedList",
        ]),
        label,
      }),
    )
    .min(1),
});

const browserSearchExercise = z.object({
  kind: z.literal("browserSearch"),
  /** Results the simulated engine will show. */
  results: z.array(z.object({ title: label, url, snippet: label })).min(1),
  tasks: z
    .array(
      z.object({
        id: idSchema,
        kind: z.enum(["search", "openResult", "bookmark"]),
        label,
        /** For `search`: the query fragment that must appear. */
        match: label.optional(),
        /** For `openResult` / `bookmark`: the 1-based result index. */
        resultIndex: z.number().int().min(1).optional(),
      }),
    )
    .min(1),
});

const fileExplorerExercise = z.object({
  kind: z.literal("fileExplorer"),
  files: z
    .array(
      z.object({
        id: idSchema,
        name: label,
        kind: z.enum(["folder", "document", "image", "archive", "spreadsheet"]),
        sizeKb: z.number().min(0),
        modified: z.string().trim().max(40),
      }),
    )
    .min(2),
  tasks: z
    .array(
      z.object({
        id: idSchema,
        kind: z.enum(["sortName", "sortSize", "select", "copy", "paste", "delete", "newFolder"]),
        label,
        /** Required for `select` / `copy` / `delete`. */
        fileId: idSchema.optional(),
      }),
    )
    .min(1),
});

const emailComposeExercise = z.object({
  kind: z.literal("emailCompose"),
  expected: z.object({
    to: label,
    cc: label.optional(),
    bcc: label.optional(),
    subject: label,
    bodyIncludes: label.optional(),
    attach: z.boolean().default(false),
  }),
  attachments: z.array(z.object({ id: idSchema, name: label })).default([]),
});

export const exerciseSchema = z.discriminatedUnion("kind", [
  mcqExercise,
  trueFalseExercise,
  fillBlankExercise,
  matchingExercise,
  orderStepsExercise,
  excelFormulaExercise,
  wordFormatExercise,
  browserSearchExercise,
  fileExplorerExercise,
  emailComposeExercise,
]);

export type ExerciseData = z.infer<typeof exerciseSchema>;
export type ExerciseKindData<K extends ExerciseKind> = Extract<ExerciseData, { kind: K }>;

// ─────────────────────────────────────────────────────────────
// Demo payloads (explorable, no task)
// ─────────────────────────────────────────────────────────────

export const DEMO_KINDS = [
  "windowsDesktop",
  "fileExplorer",
  "wordEditor",
  "excelSheet",
  "browser",
  "powerPoint",
] as const;

export type DemoKind = (typeof DEMO_KINDS)[number];

export const demoSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("windowsDesktop"),
    hint: label.optional(),
  }),
  z.object({
    kind: z.literal("fileExplorer"),
    folders: z.array(label).default([]),
    files: z.array(label).default([]),
    hint: label.optional(),
  }),
  z.object({
    kind: z.literal("wordEditor"),
    initialText: label.optional(),
    hint: label.optional(),
  }),
  z.object({
    kind: z.literal("excelSheet"),
    columns: z.array(label).default(["A", "B", "C"]),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))).default([]),
    hint: label.optional(),
  }),
  z.object({
    kind: z.literal("browser"),
    address: label.default("www.google.com"),
    results: z.array(z.object({ title: label, url, snippet: label })).default([]),
    hint: label.optional(),
  }),
  z.object({
    kind: z.literal("powerPoint"),
    slides: z
      .array(z.object({ title: label, body: label.optional() }))
      .min(1)
      .max(10),
    hint: label.optional(),
  }),
]);

export type DemoData = z.infer<typeof demoSchema>;

// ─────────────────────────────────────────────────────────────
// Full block payload union
// ─────────────────────────────────────────────────────────────

export const lessonBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("objectives"),
    data: z.object({ title: label.default("در این درس یاد می‌گیرید"), items: z.array(label).min(1) }),
  }),
  z.object({
    type: z.literal("heading"),
    data: z.object({ text: label, level: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2) }),
  }),
  z.object({
    type: z.literal("text"),
    data: z.object({ html }),
  }),
  z.object({
    type: z.literal("definition"),
    data: z.object({ term: label, definition: html, example: label.optional() }),
  }),
  z.object({
    type: z.literal("callout"),
    data: z.object({ tone: toneSchema.default("info"), title: label.optional(), html }),
  }),
  z.object({
    type: z.literal("tip"),
    data: z.object({ title: label.default("نکته"), html }),
  }),
  z.object({
    type: z.literal("warning"),
    data: z.object({ title: label.default("هشدار"), html }),
  }),
  z.object({
    type: z.literal("example"),
    data: z.object({ title: label.default("مثال"), html }),
  }),
  z.object({
    type: z.literal("image"),
    data: imageSchema.extend({ width: z.number().int().positive().optional() }),
  }),
  z.object({
    type: z.literal("gallery"),
    data: z.object({ images: z.array(imageSchema).min(1), columns: z.union([z.literal(2), z.literal(3)]).default(2) }),
  }),
  z.object({
    type: z.literal("video"),
    data: z.object({ url, title: label.optional(), caption: label.optional() }),
  }),
  z.object({
    type: z.literal("table"),
    data: z.object({
      caption: label.optional(),
      headers: z.array(label).min(1),
      rows: z.array(z.array(z.string())).min(1),
    }),
  }),
  z.object({
    type: z.literal("keyboard"),
    data: z.object({
      title: label.default("میان‌برهای کیبورد"),
      shortcuts: z.array(z.object({ keys: z.array(label).min(1), description: label })).min(1),
    }),
  }),
  z.object({
    type: z.literal("code"),
    data: z.object({ code: z.string().max(4000), language: label.default(""), caption: label.optional() }),
  }),
  z.object({
    type: z.literal("steps"),
    data: z.object({
      title: label.default("مرحله به مرحله"),
      steps: z
        .array(
          z.object({
            title: label,
            html,
            imageUrl: url.optional(),
            tip: label.optional(),
          }),
        )
        .min(1),
    }),
  }),
  z.object({
    type: z.literal("practice"),
    data: z.object({
      title: label.default("تمرین کنید"),
      html,
      checklist: z.array(label).default([]),
    }),
  }),
  z.object({
    type: z.literal("exercise"),
    data: z.object({
      title: label.default("تمرین تعاملی"),
      instructions: html,
      maxAttempts: z.number().int().min(1).max(20).default(3),
      exercise: exerciseSchema,
    }),
  }),
  z.object({
    type: z.literal("demo"),
    data: z.object({
      title: label.default("نمایش تعاملی"),
      instructions: html.optional(),
      demo: demoSchema,
    }),
  }),
  z.object({
    type: z.literal("quiz"),
    data: z.object({ title: label.default("آزمون این درس"), anchor: z.boolean().default(true) }),
  }),
  z.object({
    type: z.literal("faq"),
    data: z.object({ title: label.default("پرسش‌های پرتکرار"), items: z.array(z.object({ question: label, answer: html })).min(1) }),
  }),
  z.object({
    type: z.literal("resource"),
    data: z.object({
      title: label.default("فایل‌های تمرین"),
      items: z
        .array(
          z.object({
            label,
            url,
            kind: z.enum(["pdf", "doc", "sheet", "slide", "zip", "link"]).default("link"),
            size: label.optional(),
          }),
        )
        .min(1),
    }),
  }),
  z.object({
    type: z.literal("summary"),
    data: z.object({ title: label.default("خلاصه درس"), html, points: z.array(label).default([]) }),
  }),
  z.object({
    type: z.literal("relatedLessons"),
    data: z.object({ title: label.default("درس‌های مرتبط"), lessonSlugs: z.array(z.string().trim().min(1)).min(1) }),
  }),
  z.object({
    type: z.literal("divider"),
    data: z.object({}).default({}),
  }),
]);

export type LessonBlockPayload = z.infer<typeof lessonBlockSchema>;

/** A block as persisted, with its database identity and position. */
export type LessonBlock = {
  id: string;
  type: BlockType;
  order: number;
  isVisible: boolean;
  data: BlockData;
};

/**
 * Convenience alias: the validated `data` for any block type.
 * Because the payload union is discriminated on `type`, consumers narrow with
 * `block.type === "steps"` and get the correct shape.
 */
export type BlockData = LessonBlockPayload["data"];

/**
 * Maps a block to its data type, so renderers can type a `switch` precisely.
 * `BlockDataOf<'steps'>` resolves to the step-by-step payload.
 */
export type BlockDataOf<T extends BlockType> = Extract<LessonBlockPayload, { type: T }>["data"];

const schemaByType = new Map<string, z.ZodTypeAny>(
  lessonBlockSchema.options.map((option) => [
    (option.shape.type as z.ZodLiteral<string>).value,
    option.shape.data as z.ZodTypeAny,
  ]),
);

export function blockDataSchema(type: string): z.ZodTypeAny | undefined {
  return schemaByType.get(type);
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

/** Validates a block payload, returning Persian-friendly error paths. */
export function validateBlockData<T = BlockData>(
  type: string,
  data: unknown,
): ValidationResult<T> {
  const schema = blockDataSchema(type);
  if (!schema) {
    return { ok: false, errors: [`نوع بلوک «${type}» پشتیبانی نمی‌شود.`] };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }
  return { ok: true, data: parsed.data as T };
}

export function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}

/**
 * Extracts plain text from a block payload, used to build the search index.
 * Rich text is stripped of tags and entities are decoded by the caller's
 * normaliser.
 */
export function blockToSearchText(type: BlockType, data: BlockData): string {
  const anyData = data as Record<string, unknown>;
  const parts: string[] = [];

  const pushText = (value: unknown) => {
    if (typeof value === "string") parts.push(value);
  };

  switch (type) {
    case "objectives":
      parts.push((anyData.title as string) ?? "");
      (anyData.items as string[] | undefined)?.forEach(pushText);
      break;
    case "heading":
      pushText(anyData.text);
      break;
    case "text":
    case "summary":
      pushText(anyData.html);
      pushText(anyData.title);
      (anyData.points as string[] | undefined)?.forEach(pushText);
      break;
    case "definition":
      pushText(anyData.term);
      pushText(anyData.definition);
      pushText(anyData.example);
      break;
    case "callout":
    case "tip":
    case "warning":
    case "example":
    case "practice":
      pushText(anyData.title);
      pushText(anyData.html);
      (anyData.checklist as string[] | undefined)?.forEach(pushText);
      break;
    case "steps":
      pushText(anyData.title);
      (anyData.steps as { title: string; html: string; tip?: string }[] | undefined)?.forEach((step) => {
        pushText(step.title);
        pushText(step.html);
        pushText(step.tip);
      });
      break;
    case "table":
      (anyData.headers as string[] | undefined)?.forEach(pushText);
      (anyData.rows as string[][] | undefined)?.forEach((row) => row.forEach(pushText));
      pushText(anyData.caption);
      break;
    case "keyboard":
      (anyData.shortcuts as { keys: string[]; description: string }[] | undefined)?.forEach((s) => {
        s.keys.forEach(pushText);
        pushText(s.description);
      });
      break;
    case "code":
      pushText(anyData.code);
      pushText(anyData.caption);
      break;
    case "faq":
      (anyData.items as { question: string; answer: string }[] | undefined)?.forEach((item) => {
        pushText(item.question);
        pushText(item.answer);
      });
      break;
    case "resource":
      (anyData.items as { label: string }[] | undefined)?.forEach((item) => pushText(item.label));
      break;
    case "exercise":
      pushText(anyData.title);
      pushText(anyData.instructions);
      break;
    case "demo":
      pushText(anyData.title);
      pushText(anyData.instructions);
      break;
    case "quiz":
      pushText(anyData.title);
      break;
    case "relatedLessons":
      pushText(anyData.title);
      break;
    default:
      break;
  }

  return parts.filter(Boolean).join(" \n ");
}
