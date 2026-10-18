/**
 * Persian text utilities.
 *
 * Search, display and input all route through here so that the same
 * normalisation rules are applied everywhere. The rules matter because
 * Persian has multiple Unicode representations for the same visible word:
 * Arabic yeh/kaf versus Persian yeh/kaf, optional diacritics, and the
 * zero-width non-joiner which users type inconsistently.
 */

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;

/** Combining marks: harakat, tashdid, sukun and friends. */
const DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;

const ZWNJ = /\u200C/g;
const ZWJ_AND_BIDI_MARKS = /[\u200D\u200E\u200F\u202A-\u202E\uFEFF]/g;

/**
 * Normalises Persian text for comparison and indexing.
 *
 * - Unifies Arabic and Persian letter variants (ي→ی, ك→ک, ة→ه)
 * - Strips diacritics and tatweel
 * - Treats ZWNJ as a word separator so "می‌روم" and "می روم" both match
 * - Converts Persian and Arabic-Indic digits to ASCII so "۱۲۳" matches "123"
 * - Removes punctuation and collapses whitespace
 */
export function normalizePersian(input: string): string {
  if (!input) return "";

  let text = input.normalize("NFKC");

  // Letter variants
  text = text
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[ةۀ]/g, "ه")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ی")
    .replace(/ﻻ/g, "لا");

  // Digits
  text = text
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));

  // Remove invisible control characters, then treat ZWNJ as a space
  text = text.replace(ZWJ_AND_BIDI_MARKS, "").replace(ZWNJ, " ");
  text = text.replace(DIACRITICS, "");

  // Lowercase Latin, drop punctuation, keep Persian letters, Latin letters,
  // digits and whitespace.
  text = text
    .toLowerCase()
    .replace(/[^\p{Script=Arabic}\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

/** Splits a user query into normalised tokens. */
export function tokenizePersian(query: string): string[] {
  const normalized = normalizePersian(query);
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length > 0);
}

/**
 * Persian function words that carry no topical meaning.
 *
 * Question words matter here: "چگونه" appears in the heading of almost every
 * FAQ, so without this list a question like "چگونه در ورد جدول بسازم؟" matched
 * an unrelated FAQ on the strength of "چگونه" alone — and the search index
 * returned nothing at all, because the same words diluted the match against the
 * lesson that actually covers tables.
 */
export const PERSIAN_STOP_WORDS: ReadonlySet<string> = new Set([
  "و", "یا", "را", "به", "از", "در", "با", "بر", "تا", "که", "هم", "نیز", "اگر", "ولی", "اما",
  "این", "آن", "اینها", "آنها", "اینجا", "آنجا", "چنین", "همان", "همین",
  "من", "ما", "شما", "تو", "او", "ایشان", "خود", "خودم", "خودتان",
  "است", "هست", "بود", "نیست", "بودن", "دارد", "دارم", "دارید", "داشت", "شد", "شده", "شود",
  "می‌شود", "میشود", "می‌کنم", "میکنم", "می‌کنید", "کنم", "کنید", "کن", "کرد", "کردن",
  "چه", "چی", "چیه", "چیست", "چگونه", "چه‌طور", "چطور", "چرا", "کجا", "کی", "کدام", "چند",
  "آیا", "یعنی", "مثل", "مانند", "مثلا", "مثلاً", "برای", "درباره", "مورد", "طور", "جور",
  "لطفا", "لطفاً", "بگو", "بگویید", "بده", "بساز", "بسازم", "بسازیم", "بخواهم", "می‌خواهم",
  "میخواهم", "می‌خواهید", "باید", "نمی", "نه", "بله", "خیلی", "بسیار", "کمی", "فقط", "دیگر",
  "کار", "کاری", "چیز", "چیزی", "کسی", "جایی", "وقتی", "زمانی", "حال", "حالا", "بعد", "قبل",
]);

/** Tokens that carry meaning, with Persian function words removed. */
export function meaningfulTokens(text: string): string[] {
  const tokens = tokenizePersian(text);
  const meaningful = tokens.filter((token) => !PERSIAN_STOP_WORDS.has(token));
  // A query of nothing but function words ("چه چیزی؟") would otherwise become
  // empty and match nothing at all, so the original tokens are kept as a
  // last resort.
  return meaningful.length > 0 ? meaningful : tokens;
}

/** The query reduced to its meaningful words, falling back to the original. */
export function stripPersianStopWords(text: string): string {
  const tokens = tokenizePersian(text);
  const meaningful = tokens.filter((token) => !PERSIAN_STOP_WORDS.has(token));
  return (meaningful.length > 0 ? meaningful : tokens).join(" ").trim();
}

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&rsquo;": "'",
  "&laquo;": "«",
  "&raquo;": "»",
};

/** Removes markup and decodes the entities the rich text editor can produce. */
export function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|td|th)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Builds a search haystack from mixed HTML and plain fragments. */
export function buildSearchText(parts: (string | undefined | null)[]): string {
  return normalizePersian(parts.filter(Boolean).map((part) => stripHtml(String(part))).join(" \n "));
}

// ─────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────

/** Converts ASCII digits in a string to Persian digits. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]!);
}

/** Converts Persian and Arabic-Indic digits in a string to ASCII. */
export function toEnglishDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Formats an integer with Persian digits and a thousands separator. */
export function formatNumber(value: number, options: { decimals?: number } = {}): string {
  const decimals = options.decimals ?? 0;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return toPersianDigits(formatted);
}

/** Formats a percentage, e.g. 42 → "۴۲٪". */
export function formatPercent(value: number): string {
  const rounded = Math.round(value);
  return `${toPersianDigits(rounded)}٪`;
}

/** Human friendly duration, e.g. 75 → "۱ ساعت و ۱۵ دقیقه". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "کمتر از ۱ دقیقه";
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);

  if (hours === 0) return `${toPersianDigits(remaining)} دقیقه`;
  if (remaining === 0) return `${toPersianDigits(hours)} ساعت`;
  return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(remaining)} دقیقه`;
}

let dateFormatter: Intl.DateTimeFormat | null = null;

function getDateFormatter(): Intl.DateTimeFormat {
  if (!dateFormatter) {
    dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return dateFormatter;
}

/** Formats a date in the Persian (Jalali) calendar. */
export function formatPersianDate(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return getDateFormatter().format(date);
  } catch {
    return toPersianDigits(date.toLocaleDateString("en-GB"));
  }
}

/** Short relative time such as "۳ روز پیش". */
export function formatRelativeTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secondsInUnit] of units) {
    if (abs >= secondsInUnit || unit === "second") {
      const value = Math.round(diffSeconds / secondsInUnit);
      try {
        return new Intl.RelativeTimeFormat("fa", { numeric: "auto" }).format(value, unit);
      } catch {
        return formatPersianDate(date);
      }
    }
  }

  return "";
}

/** Truncates text on a word boundary, appending an ellipsis. */
export function truncate(input: string, maxLength = 140): string {
  const text = input.trim();
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}

/**
 * Builds a URL-safe slug that still preserves Persian characters, so admin
 * authored titles produce readable URLs.
 */
export function slugify(input: string): string {
  const base = normalizePersian(input).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return base.slice(0, 80) || `item-${Date.now().toString(36)}`;
}
