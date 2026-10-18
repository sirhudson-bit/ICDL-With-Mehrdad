"use client";

import { useEffect, useRef, useState } from "react";

import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

/**
 * Count-up number.
 *
 * Animates from zero to the target once the element is on screen, using
 * requestAnimationFrame and an ease-out curve. Reduces to the final value
 * immediately under `prefers-reduced-motion`, and starts from the final value
 * during server rendering so the markup never shows a misleading "۰".
 */
export function AnimatedCounter({
  value,
  suffix = "",
  durationMs = 1100,
  className,
}: {
  value: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: settle on the real value when motion is off
      setDisplay(value);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || started.current) continue;
        started.current = true;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / durationMs);
          // easeOutCubic keeps the last digits from crawling.
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(value * eased));
          if (progress < 1) requestAnimationFrame(tick);
          else setDisplay(value);
        };
        requestAnimationFrame(tick);
      }
    });

    observer.observe(node);
    setDisplay(0);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {toPersianDigits(display)}
      {suffix}
    </span>
  );
}
