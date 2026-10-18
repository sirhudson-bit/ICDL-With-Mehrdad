import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";

import { getIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
   Button
   ───────────────────────────────────────────────────────────── */

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-200 select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:bg-primary-hover",
        secondary: "bg-muted text-foreground hover:bg-card-muted border border-border",
        outline: "border border-border-strong bg-card text-foreground hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        soft: "bg-primary-soft text-primary hover:brightness-[0.97] dark:hover:brightness-110",
        danger: "bg-danger text-white hover:brightness-95",
        success: "bg-success text-white hover:brightness-95",
        link: "text-primary underline underline-offset-4 hover:no-underline px-0",
      },
      size: {
        sm: "h-9 rounded-xl px-3 text-sm",
        md: "h-11 rounded-xl px-4 text-[0.9375rem]",
        lg: "h-13 rounded-2xl px-6 text-base",
        icon: "size-10 rounded-xl",
        iconSm: "size-8 rounded-lg",
        iconLg: "size-12 rounded-2xl",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, block, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

export function ButtonLink({ className, variant, size, block, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

/* ─────────────────────────────────────────────────────────────
   Card
   ───────────────────────────────────────────────────────────── */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("stack-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5 sm:p-6", className)} {...props} />;
}

export function CardTitle({
  className,
  as: Tag = "h3",
  ...props
}: ComponentProps<"h3"> & { as?: "h1" | "h2" | "h3" | "h4" }) {
  return <Tag className={cn("text-base font-bold sm:text-lg", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-border px-5 py-4 sm:px-6", className)}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   Badge & Chip
   ───────────────────────────────────────────────────────────── */

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        primary: "bg-primary-soft text-primary",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        outline: "border border-border text-muted-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-[0.6875rem]",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

/* ─────────────────────────────────────────────────────────────
   Form controls
   ───────────────────────────────────────────────────────────── */

const fieldBase =
  "w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-[0.9375rem] shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-colors placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--primary-ring)] disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-28 resize-y leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-11 cursor-pointer pe-3", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-medium text-foreground", className)} {...props} />;
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-5 shrink-0 cursor-pointer rounded-md border border-border-strong accent-[var(--primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  id: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-border-strong",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white shadow transition-transform",
          checked ? "-translate-x-5" : "-translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-xs text-subtle-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Progress & feedback
   ───────────────────────────────────────────────────────────── */

export function Progress({
  value,
  className,
  tone = "primary",
  label,
  showValue = false,
}: {
  value: number;
  className?: string;
  tone?: "primary" | "success" | "warning" | "accent";
  label?: string;
  showValue?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const toneClass = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    accent: "bg-accent",
  }[tone];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label || showValue ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {label ? <span>{label}</span> : <span />}
          {showValue ? <span className="tabular-nums">{clamped.toLocaleString("fa-IR")}٪</span> : null}
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "میزان پیشرفت"}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", toneClass)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

const ALERT_TONES = {
  info: { wrapper: "bg-info-soft text-info border-info/25", icon: "Info" },
  success: { wrapper: "bg-success-soft text-success border-success/25", icon: "CheckCircle2" },
  warning: { wrapper: "bg-warning-soft text-warning border-warning/30", icon: "TriangleAlert" },
  danger: { wrapper: "bg-danger-soft text-danger border-danger/25", icon: "Circle" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof ALERT_TONES;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const config = ALERT_TONES[tone];
  const Icon = getIcon(config.icon);

  return (
    <div
      className={cn("flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed", config.wrapper, className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon size={18} className="mt-1 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-1 font-bold">{title}</p> : null}
        {children ? <div className="[&_a]:underline">{children}</div> : null}
      </div>
    </div>
  );
}

export function Spinner({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("inline-block animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="در حال بارگذاری"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} aria-hidden="true" />;
}

/* ─────────────────────────────────────────────────────────────
   Empty state
   ───────────────────────────────────────────────────────────── */

export function EmptyState({
  icon = "Search",
  title,
  description,
  action,
  children,
  className,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = getIcon(icon);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon size={26} aria-hidden="true" />
      </span>
      <h3 className="text-base font-bold">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Layout helpers
   ───────────────────────────────────────────────────────────── */

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-border", className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded-lg border border-border-strong bg-card-muted px-2 py-1 text-xs font-semibold text-foreground shadow-[0_1px_0_var(--border-strong)]">
      {children}
    </kbd>
  );
}

export function StatTile({
  label,
  value,
  icon,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  hint?: string;
  className?: string;
}) {
  const Icon = getIcon(icon ?? "TrendingUp");

  return (
    <div className={cn("stack-card flex items-center gap-4 p-4", className)}>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        {hint ? <p className="text-[0.6875rem] text-subtle-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
