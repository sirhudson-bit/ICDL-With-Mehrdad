import { z } from "zod";

/**
 * Persian personal-name validation.
 *
 * A name field that only checked length accepted digits, Latin letters, emoji
 * and punctuation — so "مهرداد123" and "Mehrdad!" were both valid names. The
 * rules here are deliberately strict and shared by every schema that accepts a
 * name (registration, profile edit, admin-created users) so the behaviour
 * cannot drift between them.
 *
 * Allowed: Persian/Arabic letters only, with single spaces between words.
 * Rejected: digits (Persian or Latin), Latin letters, hyphens, any symbol,
 * double spaces, and leading/trailing whitespace.
 */

/** Letters used by Persian, including the Persian-specific forms (پ چ ژ گ ک ی). */
const PERSIAN_LETTERS = "\u0621-\u064A\u066E-\u06D3";

/**
 * A word: Persian letters, with ZWNJ allowed *between* them.
 *
 * ZWNJ (نیم‌فاصله, \u200c) is not punctuation — it is correct Persian spelling
 * inside names like «رضایی‌زاده» and «امیرحسین» — so it must be accepted, but
 * only in the middle of a word: not leading, trailing or doubled.
 */
const PERSIAN_WORD = `[${PERSIAN_LETTERS}]+(?:\\u200c[${PERSIAN_LETTERS}]+)*`;

/** One or more Persian words separated by exactly one space each. */
const PERSIAN_NAME_PATTERN = new RegExp(`^${PERSIAN_WORD}(?: ${PERSIAN_WORD})*$`);

export const PERSIAN_NAME_MESSAGES = {
  required: "نام خود را بنویسید.",
  tooShort: "نام باید حداقل ۲ حرف داشته باشد.",
  tooLong: "نام بیش از حد طولانی است.",
  latinOrDigit: "نام باید فقط با حروف فارسی نوشته شود؛ عدد، حرف انگلیسی و علامت مجاز نیست.",
  spacing: "بین نام و نام خانوادگی فقط یک فاصله بگذارید.",
} as const;

/**
 * Validates a name and returns a Persian message, or null when valid.
 * Exported for client-side use so the form and the server agree exactly.
 */
export function checkPersianName(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) return PERSIAN_NAME_MESSAGES.required;
  if (trimmed.length < 2) return PERSIAN_NAME_MESSAGES.tooShort;
  if (trimmed.length > 80) return PERSIAN_NAME_MESSAGES.tooLong;
  if (/\s{2,}/.test(trimmed)) return PERSIAN_NAME_MESSAGES.spacing;
  if (!PERSIAN_NAME_PATTERN.test(trimmed)) return PERSIAN_NAME_MESSAGES.latinOrDigit;

  return null;
}

/** Zod schema for any name field. */
export const persianNameSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const message = checkPersianName(value);
    if (message) ctx.addIssue({ code: "custom", message });
  });

/** Zod schema for an optional name field (e.g. a contact form). */
export const optionalPersianNameSchema = z
  .union([persianNameSchema, z.literal("")])
  .optional()
  .transform((value) => (value === "" ? undefined : value));
