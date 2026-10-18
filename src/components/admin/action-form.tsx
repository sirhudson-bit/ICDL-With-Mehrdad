"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import { getIcon } from "@/components/icon";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

/**
 * Admin mutation helpers.
 *
 * Server actions are called from the client so the result can be surfaced as a
 * Persian toast and the affected routes refreshed. Small, deliberately generic
 * wrappers keep every admin screen consistent without duplicating state logic.
 */

type Outcome = { ok: boolean; message?: string };

export function AdminForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
  onSuccess,
  submitLabel = "ذخیره",
  submitVariant = "primary",
  compact = false,
}: {
  action: (formData: FormData) => Promise<Outcome>;
  children: ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  submitLabel?: string;
  submitVariant?: "primary" | "outline" | "soft" | "danger" | "success";
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const form = event.currentTarget;

        startTransition(async () => {
          const outcome = await action(formData);

          if (!outcome.ok) {
            toast({ title: "انجام نشد", description: outcome.message, tone: "error" });
            return;
          }

          toast({
            title: outcome.message ?? successMessage ?? "ذخیره شد",
            tone: "success",
            durationMs: 2800,
          });

          if (resetOnSuccess) form.reset();
          onSuccess?.();
          router.refresh();
        });
      }}
    >
      {children}

      <div className={cn("mt-3", compact && "mt-2")}>
        <Button type="submit" size={compact ? "sm" : "md"} variant={submitVariant} disabled={pending}>
          {pending ? "در حال ذخیره…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function ConfirmActionButton({
  action,
  confirmTitle,
  confirmDescription,
  label,
  icon = "Trash2",
  variant = "ghost",
  size = "sm",
  className,
}: {
  action: () => Promise<Outcome>;
  confirmTitle: string;
  confirmDescription?: string;
  label: string;
  icon?: string;
  variant?: "ghost" | "danger" | "outline" | "soft";
  size?: "sm" | "md" | "icon" | "iconSm";
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const Icon = getIcon(icon);

  const run = () => {
    const confirmed = window.confirm(
      confirmDescription ? `${confirmTitle}\n\n${confirmDescription}` : confirmTitle,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const outcome = await action();
      if (!outcome.ok) {
        toast({ title: "انجام نشد", description: outcome.message, tone: "error" });
        return;
      }
      toast({ title: outcome.message ?? "انجام شد", tone: "success", durationMs: 2600 });
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg transition-colors disabled:opacity-50",
        size === "sm" && "h-8 px-2 text-xs",
        size === "md" && "h-10 px-3 text-sm",
        size === "icon" && "size-9 justify-center",
        size === "iconSm" && "size-7 justify-center",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" && "text-danger hover:bg-danger-soft",
        variant === "outline" && "border border-border text-foreground hover:bg-muted",
        variant === "soft" && "bg-muted text-foreground hover:brightness-95",
        className,
      )}
    >
      <Icon size={size === "sm" || size === "iconSm" ? 14 : 16} aria-hidden="true" />
      {size !== "icon" && size !== "iconSm" ? label : null}
    </button>
  );
}

export function TogglePublishButton({
  action,
  isPublished,
  entityLabel,
}: {
  action: () => Promise<Outcome & { data?: { isPublished: boolean } }>;
  isPublished: boolean;
  entityLabel: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const EyeIcon = getIcon(isPublished ? "Eye" : "EyeOff");

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const outcome = await action();
          if (!outcome.ok) {
            toast({ title: "انجام نشد", description: outcome.message, tone: "error" });
            return;
          }
          const next = outcome.data?.isPublished;
          toast({
            title: next ? `${entityLabel} منتشر شد` : `${entityLabel} از حالت انتشار خارج شد`,
            tone: "success",
            durationMs: 2600,
          });
          router.refresh();
        })
      }
      aria-pressed={isPublished}
      title={isPublished ? "خروج از انتشار" : "انتشار"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.6875rem] transition-colors disabled:opacity-50",
        isPublished ? "bg-success-soft text-success" : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      <EyeIcon size={13} aria-hidden="true" />
      {isPublished ? "منتشرشده" : "پیش‌نویس"}
    </button>
  );
}

/** Copy-to-clipboard helper used by the export panel. */
export function CopyButton({ text, label = "کپی" }: { text: string; label?: string }) {
  const { toast } = useToast();
  const CopyIcon = getIcon("Copy");

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast({ title: "در حافظه کپی شد", tone: "success", durationMs: 2000 });
        } catch {
          toast({ title: "کپی نشد", description: "مرورگر اجازه کپی نداد.", tone: "error" });
        }
      }}
    >
      <CopyIcon size={14} aria-hidden="true" />
      {label}
    </Button>
  );
}
