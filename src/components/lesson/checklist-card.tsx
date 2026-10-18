"use client";

import { useEffect, useState } from "react";

import { getIcon } from "@/components/icon";
import { ClientHtml } from "@/components/lesson/client-html";
import { cn } from "@/lib/utils";

/**
 * Practice-task checklist.
 *
 * Learners tick off the practical steps they performed on their own computer.
 * Ticks persist locally so returning to a lesson does not lose the learner's
 * place, and the completion state is announced for screen readers.
 */
export function ChecklistCard({
  title,
  html,
  items,
  storageKey,
}: {
  title: string;
  html: string;
  items: string[];
  storageKey: string;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          // Restoring saved ticks must happen after mount: reading browser
          // storage during render would desynchronise server and client markup.
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from browser storage
          setChecked(new Set(parsed.filter((value): value is number => typeof value === "number")));
        }
      }
    } catch {
      // Local persistence is a convenience; ignore unavailable storage.
    }
    setReady(true);
  }, [storageKey]);

  const toggle = (index: number) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Ignore write failures.
      }
      return next;
    });
  };

  const done = checked.size;
  const total = items.length;
  const allDone = ready && total > 0 && done === total;

  const PenIcon = getIcon("PencilRuler");
  const CheckIcon = getIcon("Check");
  const CircleIcon = getIcon("Circle");

  return (
    <section
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        allDone ? "border-success/30 bg-success-soft" : "border-border bg-card-muted",
      )}
      aria-labelledby={`${storageKey}-title`}
    >
      <header className="flex items-center gap-2.5">
        <span
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-xl",
            allDone ? "bg-success/15 text-success" : "bg-accent-soft text-accent",
          )}
        >
          <PenIcon size={18} aria-hidden="true" />
        </span>
        <h3 id={`${storageKey}-title`} className="text-sm font-bold sm:text-base">
          {title}
        </h3>
        {total > 0 ? (
          <span className="ms-auto text-xs text-muted-foreground tabular-nums">
            {new Intl.NumberFormat("fa-IR").format(done)} از {new Intl.NumberFormat("fa-IR").format(total)}
          </span>
        ) : null}
      </header>

      <ClientHtml html={html} className="mt-3 text-sm" />

      {items.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item, index) => {
            const isChecked = checked.has(index);
            return (
              <li key={`${item}-${index}`}>
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-pressed={isChecked}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-start text-sm transition-colors",
                    isChecked
                      ? "border-success/30 bg-card text-muted-foreground line-through decoration-success/50"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <span className={cn("mt-0.5 shrink-0", isChecked ? "text-success" : "text-border-strong")}>
                    {isChecked ? <CheckIcon size={16} aria-hidden="true" /> : <CircleIcon size={16} aria-hidden="true" />}
                  </span>
                  <span className="flex-1 leading-relaxed">{item}</span>
                  <span className="sr-only">{isChecked ? "انجام شد" : "انجام نشده"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {allDone ? (
        <p className="mt-3 text-xs font-bold text-success" role="status">
          آفرین! همه تمرین‌های این بخش را انجام دادید.
        </p>
      ) : null}
    </section>
  );
}
