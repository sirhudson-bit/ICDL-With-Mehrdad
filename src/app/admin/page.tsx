import Link from "next/link";
import type { Metadata } from "next";

import { BarChart, DonutChart, ProgressRing } from "@/components/admin/charts";
import { CountUp } from "@/components/admin/count-up";
import { getIcon } from "@/components/icon";
import { Badge, Card, CardContent, ButtonLink, StatTile } from "@/components/ui/primitives";
import { formatRelativeTime, formatPercent, toPersianDigits } from "@/lib/persian";
import { getAdminDashboard } from "@/services/stats-service";

export const metadata: Metadata = {
  title: "داشبورد مدیریت",
  robots: { index: false, follow: false },
};

/** Admin dashboard: platform health, content inventory and learner activity. */
export default async function AdminDashboardPage() {
  const data = await getAdminDashboard();
  const { counts } = data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">داشبورد</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          نمای کلی از وضعیت محتوا، کاربران و فعالیت یادگیرندگان.
        </p>
      </header>

      {/* Key numbers */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "کاربران",
            value: counts.users,
            icon: "Users",
            hint: `${toPersianDigits(counts.activeUsers)} فعال • ${toPersianDigits(counts.admins)} مدیر`,
          },
          {
            label: "درس‌های منتشرشده",
            value: counts.publishedLessons,
            icon: "BookOpen",
            hint: `از مجموع ${toPersianDigits(counts.lessons)} درس`,
          },
          {
            label: "بلوک محتوا",
            value: counts.blocks,
            icon: "ListChecks",
            hint: `${toPersianDigits(counts.questions)} پرسش آزمون`,
          },
          {
            label: "آزمون‌های داده‌شده",
            value: counts.quizAttempts,
            icon: "ClipboardCheck",
            hint: `میانگین نمره ${formatPercent(data.progressStats.averageQuizScore)}`,
          },
        ].map((tile, index) => (
          <div
            key={tile.label}
            className="h-full animate-[var(--animate-fade-up)]"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <StatTile
              className="h-full"
              label={tile.label}
              value={<CountUp value={tile.value} />}
              icon={tile.icon}
              hint={tile.hint}
            />
          </div>
        ))}
      </section>

      {/* Charts */}
      <section
        className="grid animate-[var(--animate-fade-up)] gap-4 lg:grid-cols-3"
        style={{ animationDelay: "140ms" }}
      >
        <Card className="lg:col-span-2">
          <CardContent className="p-5 pt-5">
            <h2 className="text-sm font-bold">تکمیل درس‌ها به تفکیک ماژول</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              مجموع درس‌هایی که کاربران تکمیل کرده‌اند.
            </p>
            <div className="mt-4">
              <BarChart data={data.moduleCompletion} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 pt-5">
            <h2 className="text-sm font-bold">نتیجه آزمون‌ها</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">میزان قبولی در همه آزمون‌ها</p>
            <div className="mt-4">
              <DonutChart
                segments={data.quizOutcome}
                centerValue={formatPercent(data.progressStats.quizPassRate)}
                centerLabel="قبولی"
              />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <ProgressRing
                value={counts.completionRate}
                label="نسبت درس‌های تکمیل‌شده به کل درس‌ها"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Lists */}
      <section
        className="grid animate-[var(--animate-fade-up)] gap-4 lg:grid-cols-3"
        style={{ animationDelay: "220ms" }}
      >
        <Card>
          <CardContent className="p-5 pt-5">
            <h2 className="text-sm font-bold">پربازدیدترین درس‌ها</h2>
            {data.topLessons.length === 0 ? (
              <p className="mt-3 text-xs text-subtle-foreground">هنوز فعالیتی ثبت نشده است.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {data.topLessons.map((lesson) => (
                  <li key={lesson.href}>
                    <Link
                      href={lesson.href}
                      className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs transition-colors hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      <Badge tone="outline" size="sm">
                        {toPersianDigits(lesson.views)} بازدید
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 pt-5">
            <h2 className="text-sm font-bold">پر جستجوترین موضوع‌ها</h2>
            {data.topSearches.length === 0 ? (
              <p className="mt-3 text-xs text-subtle-foreground">جستجویی ثبت نشده است.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {data.topSearches.map((item) => (
                  <li key={item.query} className="flex items-center gap-2 text-xs">
                    <SearchGlyph />
                    <span className="min-w-0 flex-1 truncate">{item.query}</span>
                    <span className="shrink-0 text-subtle-foreground tabular-nums">
                      {toPersianDigits(item.count)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 pt-5">
            <h2 className="text-sm font-bold">پرسش‌های پرتکرار از چت‌بات</h2>
            <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
              {toPersianDigits(counts.chatQuestions)} پرسش ثبت شده است
            </p>
            {data.topQuestions.length === 0 ? (
              <p className="mt-3 text-xs text-subtle-foreground">هنوز پرسشی پرسیده نشده است.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {data.topQuestions.map((item) => (
                  <li key={item.question} className="flex items-start gap-2 text-xs">
                    <BotGlyph />
                    <span className="min-w-0 flex-1 leading-relaxed">{item.question}</span>
                    <span className="shrink-0 text-subtle-foreground tabular-nums">
                      {toPersianDigits(item.count)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quiz performance */}
      <Card className="animate-[var(--animate-fade-up)]" style={{ animationDelay: "300ms" }}>
        <CardContent className="p-5 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">عملکرد آزمون‌ها</h2>
            <ButtonLink href="/admin/content" variant="ghost" size="sm">
              مدیریت آزمون‌ها
            </ButtonLink>
          </div>

          {data.quizOverview.length === 0 ? (
            <p className="mt-3 text-xs text-subtle-foreground">آزمونی ساخته نشده است.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-card-muted">
                    {["آزمون", "درس", "تعداد تلاش", "نرخ قبولی", "میانگین نمره"].map((header) => (
                      <th key={header} scope="col" className="border-b border-border px-3 py-2 text-start text-xs font-bold text-muted-foreground">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.quizOverview.map((quiz) => (
                    <tr key={quiz.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2.5">{quiz.title}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{quiz.lessonTitle}</td>
                      <td className="px-3 py-2.5 tabular-nums">{toPersianDigits(quiz.attempts)}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={quiz.passRate >= 70 ? "success" : quiz.attempts === 0 ? "outline" : "warning"}>
                          {formatPercent(quiz.passRate)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{formatPercent(quiz.averageScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity + new users */}
      <section
        className="grid animate-[var(--animate-fade-up)] gap-4 lg:grid-cols-2"
        style={{ animationDelay: "360ms" }}
      >
        <Card>
          <CardContent className="p-5 pt-5">
            <h2 className="text-sm font-bold">فعالیت‌های اخیر</h2>
            {data.recentActivity.length === 0 ? (
              <p className="mt-3 text-xs text-subtle-foreground">فعالیتی ثبت نشده است.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {data.recentActivity.map((activity) => (
                  <li key={activity.id} className="flex items-start gap-2.5 text-xs">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block leading-relaxed">{activity.message}</span>
                      <span className="block text-subtle-foreground">
                        {activity.user?.name ?? "سیستم"} • {formatRelativeTime(activity.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">کاربران جدید</h2>
              <ButtonLink href="/admin/users" variant="ghost" size="sm">
                مدیریت کاربران
              </ButtonLink>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {data.recentUsers.map((user) => (
                <li key={user.id} className="flex items-center gap-2.5 text-xs">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted font-bold">
                    {user.name.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{user.name}</span>
                    <span dir="ltr" className="block truncate text-subtle-foreground">
                      {user.email}
                    </span>
                  </span>
                  <Badge tone={user.role === "ADMIN" ? "primary" : "outline"} size="sm">
                    {user.role === "ADMIN" ? "مدیر" : "کاربر"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SearchGlyph() {
  const Icon = getIcon("Search");
  return <Icon size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />;
}
function BotGlyph() {
  const Icon = getIcon("Bot");
  return <Icon size={13} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />;
}
