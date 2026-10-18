"use client";

import { useEffect, useState } from "react";

import { getIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

/**
 * Back to top.
 *
 * Sits in the bottom-right corner (the assistant owns the bottom-left) and only
 * appears once the reader has scrolled a screen or so, so it never competes with
 * the content on a short page. The scroll itself follows the site's smooth
 * behaviour but respects reduced-motion preferences.
 */
const SHOW_AFTER_PX = 700;

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ArrowIcon = getIcon("ArrowUp");

  return (
    <button
      type="button"
      aria-label="بازگشت به بالای صفحه"
      title="بازگشت به بالا"
      onClick={() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }}
      className={cn(
        "no-print fixed start-4 bottom-20 z-[60] inline-flex size-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground shadow-[var(--shadow-raised)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-muted lg:start-5 lg:bottom-5",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowIcon size={19} aria-hidden="true" />
    </button>
  );
}
