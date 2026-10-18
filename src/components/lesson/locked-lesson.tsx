"use client";

import { useEffect, useRef } from "react";

import { getIcon } from "@/components/icon";
import { Alert, ButtonLink, Card, CardContent, Progress } from "@/components/ui/primitives";
import { Container } from "@/components/ui/container";
import { useToast } from "@/components/ui/toaster";
import { toPersianDigits } from "@/lib/persian";
import type { SequenceStep } from "@/services/sequence-service";

/**
 * Shown instead of a lesson the learner has not unlocked yet.
 *
 * Renders the blocked state as a notification (a toast that appears on arrival)
 * plus a persistent panel, because a toast alone is easy to miss and the learner
 * needs a way back to the lesson they are actually supposed to do next.
 */
export function LockedLessonNotice({
  lessonTitle,
  prerequisite,
  position,
  total,
  completedCount,
  message,
}: {
  lessonTitle: string;
  prerequisite: SequenceStep;
  position: number;
  total: number;
  completedCount: number;
  message: string;
}) {
  const { toast } = useToast();
  const notified = useRef(false);
  const LockIcon = getIcon("Lock");
  const ArrowIcon = getIcon("ArrowLeft");

  /*
   * The notification is fired once per arrival. The ref guard matters because
   * React re-invokes effects in development, which showed the learner the same
   * toast twice.
   */
  useEffect(() => {
    if (notified.current) return;
    notified.current = true;

    toast({
      title: "این درس هنوز باز نشده است",
      description: `برای دسترسی به «${lessonTitle}» ابتدا «${prerequisite.lessonTitle}» را کامل کنید.`,
      tone: "warning",
      durationMs: 7000,
    });
  }, [lessonTitle, prerequisite.lessonTitle, toast]);

  return (
    <Container size="default" className="py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Alert tone="warning" title="این درس هنوز برای شما باز نشده است">
          <p>{message}</p>
        </Alert>

        <Card className="mt-4">
          <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
            <div className="flex items-start gap-3.5">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning">
                <LockIcon size={24} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="text-base font-bold sm:text-lg">«{lessonTitle}» قفل است</h1>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  دوره ICDL به‌صورت زنجیره‌ای طراحی شده است؛ هر درس روی درس قبلی ساخته می‌شود. با تکمیل
                  درس‌های قبلی، این درس به‌طور خودکار باز می‌شود.
                </p>
              </div>
            </div>

            {/* Where the learner is, so the block feels like progress rather than a wall */}
            <div className="mt-5 rounded-2xl border border-border bg-card-muted p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">پیشرفت شما در دوره</span>
                <span className="font-bold tabular-nums">
                  {toPersianDigits(completedCount)} از {toPersianDigits(total)} درس
                </span>
              </div>
              <Progress className="mt-2.5" value={(completedCount / Math.max(total, 1)) * 100} tone="success" />
              <p className="mt-2 text-xs text-subtle-foreground">
                این درس، درس شماره {toPersianDigits(position)} از {toPersianDigits(total)} است.
              </p>
            </div>

            {/* The actual next step, with the primary learning action in blue */}
            <div className="mt-5 rounded-2xl border border-primary/25 bg-primary-soft/40 p-4">
              <p className="text-xs font-bold text-primary">درس بعدی شما</p>
              <p className="mt-1 text-sm font-bold">{prerequisite.lessonTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {prerequisite.moduleTitle} • درس شماره {toPersianDigits(prerequisite.position)} از{" "}
                {toPersianDigits(total)}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                <ButtonLink href={`/course/${prerequisite.moduleSlug}/${prerequisite.lessonSlug}`} size="lg">
                  <ArrowIcon size={19} aria-hidden="true" />
                  شروع یادگیری
                </ButtonLink>
                <ButtonLink href="/progress" variant="outline" size="lg">
                  مشاهده پیشرفت من
                </ButtonLink>
                <ButtonLink href="/course" variant="ghost" size="lg">
                  فهرست دوره
                </ButtonLink>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

/**
 * Inline padlock used in lesson listings.
 *
 * A plain span rather than a button: the row still links to the lesson, and the
 * lesson page itself explains why it cannot be opened yet.
 */
export function LessonLockBadge({ title }: { title: string }) {
  const LockIcon = getIcon("Lock");
  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
    >
      <LockIcon size={12} aria-hidden="true" />
    </span>
  );
}
