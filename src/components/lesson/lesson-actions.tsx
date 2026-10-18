"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { markLessonViewedAction, setLessonStatusAction } from "@/app/actions/lesson";
import { getIcon } from "@/components/icon";
import { Badge, Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import type { ProgressStatus } from "@/types";

/**
 * Records that a lesson was opened.
 *
 * Done from the client rather than during render because a server component
 * must not write to the database while rendering. A session-storage guard keeps
 * it to one call per lesson per browser session.
 */
export function LessonViewedTracker({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    const key = `viewed-${lessonId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Session storage may be blocked; still record the view once per mount.
    }

    void markLessonViewedAction(lessonId);
  }, [lessonId]);

  return null;
}

/** Explicit completion controls, with the current state shown inline. */
export function LessonCompletionControls({
  lessonId,
  initialStatus,
  isAuthenticated,
}: {
  lessonId: string;
  initialStatus: ProgressStatus;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<ProgressStatus>(initialStatus);
  const [pending, startTransition] = useTransition();

  const CheckIcon = getIcon("CheckCircle2");
  const ResetIcon = getIcon("RotateCcw");

  const update = (next: ProgressStatus) => {
    if (!isAuthenticated) {
      toast({
        title: "برای ثبت پیشرفت وارد شوید",
        description: "با حساب کاربری، وضعیت درس‌های شما ذخیره می‌شود.",
        tone: "info",
      });
      return;
    }

    startTransition(async () => {
      const outcome = await setLessonStatusAction(lessonId, next);
      if (!outcome.ok) {
        toast({ title: "ثبت نشد", description: outcome.message, tone: "error" });
        return;
      }

      setStatus(next);
      toast({
        title:
          next === "COMPLETED"
            ? "این درس تکمیل شد"
            : next === "NOT_STARTED"
              ? "وضعیت درس بازنشانی شد"
              : "وضعیت ذخیره شد",
        tone: "success",
        durationMs: 2600,
      });
      router.refresh();
    });
  };

  const completed = status === "COMPLETED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {completed ? (
        <Badge tone="success" size="lg">
          <CheckIcon size={14} aria-hidden="true" />
          تکمیل شده
        </Badge>
      ) : (
        /*
         * No "start learning" button: a lesson is completed by passing its quiz,
         * so the button only duplicated the quiz's own action and invited people
         * to mark work done that they had not done.
         */
        <p className="text-xs leading-relaxed text-muted-foreground">
          این درس پس از قبولی در آزمون پایین همین صفحه، خودکار تکمیل می‌شود.
        </p>
      )}
      {completed ? (
        <Button variant="ghost" size="sm" onClick={() => update("NOT_STARTED")} disabled={pending}>
          <ResetIcon size={15} aria-hidden="true" />
          بازنشانی وضعیت
        </Button>
      ) : null}
    </div>
  );
}

/** Prev/next navigation between lessons in curriculum order. */
export function LessonPager({
  previous,
  next,
}: {
  previous: { slug: string; title: string; moduleSlug: string } | null;
  next: { slug: string; title: string; moduleSlug: string } | null;
}) {
  return (
    <nav className="grid gap-3 sm:grid-cols-2" aria-label="درس قبلی و بعدی">
      {previous ? (
        <a
          href={`/course/${previous.moduleSlug}/${previous.slug}`}
          className={cn(
            "stack-card flex flex-col gap-1 p-4 transition-shadow hover:shadow-[var(--shadow-raised)]",
          )}
        >
          <span className="text-xs text-muted-foreground">درس قبلی</span>
          <span className="text-sm font-bold">{previous.title}</span>
        </a>
      ) : (
        <span />
      )}

      {next ? (
        <a
          href={`/course/${next.moduleSlug}/${next.slug}`}
          className="stack-card flex flex-col gap-1 p-4 text-end transition-shadow hover:shadow-[var(--shadow-raised)]"
        >
          <span className="text-xs text-muted-foreground">درس بعدی</span>
          <span className="text-sm font-bold">{next.title}</span>
        </a>
      ) : null}
    </nav>
  );
}
