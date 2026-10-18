import type { TopicGroupKey } from "@/lib/topics";
import { cn } from "@/lib/utils";

/**
 * Illustration set.
 *
 * Hand-authored SVG scenes rather than bitmap assets: they inherit the theme
 * tokens so they look correct in both light and dark mode, they stay crisp at
 * any size, they add no network requests, and there is nothing to optimise or
 * version. All of them are decorative and hidden from assistive technology —
 * the surrounding heading carries the meaning.
 */

type IllustrationProps = { className?: string };

/* ─────────────────────────────────────────────────────────────
   Hero
   ───────────────────────────────────────────────────────────── */

/** Hero scene: a learner's desk reduced to soft geometry. */
export function LearningHero({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 560 380"
      role="presentation"
      aria-hidden="true"
      className={cn("h-auto w-full", className)}
    >
      <defs>
        <linearGradient id="hero-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary-soft)" />
          <stop offset="100%" stopColor="var(--card)" />
        </linearGradient>
        <linearGradient id="hero-blob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Background wash */}
      <circle cx="300" cy="170" r="168" fill="url(#hero-blob)" />
      <circle cx="120" cy="300" r="72" fill="var(--primary-soft)" opacity="0.55" />

      {/* Monitor */}
      <rect x="118" y="74" width="320" height="204" rx="20" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
      <rect x="132" y="88" width="292" height="152" rx="12" fill="url(#hero-screen)" />

      {/* Lesson skeleton on screen */}
      <rect x="150" y="106" width="120" height="11" rx="5.5" fill="var(--primary)" opacity="0.55" />
      <rect x="150" y="128" width="210" height="8" rx="4" fill="var(--muted-foreground)" opacity="0.35" />
      <rect x="150" y="145" width="182" height="8" rx="4" fill="var(--muted-foreground)" opacity="0.28" />
      <rect x="150" y="162" width="200" height="8" rx="4" fill="var(--muted-foreground)" opacity="0.22" />

      {/* Progress bar on screen */}
      <rect x="150" y="196" width="238" height="12" rx="6" fill="var(--muted)" />
      <rect x="150" y="196" width="148" height="12" rx="6" fill="var(--primary)" />

      {/* Screen cards */}
      <rect x="150" y="220" width="72" height="10" rx="5" fill="var(--success)" opacity="0.6" />
      <rect x="232" y="220" width="54" height="10" rx="5" fill="var(--muted-foreground)" opacity="0.25" />

      {/* Stand */}
      <rect x="250" y="278" width="56" height="12" rx="6" fill="var(--border-strong)" />
      <rect x="222" y="290" width="112" height="10" rx="5" fill="var(--border)" />

      {/* Graduation cap */}
      <path d="M400 96l58 26-58 26-58-26z" fill="var(--accent)" opacity="0.9" />
      <path d="M366 130v22c0 9 15 16 34 16s34-7 34-16v-22" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="452" cy="140" r="6" fill="var(--accent)" />

      {/* Floating chips */}
      <g>
        <rect x="66" y="112" width="62" height="34" rx="10" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="78" y="127" width="38" height="5" rx="2.5" fill="var(--muted-foreground)" opacity="0.5" />
      </g>
      <g>
        <rect x="58" y="196" width="74" height="34" rx="10" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
        <circle cx="76" cy="213" r="7" fill="var(--success)" />
        <rect x="90" y="210" width="30" height="6" rx="3" fill="var(--muted-foreground)" opacity="0.45" />
      </g>
      <g>
        <rect x="432" y="196" width="82" height="46" rx="12" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="446" y="222" width="12" height="12" rx="3" fill="var(--primary)" opacity="0.75" />
        <rect x="464" y="212" width="12" height="22" rx="3" fill="var(--primary)" opacity="0.55" />
        <rect x="482" y="204" width="12" height="30" rx="3" fill="var(--primary)" opacity="0.35" />
      </g>

      {/* Keyboard hint */}
      <g>
        <rect x="392" y="270" width="112" height="44" rx="12" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="404" y="282" width="26" height="20" rx="6" fill="var(--muted)" />
        <rect x="436" y="282" width="26" height="20" rx="6" fill="var(--muted)" />
        <rect x="468" y="282" width="24" height="20" rx="6" fill="var(--primary)" opacity="0.6" />
      </g>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Topic art
   ───────────────────────────────────────────────────────────── */

const COMMON_PROPS = {
  viewBox: "0 0 220 150",
  role: "presentation" as const,
  "aria-hidden": true,
};

/** Small scene per curriculum strand, used on group headers and module cards. */
export function TopicArt({ group, className }: { group: TopicGroupKey | string; className?: string }) {
  const shared = cn("h-auto w-full", className);

  if (group === "windows") {
    return (
      <svg {...COMMON_PROPS} className={shared}>
        <rect x="24" y="24" width="172" height="102" rx="14" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="24" y="24" width="172" height="22" rx="14" fill="var(--primary-soft)" />
        <rect x="36" y="32" width="8" height="8" rx="4" fill="var(--primary)" />
        <rect x="24" y="46" width="86" height="80" fill="var(--card-muted)" />
        <rect x="110" y="46" width="86" height="80" fill="var(--card)" />
        <rect x="38" y="62" width="44" height="7" rx="3.5" fill="var(--primary)" opacity="0.6" />
        <rect x="38" y="78" width="58" height="7" rx="3.5" fill="var(--muted-foreground)" opacity="0.35" />
        <rect x="38" y="94" width="36" height="7" rx="3.5" fill="var(--muted-foreground)" opacity="0.25" />
        <rect x="124" y="62" width="56" height="46" rx="8" fill="var(--primary-soft)" />
      </svg>
    );
  }

  if (group === "online") {
    return (
      <svg {...COMMON_PROPS} className={shared}>
        <circle cx="110" cy="78" r="52" fill="var(--primary-soft)" />
        <circle cx="110" cy="78" r="52" fill="none" stroke="var(--primary)" strokeWidth="2.5" opacity="0.5" />
        <ellipse cx="110" cy="78" rx="24" ry="52" fill="none" stroke="var(--primary)" strokeWidth="2.5" opacity="0.5" />
        <path d="M60 62h100M60 94h100" stroke="var(--primary)" strokeWidth="2.5" opacity="0.4" strokeLinecap="round" />
        <circle cx="168" cy="38" r="12" fill="var(--accent)" />
        <path d="M163 38l4 4 7-8" stroke="var(--card)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="26" y="106" width="62" height="30" rx="9" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="38" y="118" width="38" height="6" rx="3" fill="var(--success)" opacity="0.7" />
      </svg>
    );
  }

  if (group === "office") {
    return (
      <svg {...COMMON_PROPS} className={shared}>
        <rect x="30" y="26" width="74" height="98" rx="10" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="42" y="44" width="50" height="7" rx="3.5" fill="var(--primary)" opacity="0.7" />
        <rect x="42" y="60" width="38" height="6" rx="3" fill="var(--muted-foreground)" opacity="0.35" />
        <rect x="42" y="74" width="44" height="6" rx="3" fill="var(--muted-foreground)" opacity="0.3" />
        <rect x="42" y="96" width="50" height="18" rx="6" fill="var(--primary-soft)" />

        <rect x="112" y="26" width="80" height="98" rx="10" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="122" y="38" width="60" height="14" rx="4" fill="var(--success)" opacity="0.35" />
        <g opacity="0.5" stroke="var(--border-strong)" strokeWidth="1.5">
          <path d="M122 52h60M122 66h60M122 80h60M122 94h60M122 108h60" />
          <path d="M142 38v84M162 38v84" />
        </g>
        <path d="M126 104l14-14 12 9 18-22" stroke="var(--success)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (group === "advanced") {
    return (
      <svg {...COMMON_PROPS} className={shared}>
        <path d="M110 22l58 20v40c0 30-24 50-58 62-34-12-58-32-58-62V42z" fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth="2.5" />
        <path d="M86 82l18 18 34-38" stroke="var(--primary)" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="172" cy="110" r="16" fill="var(--accent)" />
        <rect x="165" y="108" width="14" height="11" rx="3" fill="var(--card)" />
        <path d="M167 108v-3a5 5 0 0110 0v3" stroke="var(--card)" strokeWidth="2.5" fill="none" />
      </svg>
    );
  }

  // fundamentals
  return (
    <svg {...COMMON_PROPS} className={shared}>
      <rect x="66" y="30" width="104" height="70" rx="10" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
      <rect x="76" y="40" width="84" height="50" rx="6" fill="var(--primary-soft)" />
      <rect x="86" y="52" width="46" height="7" rx="3.5" fill="var(--primary)" opacity="0.65" />
      <rect x="86" y="66" width="30" height="6" rx="3" fill="var(--muted-foreground)" opacity="0.35" />
      <rect x="100" y="100" width="36" height="10" rx="5" fill="var(--border-strong)" />
      <rect x="78" y="110" width="80" height="8" rx="4" fill="var(--border)" />

      <rect x="24" y="60" width="30" height="46" rx="8" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
      <circle cx="39" cy="94" r="3" fill="var(--primary)" />
      <rect x="178" y="84" width="26" height="34" rx="7" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
      <circle cx="191" cy="112" r="2.5" fill="var(--primary)" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Empty state
   ───────────────────────────────────────────────────────────── */

/** Neutral art for empty and not-found states. */
export function EmptyArt({ className }: IllustrationProps) {
  return (
    <svg {...COMMON_PROPS} className={cn("h-auto w-full", className)}>
      <rect x="56" y="26" width="76" height="94" rx="10" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="2" />
      <rect x="70" y="44" width="48" height="7" rx="3.5" fill="var(--muted-foreground)" opacity="0.35" />
      <rect x="70" y="60" width="34" height="6" rx="3" fill="var(--muted-foreground)" opacity="0.25" />
      <rect x="70" y="76" width="42" height="6" rx="3" fill="var(--muted-foreground)" opacity="0.2" />
      <rect x="92" y="96" width="80" height="44" rx="12" fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth="2.5" opacity="0.85" />
      <circle cx="122" cy="116" r="11" fill="none" stroke="var(--primary)" strokeWidth="3" />
      <path d="M131 125l11 11" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
