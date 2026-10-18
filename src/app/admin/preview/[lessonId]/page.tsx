import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { LessonBlockView } from "@/components/lesson/blocks";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { Badge, ButtonLink, Card, CardContent } from "@/components/ui/primitives";
import { prisma } from "@/lib/db";
import { formatDuration, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "پیش‌نمایش درس",
  robots: { index: false, follow: false },
};

const DEVICES = [
  { value: "desktop", label: "دسکتاپ", width: "w-full" },
  { value: "tablet", label: "تبلت", width: "w-[48rem]" },
  { value: "mobile", label: "موبایل", width: "w-[24rem]" },
] as const;

/**
 * Draft preview.
 *
 * Renders the lesson exactly as a learner would see it — including unpublished
 * blocks — inside a device-sized frame so an administrator can check desktop,
 * tablet and mobile layouts before publishing.
 */
export default async function AdminPreviewPage(props: PageProps<"/admin/preview/[lessonId]">) {
  const { lessonId } = await props.params;
  const searchParams = await props.searchParams;

  const deviceParam = typeof searchParams.device === "string" ? searchParams.device : "desktop";
  const device = DEVICES.find((item) => item.value === deviceParam) ?? DEVICES[0];

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      blocks: { orderBy: { order: "asc" } },
      quiz: { include: { questions: { orderBy: { order: "asc" } } } },
      chapter: { include: { module: true } },
    },
  });

  if (!lesson) notFound();

  const courseModule = lesson.chapter.module;
  const visibleBlocks = lesson.blocks;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">پیش‌نمایش: {lesson.title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            این پیش‌نمایش شامل بلوک‌های پنهان هم می‌شود. چیدمان را روی اندازه‌های مختلف بررسی کنید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={lesson.isPublished ? "success" : "warning"}>
            {lesson.isPublished ? "منتشرشده" : "پیش‌نویس"}
          </Badge>
          {DEVICES.map((option) => (
            <Link
              key={option.value}
              href={`/admin/preview/${lesson.id}?device=${option.value}`}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                option.value === device.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:border-primary hover:text-primary",
              )}
            >
              {option.label}
            </Link>
          ))}
          <ButtonLink href={`/admin/content/lesson/${lesson.id}`} variant="outline" size="sm">
            بازگشت به ویرایش
          </ButtonLink>
        </div>
      </div>

      <div className="flex justify-center">
        <div className={cn("mx-auto transition-[width] duration-300", device.width)}>
          <article className={cn("space-y-5 rounded-2xl border border-border bg-background p-4 sm:p-6")}>
            <header className={`tone-${courseModule.color} rounded-2xl border border-border bg-card p-4`}>
              <p className="text-[0.6875rem] text-subtle-foreground">
                ماژول {toPersianDigits(courseModule.number)} • {lesson.chapter.title}
              </p>
              <h2 className="mt-1 text-lg font-bold">{lesson.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{lesson.summary}</p>
              <p className="mt-2 text-xs text-subtle-foreground">
                {formatDuration(lesson.estimatedMinutes)} • {toPersianDigits(visibleBlocks.length)} بلوک
              </p>
            </header>

            {visibleBlocks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-strong bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                این درس هنوز بلوکی ندارد.
              </p>
            ) : (
              visibleBlocks.map((block) => (
                <div key={block.id} className={cn(!block.isVisible && "opacity-50")}>
                  {!block.isVisible ? (
                    <p className="mb-1.5 text-[0.6875rem] text-warning">
                      این بلوک پنهان است و در سایت نمایش داده نمی‌شود.
                    </p>
                  ) : null}
                  <LessonBlockView
                    block={{ id: block.id, type: block.type, data: block.data }}
                    lessonId={lesson.id}
                    lessonTitle={lesson.title}
                    isBookmarkedBlock={false}
                    isAuthenticated={false}
                  />
                </div>
              ))
            )}

            {lesson.quiz ? (
              <QuizRunner
                quiz={{
                  id: lesson.quiz.id,
                  title: lesson.quiz.title,
                  description: lesson.quiz.description,
                  passingScore: lesson.quiz.passingScore,
                  timeLimitMinutes: lesson.quiz.timeLimitMinutes,
                  questions: lesson.quiz.questions.map((question) => ({
                    id: question.id,
                    type: question.type,
                    prompt: question.prompt,
                    hint: question.hint,
                    points: question.points,
                    data: question.data,
                  })),
                }}
                lessonId={lesson.id}
                bestAttempt={null}
              />
            ) : null}

            <Card>
              <CardContent className="p-4 pt-4 text-center text-xs text-muted-foreground">
                پایان پیش‌نمایش — دکمه‌های ثبت پیشرفت و چت‌بات در نسخه واقعی هم نمایش داده می‌شوند.
              </CardContent>
            </Card>
          </article>
        </div>
      </div>
    </div>
  );
}
