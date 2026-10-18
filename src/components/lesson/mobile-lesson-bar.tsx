"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setLessonStatusAction } from "@/app/actions/lesson";
import { getIcon } from "@/components/icon";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import type { ProgressStatus } from "@/types";

/**
 * Sticky lesson bar for small screens.
 *
 * On mobile the lesson navigation and the completion action would otherwise sit
 * at the end of a long article, so finishing a lesson meant scrolling to the
 * bottom. This keeps both permanently reachable at thumb height and replaces
 * the global tab bar on lesson pages so the two never stack.
 */
export function MobileLessonBar({
  lessonId,
  initialStatus,
  previous,
  next,
  progressPercent,
  isAuthenticated,
}: {
  lessonId: string;
  initialStatus: ProgressStatus;
  previous: { slug: string; moduleSlug: string; title: string } | null;
  next: { slug: string; moduleSlug: string; title: string } | null;
  progressPercent: number;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<ProgressStatus>(initialStatus);
  const [pending, startTransition] = useTransition();

  const completed = status === "COMPLETED";
  const CheckIcon = getIcon(completed ? "CheckCircle2" : "Check");
  const PrevIcon = getIcon("ChevronRight");
  const NextIcon = getIcon("ChevronLeft");

  const complete = () => {
    if (!isAuthenticated) {
      toast({
        title: "برای ثبت پیشرفت وارد شوید",
        description: "با حساب کاربری، وضعیت درس‌های شما ذخیره می‌شود.",
        tone: "info",
      });
      return;
    }

    startTransition(async () => {
      const outcome = await setLessonStatusAction(lessonId, completed ? "IN_PROGRESS" : "COMPLETED");
      if (!outcome.ok) {
        toast({ title: "ثبت نشد", description: outcome.message, tone: "error" });
        return;
      }

      setStatus(completed ? "IN_PROGRESS" : "COMPLETED");
      toast({
        title: completed ? "وضعیت درس بازنشانی شد" : "آفرین! این درس تکمیل شد",
        tone: "success",
        durationMs: 2600,
      });
      router.refresh();
    });
  };

  return (
    <div
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Reading position: a thin progress line above the controls. */}
      <div className="h-1 w-full bg-muted" aria-hidden="true">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${Math.max(3, Math.min(100, progressPercent))}%` }}
        />
      </div>

      <div className="flex items-stretch gap-2 px-3 py-2.5">
        {previous ? (
          <Link
            href={`/course/${previous.moduleSlug}/${previous.slug}`}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground"
            aria-label={`درس قبلی: ${previous.title}`}
          >
            <PrevIcon size={21} aria-hidden="true" />
          </Link>
        ) : (
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-border-strong opacity-50">
            <PrevIcon size={21} aria-hidden="true" />
          </span>
        )}

        <button
          type="button"
          onClick={complete}
          disabled={pending}
          aria-pressed={completed}
          className={cn(
            "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60",
            completed ? "bg-success-soft text-success" : "bg-primary text-primary-foreground",
          )}
        >
          <CheckIcon size={19} aria-hidden="true" />
          {completed ? "تکمیل شده" : "این درس را خواندم"}
        </button>

        {next ? (
          <Link
            href={`/course/${next.moduleSlug}/${next.slug}`}
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-muted px-3.5 text-sm font-medium text-foreground"
            aria-label={`درس بعدی: ${next.title}`}
          >
            بعدی
            <NextIcon size={18} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
