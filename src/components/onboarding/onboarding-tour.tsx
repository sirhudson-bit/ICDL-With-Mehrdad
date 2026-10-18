"use client";

import { useCallback, useEffect, useState } from "react";

import { getIcon } from "@/components/icon";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * First-visit onboarding tour.
 *
 * Shows once per browser: a short welcome, then a spotlight on the parts of the
 * page a beginner needs to recognise — search, the main menu, favourites, the
 * account menu and the "start learning" call to action. Each step explains that
 * one element rather than listing the whole product.
 *
 * Targets are looked up by selector and missing ones are skipped, so the tour
 * still works for a signed-out visitor (no account button) and if the header is
 * later rearranged. Completion is stored in localStorage; the help page can
 * restart it by dispatching `icdl:start-tour`.
 */

const STORAGE_KEY = "icdl:tour-done";
export const START_TOUR_EVENT = "icdl:start-tour";

type Step = {
  selector: string;
  title: string;
  body: string;
  /** Preferred side for the tooltip; flipped when there is no room. */
  place?: "below" | "above";
};

const STEPS: Step[] = [
  {
    selector: '[aria-label="جستجو در دوره‌ها"]',
    title: "جستجو",
    body: "هر موضوعی را با نام نرم‌افزار یا بخشی از درس پیدا کنید؛ نتیجه‌ها همان‌جا نشان داده می‌شوند.",
  },
  {
    selector: 'nav[aria-label="ناوبری اصلی"]',
    title: "منوی اصلی",
    body: "دوره‌ها، درباره من و تماس با من از همین منو در دسترس است.",
  },
  {
    selector: 'a[href="/bookmarks"]',
    title: "علاقه‌مندی‌ها",
    body: "هر درس، نکته یا تعریفی که نشان‌دار کنید اینجا جمع می‌شود.",
  },
  {
    selector: '[aria-label="حساب کاربری"]',
    title: "حساب شما",
    body: "پیشرفت، تمرین‌ها، درخواست‌ها و گواهی پایان دوره از اینجا باز می‌شود.",
  },
  {
    selector: 'a[href="/course"]',
    title: "شروع یادگیری",
    body: "از فهرست دوره شروع کنید. درس‌ها به ترتیب باز می‌شوند تا مسیر یادگیری منظم بماند.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

export function OnboardingTour() {
  const [phase, setPhase] = useState<"idle" | "welcome" | "tour">("idle");
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const current = phase === "tour" ? STEPS[index] : undefined;

  // Decide shortly after mount whether to invite the visitor in. Deferred out of
  // the effect body so the state update happens in a callback, not during render
  // synchronisation.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
        setPhase("welcome");
      } catch {
        // Storage unavailable: skip the tour rather than nag on every page.
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Allow the help page to replay the tour.
  useEffect(() => {
    const restart = () => {
      setIndex(0);
      setPhase("tour");
    };
    window.addEventListener(START_TOUR_EVENT, restart);
    return () => window.removeEventListener(START_TOUR_EVENT, restart);
  }, []);

  const measure = useCallback(() => {
    if (!current) {
      setRect(null);
      return;
    }
    const target = document.querySelector(current.selector);
    if (!target) {
      setRect(null);
      return;
    }
    const box = target.getBoundingClientRect();
    setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
  }, [current]);

  useEffect(() => {
    if (!current) return;

    const target = document.querySelector(current.selector);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });

    // Measured in callbacks (never synchronously in the effect body): once after
    // the scroll starts and once when it has settled.
    const initial = window.setTimeout(measure, 60);
    const settled = window.setTimeout(measure, 380);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });

    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(settled);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [current, measure]);

  const finish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore: the tour simply shows again next time.
    }
    setPhase("idle");
  };

  const SparkIcon = getIcon("Sparkles");
  const CloseIcon = getIcon("X");

  if (phase === "welcome") {
    return (
      <div className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
        <div className="animate-[var(--animate-pop)] w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-raised)]">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <SparkIcon size={22} aria-hidden="true" />
          </span>
          <h2 className="mt-3 text-base font-bold">خوش آمدید! 👋</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            این پلتفرم یک دوره کامل ICDL است: درس‌ها، تمرین‌های عملی، آزمون و گواهی پایان دوره. می‌خواهید
            در یک تور کوتاه ببینید هر بخش کجاست؟
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setPhase("tour")}>
              <SparkIcon size={17} aria-hidden="true" />
              شروع تور
            </Button>
            <Button variant="ghost" onClick={finish}>
              بعداً
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  // Tooltip placement: clamped so it never leaves the viewport.
  const tooltipWidth = 288;
  const left = rect ? Math.min(Math.max(12, rect.left + rect.width / 2 - tooltipWidth / 2), window.innerWidth - tooltipWidth - 12) : 12;
  const below = rect ? rect.top + rect.height + 14 : 120;
  const placeAbove = rect ? below + 190 > window.innerHeight : false;
  const top = rect ? (placeAbove ? Math.max(12, rect.top - 200) : below) : 120;

  return (
    <div className="no-print fixed inset-0 z-[80]">
      {/* Dimming layer with a hole cut over the current target. */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-primary transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
          }}
          aria-hidden="true"
        />
      ) : (
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`راهنمای سایت، گام ${index + 1} از ${STEPS.length}`}
        className="animate-[var(--animate-pop)] fixed rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-raised)]"
        style={{ top, left, width: tooltipWidth }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-bold">{current.title}</p>
          <button
            type="button"
            onClick={finish}
            aria-label="بستن راهنما"
            className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon size={15} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{current.body}</p>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1" aria-hidden="true">
            {STEPS.map((step, position) => (
              <span
                key={step.selector}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  position === index ? "w-5 bg-primary" : "w-1.5 bg-border-strong",
                )}
              />
            ))}
          </span>

          <span className="flex items-center gap-1.5">
            {index > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setIndex((value) => value - 1)}>
                قبلی
              </Button>
            ) : null}
            {index < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setIndex((value) => value + 1)}>
                بعدی
              </Button>
            ) : (
              <Button size="sm" variant="success" onClick={finish}>
                پایان
              </Button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
