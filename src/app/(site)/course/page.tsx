import type { Metadata } from "next";

import { Reveal } from "@/components/fx/reveal";
import { getIcon } from "@/components/icon";
import { Badge, ButtonLink, Card, CardContent, Progress, SectionHeading } from "@/components/ui/primitives";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDuration, formatPercent, toPersianDigits } from "@/lib/persian";
import { getTopicGroup } from "@/lib/topics";
import { getCourseStats, getCourseTree } from "@/services/course-service";
import { getContinueLearning, getCourseProgress, getModuleProgress } from "@/services/progress-service";
import { getAllSettings } from "@/services/settings-service";

export const metadata: Metadata = {
  title: "دوره‌ها و سرفصل‌ها",
  description:
    "فهرست کامل ماژول‌ها و درس‌های دوره ICDL به ترتیب یادگیری، همراه با توضیح آزمون نهایی و شرایط دریافت گواهی.",
  alternates: { canonical: "/course" },
};

/**
 * Courses page.
 *
 * Deliberately *not* the homepage layout: a homepage sells the platform, this
 * page has to let a learner see the whole syllabus, understand the order, and
 * start. So it opens with the course itself, states the outcome, gives the final
 * exam its own section with the unlock rule, then lays every module and lesson
 * out as one numbered timeline that reveals as you scroll.
 */
