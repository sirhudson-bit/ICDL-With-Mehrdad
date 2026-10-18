import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { buildSnippet, highlightSegments, matchesAllTokens } from "@/lib/search/highlight";
import { normalizePersian, meaningfulTokens } from "@/lib/persian";
import { getSettings } from "@/services/settings-service";

/**
 * Search.
 *
 * The interface below is the seam that keeps the application independent of the
 * search backend: today a PostgreSQL/SQLite-backed provider (efficient thanks
 * to the normalised `searchText` columns on modules, chapters, lessons and
 * FAQs), and later a dedicated engine such as Meilisearch can be added by
 * implementing the same interface and flipping the admin setting.
 */

export type SearchHitType = "module" | "chapter" | "lesson" | "faq";

export type SearchHit = {
  id: string;
  type: SearchHitType;
  title: string;
  href: string;
  moduleTitle: string | null;
  chapterTitle: string | null;
  snippet: string;
  matchedTokens: string[];
  score: number;
};

export type SearchResult = {
  query: string;
  normalizedQuery: string;
  hits: SearchHit[];
  total: number;
  tookMs: number;
  provider: string;
  /** Present when the query produced no hits, so the UI can still be helpful. */
  suggestions: { label: string; href: string }[];
};

export type SearchSuggestion = {
  id: string;
  type: SearchHitType;
  label: string;
  href: string;
  context: string | null;
};

export type SearchOptions = {
  types?: SearchHitType[];
  limit?: number;
  offset?: number;
};

export interface SearchProvider {
  readonly id: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult>;
  suggest(query: string, limit?: number): Promise<SearchSuggestion[]>;
}

// ─────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────

/**
 * How well a single token matches a piece of text.
 *
 * Whole-word matching matters in Persian: "ورد" (Word) is a substring of
 * "ورود", "آوردن", "کیبورد" and "رکورد", so substring-only matching made the
 * top results for a Word search pages about keyboards and logins. 2 = the token
 * is a whole word, 1 = it begins a longer word ("فشرده" in "فشرده‌سازی"), and
 * 0 = incidental substring.
 */
function matchStrength(words: string[], token: string): 0 | 1 | 2 {
  if (words.includes(token)) return 2;
  if (token.length >= 3 && words.some((word) => word.startsWith(token))) return 1;
  return 0;
}

function scoreHit(input: {
  title: string;
  body: string;
  tokens: string[];
  type: SearchHitType;
}): { score: number; matched: string[]; strongMatches: number } {
  const normalizedTitle = normalizePersian(input.title);
  const normalizedBody = normalizePersian(input.body);
  const titleWords = normalizedTitle.split(" ").filter(Boolean);
  const bodyWords = normalizedBody.split(" ").filter(Boolean);

  let score = 0;
  let strongMatches = 0;
  const matched: string[] = [];

  for (const token of input.tokens) {
    if (token.length < 2) continue;

    const titleStrength = matchStrength(titleWords, token);
    const bodyStrength = matchStrength(bodyWords, token);

    if (titleStrength === 2) {
      score += 12;
      strongMatches += 1;
    } else if (titleStrength === 1) {
      score += 8;
      strongMatches += 1;
    } else if (bodyStrength === 2) {
      score += 6;
      strongMatches += 1;
    } else if (bodyStrength === 1) {
      score += 4;
      strongMatches += 1;
    } else if (normalizedTitle.includes(token)) {
      score += 2;
    } else if (normalizedBody.includes(token)) {
      // Incidental substring only — deliberately worth almost nothing so these
      // results fall below the relevance floor below.
      score += 1;
    } else {
      continue;
    }

    matched.push(token);
  }

  // An exact title match is the strongest possible signal.
  if (input.tokens.length > 0 && normalizedTitle === input.tokens.join(" ")) score += 25;

  // Type priority is a tie-breaker, not a ranking signal: it must stay smaller
  // than a single body match or it would outrank relevance.
  score += { lesson: 2, module: 2, chapter: 1, faq: 1 }[input.type];

  return { score, matched, strongMatches };
}

/**
 * Minimum relevance for a hit to be shown.
 *
 * At least one query token must match as a whole word or a word prefix; a page
 * that merely contains the letters somewhere is noise, not a search result.
 */
const RELEVANCE_FLOOR = 1;

// ─────────────────────────────────────────────────────────────
// Database-backed provider
// ─────────────────────────────────────────────────────────────

class DatabaseSearchProvider implements SearchProvider {
  readonly id = "database";

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const startedAt = Date.now();
    const normalizedQuery = normalizePersian(query);
    // Function words are dropped so a natural-language question
    // ("چگونه در ورد جدول بسازم؟") matches like its keywords ("ورد جدول").
    const tokens = meaningfulTokens(query);
    const limit = options.limit ?? 20;
    const types = options.types ?? ["module", "chapter", "lesson", "faq"];

    if (tokens.length === 0) {
      return {
        query,
        normalizedQuery,
        hits: [],
        total: 0,
        tookMs: Date.now() - startedAt,
        provider: this.id,
        suggestions: await this.fallbackSuggestions(),
      };
    }

