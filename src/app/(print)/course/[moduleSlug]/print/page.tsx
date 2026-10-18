import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { PrintBlocks } from "@/components/lesson/print-blocks";
import { LockedLessonNotice } from "@/components/lesson/locked-lesson";
import { PrintButton } from "@/components/ui/print-button";
import { requireUser } from "@/lib/auth/session";
import { formatDuration, formatPersianDate, toPersianDigits } from "@/lib/persian";
import { getTopicGroup } from "@/lib/topics";
import { getModuleBySlug } from "@/services/course-service";
import { getLessonLockMap } from "@/services/sequence-service";
import { getAllSettings } from "@/services/settings-service";
import { prisma } from "@/lib/db";

type PrintModuleProps = { params: Promise<{ moduleSlug: string }> };

export async function generateMetadata({ params }: PrintModuleProps): Promise<Metadata> {
  const { moduleSlug } = await params;
  const courseModule = await getModuleBySlug(moduleSlug);
  return {
    title: courseModule ? `نسخه چاپی: ${courseModule.title}` : "نسخه چاپی ماژول",
    robots: { index: false, follow: false },
  };
}

/**
 * Printable module export.
 *
 * A handout for a whole module: a cover page, a table of contents, then every
 * lesson starting on a fresh page. Page breaks are applied per lesson — never
 * nested inside another break — because stacking `break-before: page` on both a
 * chapter and its first lesson is what produces stray blank pages in the
 * exported PDF. Each chapter heading is attached to the first lesson that
 * follows it, so a heading can never be orphaned at the foot of a page.
 */
