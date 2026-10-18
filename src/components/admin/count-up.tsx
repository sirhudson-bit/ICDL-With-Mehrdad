"use client";

import { useEffect, useRef, useState } from "react";

import { toPersianDigits } from "@/lib/persian";

/**
 * Counting number.
 *
 * The server renders the final value and the first client render matches it, so
 * hydration never mismatches — the effect then rewinds to zero and counts up.
 * With reduced motion the number simply stays put.
 */
export function CountUp({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, durationMs]);

  return <>{toPersianDigits(display)}</>;
}
