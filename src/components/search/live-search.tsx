"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { getIcon } from "@/components/icon";
import { SearchBox } from "@/components/search/search-box";
import { Badge, ButtonLink, EmptyState, Skeleton } from "@/components/ui/primitives";
import { highlightSegments } from "@/lib/search/highlight";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

/**
 * Live search.
 *
 * Keeps the server-rendered results for the initial query (so the page is
 * shareable, indexable and useful before hydration), then takes over and
 * refetches over AJAX as the learner types or changes the filter. The URL is
 * updated with `replaceState` so the address bar stays in sync without a full
 * navigation, and stale responses are discarded by comparing the request token.
 */

export type SearchHitView = {
  id: string;
  type: "module" | "chapter" | "lesson" | "faq";
  title: string;
  href: string;
  moduleTitle: string | null;
  chapterTitle: string | null;
  snippet: string;
  matchedTokens: string[];
  score: number;
};

export type SearchResultView = {
  query: string;
  hits: SearchHitView[];
  total: number;
  tookMs: number;
  suggestions: { label: string; href: string }[];
};

const TYPE_LABELS: Record<SearchHitView["type"], string> = {
  lesson: "درس‌ها",
  module: "ماژول‌ها",
  chapter: "فصل‌ها",
  faq: "پرسش‌های پرتکرار",
};

const TYPE_ICONS: Record<SearchHitView["type"], string> = {
  lesson: "FileText",
  module: "BookOpen",
  chapter: "FolderTree",
  faq: "HelpCircle",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "همه" },
  { value: "lesson", label: "درس‌ها" },
  { value: "module", label: "ماژول‌ها" },
  { value: "faq", label: "پرسش‌ها" },
  { value: "chapter", label: "فصل‌ها" },
];

const DEBOUNCE_MS = 260;

