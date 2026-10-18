"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getIcon } from "@/components/icon";
import { highlightSegments } from "@/lib/search/highlight";
import { cn } from "@/lib/utils";

type Suggestion = {
  id: string;
  type: "module" | "chapter" | "lesson" | "faq";
  label: string;
  href: string;
  context: string | null;
};

/**
 * One shape for every row in the suggestion list, so the keyboard navigation
 * and rendering logic do not have to narrow a union on every access.
 */
type SuggestionRow = {
  kind: "recent" | "popular" | "suggestion";
  id: string;
  label: string;
  href: string;
  context: string | null;
  /** Present on real results, used for the row's icon and type label. */
  type?: Suggestion["type"];
};

const RECENT_KEY = "icdl-recent-searches";

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(query: string) {
  try {
    const next = [query, ...readRecent().filter((item) => item !== query)].slice(0, 6);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable; recent searches are a convenience only.
  }
}

/**
 * Search field.
 *
 * Two modes:
 *
 * - **Standalone** (default) — navigates to `/search?q=…` on submit and shows
 *   as-you-type suggestion links. Used in the header and on the home page.
 * - **Controlled** (when `onQueryChange` is passed) — reports the query upward
 *   and never navigates, so the results panel can refetch over AJAX. The
 *   suggestion dropdown is suppressed in this mode because live results are
 *   already on screen and two overlapping lists would be confusing.
 */
