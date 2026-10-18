"use client";

import { useEffect, useMemo, useState } from "react";

import { getIcon } from "@/components/icon";
import { ClientHtml } from "@/components/lesson/client-html";
import { Button, Progress } from "@/components/ui/primitives";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

export type StepItem = {
  title: string;
  html: string;
  imageUrl?: string;
  tip?: string;
};

/**
 * Guided step-by-step walkthrough.
 *
 * Practical tasks are broken into one action per screen so a beginner is never
 * asked to hold several instructions in mind at once. Progress through the
 * steps is kept locally, and the learner confirms each step with "انجام شد".
 */
export function StepViewer({
  title,
  steps,
  storageKey,
}: {
  title: string;
  steps: StepItem[];
  storageKey: string;
}) {
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  const total = steps.length;
  const allDone = ready && total > 0 && done.size === total;

  // Restoring saved step progress has to happen after mount: browser storage is
  // not available during server rendering, so doing it in render would produce
  // mismatched markup. The updates below settle in a single pass.
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot hydration from browser storage */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${storageKey}-done`);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const indices = parsed.filter((value): value is number => typeof value === "number");
          setDone(new Set(indices));
          const nextUnfinished = steps.findIndex((_, index) => !indices.includes(index));
          setCurrent(nextUnfinished === -1 ? Math.max(0, steps.length - 1) : nextUnfinished);
        }
      }
    } catch {
      // Ignore unavailable storage.
    }
    setReady(true);
    // Only re-run when the step set changes.
  }, [storageKey, steps]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = (next: Set<number>) => {
    try {
      window.localStorage.setItem(`${storageKey}-done`, JSON.stringify([...next]));
    } catch {
      // Ignore write failures.
    }
  };

  const markDone = () => {
    const next = new Set(done);
    next.add(current);
    setDone(next);
    persist(next);
    if (current < total - 1) setCurrent(current + 1);
  };

  const isCurrentDone = done.has(current);

  const completionPercent = useMemo(
    () => (total === 0 ? 0 : Math.round((done.size / total) * 100)),
    [done.size, total],
  );

  if (total === 0) return null;

  const CheckIcon = getIcon("Check");
  const ListIcon = getIcon("ListOrdered");
  const step = steps[current] ?? steps[0]!;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
      aria-labelledby={`${storageKey}-heading`}
    >
      <header className="border-b border-border bg-card-muted px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ListIcon size={18} aria-hidden="true" />
          </span>
          <h3 id={`${storageKey}-heading`} className="text-sm font-bold sm:text-base">
            {title}
          </h3>
          <span className="ms-auto rounded-full bg-card px-2.5 py-1 text-xs font-bold tabular-nums text-muted-foreground">
            مرحله {toPersianDigits(current + 1)} از {toPersianDigits(total)}
          </span>
        </div>
        <Progress className="mt-3" value={completionPercent} tone={allDone ? "success" : "primary"} />
      </header>

      <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_13rem]">
        {/* Step list */}
        <div className="order-2 border-t border-border p-4 sm:order-1 sm:border-t-0 sm:border-e sm:p-5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              {toPersianDigits(current + 1)}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold sm:text-base">{step.title}</h4>
              <ClientHtml html={step.html} className="mt-2 text-sm sm:text-[0.9375rem]" />

              {step.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL with unknown dimensions
                <img
                  src={step.imageUrl}
                  alt={`تصویر مرحله ${toPersianDigits(current + 1)}`}
                  loading="lazy"
                  decoding="async"
                  className="mt-3 w-full rounded-xl border border-border"
                />
              ) : null}

              {step.tip ? (
                <p className="mt-3 rounded-xl border border-accent/25 bg-accent-soft px-3 py-2 text-xs leading-relaxed text-foreground">
                  <span className="font-bold">نکته: </span>
                  {step.tip}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant={isCurrentDone ? "secondary" : "primary"} onClick={markDone}>
              {isCurrentDone ? (
                <>
                  <CheckIcon size={16} aria-hidden="true" />
                  انجام شده
                </>
              ) : (
                "انجام شد"
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrent((index) => Math.max(0, index - 1))}
              disabled={current === 0}
            >
              مرحله قبل
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrent((index) => Math.min(total - 1, index + 1))}
              disabled={current === total - 1}
            >
              مرحله بعد
            </Button>
          </div>

          {allDone ? (
            <p
              className="mt-4 rounded-xl border border-success/30 bg-success-soft px-3 py-2.5 text-sm font-bold text-success"
              role="status"
            >
              همه مراحل را انجام دادید. حالا می‌توانید همین کار را روی کامپیوتر خودتان تمرین کنید.
            </p>
          ) : null}
        </div>

        {/* Step index */}
        <ol className="order-1 max-h-64 overflow-y-auto p-2 sm:order-2 sm:max-h-none" aria-label="فهرست مراحل">
          {steps.map((item, index) => {
            const isDone = done.has(index);
            const isActive = index === current;

            return (
              <li key={`${item.title}-${index}`}>
                <button
                  type="button"
                  onClick={() => setCurrent(index)}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-start text-xs transition-colors",
                    isActive ? "bg-primary-soft font-bold text-primary" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-[0.625rem] font-bold",
                      isDone
                        ? "bg-success text-white"
                        : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isDone ? <CheckIcon size={12} aria-hidden="true" /> : toPersianDigits(index + 1)}
                  </span>
                  <span className="flex-1 leading-relaxed">{item.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
