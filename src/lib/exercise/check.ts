import type { ExerciseData, ExerciseKind } from "@/lib/content/blocks";
import { normalizePersian, toEnglishDigits } from "@/lib/persian";

/**
 * Exercise checking.
 *
 * Kept free of React so the same rules run on the server (seed validation,
 * admin preview) and in the browser, and so they are easy to reason about:
 * every function is pure and returns the reason a learner got something wrong,
 * which is what makes the feedback useful rather than just "نادرست".
 */

export type ExerciseCheck = {
  correct: boolean;
  /** Persian explanation of what is still missing. */
  detail?: string;
};

/** Answer shapes are deliberately loose; each kind narrows as needed. */
export type ExerciseAnswer = unknown;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) % 100_000;
  }
  return result;
}

/**
 * Deterministic shuffle.
 *
 * A random shuffle would produce different markup on the server and the client,
 * causing a hydration mismatch, so ordering is derived from the item ids.
 */
export function deterministicShuffle<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => hash(a.id) - hash(b.id));
}

function normalizeText(value: string): string {
  return normalizePersian(value);
}

function looseEqual(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

function looseIncludes(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}

/** Formulas are compared ignoring spaces, case and the optional leading `=`. */
function normalizeFormula(value: string): string {
  return toEnglishDigits(value)
    .replace(/\s+/g, "")
    .replace(/^=/, "")
    .toUpperCase()
    .replace(/["'`]/g, "");
}

// ─────────────────────────────────────────────────────────────
// Initial answers
// ─────────────────────────────────────────────────────────────

export function initialAnswer(exercise: ExerciseData): ExerciseAnswer {
  switch (exercise.kind) {
    case "mcq":
      return "";
    case "trueFalse":
      return null;
    case "fillBlank":
      return exercise.blanks.map(() => "");
    case "matching":
      return {} as Record<string, string>;
    case "orderSteps":
      return deterministicShuffle(exercise.items).map((item) => item.id);
    case "excelFormula":
      return "";
    case "wordFormat":
      return {} as Record<string, boolean>;
    case "browserSearch":
      return { query: "", openedIndex: null, bookmarkedIndex: null } as const;
    case "fileExplorer":
      return {
        sort: null,
        selectedId: null,
        clipboardId: null,
        pasted: false,
        deletedIds: [] as string[],
        createdFolder: false,
      };
    case "emailCompose":
      return { to: "", cc: "", subject: "", body: "", attachedIds: [] as string[] };
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Checking
// ─────────────────────────────────────────────────────────────

export function checkExercise(exercise: ExerciseData, answer: ExerciseAnswer): ExerciseCheck {
  switch (exercise.kind) {
    case "mcq": {
      const selected = typeof answer === "string" ? answer : "";
      const correct = selected.length > 0 && selected === exercise.correctOptionId;
      const correctOption = exercise.options.find((option) => option.id === exercise.correctOptionId);
      return {
        correct,
        detail: correct ? undefined : `پاسخ درست «${correctOption?.text ?? ""}» است.`,
      };
    }

    case "trueFalse": {
      const selected = typeof answer === "boolean" ? answer : null;
      if (selected === null) return { correct: false, detail: "یکی از دو گزینه را انتخاب کنید." };
      return {
        correct: selected === exercise.isTrue,
        detail: selected === exercise.isTrue ? undefined : "به جمله دقت کنید و دوباره فکر کنید.",
      };
    }

    case "fillBlank": {
      const values = Array.isArray(answer) ? (answer as string[]) : [];
      const missing: number[] = [];

      exercise.blanks.forEach((blank, index) => {
        const provided = values[index] ?? "";
        const matches = blank.accepted.some((candidate) =>
          exercise.caseSensitive ? candidate.trim() === provided.trim() : looseEqual(candidate, provided),
        );
        if (!matches) missing.push(index + 1);
      });

      return {
        correct: missing.length === 0,
        detail:
          missing.length === 0
            ? undefined
            : `جای خالی ${missing.map((index) => `شماره ${index}`).join("، ")} هنوز درست نیست.`,
      };
    }

    case "matching": {
      const submitted = (answer && typeof answer === "object" ? answer : {}) as Record<string, string>;
      const wrong = exercise.pairs.filter(([leftId, rightId]) => submitted[leftId] !== rightId);
      return {
        correct: wrong.length === 0,
        detail: wrong.length === 0 ? undefined : `${wrong.length} مورد از موارد تطبیق درست نیست.`,
      };
    }

    case "orderSteps": {
      const order = Array.isArray(answer) ? (answer as string[]) : [];
      const expected = exercise.items.map((item) => item.id);
      const isCorrect = order.length === expected.length && order.every((id, index) => id === expected[index]);
      return {
        correct: isCorrect,
        detail: isCorrect ? undefined : "ترتیب مراحل را دوباره بررسی کنید.",
      };
    }

    case "excelFormula": {
      const value = typeof answer === "string" ? answer.trim() : "";
      if (value.length === 0) return { correct: false, detail: "فرمول یا مقدار را در سلول وارد کنید." };

      const normalized = normalizeFormula(value);
      const formulaMatch = exercise.acceptedFormulas.some(
        (candidate) => normalizeFormula(candidate) === normalized,
      );

      if (formulaMatch) return { correct: true };

      const numeric = Number(toEnglishDigits(value).replace(/[^\d.-]/g, ""));
      if (Number.isFinite(numeric) && exercise.acceptedValues.some((expected) => Math.abs(expected - numeric) < 0.001)) {
        return {
          correct: true,
          detail: "نتیجه درست است. برای تمرین بیشتر، همان را با فرمول هم بنویسید.",
        };
      }

      return { correct: false, detail: "فرمول درست کار نمی‌کند. به ساختار و آدرس سلول‌ها دقت کنید." };
    }

    case "wordFormat": {
      const applied = (answer && typeof answer === "object" ? answer : {}) as Record<string, boolean>;
      const missing = exercise.tasks.filter((task) => !applied[task.kind]);
      return {
        correct: missing.length === 0,
        detail: missing.length === 0 ? undefined : `این موارد انجام نشده است: ${missing.map((task) => task.label).join("، ")}`,
      };
    }

    case "browserSearch": {
      const state = (answer && typeof answer === "object" ? answer : {}) as {
        query?: string;
        openedIndex?: number | null;
        bookmarkedIndex?: number | null;
      };

      const missing: string[] = [];

      for (const task of exercise.tasks) {
        if (task.kind === "search") {
          const match = task.match ?? "";
          if (!looseIncludes(state.query ?? "", match)) missing.push(task.label);
        }
        if (task.kind === "openResult") {
          if (state.openedIndex !== task.resultIndex) missing.push(task.label);
        }
        if (task.kind === "bookmark") {
          if (state.bookmarkedIndex !== task.resultIndex) missing.push(task.label);
        }
      }

      return {
        correct: missing.length === 0,
        detail: missing.length === 0 ? undefined : `این کارها باقی مانده است: ${missing.join("، ")}`,
      };
    }

    case "fileExplorer": {
      const state = (answer && typeof answer === "object" ? answer : {}) as {
        sort?: string | null;
        selectedId?: string | null;
        clipboardId?: string | null;
        pasted?: boolean;
        deletedIds?: string[];
        createdFolder?: boolean;
      };

      const missing: string[] = [];

      for (const task of exercise.tasks) {
        switch (task.kind) {
          case "sortName":
            if (state.sort !== "name") missing.push(task.label);
            break;
          case "sortSize":
            if (state.sort !== "size") missing.push(task.label);
            break;
          case "select":
            if (state.selectedId !== task.fileId) missing.push(task.label);
            break;
          case "copy":
            if (state.clipboardId !== task.fileId) missing.push(task.label);
            break;
          case "paste":
            if (!state.pasted || state.clipboardId === null) missing.push(task.label);
            break;
          case "delete":
            if (!state.deletedIds?.includes(task.fileId ?? "")) missing.push(task.label);
            break;
          case "newFolder":
            if (!state.createdFolder) missing.push(task.label);
            break;
          default:
            break;
        }
      }

      return {
        correct: missing.length === 0,
        detail: missing.length === 0 ? undefined : `این کارها باقی مانده است: ${missing.join("، ")}`,
      };
    }

    case "emailCompose": {
      const state = (answer && typeof answer === "object" ? answer : {}) as {
        to?: string;
        cc?: string;
        subject?: string;
        body?: string;
        attachedIds?: string[];
      };

      const missing: string[] = [];

      if (!looseEqual(state.to ?? "", exercise.expected.to)) missing.push("گیرنده (To) درست نیست");
      if (exercise.expected.cc && !looseEqual(state.cc ?? "", exercise.expected.cc)) {
        missing.push("گیرنده رونوشت (CC) درست نیست");
      }
      if (!looseEqual(state.subject ?? "", exercise.expected.subject)) missing.push("موضوع ایمیل درست نیست");
      if (exercise.expected.bodyIncludes && !looseIncludes(state.body ?? "", exercise.expected.bodyIncludes)) {
        missing.push("متن ایمیل باید شامل توضیح خواسته‌شده باشد");
      }
      if (exercise.expected.attach && (state.attachedIds?.length ?? 0) === 0) {
        missing.push("فایل پیوست نشده است");
      }

      return {
        correct: missing.length === 0,
        detail: missing.length === 0 ? undefined : `این موارد مشکل دارد: ${missing.join("، ")}`,
      };
    }

    default:
      return { correct: false };
  }
}

/** Whether the learner has produced enough input for checking to be meaningful. */
export function isAnswerComplete(exercise: ExerciseData, answer: ExerciseAnswer): boolean {
  switch (exercise.kind) {
    case "mcq":
      return typeof answer === "string" && answer.length > 0;
    case "trueFalse":
      return typeof answer === "boolean";
    case "fillBlank":
      return Array.isArray(answer) && (answer as string[]).some((value) => value.trim().length > 0);
    case "matching":
      return Object.keys((answer as Record<string, string>) ?? {}).length > 0;
    case "orderSteps":
      return true;
    case "excelFormula":
      return typeof answer === "string" && answer.trim().length > 0;
    case "wordFormat":
      return Object.values((answer as Record<string, boolean>) ?? {}).some(Boolean);
    default:
      return true;
  }
}

/** The expected answer, shown after the attempt limit is reached. */
export function describeAnswer(exercise: ExerciseData): string {
  switch (exercise.kind) {
    case "mcq":
      return exercise.options.find((option) => option.id === exercise.correctOptionId)?.text ?? "";
    case "trueFalse":
      return exercise.isTrue ? "درست" : "نادرست";
    case "fillBlank":
      return exercise.blanks.map((blank) => blank.accepted[0] ?? "").join(" ، ");
    case "matching":
      return exercise.pairs
        .map(([leftId, rightId]) => {
          const left = exercise.left.find((item) => item.id === leftId)?.text ?? leftId;
          const right = exercise.right.find((item) => item.id === rightId)?.text ?? rightId;
          return `${left} → ${right}`;
        })
        .join(" | ");
    case "orderSteps":
      return exercise.items.map((item, index) => `${index + 1}. ${item.text}`).join(" | ");
    case "excelFormula":
      return exercise.acceptedFormulas[0] ?? "";
    case "wordFormat":
      return exercise.tasks.map((task) => task.label).join("، ");
    case "browserSearch":
      return exercise.tasks.map((task) => task.label).join("، ");
    case "fileExplorer":
      return exercise.tasks.map((task) => task.label).join("، ");
    case "emailCompose":
      return [
        `گیرنده: ${exercise.expected.to}`,
        exercise.expected.cc ? `رونوشت: ${exercise.expected.cc}` : "",
        `موضوع: ${exercise.expected.subject}`,
        exercise.expected.attach ? "همراه با پیوست" : "",
      ]
        .filter(Boolean)
        .join(" | ");
    default:
      return "";
  }
}

export type { ExerciseData, ExerciseKind };
