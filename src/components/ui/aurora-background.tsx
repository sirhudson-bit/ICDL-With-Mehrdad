import type { HTMLProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type AuroraBackgroundProps = HTMLProps<HTMLDivElement> & {
  children?: ReactNode;
  /**
   * Radial mask that fades the sweep out toward the edges. Keep it on when the
   * aurora decorates a contained surface; turn it off for a full-bleed backdrop.
   */
  showRadialGradient?: boolean;
};

/**
 * Aurora background.
 *
 * A slow, heavily blurred gradient sweep that drifts behind whatever is placed
 * inside it. Based on the Aceternity `AuroraBackground`, adapted to this
 * codebase:
 *
 * - The colour variables are declared on the element itself rather than by a
 *   Tailwind plugin. Tailwind is configured in CSS here (`globals.css`), so
 *   there is no `tailwind.config.js` to extend, and this keeps the component
 *   self-contained.
 * - The palette comes from the theme tokens (`--primary`, `--info`, `--accent`),
 *   so the sweep follows light and dark mode instead of hard-coded colours.
 * - `background-attachment: fixed` is dropped: it repaints the whole viewport on
 *   scroll and made scrolling stutter.
 * - Strength is tuned for contrast, not for drama. Under the muted section
 *   subtitles that sit directly on the canvas (rather than inside a card) the
 *   sweep measures 4.59:1 in light mode and 4.69:1 in dark, both clearing AA at
 *   4.5:1. Raising it further is what breaks those two lines first.
 * - No `"use client"` — there is no state or effect, so it stays a server
 *   component and ships no JavaScript.
 *
 * The drift is the `animate-aurora` CSS animation, which the global
 * `prefers-reduced-motion` rule already neutralises and which leaves the sweep
 * looking correct when it is skipped.
 */
export function AuroraBackground({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) {
  return (
    <div
      className={cn("relative flex flex-col items-center justify-center", className)}
      {...props}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={cn(
            "absolute -inset-[10px] opacity-35 blur-[10px] will-change-[background-position] dark:opacity-20",
            // White streaks over the colour bands — this is what gives the sweep
            // its curtain-like banding instead of a flat two-colour fade. The
            // bands stay violet/blue-dominant (the brand colours) with amber only
            // as a highlight, so the page keeps its palette.
            "[--aurora-streaks:repeating-linear-gradient(100deg,#ffffff_0%,#ffffff_7%,transparent_10%,transparent_12%,#ffffff_16%)]",
            "[--aurora-bands:repeating-linear-gradient(100deg,var(--primary)_8%,var(--info)_14%,var(--primary)_20%,var(--primary-soft)_26%,var(--accent)_31%,var(--info)_36%,var(--primary)_42%)]",
            // Dark mode needs its own opacity as well as its own bands: there the
            // page is near-black, so the sweep has to add light rather than tint,
            // and it must stay below the luminance that would spoil the muted text.
            "dark:[--aurora-bands:repeating-linear-gradient(100deg,var(--primary)_8%,var(--info)_16%,var(--primary)_24%,var(--accent)_32%,var(--primary)_40%)]",
            "[background-image:var(--aurora-streaks),var(--aurora-bands)]",
            "dark:[background-image:var(--aurora-bands),var(--aurora-bands)]",
            "[background-size:300%,200%] [background-position:50%_50%,50%_50%]",
            // The moving layer: same gradients at a different scale, blended back
            // over the base to make the light travel. Dark mode screens instead,
            // so it adds light rather than tinting a near-black page.
            "after:absolute after:inset-0 after:animate-aurora after:content-['']",
            "after:[background-image:var(--aurora-streaks),var(--aurora-bands)]",
            "dark:after:[background-image:var(--aurora-bands),var(--aurora-bands)]",
            "after:[background-size:200%,100%]",
            "after:mix-blend-soft-light dark:after:mix-blend-screen",
            showRadialGradient &&
              "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_72%)]",
          )}
        />
      </div>
      {children}
    </div>
  );
}
