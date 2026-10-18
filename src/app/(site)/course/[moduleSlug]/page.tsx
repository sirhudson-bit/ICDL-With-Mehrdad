import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { FavoriteModuleButton } from "@/components/course/favorite-module-button";
import { TopicArt } from "@/components/illustrations";
import { CourseShell } from "@/components/layout/course-shell";
import { TopicPath } from "@/components/topics/topic-path";
import { Badge, ButtonLink, Card, CardContent, Progress } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDuration, formatPercent, formatPersianDate, toPersianDigits } from "@/lib/persian";
import { getTopicGroup } from "@/lib/topics";
import { getModuleBySlug } from "@/services/course-service";
import { getLessonProgressMap, type LessonProgress } from "@/services/progress-service";
import { getBookmarkedModuleIds } from "@/services/bookmark-service";
import { getLessonLockMap } from "@/services/sequence-service";
import { LessonLockBadge } from "@/components/lesson/locked-lesson";
import { getAllSettings } from "@/services/settings-service";

type ModulePageProps = { params: Promise<{ moduleSlug: string }> };

export async function generateMetadata({ params }: ModulePageProps): Promise<Metadata> {
  const { moduleSlug } = await params;
  const courseModule = await getModuleBySlug(moduleSlug);
  if (!courseModule) return { title: "ماژول پیدا نشد" };

  const lessonCount = courseModule.chapters.reduce((total, chapter) => total + chapter.lessons.length, 0);
  const topic = getTopicGroup(courseModule.group);

  return {
    title: courseModule.title,
    description: `${courseModule.description} این ماژول بخشی از «${topic.title}» است و شامل ${lessonCount} درس می‌شود.`,
    alternates: { canonical: `/course/${courseModule.slug}` },
    openGraph: {
      title: `${courseModule.title} | ${topic.title}`,
      description: courseModule.description,
      url: `/course/${courseModule.slug}`,
    },
  };
}

/**
 * Module overview.
 *
 * Reads like a syllabus (سرفصل) — every chapter expanded, every lesson with its
 * length and the learner's own progress. The last-updated date is shown because
 * learners evaluating course material use it to judge whether the content still
 * matches the software version they have installed.
 */
