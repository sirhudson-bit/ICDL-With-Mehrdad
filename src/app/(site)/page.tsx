import Link from "next/link";

import { ModuleCard } from "@/components/course/module-card";
import { AnimatedCounter } from "@/components/fx/animated-counter";
import { Reveal } from "@/components/fx/reveal";
import { getIcon } from "@/components/icon";
import { LearningHero } from "@/components/illustrations";
import { SearchBox } from "@/components/search/search-box";
import { Container } from "@/components/ui/container";
import { GridPulse } from "@/components/ui/grid-pulse";
import { Badge, ButtonLink, Card, CardContent, Progress, SectionHeading } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDuration, toPersianDigits } from "@/lib/persian";
import { sortTopicGroups } from "@/lib/topics";
import { getCourseStats, getCourseTree } from "@/services/course-service";
import {
  getContinueLearning,
  getModuleProgress,
  getRecentlyViewed,
} from "@/services/progress-service";
import { getAllSettings } from "@/services/settings-service";

/**
 * Home page.
 *
 * Answers a beginner's first questions in order — what is this, where do I
 * continue, what does the course cover, who is it for — before the module list.
 * Curriculum strands get their own layer so the structure reads as
 * «آموزش آفیس ← Excel» rather than a flat list of nine titles. Section
 * visibility stays admin-configurable.
 */