    // Every token must appear in the normalised haystack.
    const tokenFilter = tokens.map((token) => ({ searchText: { contains: token } }));

    const [modules, chapters, lessons, faqs] = await Promise.all([
      types.includes("module")
        ? prisma.module.findMany({
            where: { isPublished: true, AND: tokenFilter },
            select: { id: true, slug: true, number: true, title: true, description: true, searchText: true },
            take: limit * 2,
          })
        : Promise.resolve([]),
      types.includes("chapter")
        ? prisma.chapter.findMany({
            where: { isPublished: true, AND: tokenFilter, module: { isPublished: true } },
            select: {
              id: true,
              slug: true,
              title: true,
              description: true,
              searchText: true,
              module: { select: { slug: true, title: true } },
            },
            take: limit * 2,
          })
        : Promise.resolve([]),
      types.includes("lesson")
        ? prisma.lesson.findMany({
            where: {
              isPublished: true,
              AND: tokenFilter,
              chapter: { isPublished: true, module: { isPublished: true } },
            },
            select: {
              id: true,
              slug: true,
              title: true,
              summary: true,
              searchText: true,
              chapter: {
                select: { title: true, module: { select: { slug: true, title: true } } },
              },
            },
            take: limit * 2,
          })
        : Promise.resolve([]),
      types.includes("faq")
        ? prisma.faq.findMany({
            where: { isPublished: true, AND: tokenFilter },
            select: {
              id: true,
              question: true,
              answer: true,
              searchText: true,
              lesson: {
                select: {
                  slug: true,
                  title: true,
                  chapter: { select: { module: { select: { slug: true } } } },
                },
              },
            },
            take: limit * 2,
          })
        : Promise.resolve([]),
    ]);

    const hits: SearchHit[] = [];

    for (const courseModule of modules) {
      const { score, matched, strongMatches } = scoreHit({
        title: courseModule.title,
        body: courseModule.description,
        tokens,
        type: "module",
      });
      if (matched.length === 0 || strongMatches < RELEVANCE_FLOOR) continue;
      hits.push({
        id: courseModule.id,
        type: "module",
        title: courseModule.title,
        href: `/course/${courseModule.slug}`,
        moduleTitle: courseModule.title,
        chapterTitle: null,
        snippet: buildSnippet(courseModule.description, query),
        matchedTokens: matched,
        score,
      });
    }

    for (const chapter of chapters) {
      const body = chapter.description ?? "";
      const { score, matched, strongMatches } = scoreHit({
        title: chapter.title,
        body: `${body} ${chapter.module.title}`,
        tokens,
        type: "chapter",
      });
      if (matched.length === 0 || strongMatches < RELEVANCE_FLOOR) continue;
      hits.push({
        id: chapter.id,
        type: "chapter",
        title: chapter.title,
        href: `/course/${chapter.module.slug}`,
        moduleTitle: chapter.module.title,
        chapterTitle: chapter.title,
        snippet: buildSnippet(body || chapter.title, query),
        matchedTokens: matched,
        score,
      });
    }

    for (const lesson of lessons) {
      const { score, matched, strongMatches } = scoreHit({
        title: lesson.title,
        body: `${lesson.summary} ${lesson.searchText}`,
        tokens,
        type: "lesson",
      });
      if (matched.length === 0 || strongMatches < RELEVANCE_FLOOR) continue;
      hits.push({
        id: lesson.id,
        type: "lesson",
        title: lesson.title,
        href: `/course/${lesson.chapter.module.slug}/${lesson.slug}`,
        moduleTitle: lesson.chapter.module.title,
        chapterTitle: lesson.chapter.title,
        snippet: buildSnippet(lesson.summary, query),
        matchedTokens: matched,
        score,
      });
    }

    for (const faq of faqs) {
      const { score, matched, strongMatches } = scoreHit({
        title: faq.question,
        body: faq.answer,
        tokens,
        type: "faq",
      });
      if (matched.length === 0 || strongMatches < RELEVANCE_FLOOR) continue;
      hits.push({
        id: faq.id,
        type: "faq",
        title: faq.question,
        // A lesson FAQ needs the module segment to form a real lesson URL, and
        // the anchor must match the id the lesson page actually renders.
        href: faq.lesson
          ? `/course/${faq.lesson.chapter.module.slug}/${faq.lesson.slug}#lesson-faq`
          : "/help",
        moduleTitle: null,
        chapterTitle: faq.lesson?.title ?? null,
        snippet: buildSnippet(stripTags(faq.answer), query),
        matchedTokens: matched,
        score,
      });
    }

    hits.sort((a, b) => b.score - a.score);

    const offset = options.offset ?? 0;
    const paged = hits.slice(offset, offset + limit);

