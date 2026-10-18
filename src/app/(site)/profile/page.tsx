import Link from "next/link";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { DonateButtonAuto } from "@/components/fx/donate-button";
import { Reveal } from "@/components/fx/reveal";
import { Badge, ButtonLink, Card, CardContent, Progress, SectionHeading, StatTile } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { formatDuration, formatPercent, formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { countBookmarks } from "@/services/bookmark-service";
import { getUserCertificate } from "@/services/certificate-service";
import { listMyContactMessages, listMyCourseRequests } from "@/services/inbox-service";
import { getContinueLearning, getCourseProgress, getRecentlyViewed } from "@/services/progress-service";

export const metadata: Metadata = {
  title: "پروفایل من",
  description: "نمای کلی حساب شما: پیشرفت، تمرین‌ها، درخواست‌ها و گواهی پایان دوره.",
  robots: { index: false, follow: false },
};

/**
 * Account dashboard.
 *
 * A single place to see where the learner stands and to reach everything else in
 * the account area, instead of four unrelated pages reached only from the header.
 */
export default async function ProfilePage() {
  const user = await requireUser("/login?next=/profile");

  const [progress, continueLearning, recentlyViewed, bookmarkCount, myRequests, myMessages, certificate] =
    await Promise.all([
      getCourseProgress(user.id),
      getContinueLearning(user.id),
      getRecentlyViewed(user.id, 4),
      countBookmarks(user.id),
      listMyCourseRequests(user.id, 5),
      listMyContactMessages(user.id, 5),
      getUserCertificate(user.id),
    ]);

  const SparkIcon = getIcon("Sparkles");
  const ArrowIcon = getIcon("ArrowLeft");

  const openRequests = myRequests.filter((request) => request.status !== "DONE" && request.status !== "DECLINED");

  return (
    <div className="space-y-8">
      <header className="stack-card flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-xl font-bold text-primary">
          {user.name.trim().charAt(0) || "؟"}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold sm:text-xl">
            {user.name}
            <Badge tone={user.role === "ADMIN" ? "primary" : "outline"} size="sm">
              {user.role === "ADMIN" ? "مدیر" : "کاربر عادی"}
            </Badge>
          </h1>
          <p dir="ltr" className="mt-0.5 text-start text-xs text-muted-foreground">
            {user.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/course" size="sm" variant="outline">
            ادامه یادگیری
          </ButtonLink>
          <ButtonLink href="/settings" size="sm" variant="ghost">
            ویرایش پروفایل
          </ButtonLink>
        </div>
      </header>

      <Reveal>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="پیشرفت دوره"
            value={formatPercent(progress.percent)}
            icon="TrendingUp"
            hint={`${toPersianDigits(progress.completedLessons)} از ${toPersianDigits(progress.totalLessons)} درس`}
          />
          <StatTile
            label="زمان یادگیری"
            value={formatDuration(progress.completedMinutes)}
            icon="Clock"
            hint={`از ${formatDuration(progress.totalMinutes)}`}
          />
          <StatTile
            label="علاقه‌مندی‌ها"
            value={toPersianDigits(bookmarkCount)}
            icon="Star"
            hint="دوره، درس و نکته‌های ذخیره‌شده"
          />
          <StatTile
            label="درخواست‌های باز"
            value={toPersianDigits(openRequests.length)}
            icon="Mail"
            hint={`${toPersianDigits(myRequests.length + myMessages.length)} مورد ثبت‌شده`}
          />
        </section>
      </Reveal>

      {continueLearning ? (
        <Reveal>
          <Card className={`tone-${continueLearning.lesson.chapter.module.color}`}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 pt-5">
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-bold text-muted-foreground">
                  {continueLearning.reason === "in_progress" ? "ادامه بدهید" : "درس بعدی شما"}
                </p>
                <p className="mt-1 text-sm font-bold">{continueLearning.lesson.title}</p>
                <p className="mt-0.5 text-[0.6875rem] text-subtle-foreground">
                  {continueLearning.lesson.chapter.module.title} • {continueLearning.lesson.chapter.title}
                </p>
              </div>
              <ButtonLink
                href={`/course/${continueLearning.lesson.chapter.module.slug}/${continueLearning.lesson.slug}`}
                size="sm"
              >
                رفتن به درس
                <ArrowIcon size={16} aria-hidden="true" />
              </ButtonLink>
            </CardContent>
          </Card>
        </Reveal>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Reveal delayMs={0}>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col p-5 pt-5">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <SparkIcon size={18} className="text-primary" aria-hidden="true" />
                دسترسی سریع
              </h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {[
                  { href: "/profile/exercises", label: "تمرین‌های عملی من", icon: "MousePointerClick" },
                  { href: "/profile/requests", label: "پیگیری درخواست‌ها", icon: "Mail" },
                  { href: "/progress", label: "پیشرفت و نتایج آزمون", icon: "TrendingUp" },
                  { href: "/certificate", label: "گواهی پایان دوره", icon: "Award" },
                  { href: "/bookmarks", label: "علاقه‌مندی‌ها", icon: "Star" },
                ].map((item) => {
                  const Icon = getIcon(item.icon);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Icon size={17} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <ArrowIcon size={15} className="shrink-0 opacity-60" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delayMs={70}>
          <Card className="h-full">
            <CardContent className="p-5 pt-5">
              <SectionHeading title="آخرین درخواست‌ها" />
              {myRequests.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  هنوز درخواستی ثبت نکرده‌اید.{" "}
                  <Link href="/contact" className="text-primary hover:underline">
                    یک درخواست بفرستید
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {myRequests.slice(0, 4).map((request) => (
                    <li key={request.id} className="flex items-start gap-2.5 text-xs">
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{request.title}</span>
                        <span className="block text-[0.6875rem] text-subtle-foreground">
                          {formatRelativeTime(request.createdAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <ButtonLink href="/profile/requests" variant="ghost" size="sm" className="mt-4">
                پیگیری همه درخواست‌ها
              </ButtonLink>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delayMs={140}>
          <Card className="h-full">
            <CardContent className="p-5 pt-5">
              <SectionHeading title="وضعیت گواهی" />
              {certificate ? (
                <div className="mt-3 space-y-2">
                  <Badge tone="success">صادر شده</Badge>
                  <p className="text-xs text-muted-foreground">
                    شماره گواهی: <span dir="ltr" className="font-mono">{certificate.code}</span>
                  </p>
                  <ButtonLink href="/certificate" size="sm" variant="outline" className="mt-1">
                    دیدن گواهی
                  </ButtonLink>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    پس از تکمیل همه درس‌ها و قبولی در همه آزمون‌ها، گواهی شما صادر می‌شود.
                  </p>
                  <Progress value={progress.percent} tone={progress.percent >= 100 ? "success" : "primary"} />
                </div>
              )}

              {recentlyViewed.length > 0 ? (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-[0.6875rem] font-bold text-muted-foreground">اخیراً دیده‌اید</p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
                    {recentlyViewed.slice(0, 3).map((item) => (
                      <li key={item.lesson.id} className="truncate">
                        • {item.lesson.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </Reveal>
      </section>

      <Reveal>
        <Card className="border-accent/30 bg-accent-soft/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 pt-5 sm:p-6 sm:pt-6">
            <div className="min-w-0">
              <p className="text-sm font-bold">از این پروژه حمایت کنید</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                ساخت درس‌ها و تمرین‌های بعدی زمان می‌برد؛ هر حمایتی به ادامه راه کمک می‌کند.
              </p>
            </div>
            <DonateButtonAuto />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
