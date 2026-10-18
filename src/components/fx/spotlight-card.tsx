"use client";

import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Pointer-tracking highlight.
 *
 * Sets a CSS custom property from the pointer position so a soft radial
 * highlight follows the cursor across the card. Purely decorative: the card is
 * fully legible without it, and it is disabled for coarse pointers and reduced
 * motion so it never interferes with touch or vestibular comfort.
 */
export function SpotlightCard({
  children,
  className,
  as: Tag = "article",
}: {
  children: ReactNode;
  className?: string;
  as?: "article" | "div" | "li" | "section";
}) {
  const ref = useRef<HTMLElement>(null);

  return (
    <Tag
      ref={ref as never}
      onPointerMove={(event) => {
        const node = ref.current;
        if (!node) return;
        // Coarse pointers (touch) have no hover position worth tracking.
        if (event.pointerType !== "mouse") return;

        const rect = node.getBoundingClientRect();
        node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
        node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
      }}
      className={cn(
        "group/spot relative isolate overflow-hidden",
        // The highlight is a pseudo-element so it never catches pointer events
        // or affects layout.
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:opacity-0 before:transition-opacity before:duration-300",
        "before:bg-[radial-gradient(340px_circle_at_var(--spot-x,50%)_var(--spot-y,0%),color-mix(in_oklch,var(--primary)_13%,transparent),transparent_70%)]",
        "hover:before:opacity-100 motion-reduce:before:hidden",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