export default async function CoursesPage() {
  const [user, settings, stats, modules] = await Promise.all([
    getCurrentUser(),
    getAllSettings(),
    getCourseStats(),
    getCourseTree(),
  ]);

  const [courseProgress, moduleProgress, continueLearning] = await Promise.all([
    user ? getCourseProgress(user.id) : Promise.resolve(null),
    user ? getModuleProgress(user.id) : Promise.resolve([]),
    user ? getContinueLearning(user.id) : Promise.resolve(null),
  ]);

  const percentByModule = new Map(moduleProgress.map((item) => [item.moduleSlug, item.percent]));
  const currentModuleSlug = modules.find(
    (courseModule) => (percentByModule.get(courseModule.slug) ?? 0) < 100,
  )?.slug;

  const startHref = modules[0] ? `/course/${modules[0].slug}` : "/register";
  const continueHref = continueLearning
    ? `/course/${continueLearning.lesson.chapter.module.slug}/${continueLearning.lesson.slug}`
    : startHref;

  const lessonTotal = modules.reduce(
    (total, courseModule) =>
      total + courseModule.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0),
    0,
  );
  const strandCount = new Set(modules.map((courseModule) => courseModule.group)).size;
  const courseDone = (courseProgress?.percent ?? 0) >= 100;

  /*
   * Lesson numbers are computed once, before rendering, rather than counting up
   * inside the JSX: mutating a variable during render is what the immutability
   * lint rule (rightly) forbids.
   */
  const lessonNumber = new Map<string, number>();
  let running = 0;
  for (const courseModule of modules) {
    for (const chapter of courseModule.chapters) {
      for (const lesson of chapter.lessons) {
        running += 1;
        lessonNumber.set(lesson.id, running);
      }
    }
  }

  const ArrowIcon = getIcon("ArrowLeft");
  const AwardIcon = getIcon("Award");
  const LockIcon = getIcon("Lock");
  const CheckIcon = getIcon("CheckCircle2");
  const BookIcon = getIcon("BookOpen");
  const ClockIcon = getIcon("Clock");
  const QuizIcon = getIcon("ClipboardCheck");
  const StrandIcon = getIcon("FolderTree");

  const facts = [
    { key: "lessons", Icon: BookIcon, label: "درس", value: toPersianDigits(stats.lessons) },
    { key: "time", Icon: ClockIcon, label: "زمان تخمینی", value: formatDuration(stats.totalMinutes) },
    { key: "questions", Icon: QuizIcon, label: "پرسش آزمون", value: toPersianDigits(stats.questions) },
    { key: "strands", Icon: StrandIcon, label: "شاخه موضوعی", value: toPersianDigits(strandCount) },
  ];

  return (
    <div className="pb-4">
      {/* ── Course introduction ──────────────────────────────── */}
      <section className="border-b border-border bg-card">
        <Container size="default" className="py-9 sm:py-11">
          <Badge tone="primary">
            {toPersianDigits(stats.modules)} ماژول • {toPersianDigits(lessonTotal)} درس
          </Badge>

          <h1 className="mt-3.5 text-2xl font-bold leading-snug sm:text-3xl">{settings.course.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{settings.course.subtitle}</p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {settings.course.description}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.key} className="flex items-center gap-3 rounded-2xl border border-border p-3.5">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <fact.Icon size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[0.6875rem] text-muted-foreground">{fact.label}</dt>
                  <dd className="text-sm font-bold">{fact.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          {user && courseProgress ? (
            <div className="mt-6 rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {courseDone ? "دوره را کامل کرده‌اید" : courseProgress.percent > 0 ? "در حال یادگیری" : "شروع نشده"}
                </span>
                <span className="font-bold tabular-nums">{formatPercent(courseProgress.percent)}</span>
              </div>
              <Progress
                className="mt-2.5"
                value={courseProgress.percent}
                tone={courseDone ? "success" : "primary"}
              />
              <p className="mt-2 text-xs text-subtle-foreground">
                {toPersianDigits(courseProgress.completedLessons)} از{" "}
                {toPersianDigits(courseProgress.totalLessons)} درس تکمیل شده
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ButtonLink href={continueHref} size="lg">
              {continueLearning ? "ادامه یادگیری" : user ? "شروع یادگیری" : "ساخت حساب و شروع"}
              <ArrowIcon size={19} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="#syllabus" variant="outline" size="lg">
              دیدن سرفصل‌ها
            </ButtonLink>
          </div>

          {!user ? (
            <p className="mt-4 text-xs leading-relaxed text-subtle-foreground">
              سرفصل‌ها برای همه آزاد است. برای خواندن درس‌ها، آزمون‌ها و دریافت گواهی، یک حساب رایگان بسازید.
            </p>
          ) : null}
        </Container>
      </section>

      {/* ── Outcome ─────────────────────────────────────────── */}
      <Container size="default" className="py-9">
        <SectionHeading
          title="پس از این دوره چه کارهایی می‌توانید انجام دهید؟"
          description="هر کار، متناظر با یکی از ماژول‌های فهرست زیر است."
        />
        <ul className="grid gap-3 sm:grid-cols-2">
          {modules.map((courseModule, index) => (
            <Reveal key={courseModule.id} delayMs={index * 40}>
              <li className="flex h-full items-start gap-3 rounded-2xl border border-border p-4">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                  {toPersianDigits(courseModule.number)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{courseModule.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {courseModule.description.slice(0, 120)}
                    {courseModule.description.length > 120 ? "…" : ""}
                  </span>
                </span>
              </li>
            </Reveal>
          ))}
        </ul>
      </Container>

      {/* ── Syllabus as one numbered timeline ──────────────── */}
      <div id="syllabus" className="scroll-mt-20 border-t border-border bg-card-muted/40">
        <Container size="default" className="py-9">
          <SectionHeading
            title="مسیر یادگیری، مرحله به مرحله"
            description={`${toPersianDigits(lessonTotal)} درس به ترتیب. هر درس پس از تکمیل درس‌های قبلی باز می‌شود.`}
          />

          <ol className="relative flex flex-col gap-8">
            {/* The spine of the timeline */}
            <span aria-hidden="true" className="absolute inset-y-0 end-[0.9375rem] w-px bg-border sm:end-[1.0625rem]" />

            {modules.map((courseModule) => {
              const topic = getTopicGroup(courseModule.group);
              const ModuleIcon = getIcon(courseModule.icon);
              const percent = percentByModule.get(courseModule.slug) ?? 0;
              const moduleLessons = courseModule.chapters.flatMap((chapter) =>
                chapter.lessons.map((lesson) => ({ lesson, chapter })),
              );

              return (
                      <Reveal key={courseModule.id} delayMs={60} className="cv-auto">
                  <li className="relative">
                    <span className="absolute end-0 top-1 inline-flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground sm:size-9">
                      {toPersianDigits(courseModule.number)}
                    </span>

                    <div className="pe-12 sm:pe-14">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="outline" size="sm">
                          {topic.title}
                        </Badge>
                        {percent >= 100 ? (
                          <Badge tone="success" size="sm">
                            <CheckIcon size={13} aria-hidden="true" />
                            تکمیل شده
                          </Badge>
                        ) : courseModule.slug === currentModuleSlug ? (
                          <Badge tone="primary" size="sm">
                            در حال یادگیری
                          </Badge>
                        ) : null}
                      </div>

                      <h3 className="mt-2 flex items-center gap-2 text-base font-bold">
                        <ModuleIcon size={19} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                        {courseModule.title}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {courseModule.description.slice(0, 160)}
                        {courseModule.description.length > 160 ? "…" : ""}
                      </p>

                      {user ? (
                        <Progress
                          className="mt-3 max-w-md"
                          value={percent}
                          tone={percent >= 100 ? "success" : "primary"}
                        />
                      ) : null}

                      <ol className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {moduleLessons.map(({ lesson, chapter }) => (
                          <li key={lesson.id}>
                            <a
                              href={`/course/${courseModule.slug}/${lesson.slug}`}
                              className="flex items-baseline gap-2.5 rounded-xl px-2.5 py-2 text-xs transition-colors hover:bg-muted"
                            >
                              <span className="w-6 shrink-0 text-end font-bold tabular-nums text-muted-foreground">
                                {toPersianDigits(lessonNumber.get(lesson.id) ?? 0)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium">{lesson.title}</span>
                                <span className="block text-[0.6875rem] text-subtle-foreground">
                                  {chapter.title} • {formatDuration(lesson.estimatedMinutes)}
                                </span>
                              </span>
                            </a>
                          </li>
                        ))}
                      </ol>

                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        <ButtonLink href={`/course/${courseModule.slug}`} variant="outline" size="sm">
                          {percent >= 100 ? "مرور ماژول" : percent > 0 ? "ادامه ماژول" : "شروع ماژول"}
                        </ButtonLink>
                        <span className="text-[0.6875rem] text-subtle-foreground">
                          {toPersianDigits(moduleLessons.length)} درس •{" "}
                          {formatDuration(courseModule.estimatedMinutes)}
                        </span>
                      </div>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </Container>
      </div>

      {/* ── Final exam: the last step, given its own weight ─── */}
      <Container size="default" className="py-9">
        <Reveal>
          <Card className="border-accent/40 bg-accent-soft/30">
            <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
              <div className="flex flex-wrap items-start gap-4">
                <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <AwardIcon size={27} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold sm:text-lg">آزمون نهایی دوره</h2>
                    <Badge tone="warning" size="sm">
                      <LockIcon size={12} aria-hidden="true" />
                      آخرین مرحله
                    </Badge>
                  </div>

                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    آزمون نهایی پایان‌بخش دوره است و پس از همه درس‌ها قرار می‌گیرد. تمرین‌های عملی اختیاری‌اند،
                    اما قبولی در این آزمون برای تکمیل دوره و دریافت گواهی الزامی است.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-card p-3.5">
                      <p className="text-xs font-bold">شرط فعال شدن</p>
                      <ul className="mt-1.5 flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
                        <li className="flex items-start gap-1.5">
                          <CheckIcon size={13} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                          تکمیل همه {toPersianDigits(lessonTotal)} درس دوره
                        </li>
                        <li className="flex items-start gap-1.5">
                          <CheckIcon size={13} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                          قبولی در آزمون همه درس‌ها
                        </li>
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-3.5">
                      <p className="text-xs font-bold">پس از قبولی</p>
                      <ul className="mt-1.5 flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
                        <li>• دوره به‌صورت کامل تکمیل می‌شود</li>
                        <li>• گواهی پایان دوره صادر می‌شود</li>
                        <li>• می‌توانید گواهی را چاپ یا استعلام کنید</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {!user ? (
                      <ButtonLink href="/register" size="lg">
                        ساخت حساب برای شرکت در آزمون
                        <ArrowIcon size={18} aria-hidden="true" />
                      </ButtonLink>
                    ) : courseDone ? (
                      <ButtonLink href="/certificate" size="lg">
                        دریافت گواهی پایان دوره
                        <ArrowIcon size={18} aria-hidden="true" />
                      </ButtonLink>
                    ) : (
                      <ButtonLink href={continueHref} size="lg">
                        ادامه درس‌ها تا فعال شدن آزمون
                        <ArrowIcon size={18} aria-hidden="true" />
                      </ButtonLink>
                    )}
                    <ButtonLink href="/certificate/verify" variant="ghost" size="lg">
                      استعلام گواهی
                    </ButtonLink>
                  </div>

                  {/*
                    Stated plainly rather than showing a button that does nothing:
                    the exam is not yet an attemptable step in the product.
                  */}
                  <p className="mt-3 text-[0.6875rem] leading-relaxed text-subtle-foreground">
                    آزمون نهایی هنوز به‌صورت یک مرحله قابل شرکت در سایت پیاده‌سازی نشده است؛ در حال حاضر تکمیل
                    درس‌ها و قبولی در آزمون‌ها موجب صدور گواهی می‌شود.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <div className="mt-9 rounded-3xl border border-border bg-card px-5 py-9 text-center shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold">آماده شروع هستید؟</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {settings.course.certificateNote}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <ButtonLink href={continueHref} size="lg">
              {user ? "ادامه یادگیری" : "شروع از درس اول"}
              <ArrowIcon size={19} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/contact" variant="outline" size="lg">
              سؤال دارم
            </ButtonLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
