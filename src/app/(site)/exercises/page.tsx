import Link from "next/link";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { Reveal } from "@/components/fx/reveal";
import { Badge, ButtonLink, Card, CardContent, EmptyState, Progress, SectionHeading } from "@/components/ui/primitives";
import { Container } from "@/components/ui/container";
import { EXERCISE_KIND_LABELS } from "@/lib/content/block-library";
import { getCurrentUser } from "@/lib/auth/session";
import { toPersianDigits } from "@/lib/persian";
import { getTopicGroup } from "@/lib/topics";
import { prisma } from "@/lib/db";
import { getLessonProgressMap } from "@/services/progress-service";

export const metadata: Metadata = {
  title: "تمرین‌های عملی",
  description:
    "همه تمرین‌های عملی دوره ICDL در یک جا: تمرین‌های تعاملی هر درس، گروه‌بندی‌شده بر اساس ماژول. تمرین‌ها اختیاری‌اند.",
  alternates: { canonical: "/exercises" },
};

// Exercises must never be served from a cache: completion state changes as soon
// as a learner finishes a lesson.
export const dynamic = "force-dynamic";

/** An icon per exercise kind, so a card can be recognised before it is read. */
const KIND_ICONS: Record<string, string> = {
  mcq: "ListChecks",
  trueFalse: "CheckCircle2",
  fillBlank: "Type",
  matching: "GitBranch",
  orderSteps: "ListOrdered",
  excelFormula: "Table2",
  wordFormat: "FileText",
  browserSearch: "Globe",
  fileExplorer: "FolderTree",
  emailCompose: "Mail",
};

/**
 * Exercises, gathered in one place.
 *
 * Redesigned so the practical side of the course reads as progress rather than
 * an undifferentiated list: a completion summary at the top, one card per
 * module with its own bar, and two columns of exercise cards that state the
 * exercise type, the lesson it belongs to, and whether it is done.
 *
 * Exercises remain optional: nothing here gates the final exam or a certificate.
 */