export default async function ModulePrintPage({ params }: PrintModuleProps) {
  const { moduleSlug } = await params;

  const user = await requireUser(`/login?next=${encodeURIComponent(`/course/${moduleSlug}/print`)}`);

  const [courseModule, settings] = await Promise.all([getModuleBySlug(moduleSlug), getAllSettings()]);
  if (!courseModule) notFound();

  const allLessons = await prisma.lesson.findMany({
    where: { chapterId: { in: courseModule.chapters.map((chapter) => chapter.id) }, isPublished: true },
    orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      estimatedMinutes: true,
      updatedAt: true,
      chapterId: true,
      blocks: { where: { isVisible: true }, orderBy: { order: "asc" } },
      faqs: { where: { isPublished: true }, orderBy: { order: "asc" } },
    },
  });

  /*
   * The export respects the sequence: it contains the lessons the learner has
   * reached (everything completed, plus the one they are on), never the ones
   * still locked ahead of them. Without this the PDF would be a way around the
   * order the course is meant to be studied in.
   */
  const { locks, nextLesson } = await getLessonLockMap(user.id);
  const lessons =
    user.role === "ADMIN" ? allLessons : allLessons.filter((lesson) => !locks.get(lesson.id)?.locked);

  if (user.role !== "ADMIN" && lessons.length === 0 && nextLesson) {
    return (
      <LockedLessonNotice
        lessonTitle={courseModule.title}
        prerequisite={nextLesson}
        position={nextLesson.position}
        total={allLessons.length}
        completedCount={0}
        message="برای دریافت خروجی این ماژول، ابتدا درس‌های قبلی دوره را کامل کنید."
      />
    );
  }

  // Lessons grouped by chapter, so each chapter heading can ride with its first
  // lesson rather than standing alone before a page break.
  const chapters = courseModule.chapters
    .map((chapter) => ({
      chapter,
      lessons: lessons.filter((lesson) => lesson.chapterId === chapter.id),
    }))
    .filter((entry) => entry.lessons.length > 0);

  const totalMinutes = lessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0);
  const topic = getTopicGroup(courseModule.group);

  const ArrowIcon = getIcon("ArrowLeft");
  const BookIcon = getIcon("BookOpen");

  return (
    <div className="mx-auto max-w-[21cm] px-5 py-6 sm:px-8 sm:py-8">
      {/* Toolbar — hidden on paper */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-300 bg-neutral-50 p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold">نسخه چاپی کل ماژول</p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {toPersianDigits(lessons.length)} درس در {toPersianDigits(chapters.length)} فصل — هر درس از صفحه
            جدید شروع می‌شود. در پنجره چاپ «Save as PDF» را انتخاب کنید.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton label="چاپ یا ذخیره PDF" />
          <a
            href={`/course/${courseModule.slug}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-neutral-400 px-4 text-sm transition-colors hover:bg-neutral-100"
          >
            <ArrowIcon size={17} aria-hidden="true" />
            بازگشت به ماژول
          </a>
        </div>
      </div>

      {/* Cover */}
      <header className="border-b-2 border-neutral-800 pb-5">
        <p className="text-xs text-neutral-600">{settings.site.name} — نسخه چاپی دوره</p>
        <p className="mt-3 text-sm font-bold text-neutral-700">{topic.title}</p>
        <h1 className="mt-1 text-3xl font-bold leading-snug">{courseModule.title}</h1>
        {courseModule.subtitle ? (
          <p className="mt-1.5 text-sm text-neutral-700">{courseModule.subtitle}</p>
        ) : null}
        <p className="mt-3 max-w-[16cm] text-sm leading-relaxed text-neutral-700">{courseModule.description}</p>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          {[
            { label: "تعداد درس", value: toPersianDigits(lessons.length) },
            { label: "تعداد فصل", value: toPersianDigits(chapters.length) },
            { label: "زمان مطالعه", value: formatDuration(totalMinutes) },
            { label: "آخرین به‌روزرسانی", value: formatPersianDate(courseModule.updatedAt) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-neutral-300 p-3">
              <dt className="text-neutral-600">{item.label}</dt>
              <dd className="mt-0.5 font-bold">{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Contents */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 border-b border-neutral-300 pb-2 text-base font-bold">
          <BookIcon size={18} aria-hidden="true" />
          فهرست مطالب
        </h2>
        <ol className="flex flex-col gap-3">
          {chapters.map(({ chapter, lessons: chapterLessons }, chapterIndex) => (
            <li key={chapter.id}>
              <p className="text-sm font-bold">
                فصل {toPersianDigits(chapterIndex + 1)}: {chapter.title}
              </p>
              <ol className="mt-1 flex flex-col gap-0.5 ps-4">
                {chapterLessons.map((lesson, lessonIndex) => (
                  <li key={lesson.id} className="flex items-baseline gap-2 text-xs">
                    <span className="text-neutral-600">
                      {toPersianDigits(chapterIndex + 1)}.{toPersianDigits(lessonIndex + 1)}
                    </span>
                    <span>{lesson.title}</span>
                    <span className="ms-auto shrink-0 text-neutral-500">
                      {formatDuration(lesson.estimatedMinutes)}
                    </span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </section>

      {/* Lessons — one page break per lesson, never nested */}
      {chapters.map(({ chapter, lessons: chapterLessons }, chapterIndex) => (
        <div key={chapter.id}>
          {chapterLessons.map((lesson, lessonIndex) => (
            <article key={lesson.id} className="print-break pt-6">
              {lessonIndex === 0 ? (
                <header className="mb-4 border-b-2 border-neutral-800 pb-3">
                  <h2 className="text-lg font-bold">
                    فصل {toPersianDigits(chapterIndex + 1)}: {chapter.title}
                  </h2>
                  {chapter.description ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">{chapter.description}</p>
                  ) : null}
                </header>
              ) : null}

              <header className="mb-4">
                <h3 className="text-xl font-bold leading-snug">{lesson.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">{lesson.summary}</p>
                <p className="mt-2 text-[0.6875rem] text-neutral-500">
                  {formatDuration(lesson.estimatedMinutes)} • آخرین به‌روزرسانی:{" "}
                  {formatPersianDate(lesson.updatedAt)}
                </p>
              </header>

              <PrintBlocks blocks={lesson.blocks} />

              {lesson.faqs.length > 0 ? (
                <section className="break-inside-avoid mt-6">
                  <h4 className="mb-2.5 border-b border-neutral-300 pb-1.5 text-sm font-bold">
                    پرسش‌های پرتکرار این درس
                  </h4>
                  <dl className="flex flex-col gap-2.5">
                    {lesson.faqs.map((faq) => (
                      <div key={faq.id} className="break-inside-avoid">
                        <dt className="text-xs font-bold">{faq.question}</dt>
                        <dd className="mt-0.5 text-xs leading-relaxed text-neutral-700">
                          {faq.answer.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}
            </article>
          ))}
        </div>
      ))}

      <footer className="mt-8 border-t border-neutral-300 pt-3 text-[0.6875rem] text-neutral-600">
        {settings.site.name} — {settings.course.title} — {settings.navigation.creditText}
      </footer>
    </div>
  );
}
