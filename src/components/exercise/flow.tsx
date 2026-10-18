"use client";

import { useEffect, useState } from "react";

import { ExerciseRunner } from "@/components/exercise/runner";
import { getIcon } from "@/components/icon";
import { Badge, Button, Progress } from "@/components/ui/primitives";
import type { ExerciseData } from "@/lib/content/blocks";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

/**
 * Multi-step exercise flow.
 *
 * Exercises used to be rendered one after another inline in the lesson body, so
 * a lesson with several of them presented a wall of forms at once and there was
 * no sense of progress through them. Here they become a single stepped flow:
 * one exercise visible at a time, with a step counter, a progress bar and
 * previous/next controls.
 *
 * The individual exercise itself is still the existing `ExerciseRunner` — its
 * checking, attempt counting, retry and reveal behaviour are untouched, so this
 * adds sequencing without reimplementing grading.
 *
 * The current step is remembered per lesson, so a refresh resumes in place.
 */
export function ExerciseFlow({
  steps,
  lessonId,
}: {
  steps: { id: string; data: Record<string, unknown> }[];
  lessonId: string;
}) {
  const storageKey = `exercise-flow:${lessonId}`;
  const [current, setCurrent] = useState(0);

  // Resume where the learner left off. Read in an effect so the server and the
  // first client render agree (localStorage is not available while rendering).
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot hydration from browser storage */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { current?: unknown };
      if (typeof parsed.current === "number" && Number.isFinite(parsed.current)) {
        setCurrent(Math.min(Math.max(Math.trunc(parsed.current), 0), Math.max(steps.length - 1, 0)));
      }
    } catch {
      // A missing or corrupt entry just means starting from the first step.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once per lesson
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const goTo = (index: number) => {
    const next = Math.min(Math.max(index, 0), steps.length - 1);
    setCurrent(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ current: next }));
    } catch {
      // Storage being unavailable must not block navigation.
    }
  };

  if (steps.length === 0) return null;

  const step = steps[current]!;
  const data = step.data;
  const title = typeof data.title === "string" && data.title.trim() ? data.title : "تمرین عملی";
  const instructions = typeof data.instructions === "string" ? data.instructions : "";
  const percent = ((current + 1) / steps.length) * 100;

  const ArrowRightIcon = getIcon("ArrowRight");
  const ArrowLeftIcon = getIcon("ArrowLeft");
  const ToolsIcon = getIcon("MousePointerClick");
  const CheckIcon = getIcon("CheckCircle2");

  return (
    <section
      id="exercises"
      aria-label="تمرین‌های عملی این درس"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card"
    >
      {/* Step header */}
      <header className="border-b border-border bg-card-muted px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-bold">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <ToolsIcon size={17} aria-hidden="true" />
            </span>
            تمرین‌های عملی
          </span>
          <Badge tone="primary" size="sm">
            مرحله {toPersianDigits(current + 1)} از {toPersianDigits(steps.length)}
          </Badge>
        </div>

        <Progress className="mt-3" value={percent} tone={current === steps.length - 1 ? "success" : "primary"} />

        {/* Step dots, so the learner can see how many remain and jump back */}
        <ol className="mt-3 flex flex-wrap items-center gap-1.5">
          {steps.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => goTo(index)}
                aria-label={`مرحله ${toPersianDigits(index + 1)}`}
                aria-current={index === current ? "step" : undefined}
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-lg text-[0.6875rem] font-bold transition-colors",
                  index === current
                    ? "bg-primary text-primary-foreground"
                    : index < current
                      ? "bg-success-soft text-success hover:bg-success/20"
                      : "bg-muted text-muted-foreground hover:bg-border",
                )}
              >
                {index < current ? (
                  <CheckIcon size={13} aria-hidden="true" />
                ) : (
                  toPersianDigits(index + 1)
                )}
              </button>
            </li>
          ))}
        </ol>
      </header>

      {/* Only the current exercise is mounted, so focus and answers stay put */}
      <div className="p-4 sm:p-5">
        <ExerciseRunner
          title={title}
          instructions={instructions}
          exercise={data as unknown as ExerciseData}
          storageKey={`exercise-${step.id}`}
        />
      </div>

      {/* Step controls */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card-muted px-4 py-3.5 sm:px-5">
        <Button variant="outline" onClick={() => goTo(current - 1)} disabled={current === 0}>
          <ArrowRightIcon size={17} aria-hidden="true" />
          مرحله قبل
        </Button>

        <span className="text-[0.6875rem] text-subtle-foreground">
          پس از انجام هر تمرین، به مرحله بعد بروید. تمرین‌ها اختیاری‌اند.
        </span>

        {current < steps.length - 1 ? (
          <Button onClick={() => goTo(current + 1)}>
            مرحله بعد
            <ArrowLeftIcon size={17} aria-hidden="true" />
          </Button>
        ) : (
          <Badge tone="success" size="sm">
            <CheckIcon size={13} aria-hidden="true" />
            آخرین تمرین
          </Badge>
        )}
      </footer>
    </section>
  );
}