    return {
      query,
      normalizedQuery,
      hits: paged,
      total: hits.length,
      tookMs: Date.now() - startedAt,
      provider: this.id,
      suggestions: hits.length === 0 ? await this.fallbackSuggestions() : [],
    };
  }

  async suggest(query: string, limit = 6): Promise<SearchSuggestion[]> {
    // Function words are dropped so a natural-language question
    // ("چگونه در ورد جدول بسازم؟") matches like its keywords ("ورد جدول").
    const tokens = meaningfulTokens(query);
    if (tokens.length === 0) return [];

    const tokenFilter = tokens.map((token) => ({ searchText: { contains: token } }));

    const [modules, lessons] = await Promise.all([
      prisma.module.findMany({
        where: { isPublished: true, AND: tokenFilter },
        select: { id: true, slug: true, number: true, title: true },
        take: limit,
        orderBy: { order: "asc" },
      }),
      prisma.lesson.findMany({
        where: {
          isPublished: true,
          AND: tokenFilter,
          chapter: { isPublished: true, module: { isPublished: true } },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          chapter: { select: { title: true, module: { select: { slug: true, title: true } } } },
        },
        take: limit,
      }),
    ]);

    const suggestions: SearchSuggestion[] = [
      ...lessons.map((lesson) => ({
        id: lesson.id,
        type: "lesson" as const,
        label: lesson.title,
        href: `/course/${lesson.chapter.module.slug}/${lesson.slug}`,
        context: `${lesson.chapter.module.title} • ${lesson.chapter.title}`,
      })),
      ...modules.map((courseModule) => ({
        id: courseModule.id,
        type: "module" as const,
        label: courseModule.title,
        href: `/course/${courseModule.slug}`,
        context: "ماژول دوره",
      })),
    ];

    return suggestions.slice(0, limit);
  }

  /** Related destinations and popular lessons to offer when nothing matched. */
  private async fallbackSuggestions(): Promise<{ label: string; href: string }[]> {
    const popular = await prisma.lesson.findMany({
      where: { isPublished: true },
      orderBy: [{ chapter: { module: { order: "asc" } } }, { order: "asc" }],
      take: 4,
      select: { slug: true, title: true, chapter: { select: { module: { select: { slug: true } } } } },
    });

    return popular.map((lesson) => ({
      label: lesson.title,
      href: `/course/${lesson.chapter.module.slug}/${lesson.slug}`,
    }));
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Provider resolution
// ─────────────────────────────────────────────────────────────

let cachedProvider: SearchProvider | null = null;

/**
 * Resolves the configured search provider.
 *
 * `meilisearch` is declared in the settings but not implemented yet; rather
 * than silently returning nothing, it logs the misconfiguration and falls back
 * to the database provider so search keeps working.
 */
export async function getSearchProvider(): Promise<SearchProvider> {
  if (cachedProvider) return cachedProvider;

  const settings = await getSettings("search");

  if (settings.provider === "meilisearch") {
    logError(
      "search:provider",
      new Error(
        "ارائه‌دهنده Meilisearch انتخاب شده اما هنوز پیاده‌سازی نشده است؛ جستجوی پایگاه داده استفاده می‌شود.",
      ),
    );
    cachedProvider = new DatabaseSearchProvider();
    return cachedProvider;
  }

  cachedProvider = new DatabaseSearchProvider();
  return cachedProvider;
}

export async function searchContent(query: string, options?: SearchOptions): Promise<SearchResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return {
      query: "",
      normalizedQuery: "",
      hits: [],
      total: 0,
      tookMs: 0,
      provider: "none",
      suggestions: [],
    };
  }

  const provider = await getSearchProvider();
  return provider.search(trimmed, options);
}

export async function suggestContent(query: string, limit = 6): Promise<SearchSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const provider = await getSearchProvider();
  return provider.suggest(trimmed, limit);
}

/** Records a search so admins can report on the most requested topics. */
export async function recordSearch(
  userId: string | null,
  query: string,
  resultCount: number,
): Promise<void> {
  const trimmed = query.trim().slice(0, 160);
  if (trimmed.length === 0 || !userId) return;

  const settings = await getSettings("search");
  if (!settings.enableHistory) return;

  try {
    await prisma.searchHistory.create({
      data: {
        userId,
        query: trimmed,
        normalizedQuery: normalizePersian(trimmed),
        resultCount,
      },
    });
  } catch (error) {
    // Search must never fail because analytics could not be written.
    logError("search:record", error);
  }
}

export async function getRecentSearches(userId: string, limit = 6) {
  const rows = await prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    distinct: ["normalizedQuery"],
    take: limit,
    select: { query: true, normalizedQuery: true },
  });

  return rows.map((row) => row.query);
}

/** Most frequent search terms across all learners, for the admin dashboard. */
export async function getTopSearches(limit = 8) {
  const grouped = await prisma.searchHistory.groupBy({
    by: ["normalizedQuery"],
    _count: { normalizedQuery: true },
    orderBy: { _count: { normalizedQuery: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const samples = await prisma.searchHistory.findMany({
    where: { normalizedQuery: { in: grouped.map((row) => row.normalizedQuery) } },
    distinct: ["normalizedQuery"],
    select: { normalizedQuery: true, query: true },
  });

  return grouped.map((row) => ({
    query: samples.find((sample) => sample.normalizedQuery === row.normalizedQuery)?.query ?? row.normalizedQuery,
    count: row._count.normalizedQuery,
  }));
}

export { highlightSegments, matchesAllTokens };
