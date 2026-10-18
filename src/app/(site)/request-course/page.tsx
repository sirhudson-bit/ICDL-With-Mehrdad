import type { Metadata } from "next";

import { CourseRequestForm } from "@/components/forms/public-forms";
import { getIcon } from "@/components/icon";
import { Reveal } from "@/components/fx/reveal";
import { Alert, Card, CardContent } from "@/components/ui/primitives";
import { Container } from "@/components/ui/container";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";

export const metadata: Metadata = {
  title: "درخواست ساخت دوره",
  description:
    "دوره‌ای که لازم دارید در فهرست نیست؟ با فرم درخواست دوره، موضوع و نیاز خود را بگویید تا در برنامه بعدی گنجانده شود.",
  alternates: { canonical: "/request-course" },
};

/**
 * Course request page.
 *
 * Showing recent requests (and their status) turns an empty form into a visible
 * roadmap, so a visitor can see that requests are actually read and acted on
 * rather than collected into a void.
 */
export default async function RequestCoursePage() {
  const user = await getCurrentUser();

  const [recent, counts] = await Promise.all([
    prisma.courseRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, category: true, status: true, createdAt: true },
    }),
    prisma.courseRequest.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  const RequestIcon = getIcon("Rocket");
  const CheckIcon = getIcon("CheckCircle2");

  const builtCount = counts.find((row) => row.status === "DONE")?._count.status ?? 0;
  const plannedCount =
    (counts.find((row) => row.status === "PLANNED")?._count.status ?? 0) +
    (counts.find((row) => row.status === "IN_PROGRESS")?._count.status ?? 0);

  return (
    <Container size="default" className="py-8 sm:py-12">
      <header className="text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-3xl bg-accent-soft text-accent">
          <RequestIcon size={28} aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-xl font-bold sm:text-2xl">درخواست ساخت دوره</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          دوره‌ای که به آن نیاز دارید در فهرست نیست؟ اینجا بنویسید. درخواست‌ها بررسی و بر اساس تعداد
          درخواست و اولویت، برنامه‌ریزی می‌شوند.
        </p>
      </header>

      <Reveal>
      {builtCount > 0 || plannedCount > 0 ? (
        <div className="mx-auto mt-6 flex max-w-lg flex-wrap justify-center gap-2">
          {builtCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success">
              <CheckIcon size={14} aria-hidden="true" />
              {toPersianDigits(builtCount)} دوره از درخواست‌ها ساخته شده است
            </span>
          ) : null}
          {plannedCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
              {toPersianDigits(plannedCount)} دوره در برنامه ساخت است
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
            <h2 className="text-base font-bold">فرم درخواست</h2>
            <div className="mt-5">
              <CourseRequestForm defaultName={user?.name} defaultEmail={user?.email} />
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardContent className="p-5 pt-5">
              <h2 className="text-sm font-bold">درخواست‌های اخیر</h2>
              {recent.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  هنوز درخواستی ثبت نشده است. اولین نفر باشید.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {recent.map((request) => (
                    <li key={request.id} className="flex items-start gap-2.5">
                      <span
                        className={
                          request.status === "DONE"
                            ? "mt-1 size-2 shrink-0 rounded-full bg-success"
                            : request.status === "DECLINED"
                              ? "mt-1 size-2 shrink-0 rounded-full bg-border-strong"
                              : "mt-1 size-2 shrink-0 rounded-full bg-primary"
                        }
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">{request.title}</span>
                        <span className="block text-[0.6875rem] text-subtle-foreground">
                          {statusLabel(request.status)}
                          {request.category ? ` • ${request.category}` : ""} •{" "}
                          {formatRelativeTime(request.createdAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Alert tone="info" title="چطور سریع‌تر ساخته می‌شود؟">
            <p>
              هر چه توضیح دقیق‌تر و کاربرد مشخص‌تر باشد، اولویت بالاتری می‌گیرد. اگر دوره مشابهی هست که
              ناقص است، همان را نام ببرید تا تکمیل شود.
            </p>
          </Alert>
        </aside>
      </div>
      </Reveal>
    </Container>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    NEW: "در انتظار بررسی",
    PLANNED: "برنامه‌ریزی‌شده",
    IN_PROGRESS: "در حال ساخت",
    DONE: "ساخته شده",
    DECLINED: "رد شده",
  };
  return map[status] ?? status;
}