export function SearchBox({
  variant = "header",
  popularSearches = [],
  autoFocus = false,
  className,
  value,
  onQueryChange,
  onNavigate,
  inline = false,
}: {
  variant?: "header" | "hero" | "compact";
  popularSearches?: string[];
  autoFocus?: boolean;
  className?: string;
  value?: string;
  onQueryChange?: (value: string) => void;
  /**
   * Called whenever the box leaves for another page. The header uses it to close
   * its search modal: without it the navigation happened *behind* the still-open
   * dialog, so the only thing the user ever saw was the suggestion list.
   */
  onNavigate?: () => void;
  /**
   * Render the results in normal flow instead of a floating dropdown. Inside the
   * search modal this is what lets the panel grow and shrink with the results
   * instead of pinning a fixed-height list over the page.
   */
  inline?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [internalQuery, setInternalQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const isControlled = typeof onQueryChange === "function";
  const query = value ?? internalQuery;

  const updateQuery = (next: string) => {
    if (isControlled) onQueryChange?.(next);
    else setInternalQuery(next);
  };

  const SearchIcon = getIcon("Search");
  const LoaderIcon = getIcon("RefreshCw");

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Debounced result fetch. Only used in standalone mode — in controlled mode
  // the parent owns the fetching.
  //
  // This deliberately calls `/api/search` (the real search) rather than the
  // typeahead endpoint: the dropdown previously showed "suggestions" only, which
  // is why the site search looked like it never returned results.
  useEffect(() => {
    if (isControlled) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=6`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("search failed");
        const payload = (await response.json()) as {
          result?: { hits?: { id: string; type: string; title: string; href: string; snippet?: string }[] };
        };
        if (!cancelled) {
          setSuggestions(
            (payload.result?.hits ?? []).map((hit) => ({
              id: hit.id,
              type: hit.type as Suggestion["type"],
              label: hit.title,
              href: hit.href,
              context: hit.snippet ?? null,
            })),
          );
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isControlled]);

  // Close on outside click. Skipped in inline mode: the list belongs to the
  // dialog, so clicking anywhere in the dialog must not dismiss it.
  useEffect(() => {
    if (inline) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [inline]);

  const submit = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    writeRecent(trimmed);
    setRecent(readRecent());

    if (isControlled) {
      updateQuery(trimmed);
      setOpen(false);
      return;
    }

    setOpen(false);
    inputRef.current?.blur();
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const items = useMemo<SuggestionRow[]>(() => {
    if (isControlled) return [];

    const showRecent = query.trim().length < 2;
    if (showRecent) {
      return [
        ...recent.map((item) => ({
          kind: "recent" as const,
          label: item,
          href: "",
          context: null,
          id: `r-${item}`,
        })),
        ...popularSearches
          .filter((item) => !recent.includes(item))
          .slice(0, 4)
          .map((item) => ({
            kind: "popular" as const,
            label: item,
            href: "",
            context: null,
            id: `p-${item}`,
          })),
      ];
    }
    return suggestions.map((item) => ({ kind: "suggestion" as const, ...item }));
  }, [query, recent, popularSearches, suggestions, isControlled]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      if (items.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, items.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      if (items.length === 0) return;
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const active = activeIndex >= 0 ? items[activeIndex] : undefined;

      if (active && active.kind === "suggestion") {
        writeRecent(query.trim());
        setOpen(false);
        onNavigate?.();
        router.push(active.href);
        return;
      }
      if (active && active.kind !== "suggestion") {
        submit(active.label);
        return;
      }
      submit(query);
    }
  };

  const isHero = variant === "hero";
  const isCompact = variant === "compact";
  // In the modal the list is part of the panel, so it is always rendered and the
  // panel sizes itself to the results; elsewhere it is a dropdown.
  const listVisible = inline || (open && (items.length > 0 || query.trim().length >= 2));

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit(query);
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          جستجو در درس‌ها و موضوع‌ها
        </label>

        {/*
          Anchored to the input's own height, not `inset-y-0`: in the modal the
          results sit inside this container, so stretching to the container put
          the magnifier halfway down the result list.
        */}
        <span
          className={cn(
            "pointer-events-none absolute start-0 top-0 flex items-center text-muted-foreground",
            isHero ? "h-15 ps-4.5" : isCompact ? "h-11 ps-3.5" : "h-12 ps-3.5",
          )}
        >
          {loading ? (
            <LoaderIcon size={isHero ? 22 : 19} className="animate-spin" />
          ) : (
            <SearchIcon size={isHero ? 22 : 19} />
          )}
        </span>

        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-item-${activeIndex}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={
            isCompact
              ? "جستجو…"
              : "چه چیزی می‌خواهید یاد بگیرید؟ مثلاً «فرمول SUM» یا «نیم‌فاصله»"
          }
          onChange={(event) => {
            const next = event.target.value;
            updateQuery(next);
            setOpen(true);
            setActiveIndex(-1);

            if (isControlled) return;

            // Below the suggestion threshold there is nothing to fetch, so the
            // previous results are cleared here instead of inside the effect.
            if (next.trim().length < 2) {
              setSuggestions([]);
              setLoading(false);
            } else {
              setLoading(true);
            }
          }}
          onFocus={() => {
            if (isControlled) return;
            setRecent(readRecent());
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full rounded-2xl border border-border bg-card text-start transition-colors",
            "placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--primary-ring)]",
            isHero
              ? "h-15 ps-13 pe-4 text-base shadow-[var(--shadow-card)]"
              : isCompact
                ? "h-11 ps-11 pe-4 text-sm"
                : "h-12 ps-11 pe-4 text-sm",
          )}
        />
      </form>

      {listVisible ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="نتایج جستجو"
          className={cn(
            "overflow-y-auto p-1.5",
            inline
              ? "mt-3 max-h-[min(52dvh,26rem)] rounded-2xl border border-border bg-card-muted/50"
              : "absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 max-h-80 rounded-2xl border border-border bg-card shadow-[var(--shadow-raised)]",
          )}
        >
          {items.map((item, index) => (
            <li key={item.id} id={`${listId}-item-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  if (item.kind === "suggestion") {
                    writeRecent(query.trim());
                    setOpen(false);
                    onNavigate?.();
                    router.push(item.href);
                  } else {
                    submit(item.label);
                  }
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                  index === activeIndex ? "bg-muted" : "hover:bg-muted",
                )}
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Glyph name={rowIcon(item)} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    <Highlighted text={item.label} query={item.kind === "suggestion" ? query : ""} />
                  </span>
                  {item.context ? (
                    <span className="mt-0.5 line-clamp-2 block text-[0.6875rem] leading-relaxed text-subtle-foreground">
                      {item.context}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[0.625rem] text-subtle-foreground">
                  {rowLabel(item)}
                </span>
              </button>
            </li>
          ))}

          {items.length === 0 && !loading ? (
            <li className="px-3 py-4 text-center text-xs text-muted-foreground">
              نتیجه‌ای پیدا نشد. عبارت دیگری را امتحان کنید.
            </li>
          ) : null}

          {/* Escapes the panel for the full results page, so this list can stay
              short without the user wondering where the rest went. */}
          {query.trim().length >= 2 ? (
            <li className="mt-1 border-t border-border pt-1">
              <button
                type="button"
                onClick={() => submit(query)}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
              >
                دیدن همه نتایج برای «{query.trim()}»
                <Glyph name="ArrowLeft" />
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  return (
    <>
      {highlightSegments(text, query).map((segment, index) =>
        segment.match ? (
          <mark key={index} className="rounded bg-primary-soft px-0.5 text-primary">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

function Glyph({ name }: { name: string }) {
  const Icon = getIcon(name);
  return <Icon size={15} aria-hidden="true" />;
}

/** The icon that best describes a row, so results are scannable at a glance. */
function rowIcon(item: SuggestionRow): string {
  if (item.kind === "recent") return "Clock";
  if (item.kind === "popular") return "TrendingUp";
  if (item.type === "module") return "BookOpen";
  if (item.type === "chapter") return "FolderTree";
  if (item.type === "faq") return "HelpCircle";
  return "FileText";
}

/** The kind of thing a row is, shown as a small pill. */
function rowLabel(item: SuggestionRow): string {
  if (item.kind === "recent") return "اخیر";
  if (item.kind === "popular") return "پرتکرار";
  if (item.type === "module") return "ماژول";
  if (item.type === "chapter") return "فصل";
  if (item.type === "faq") return "پرسش";
  return "درس";
}