export default async function ExercisesPage() {
  const user = await getCurrentUser();

  const blocks = await prisma.lessonBlock.findMany({
    where: {
      type: "exercise",
      isVisible: true,
      lesson: { isPublished: true, chapter: { isPublished: true, module: { isPublished: true } } },
    },
    orderBy: [
      { lesson: { chapter: { module: { order: "asc" } } } },
      { lesson: { chapter: { order: "asc" } } },
      { lesson: { order: "asc" } },
      { order: "asc" },
    ],
    select: {
      id: true,
      data: true,
      lesson: {
        select: {
          id: true,
          slug: true,
          title: true,
          chapter: {
            select: {
              title: true,
              module: { select: { slug: true, title: true, icon: true, color: true, group: true } },
            },
          },
        },
      },
    },
  });

  const progressMap = user ? await getLessonProgressMap(user.id) : new Map();
  const completedLessonIds = new Set(
    [...progressMap.entries()].filter(([, state]) => state.status === "COMPLETED").map(([id]) => id),
  );

  const grouped = new Map<
    string,
    {
      moduleSlug: string;
      moduleTitle: string;
      moduleIcon: string;
      moduleColor: string;
      group: string;
      items: { id: string; kind: string; title: string; lessonSlug: string; lessonTitle: string; done: boolean }[];
    }
  >();

  for (const block of blocks) {
    const data = (block.data ?? {}) as Record<string, unknown>;
    const courseModule = block.lesson.chapter.module;
    // The exercise type lives inside the payload (`data.exercise.kind`), not on
    // the block itself; reading `data.kind` silently fell back to "تمرین".
    const payload = (data.exercise ?? {}) as { kind?: unknown };
    const kind = typeof payload.kind === "string" ? payload.kind : "exercise";
    const title =
      typeof data.title === "string" && data.title.trim().length > 0
        ? data.title
        : `${EXERCISE_KIND_LABELS[kind as keyof typeof EXERCISE_KIND_LABELS] ?? "تمرین"} — ${block.lesson.title}`;

    const bucket = grouped.get(courseModule.slug) ?? {
      moduleSlug: courseModule.slug,
      moduleTitle: courseModule.title,
      moduleIcon: courseModule.icon,
      moduleColor: courseModule.color,
      group: courseModule.group,
      items: [],
    };

    bucket.items.push({
      id: block.id,
      kind,
      title,
      lessonSlug: block.lesson.slug,
      lessonTitle: block.lesson.title,
      done: completedLessonIds.has(block.lesson.id),
    });

    grouped.set(courseModule.slug, bucket);
  }

  const modules = [...grouped.values()];
  const total = blocks.length;
  const done = modules.reduce((sum, item) => sum + item.items.filter((entry) => entry.done).length, 0);

  const ToolsIcon = getIcon("MousePointerClick");
  const CheckIcon = getIcon("CheckCircle2");
  const ArrowIcon = getIcon("ArrowLeft");

  return (
    <Container size="default" className="py-8 sm:py-10">
      <header>
        <h1 className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ToolsIcon size={22} aria-hidden="true" />
          </span>
          تمرین‌های عملی
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          همه تمرین‌های تعاملی دوره، در یک فهرست. تمرین‌ها <strong>اختیاری</strong> هستند و برای فعال شدن آزمون
          نهایی الزامی نیستند — اما یادگیری را تثبیت می‌کنند.
        </p>
      </header>

      {total === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="MousePointerClick"
            title="هنوز تمرینی ثبت نشده است"
            description="مدیر سایت می‌تواند از پنل مدیریت، تمرین‌های عملی را به درس‌ها اضافه کند."
          />
        </div>
      ) : (
        <>
          {/* Summary: progress first, because that is what a returning learner
              wants to know before scrolling the whole list. */}
          <Reveal className="mt-6">
            <Card className="overflow-hidden border-primary/25 bg-primary-soft/30">
              <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {toPersianDigits(total)} تمرین در {toPersianDigits(modules.length)} ماژول
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {user
                        ? `${toPersianDigits(done)} تمرین در درس‌های تکمیل‌شده دارید.`
                        : "برای ثبت پیشرفت تمرین‌ها، وارد حساب کاربری شوید."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="outline">{toPersianDigits(modules.length)} ماژول</Badge>
                    <Badge tone={user && done === total ? "success" : "primary"}>
                      {toPersianDigits(total)} تمرین
                    </Badge>
                  </div>
                </div>

                {user ? (
                  <Progress
                    className="mt-4"
                    value={total === 0 ? 0 : (done / total) * 100}
                    tone={done === total ? "success" : "primary"}
                  />
                ) : (
                  <p className="mt-4 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    سرفصل تمرین‌ها آزاد است؛ برای انجام دادن آن‌ها{" "}
                    <Link href="/login" className="font-medium text-primary hover:underline">
                      وارد حساب کاربری
                    </Link>{" "}
                    شوید.
                  </p>
                )}
              </CardContent>
            </Card>
          </Reveal>

          <div className="mt-8 space-y-6">
            {modules.map((courseModule, index) => {
              const topic = getTopicGroup(courseModule.group);
              const ModuleIcon = getIcon(courseModule.moduleIcon);
              const moduleDone = courseModule.items.filter((item) => item.done).length;
              const allDone = moduleDone === courseModule.items.length;

              return (
                <Reveal
                  as="section"
                  key={courseModule.moduleSlug}
                  delayMs={Math.min(index, 4) * 60}
                  className={`cv-auto tone-${courseModule.moduleColor}`}
                >
                  <Card className="tone-surface overflow-hidden">
                    <CardContent className="p-5 pt-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="tone-icon inline-flex size-10 shrink-0 items-center justify-center rounded-2xl">
                          <ModuleIcon size={20} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-sm font-bold sm:text-base">{courseModule.moduleTitle}</h2>
                          <p className="text-[0.6875rem] text-muted-foreground">
                            {topic.title} • {toPersianDigits(courseModule.items.length)} تمرین
                            {user ? ` • ${toPersianDigits(moduleDone)} انجام‌شده` : ""}
                          </p>
                        </div>
                        {user ? (
                          <Badge tone={allDone ? "success" : "outline"} size="sm">
                            {toPersianDigits(
                              courseModule.items.length === 0
                                ? 0
                                : Math.round((moduleDone / courseModule.items.length) * 100),
                            )}
                            ٪
                          </Badge>
                        ) : null}
                      </div>

                      {user ? (
                        <Progress
                          className="mt-3.5"
                          value={(moduleDone / courseModule.items.length) * 100}
                          tone={allDone ? "success" : "primary"}
                        />
                      ) : null}

                      {/* Two columns: the exercise cards carry enough information
                          now that a single column wasted the width. */}
                      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {courseModule.items.map((item) => {
                          const kindLabel =
                            EXERCISE_KIND_LABELS[item.kind as keyof typeof EXERCISE_KIND_LABELS] ?? "تمرین";
                          const KindIcon = getIcon(KIND_ICONS[item.kind] ?? "ListChecks");

                          return (
                            <li key={item.id}>
                              <Card className="h-full transition-transform duration-200 hover:-translate-y-0.5">
                                <CardContent className="flex h-full flex-col gap-2.5 p-4 pt-4">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge tone="info" size="sm">
                                      <KindIcon size={13} aria-hidden="true" />
                                      {kindLabel}
                                    </Badge>
                                    {item.done ? (
                                      <Badge tone="success" size="sm">
                                        <CheckIcon size={13} aria-hidden="true" />
                                        انجام شده
                                      </Badge>
                                    ) : null}
                                  </div>

                                  <p className="text-sm font-bold leading-relaxed">{item.title}</p>
                                  <p className="text-[0.6875rem] text-subtle-foreground">{item.lessonTitle}</p>

                                  <ButtonLink
                                    href={`/course/${courseModule.moduleSlug}/${item.lessonSlug}#${item.id}`}
                                    variant={item.done ? "outline" : "primary"}
                                    size="sm"
                                    className="mt-auto self-start"
                                  >
                                    {item.done ? "تمرین دوباره" : "انجام تمرین"}
                                    <ArrowIcon size={15} aria-hidden="true" />
                                  </ButtonLink>
                                </CardContent>
                              </Card>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                </Reveal>
              );
            })}
          </div>

          <SectionHeading
            className="mt-10"
            title="تمرین‌ها بخشی از مسیر یادگیری‌اند"
            description="پس از تمرین، آزمون همان درس را بدهید تا درس برای شما تکمیل شود."
          />
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/course" variant="outline">
              فهرست دوره و آزمون‌ها
            </ButtonLink>
            {user ? (
              <ButtonLink href="/profile/exercises" variant="ghost">
                تمرین‌های من
              </ButtonLink>
            ) : (
              <ButtonLink href="/progress" variant="ghost">
                پیشرفت من
              </ButtonLink>
            )}
          </div>
        </>
      )}
    </Container>
  );
}