export default async function ModulePage({ params }: ModulePageProps) {
  const { moduleSlug } = await params;

  const courseModule = await getModuleBySlug(moduleSlug);
  if (!courseModule) notFound();

  const [user, settings] = await Promise.all([getCurrentUser(), getAllSettings()]);

  const progressMap = user
    ? await getLessonProgressMap(user.id)
    : new Map<string, LessonProgress>();

  const favoriteModuleIds = user ? await getBookmarkedModuleIds(user.id) : new Set<string>();
  const isFavorited = favoriteModuleIds.has(courseModule.id);

  // Padlocks for lessons the learner has not reached yet.
  const { locks: lessonLocks, nextLesson: nextInCourse } = await getLessonLockMap(user?.id ?? null);

  const allLessons = courseModule.chapters.flatMap((chapter) => chapter.lessons);
  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter(
    (lesson) => progressMap.get(lesson.id)?.status === "COMPLETED",
  ).length;
  const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  const isComplete = totalLessons > 0 && completedLessons === totalLessons;

  const nextLesson =
    allLessons.find((lesson) => progressMap.get(lesson.id)?.status === "IN_PROGRESS") ??
    allLessons.find((lesson) => progressMap.get(lesson.id)?.status !== "COMPLETED") ??
    allLessons[0];

  const topic = getTopicGroup(courseModule.group);

  const ContinueIcon = getIcon("ArrowLeft");
  const CheckIcon = getIcon("CheckCircle2");
  const PlayIcon = getIcon("PlayCircle");
  const ClockIcon = getIcon("Clock");
  const FolderIcon = getIcon("FolderTree");
  const BookIcon = getIcon("BookOpen");
  const UpdateIcon = getIcon("Calendar");
  const PrinterIcon = getIcon("Printer");

  return (
    <CourseShell>
      <div className="space-y-6">
        <TopicPath
          group={courseModule.group}
          moduleTitle={courseModule.title}
          moduleSlug={courseModule.slug}
        />

        {/* Module header */}
        <header
          className={`tone-${courseModule.color} overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]`}
        >
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tone-surface inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-bold">
                  <GroupGlyph name={topic.icon} />
                  {topic.title}
                </span>
                <Badge tone="primary" size="sm">
                  ماژول {toPersianDigits(courseModule.number)}
                </Badge>
                {isComplete ? (
                  <Badge tone="success" size="sm">
                    <CheckIcon size={13} aria-hidden="true" />
                    تکمیل شده
                  </Badge>
                ) : null}
              </div>

              <h1 className="mt-2.5 text-xl font-bold sm:text-2xl">{courseModule.title}</h1>
              {courseModule.subtitle ? (
                <p className="mt-1 text-sm text-subtle-foreground">{courseModule.subtitle}</p>
              ) : null}
              <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {courseModule.description}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <BookIcon size={16} aria-hidden="true" />
                  {toPersianDigits(totalLessons)} درس
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FolderIcon size={16} aria-hidden="true" />
                  {toPersianDigits(courseModule.chapters.length)} فصل
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon size={16} aria-hidden="true" />
                  {formatDuration(courseModule.estimatedMinutes)}
                </span>
                <span className="inline-flex items-center gap-1.5" title="آخرین به‌روزرسانی محتوا">
                  <UpdateIcon size={16} aria-hidden="true" />
                  آخرین به‌روزرسانی: {formatPersianDate(courseModule.updatedAt)}
                </span>
              </div>

              {user ? (
                <div className="mt-4 max-w-sm">
                  <Progress
                    value={percent}
                    tone={isComplete ? "success" : "primary"}
                    label={`${toPersianDigits(completedLessons)} از ${toPersianDigits(totalLessons)} درس تکمیل شده`}
                    showValue
                  />
                </div>
              ) : null}
            </div>

            <div className="hidden w-44 shrink-0 lg:block">
              <TopicArt group={topic.key} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
            <FavoriteModuleButton
              moduleId={courseModule.id}
              label={courseModule.title}
              excerpt={courseModule.description.slice(0, 200)}
              initialFavorited={isFavorited}
              isAuthenticated={Boolean(user)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card-muted px-5 py-3.5">
            {nextLesson ? (
              <ButtonLink
                href={`/course/${courseModule.slug}/${nextLesson.slug}`}
                variant={isComplete ? "outline" : "primary"}
              >
                {isComplete ? "مرور دوباره ماژول" : percent > 0 ? "ادامه ماژول" : "شروع ماژول"}
                <ContinueIcon size={19} aria-hidden="true" />
              </ButtonLink>
            ) : null}

            {/* Export the whole module as a printable handout / PDF. */}
            <ButtonLink href={`/course/${courseModule.slug}/print`} variant="outline">
              <PrinterIcon size={18} aria-hidden="true" />
              دانلود PDF ماژول
            </ButtonLink>

            <p className="text-xs text-muted-foreground">
              {toPersianDigits(courseModule.chapters.length)} فصل • {toPersianDigits(totalLessons)} درس
            </p>
          </div>
        </header>

        {/* Syllabus */}
        {courseModule.chapters.map((chapter, chapterIndex) => (
          <Card key={chapter.id} id={`chapter-${chapter.slug}`} className="scroll-mt-24">
            <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="tone-icon inline-flex size-10 items-center justify-center rounded-2xl text-sm font-bold">
                  {toPersianDigits(chapterIndex + 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold sm:text-base">{chapter.title}</h2>
                  {chapter.description ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{chapter.description}</p>
                  ) : null}
                </div>
                <Badge tone="outline" size="sm">
                  {toPersianDigits(chapter.lessons.length)} درس
                </Badge>
              </div>

              <ol className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {chapter.lessons.map((lesson, lessonIndex) => {
                  const state = progressMap.get(lesson.id);
                  const done = state?.status === "COMPLETED";
                  const started = state?.status === "IN_PROGRESS";
                  const lock = lessonLocks.get(lesson.id);
                  // Only administrators see every lesson unlocked; for everyone
                  // else the course is strictly sequential.
                  const locked = user?.role !== "ADMIN" && Boolean(lock?.locked);
                  const isNext = user?.role !== "ADMIN" && nextInCourse?.lessonId === lesson.id;

                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/course/${courseModule.slug}/${lesson.slug}`}
                        className="flex items-start gap-3 px-3.5 py-3.5 transition-colors hover:bg-muted"
                      >
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[0.6875rem] font-bold text-muted-foreground">
                          {toPersianDigits(lessonIndex + 1)}
                        </span>
                        <span
                          className={
                            done
                              ? "mt-0.5 shrink-0 text-success"
                              : started
                                ? "mt-0.5 shrink-0 text-primary"
                                : "mt-0.5 shrink-0 text-border-strong"
                          }
                        >
                          {done ? <CheckIcon size={19} aria-hidden="true" /> : <PlayIcon size={19} aria-hidden="true" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className={
                                locked
                                  ? "text-sm font-medium text-muted-foreground sm:text-[0.9375rem]"
                                  : "text-sm font-medium sm:text-[0.9375rem]"
                              }
                            >
                              {lesson.title}
                            </span>
                            {/* Sequence state, so a lock is visible before clicking. */}
                            {locked ? <LessonLockBadge title="ابتدا درس‌های قبلی را کامل کنید" /> : null}
                            {isNext && !done ? (
                              <Badge tone="primary" size="sm">
                                درس بعدی شما
                              </Badge>
                            ) : null}
                            {lesson.quiz ? (
                              <Badge tone="info" size="sm">
                                آزمون
                              </Badge>
                            ) : null}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                            {lesson.summary}
                          </span>
                          <span className="mt-1 block text-[0.6875rem] text-subtle-foreground">
                            {formatDuration(lesson.estimatedMinutes)}
                            {state ? ` • ${formatPercent(state.percent)} پیشرفت` : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        ))}

        <p className="text-center text-xs text-subtle-foreground">{settings.course.certificateNote}</p>
      </div>
    </CourseShell>
  );
}

function GroupGlyph({ name }: { name: string }) {
  const Icon = getIcon(name);
  return <Icon size={14} aria-hidden="true" />;
}