export function LiveSearch({
  initialQuery,
  initialResult,
  initialType,
  popularSearches,
}: {
  initialQuery: string;
  initialResult: SearchResultView | null;
  initialType: string;
  popularSearches: string[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialType);
  const [result, setResult] = useState<SearchResultView | null>(initialResult);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  // Monotonic token: only the newest request is allowed to write state.
  const requestId = useRef(0);
  const skipFirst = useRef(true);

  /* eslint-disable react-hooks/set-state-in-effect -- one-shot hydration from browser storage */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("icdl-recent-searches");
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) {
        setRecent(parsed.filter((item): item is string => typeof item === "string"));
      }
    } catch {
      // Recent searches are a convenience; ignore unavailable storage.
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const remember = useCallback((term: string) => {
    const value = term.trim();
    if (value.length < 2) return;
    try {
      const raw = window.localStorage.getItem("icdl-recent-searches");
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const list = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
      const next = [value, ...list.filter((item) => item !== value)].slice(0, 6);
      window.localStorage.setItem("icdl-recent-searches", JSON.stringify(next));
      setRecent(next);
    } catch {
      // Ignore write failures.
    }
  }, []);

  // AJAX fetch, debounced, with the initial render skipped so the page does not
  // immediately refetch the results the server already provided.
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    const trimmed = query.trim();

    if (trimmed.length === 0) {
      // Clearing the results for an empty query is a single reset, not a cascade.
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the query is emptied */
      setResult(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    const token = (requestId.current += 1);
    setLoading(true);
    setFailed(false);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed, limit: "24" });
        if (type) params.set("type", type);

        const response = await fetch(`/api/search?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("search failed");

        const payload = (await response.json()) as { ok: boolean; result?: SearchResultView };
        if (token !== requestId.current) return; // A newer query won.

        setResult(payload.result ?? null);
        if (payload.result && payload.result.total > 0) remember(trimmed);
      } catch {
        if (token === requestId.current) setFailed(true);
      } finally {
        if (token === requestId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, type, remember]);

  // Keep the address bar shareable without a navigation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (type) params.set("type", type);
    const next = params.toString() ? `/search?${params.toString()}` : "/search";
    window.history.replaceState(null, "", next);
  }, [query, type]);

  const grouped = result
    ? (["lesson", "module", "chapter", "faq"] as SearchHitView["type"][])
        .map((hitType) => ({ type: hitType, hits: result.hits.filter((hit) => hit.type === hitType) }))
        .filter((group) => group.hits.length > 0)
    : [];

  const hasQuery = query.trim().length > 0;

  return (
    <div>
      <SearchBox
        variant="hero"
        popularSearches={popularSearches}
        autoFocus={!initialQuery}
        value={query}
        onQueryChange={setQuery}
      />

      {/* Filters */}
      {hasQuery ? (
        <nav aria-label="فیلتر نتایج" className="mt-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => {
            const active = filter.value === type;
            return (
              <button
                key={filter.value || "all"}
                type="button"
                onClick={() => setType(filter.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-primary hover:text-primary",
                )}
              >
                {filter.label}
              </button>
            );
          })}

          {result && !loading ? (
            <span className="ms-auto text-xs text-subtle-foreground">
              {toPersianDigits(result.total)} نتیجه
              <span className="ms-1.5 opacity-70">({toPersianDigits(result.tookMs)} میلی‌ثانیه)</span>
            </span>
          ) : null}
        </nav>
      ) : null}

      <div className="mt-6" aria-live="polite" aria-busy={loading}>
        {/* Loading */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="stack-card p-4">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-2.5 h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))}
          </div>
        ) : null}

        {/* Failure */}
        {failed && !loading ? (
          <EmptyState
            icon="TriangleAlert"
            title="جستجو انجام نشد"
            description="ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید."
          >
            <button
              type="button"
              onClick={() => setQuery((current) => `${current} `.trim())}
              className="mt-2 inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm hover:bg-muted"
            >
              تلاش دوباره
            </button>
          </EmptyState>
        ) : null}

        {/* No results */}
        {!loading && !failed && result && result.total === 0 ? (
          <EmptyState
            icon="Search"
            title="موضوع موردنظر پیدا نشد."
            description="شاید عبارت دیگری بهتر جواب دهد. می‌توانید کلمه‌های کمتری بنویسید یا از موضوع‌های پیشنهادی زیر شروع کنید."
          >
            <div className="mt-2 w-full space-y-4 text-start">
              <div>
                <p className="mb-2 text-xs font-bold text-muted-foreground">جستجوهای پرتکرار</p>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.slice(0, 6).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setQuery(item)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-primary hover:text-primary"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {result.suggestions.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-bold text-muted-foreground">درس‌های پیشنهادی</p>
                  <ul className="flex flex-col gap-2">
                    {result.suggestions.map((suggestion) => (
                      <li key={suggestion.href}>
                        <Link
                          href={suggestion.href}
                          className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:border-primary/40"
                        >
                          <span className="font-medium">{suggestion.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/course" variant="outline" size="sm">
                  فهرست کامل دوره
                </ButtonLink>
                <ButtonLink href="/help" variant="ghost" size="sm">
                  دیدن پرسش‌های پرتکرار
                </ButtonLink>
              </div>
            </div>
          </EmptyState>
        ) : null}

        {/* Results */}
        {!loading && !failed && grouped.length > 0
          ? grouped.map((group) => (
              <section key={group.type} className="mb-7">
                <div className="mb-3 flex items-center gap-2">
                  <GroupIcon type={group.type} />
                  <h2 className="text-sm font-bold sm:text-base">{TYPE_LABELS[group.type]}</h2>
                  <Badge tone="outline" size="sm">
                    {toPersianDigits(group.hits.length)}
                  </Badge>
                </div>

                <ul className="flex flex-col gap-2.5">
                  {group.hits.map((hit) => (
                    <li key={`${hit.type}-${hit.id}`}>
                      <Link
                        href={hit.href}
                        onClick={() => remember(query)}
                        className="stack-card block p-4 transition-shadow hover:shadow-[var(--shadow-raised)]"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Badge tone="outline" size="sm">
                            {TYPE_LABELS[hit.type]}
                          </Badge>
                          {hit.moduleTitle ? (
                            <span className="text-[0.6875rem] text-subtle-foreground">
                              {hit.moduleTitle}
                              {hit.chapterTitle ? ` › ${hit.chapterTitle}` : ""}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-1.5 text-sm font-bold sm:text-base">
                          <Highlight text={hit.title} query={query} />
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          <Highlight text={hit.snippet} query={query} />
                        </p>
                        <span className="mt-2 block text-[0.6875rem] font-medium text-primary">
                          رفتن به این درس ←
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          : null}

        {/* Idle state */}
        {!hasQuery && !loading ? (
          <div className="space-y-6">
            {recent.length > 0 ? (
              <section>
                <h2 className="mb-3 text-sm font-bold">جستجوهای اخیر شما</h2>
                <div className="flex flex-wrap gap-2">
                  {recent.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setQuery(item)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <ClockGlyph />
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="mb-3 text-sm font-bold">جستجوهای پرطرفدار</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {popularSearches.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setQuery(item)}
                    className="rounded-xl border border-border px-4 py-3 text-start text-sm transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  return (
    <>
      {highlightSegments(text, query).map((segment, index) =>
        segment.match ? (
          <mark key={index} className="rounded bg-primary-soft px-0.5 font-medium text-primary">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

function GroupIcon({ type }: { type: SearchHitView["type"] }) {
  const Icon = getIcon(TYPE_ICONS[type]);
  return <Icon size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />;
}

function ClockGlyph() {
  const Icon = getIcon("Clock");
  return <Icon size={13} aria-hidden="true" />;
}
