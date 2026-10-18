import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { Reveal } from "@/components/fx/reveal";
import { Badge, ButtonLink, Card, CardContent, EmptyState, Progress } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { EXERCISE_KIND_LABELS } from "@/lib/content/block-library";
import { toPersianDigits } from "@/lib/persian";
import { getTopicGroup } from "@/lib/topics";
import { prisma } from "@/lib/db";
import { getLessonProgressMap } from "@/services/progress-service";

export const metadata: Metadata = {
  title: "تمرین‌های من",
  description: "تمرین‌های عملی دوره و وضعیت انجام آن‌ها در حساب شما.",
  robots: { index: false, follow: false },
};

// Completion state changes as soon as a learner finishes a lesson, so this page
// must never be served from a cache.
export const dynamic = "force-dynamic";

/** An icon per exercise kind, so a row is recognisable before it is read. */
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
 * The learner's own exercises.
 *
 * Redesigned around one question — "what should I do next?" — so it shows a
 * single list per module with the remaining work first. The previous version
 * printed every exercise twice (once as "remaining", once grouped by module),
 * which made a short list feel like a long one.
 */
export default async function MyExercisesPage() {
  const user = await requireUser("/login?next=/profile/exercises");

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
          chapter: { select: { title: true, module: { select: { slug: true, title: true, icon: true, group: true } } } },
        },
      },
    },
  });

  const progressMap = await getLessonProgressMap(user.id);
  const completedLessonIds = new Set(
    [...progressMap.entries()].filter(([, state]) => state.status === "COMPLETED").map(([id]) => id),
  );

  const grouped = new Map<
    string,
    {
      moduleSlug: string;
      moduleTitle: string;
      moduleIcon: string;
      group: string;
      items: { id: string; kind: string; title: string; lessonSlug: string; lessonTitle: string; done: boolean }[];
    }
  >();

  for (const block of blocks) {
    const data = (block.data ?? {}) as Record<string, unknown>;
    const courseModule = block.lesson.chapter.module;
    // The exercise type lives inside the payload (`data.exercise.kind`).
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
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const nextUp = modules
    .flatMap((item) => item.items.map((entry) => ({ ...entry, moduleSlug: item.moduleSlug })))
    .find((entry) => !entry.done);

  const ToolsIcon = getIcon("MousePointerClick");
  const DoneIcon = getIcon("CheckCircle2");
  const ArrowIcon = getIcon("ArrowLeft");
  const PlayIcon = getIcon("PlayCircle");

  if (total === 0) {
    return (
      <EmptyState
        icon="MousePointerClick"
        title="هنوز تمرینی ثبت نشده است"
        description="به‌محض افزودن تمرین‌های عملی به درس‌ها، فهرست آن‌ها همین‌جا نمایش داده می‌شود."
      />
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ToolsIcon size={22} aria-hidden="true" />
          </span>
          تمرین‌های من
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          تمرین‌های عملی اختیاری‌اند، اما یادگیری را تثبیت می‌کنند. تمرینی که درسش را تکمیل کرده باشید،
          انجام‌شده حساب می‌شود.
        </p>
      </header>

      {/* One summary, one next action — nothing else competes for attention. */}
      <Reveal>
        <Card className="border-primary/25 bg-primary-soft/30">
          <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums">
                  {toPersianDigits(done)}
                  <span className="text-base font-medium text-muted-foreground">
                    {" "}
                    / {toPersianDigits(total)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {done === total ? "همه تمرین‌ها را انجام داده‌اید. آفرین!" : "تمرین انجام‌شده از کل تمرین‌ها"}
                </p>
              </div>

              {nextUp ? (
                <ButtonLink href={`/course/${nextUp.moduleSlug}/${nextUp.lessonSlug}#${nextUp.id}`}>
                  <PlayIcon size={17} aria-hidden="true" />
                  تمرین بعدی
                </ButtonLink>
              ) : (
                <Badge tone="success" size="lg">
                  <DoneIcon size={16} aria-hidden="true" />
                  تکمیل شده
                </Badge>
              )}
            </div>

            <Progress
              className="mt-4"
              value={percent}
              tone={done === total ? "success" : "primary"}
              label={`${toPersianDigits(percent)}٪ از تمرین‌ها انجام شده`}
            />
          </CardContent>
        </Card>
      </Reveal>

      {modules.map((courseModule, index) => {
        const ModuleIcon = getIcon(courseModule.moduleIcon);
        const topic = getTopicGroup(courseModule.group);
        const moduleDone = courseModule.items.filter((item) => item.done).length;
        const open = courseModule.items.filter((item) => !item.done);
        const closed = courseModule.items.filter((item) => item.done);

        return (
          <Reveal as="section" key={courseModule.moduleSlug} delayMs={Math.min(index, 4) * 50}>
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <ModuleIcon size={18} aria-hidden="true" />
              </span>
              <h2 className="text-sm font-bold sm:text-base">{courseModule.moduleTitle}</h2>
              <Badge tone="outline" size="sm">
                {topic.title}
              </Badge>
              <span className="text-xs text-subtle-foreground">
                {toPersianDigits(moduleDone)} از {toPersianDigits(courseModule.items.length)}
              </span>
            </div>

            <Card>
              <CardContent className="divide-y divide-border p-0">
                {/* Remaining work first, then what is already done. */}
                {[...open, ...closed].map((item) => {
                  const kindLabel =
                    EXERCISE_KIND_LABELS[item.kind as keyof typeof EXERCISE_KIND_LABELS] ?? "تمرین";
                  const KindIcon = getIcon(item.done ? "CheckCircle2" : (KIND_ICONS[item.kind] ?? "ListChecks"));

                  return (
                    <div key={item.id} className="flex flex-wrap items-center gap-3 p-3.5 sm:px-4">
                      <span
                        className={
                          item.done
                            ? "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success"
                            : "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                        }
                      >
                        <KindIcon size={17} aria-hidden="true" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span className="mt-0.5 block text-[0.6875rem] text-subtle-foreground">
                          {kindLabel} • {item.lessonTitle}
                        </span>
                      </span>

                      <ButtonLink
                        href={`/course/${courseModule.moduleSlug}/${item.lessonSlug}#${item.id}`}
                        variant={item.done ? "ghost" : "outline"}
                        size="sm"
                        className="shrink-0"
                      >
                        {item.done ? "تمرین دوباره" : "انجام تمرین"}
                        <ArrowIcon size={15} aria-hidden="true" />
                      </ButtonLink>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </Reveal>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/exercises" variant="outline">
          همه تمرین‌های دوره
        </ButtonLink>
        <ButtonLink href="/course" variant="ghost">
          فهرست درس‌ها
        </ButtonLink>
      </div>
    </div>
  );
}