export default async function HomePage() {
  const [user, settings, stats, modules] = await Promise.all([
    getCurrentUser(),
    getAllSettings(),
    getCourseStats(),
    getCourseTree(),
  ]);

  const home = settings.home;

  const [moduleProgress, continueLearning, recentlyViewed] = await Promise.all([
    user ? getModuleProgress(user.id) : Promise.resolve([]),
    user ? getContinueLearning(user.id) : Promise.resolve(null),
    user ? getRecentlyViewed(user.id, 4) : Promise.resolve([]),
  ]);

  const percentByModule = new Map(moduleProgress.map((item) => [item.moduleSlug, item.percent]));
  // The module to work through next: the first one not yet finished.
  const currentModuleSlug = modules.find(
    (courseModule) => (percentByModule.get(courseModule.slug) ?? 0) < 100,
  )?.slug;
  const grouped = sortTopicGroups(modules);
  const firstModule = modules[0];
  const startHref = firstModule ? `/course/${firstModule.slug}` : "/course";

  const continueHref = continueLearning
    ? `/course/${continueLearning.lesson.chapter.module.slug}/${continueLearning.lesson.slug}`
    : startHref;

  const ArrowIcon = getIcon("ArrowLeft");

  return (
    <>
      {/* Page backdrop.
          The body background propagates to the canvas, so a negative z-index
          layer paints above the page colour and below every in-flow block —
          including the footer that lives outside this route. It is `fixed`, so
          the grid is only ever viewport-sized and re-measures on resize, its
          canvas sleeps whenever nothing is lit, and `prefers-reduced-motion`
          leaves it as a still hairline grid. `no-print` keeps it off paper. */}
      <GridPulse className="no-print pointer-events-none fixed inset-0 -z-10" />

      <Container size="wide" className="relative py-6 sm:py-8">
        {/* ── Hero ───────────────────────────────────────────── */}
        {home.showHero ? (
          <section className="relative rounded-3xl border border-border bg-card/75 shadow-[var(--shadow-card)]">
            {/* The decorative wash is clipped on its own layer, so the hero itself
                must not carry `overflow-hidden` — that would clip the search
                suggestion dropdown and trap its stacking context. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
            >
              {/* Slow light-lines: the quiet motion that keeps the hero alive. */}
              <span className="hero-line top-[34%]" />
              <span className="hero-line hero-line--slow top-[66%]" />
            </div>

            <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:p-10">
              <div className="min-w-0">
                <Badge tone="primary" size="lg">
                  <Glyph name="Sparkles" size={15} />
                  {home.heroBadge}
                </Badge>

                <h1 className="mt-4 text-2xl font-bold leading-snug sm:text-3xl sm:leading-[1.4] lg:text-4xl lg:leading-[1.35]">
                  {home.heroTitle}
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {home.heroSubtitle}
                </p>

                <div className="relative z-30 mt-7 max-w-xl">
                  <SearchBox variant="hero" popularSearches={settings.search.popularQueries} />
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-subtle-foreground">جستجوهای پرتکرار:</span>
                    {settings.search.popularQueries.slice(0, 4).map((query) => (
                      <Link
                        key={query}
                        href={`/search?q=${encodeURIComponent(query)}`}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        {query}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <ButtonLink href={continueHref} size="lg">
                    {continueLearning ? "ادامه یادگیری" : "شروع یادگیری"}
                    <ArrowIcon size={19} aria-hidden="true" />
                  </ButtonLink>
                  <ButtonLink href="/course" variant="outline" size="lg">
                    دیدن همه ماژول‌ها
                  </ButtonLink>
                  {!user ? (
                    <ButtonLink href="/register" variant="ghost" size="lg">
                      ساخت حساب رایگان
                    </ButtonLink>
                  ) : null}
                </div>

                {!user ? (
                  <p className="mt-4 max-w-xl rounded-xl border border-border bg-card-muted px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    فهرست کامل دوره و سرفصل‌ها را می‌توانید آزادانه ببینید. برای خواندن محتوای درس‌ها، آزمون‌ها و
                    دریافت گواهی، یک حساب کاربری رایگان بسازید.
                  </p>
                ) : null}
              </div>

              <div className="hidden lg:block">
                <LearningHero />
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Continue learning ──────────────────────────────── */}
        {home.showContinueLearning && user && continueLearning ? (
          <Reveal className="mt-6">
            <Card className={`tone-${continueLearning.lesson.chapter.module.color}`}>
              <CardContent className="flex flex-col gap-4 p-5 pt-5 sm:flex-row sm:items-center sm:p-6">
                <span className="tone-icon inline-flex size-14 shrink-0 items-center justify-center rounded-2xl">
                  <Glyph name="PlayCircle" size={26} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-subtle-foreground">
                    {continueLearning.reason === "in_progress"
                      ? "از جایی که رها کردید"
                      : continueLearning.reason === "completed"
                        ? "دوره را کامل کرده‌اید — مرور کنید"
                        : "درس بعدی شما"}
                  </p>
                  <h2 className="mt-1 text-base font-bold sm:text-lg">{continueLearning.lesson.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {continueLearning.lesson.summary}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle-foreground">
                    <span>{continueLearning.lesson.chapter.module.title}</span>
                    <span aria-hidden="true">•</span>
                    <span>{continueLearning.lesson.chapter.title}</span>
                    <span aria-hidden="true">•</span>
                    <span>{formatDuration(continueLearning.lesson.estimatedMinutes)}</span>
                  </p>
                </div>
                <ButtonLink href={continueHref} size="lg" className="shrink-0">
                  ادامه
                  <ArrowIcon size={19} aria-hidden="true" />
                </ButtonLink>
              </CardContent>
            </Card>
          </Reveal>
        ) : null}

        {/* ── Stats ──────────────────────────────────────────── */}
        {home.showStats ? (
          <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox icon="BookOpen" label="ماژول آموزشی" value={stats.modules} />
            <StatBox icon="MousePointerClick" label="درس تعاملی" value={stats.lessons} />
            <StatBox icon="ClipboardCheck" label="پرسش آزمون" value={stats.questions} />
            <StatBox icon="Clock" label="دقیقه آموزش" value={stats.totalMinutes} />
          </section>
        ) : null}

        {/* ── Recently viewed ────────────────────────────────── */}
        {recentlyViewed.length > 0 ? (
          <Reveal className="mt-9">
            <SectionHeading
              title="اخیراً دیده‌اید"
              description="برای مرور سریع، این درس‌ها را باز کنید."
              action={
                <ButtonLink href="/progress" variant="ghost" size="sm">
                  همه فعالیت‌ها
                </ButtonLink>
              }
            />
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {recentlyViewed.map((item) => (
                <li key={item.lesson.id}>
                  <Link
                    href={`/course/${item.lesson.chapter.module.slug}/${item.lesson.slug}`}
                    className="stack-card block h-full p-4 transition-shadow hover:shadow-[var(--shadow-raised)]"
                  >
                    <p className="text-[0.6875rem] text-subtle-foreground">
                      {item.lesson.chapter.module.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-bold">{item.lesson.title}</p>
                    <Progress
                      className="mt-3"
                      value={item.percent}
                      tone={item.status === "COMPLETED" ? "success" : "primary"}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        ) : null}

        {/* ── Curriculum strands ─────────────────────────────── */}
        <Reveal className="mt-10">
          <SectionHeading
            title="این دوره چه چیزهایی را پوشش می‌دهد؟"
            description="محتوا در ۵ شاخه اصلی دسته‌بندی شده است. برای دیدن ماژول‌های هر شاخه، روی آن بزنید."
          />
          {/*
            Laid out as a centred flex row rather than a fixed grid: with five
            strands a 3-column grid always left an awkward gap on the second row.
            Here the five cards sit in one row when there is room and stay centred
            as they wrap down.
          */}
          <ul className="flex flex-wrap justify-center gap-3">
            {grouped.map(({ group, modules: groupModules }) => {
              const Icon = getIcon(group.icon);
              const lessonTotal = groupModules.reduce(
                (total, courseModule) =>
                  total + courseModule.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0),
                0,
              );

              return (
                <li key={group.key} className={`tone-${group.color} w-full sm:w-[15rem] lg:w-[13rem]`}>
                  <Link
                    href={`/course#group-${group.key}`}
                    className="tone-surface flex h-full flex-col items-center gap-3 rounded-2xl border p-4 text-center transition-transform hover:-translate-y-0.5"
                  >
                    <span className="tone-icon inline-flex size-14 shrink-0 items-center justify-center rounded-2xl">
                      <Icon size={27} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{group.title}</span>
                      <span className="mt-1 block text-xs leading-relaxed opacity-90">
                        {group.description}
                      </span>
                      <span className="mt-2 block text-[0.6875rem] font-medium opacity-80">
                        {toPersianDigits(groupModules.length)} ماژول • {toPersianDigits(lessonTotal)} درس
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Reveal>

        {/* ── Course overview ────────────────────────────────── */}
        {home.showModules ? (
          <Reveal className="mt-11">
            <div id="modules" className="scroll-mt-24">
              <SectionHeading
                title={settings.course.title}
                description="همه ماژول‌ها به ترتیب استاندارد ICDL؛ از بالا شروع کنید."
                action={
                  <ButtonLink href="/course" variant="outline" size="sm">
                    نمای فهرست کامل
                  </ButtonLink>
                }
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {modules.map((courseModule) => (
                  <ModuleCard
                    key={courseModule.id}
                    courseModule={courseModule}
                    priority={courseModule.number}
                    highlight={courseModule.slug === currentModuleSlug ? "current" : null}
                    progressPercent={percentByModule.get(courseModule.slug) ?? 0}
                    className="h-full"
                  />
                ))}
              </div>
            </div>
          </Reveal>
        ) : null}

        {/* ── Audience ───────────────────────────────────────── */}
        {home.showAudience ? (
          <Reveal className="mt-12">
            <SectionHeading title={home.audienceTitle} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {home.audienceItems.map((item) => (
                <div key={item.title} className="stack-card p-4">
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                    <Glyph name="Check" size={21} />
                  </span>
                  <h3 className="mt-3 text-sm font-bold">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </Reveal>
        ) : null}

        {/* ── How it works ───────────────────────────────────── */}
        {home.showHowItWorks ? (
          <Reveal className="mt-12">
            <SectionHeading title={home.howItWorksTitle} />
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {home.howItWorksSteps.map((item, index) => (
                <li key={item.title} className="stack-card p-4">
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-muted text-sm font-bold text-muted-foreground">
                    {toPersianDigits(index + 1)}
                  </span>
                  <h3 className="mt-3 text-sm font-bold">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        ) : null}

        {/* ── Closing CTA ────────────────────────────────────── */}
        <section className="mt-12">
          <div className="rounded-3xl border border-border bg-card px-5 py-9 text-center shadow-[var(--shadow-card)] sm:px-10">
            <h2 className="text-lg font-bold sm:text-xl">آماده شروع هستید؟</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {settings.course.certificateNote}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <ButtonLink href={continueHref} size="lg">
                {user ? "ادامه یادگیری" : "شروع از درس اول"}
                <ArrowIcon size={19} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/help" variant="outline" size="lg">
                سؤالی دارم
              </ButtonLink>
            </div>
          </div>
        </section>
      </Container>
    </>
  );
}

function StatBox({ icon, label, value }: { icon: string; label: string; value: number }) {
  const Icon = getIcon(icon);

  return (
    <div className="stack-card flex items-center gap-3.5 p-4">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon size={23} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">
          <AnimatedCounter value={value} />
        </p>
      </div>
    </div>
  );
}

function Glyph({ name, size }: { name: string; size: number }) {
  const Icon = getIcon(name);
  return <Icon size={size} aria-hidden="true" />;
}
