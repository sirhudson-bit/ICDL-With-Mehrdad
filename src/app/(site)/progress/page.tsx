import Link from "next/link";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { Reveal } from "@/components/fx/reveal";
import { ResetProgressButton } from "@/components/learner/progress-actions";
import { Badge, ButtonLink, Card, CardContent, EmptyState, Progress, SectionHeading, StatTile } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { formatDuration, formatPercent, formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { prisma } from "@/lib/db";
import {
  getContinueLearning,
  getCourseProgress,
  getModuleProgress,
  getRecentlyViewed,
} from "@/services/progress-service";
import { getCourseTree } from "@/services/course-service";

export const metadata: Metadata = {
  title: "پیشرفت من",
  description: "وضعیت پیشرفت شما در ماژول‌های دوره، نتایج آزمون‌ها و درس‌های اخیر.",
  robots: { index: false, follow: false },
};

/** Learner dashboard: overall progress, per-courseModule breakdown and quiz history. */
export default async function ProgressPage() {
  const user = await requireUser("/login?next=/progress");

  const [courseProgress, moduleProgress, continueLearning, recentlyViewed, modules, attempts, account] =
    await Promise.all([
      getCourseProgress(user.id),
      getModuleProgress(user.id),
      getContinueLearning(user.id),
      getRecentlyViewed(user.id, 8),
      getCourseTree(),
      prisma.quizAttempt.findMany({
        where: { userId: user.id },
        orderBy: { completedAt: "desc" },
        take: 8,
        include: { quiz: { select: { title: true, lesson: { select: { slug: true, title: true, chapter: { select: { module: { select: { slug: true } } } } } } } } },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { streakCount: true, lastActiveAt: true, createdAt: true },
      }),
    ]);

  const moduleBySlug = new Map(modules.map((courseModule) => [courseModule.slug, courseModule]));
  const continueHref = continueLearning
    ? `/course/${continueLearning.lesson.chapter.module.slug}/${continueLearning.lesson.slug}`
    : "/course";

  const TrendingIcon = getIcon("TrendingUp");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <TrendingIcon size={22} aria-hidden="true" />
            </span>
            پیشرفت من
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            سلام {user.name}؛ اینجا وضعیت یادگیری شما را می‌بینید.
          </p>
        </div>

        {/* Reset lives with the progress it clears, where it is easy to find. */}
        <div className="shrink-0 text-end">
          <ResetProgressButton />
          <p className="mt-1.5 max-w-56 text-[0.6875rem] leading-relaxed text-subtle-foreground">
            همه درس‌های تکمیل‌شده، نتایج آزمون‌ها و علاقه‌مندی‌ها پاک می‌شوند؛ حساب و گواهی شما باقی می‌ماند.
          </p>
        </div>
      </header>

      <Reveal as="section" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="پیشرفت دوره"
          value={formatPercent(courseProgress.percent)}
          icon="TrendingUp"
          hint={`${toPersianDigits(courseProgress.completedLessons)} از ${toPersianDigits(courseProgress.totalLessons)} درس`}
        />
        <StatTile
          label="زمان یادگیری"
          value={formatDuration(courseProgress.completedMinutes)}
          icon="Clock"
        />
        <StatTile
          label="درس‌های در حال انجام"
          value={toPersianDigits(courseProgress.inProgressLessons)}
          icon="BookOpen"
        />
        <StatTile
          label="روزهای پیوسته"
          value={toPersianDigits(account?.streakCount ?? 0)}
          icon="Flame"
          hint={account?.lastActiveAt ? `آخرین فعالیت: ${formatRelativeTime(account.lastActiveAt)}` : undefined}
        />
      </Reveal>

      {continueLearning ? (
        <Card className={`mt-6 tone-${continueLearning.lesson.chapter.module.color}`}>
          <CardContent className="flex flex-col gap-3 p-5 pt-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-subtle-foreground">درس بعدی شما</p>
              <h2 className="mt-1 truncate text-base font-bold">{continueLearning.lesson.title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {continueLearning.lesson.chapter.module.title} •{" "}
                {formatDuration(continueLearning.lesson.estimatedMinutes)}
              </p>
            </div>
            <ButtonLink href={continueHref} className="shrink-0">
              ادامه یادگیری
            </ButtonLink>
          </CardContent>
        </Card>
      ) : null}

      {/* Module breakdown */}
      <Reveal as="section" className="mt-8">
        <SectionHeading title="پیشرفت ماژول‌ها" description="وضعیت هر ماژول به تفکیک" />
        <ul className="flex flex-col gap-3">
          {moduleProgress.map((item) => {
            const courseModule = moduleBySlug.get(item.moduleSlug);
            if (!courseModule) return null;

            return (
              <li key={item.moduleId} className={`tone-${courseModule.color}`}>
                <Card>
                  <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/course/${courseModule.slug}`}
                        className="flex items-center gap-2 text-sm font-bold hover:text-primary"
                      >
                        <span className="tone-text text-xs">
                          ماژول {toPersianDigits(courseModule.number)}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        {courseModule.title}
                      </Link>
                      <Badge
                        tone={
                          item.percent >= 100 ? "success" : item.percent > 0 ? "primary" : "outline"
                        }
                      >
                        {item.percent >= 100
                          ? "تکمیل شده"
                          : item.percent > 0
                            ? formatPercent(item.percent)
                            : "شروع نشده"}
                      </Badge>
                    </div>
                    <Progress
                      className="mt-3"
                      value={item.percent}
                      tone={item.percent >= 100 ? "success" : "primary"}
                      label={`${toPersianDigits(item.completedLessons)} از ${toPersianDigits(item.totalLessons)} درس`}
                    />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </Reveal>

      {/* Quiz history */}
      <Reveal as="section" className="mt-8">
        <SectionHeading title="نتایج آزمون‌ها" description="آخرین آزمون‌هایی که داده‌اید" />
        {attempts.length === 0 ? (
          <EmptyState
            icon="ClipboardCheck"
            title="هنوز آزمونی نداده‌اید"
            description="در پایان درس‌های مهم، یک آزمون کوتاه وجود دارد. با دادن آزمون، مطمئن می‌شوید مطلب را یاد گرفته‌اید."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {attempts.map((attempt) => {
              const percent =
                attempt.maxScore === 0 ? 0 : Math.round((attempt.score / attempt.maxScore) * 100);
              return (
                <li key={attempt.id}>
                  <Link
                    href={`/course/${attempt.quiz.lesson.chapter.module.slug}/${attempt.quiz.lesson.slug}`}
                    className="stack-card flex flex-wrap items-center gap-3 p-3.5 transition-shadow hover:shadow-[var(--shadow-raised)]"
                  >
                    <span
                      className={
                        attempt.passed
                          ? "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success"
                          : "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"
                      }
                    >
                      {attempt.passed ? <CheckGlyph /> : <WarnGlyph />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{attempt.quiz.lesson.title}</span>
                      <span className="block text-[0.6875rem] text-subtle-foreground">
                        {toPersianDigits(attempt.correctCount)} پاسخ درست از{" "}
                        {toPersianDigits(attempt.totalCount)}
                        {attempt.completedAt ? ` • ${formatRelativeTime(attempt.completedAt)}` : ""}
                      </span>
                    </span>
                    <Badge tone={attempt.passed ? "success" : "warning"}>
                      {formatPercent(percent)}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>

      {/* Recently viewed */}
      <Reveal as="section" className="mt-8">
        <SectionHeading title="اخیراً دیده‌اید" />
        {recentlyViewed.length === 0 ? (
          <EmptyState
            icon="Clock"
            title="فعالیتی ثبت نشده است"
            description="به‌محض باز کردن اولین درس، فهرست فعالیت‌های شما اینجا ساخته می‌شود."
          >
            <ButtonLink href="/course" className="mt-2">
              شروع دوره
            </ButtonLink>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentlyViewed.map((item) => (
              <li key={item.lesson.id}>
                <Link
                  href={`/course/${item.lesson.chapter.module.slug}/${item.lesson.slug}`}
                  className="stack-card flex flex-wrap items-center gap-3 p-3.5 transition-shadow hover:shadow-[var(--shadow-raised)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.lesson.title}</span>
                    <span className="block text-[0.6875rem] text-subtle-foreground">
                      {item.lesson.chapter.module.title} • {formatRelativeTime(item.lastViewedAt)}
                    </span>
                  </span>
                  <span className="w-24">
                    <Progress
                      value={item.percent}
                      tone={item.status === "COMPLETED" ? "success" : "primary"}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}

function CheckGlyph() {
  const Icon = getIcon("Check");
  return <Icon size={16} aria-hidden="true" />;
}
function WarnGlyph() {
  const Icon = getIcon("TriangleAlert");
  return <Icon size={16} aria-hidden="true" />;
}
