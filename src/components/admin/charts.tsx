import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/persian";

/**
 * Inline SVG charts.
 *
 * Rendered on the server with no charting dependency: the admin dashboard needs
 * a handful of simple, readable visuals, and shipping a chart library for that
 * would cost far more JavaScript than it is worth.
 */

export function BarChart({
  data,
  className,
  height = 160,
}: {
  data: { label: string; value: number; hint?: string }[];
  className?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-subtle-foreground">داده‌ای برای نمایش نیست.</p>;
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-2" style={{ height }}>
        {data.map((item, index) => {
          const percent = Math.max(Math.round((item.value / max) * 100), 2);
          return (
            <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="text-[0.6875rem] font-bold tabular-nums">{toPersianDigits(item.value)}</span>
              {/*
                The bar's height is a percentage, so it needs a parent with a
                definite height to resolve against: the flex-1 track below takes
                the space left after the label and becomes that parent. Without
                it every bar collapses to zero.
              */}
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-primary"
                  style={
                    {
                      height: `${percent}%`,
                      "--bar-height": `${percent}%`,
                      animation: "bar-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
                      animationDelay: `${index * 55}ms`,
                    } as CSSProperties
                  }
                  role="img"
                  aria-label={`${item.label}: ${item.value}`}
                  title={item.hint ?? `${item.label}: ${item.value}`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((item) => (
          <span
            key={item.label}
            className="min-w-0 flex-1 truncate text-center text-[0.625rem] text-muted-foreground"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  segments,
  size = 140,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="نمودار سهم‌ها">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={14}
          />
          {total > 0
            ? segments.map((segment, index) => {
                const fraction = segment.value / total;
                const dash = fraction * circumference;
                const element = (
                  <circle
                    key={segment.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={14}
                    // A gap of one full circumference keeps exactly one dash on
                    // the ring, which is what lets each segment be drawn in by
                    // animating its own length.
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={
                      {
                        "--chart-dash": `${dash}`,
                        "--chart-circumference": `${circumference}`,
                        animation: "chart-draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
                        animationDelay: `${index * 110}ms`,
                      } as CSSProperties
                    }
                  />
                );
                offset += dash;
                return element;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue ? <span className="text-xl font-bold tabular-nums">{centerValue}</span> : null}
          {centerLabel ? <span className="text-[0.6875rem] text-muted-foreground">{centerLabel}</span> : null}
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2.5 text-sm">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{segment.label}</span>
            <span className="shrink-0 font-bold tabular-nums">{toPersianDigits(segment.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressRing({
  value,
  size = 96,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}٪`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={9} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={
              {
                "--chart-dash": `${dash}`,
                "--chart-circumference": `${circumference}`,
                animation: "chart-draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
              } as CSSProperties
            }
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
          {toPersianDigits(Math.round(clamped))}٪
        </span>
      </div>
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
    </div>
  );
}
