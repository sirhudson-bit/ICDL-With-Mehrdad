import { normalizePersian, truncate } from "@/lib/persian";

/**
 * Query highlighting.
 *
 * Persian users type inconsistently: `می‌روم` (with a zero-width non-joiner)
 * and `می روم` (with a space) are both common, and digits may be typed in
 * either script. Matching therefore happens on normalised text, while the
 * highlighted output keeps the original characters so nothing looks altered.
 */

export type HighlightSegment = { text: string; match: boolean };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds a pattern where a space in the query also matches a ZWNJ. */
function buildPattern(tokens: string[]): RegExp | null {
  const usable = tokens.map((token) => token.trim()).filter((token) => token.length > 1);
  if (usable.length === 0) return null;

  const body = usable
    .map((token) => escapeRegExp(token).replace(/\\?\s+/g, "[\\s\\u200C]*"))
    .join("|");

  try {
    return new RegExp(`(${body})`, "gi");
  } catch {
    return null;
  }
}

function tokensFor(text: string): string[] {
  return normalizePersian(text).split(" ").filter(Boolean);
}

/** Splits text into matched and unmatched segments for rendering. */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const pattern = buildPattern(tokensFor(query));
  if (!pattern) return [{ text, match: false }];

  const segments: HighlightSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index), match: false });
    }
    segments.push({ text: match[0], match: true });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), match: false });
  }

  return segments.length > 0 ? segments : [{ text, match: false }];
}

/**
 * Extracts a window of text around the first match so search results show the
 * relevant part of a long paragraph rather than its beginning.
 */
export function buildSnippet(text: string, query: string, maxLength = 170): string {
  const pattern = buildPattern(tokensFor(query));
  if (!pattern) return truncate(text, maxLength);

  const match = pattern.exec(text);
  if (!match || match.index === undefined) return truncate(text, maxLength);

  const contextBefore = Math.floor(maxLength / 3);
  const start = Math.max(0, match.index - contextBefore);
  const end = Math.min(text.length, start + maxLength);

  const slice = text.slice(start, end).trim();
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";

  return `${prefix}${slice}${suffix}`;
}

/** True when every query token appears somewhere in the text. */
export function matchesAllTokens(text: string, query: string): boolean {
  const normalized = normalizePersian(text);
  return tokensFor(query).every((token) => normalized.includes(token));
}
