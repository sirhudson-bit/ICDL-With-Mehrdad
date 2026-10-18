import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { PrintBlocks } from "@/components/lesson/print-blocks";
import { LockedLessonNotice } from "@/components/lesson/locked-lesson";
import { PrintButton } from "@/components/ui/print-button";
import { requireUser } from "@/lib/auth/session";
import { formatDuration, formatPersianDate, toPersianDigits } from "@/lib/persian";
import { getTopicGroup } from "@/lib/topics";
import { getLessonBySlug } from "@/services/course-service";
import { getLessonAccess } from "@/services/sequence-service";
import { getAllSettings } from "@/services/settings-service";

type PrintLessonProps = { params: Promise<{ moduleSlug: string; lessonSlug: string }> };

export async function generateMetadata({ params }: PrintLessonProps): Promise<Metadata> {
  const { lessonSlug } = await params;
  const lesson = await getLessonBySlug(lessonSlug);
  return {
    title: lesson ? `نسخه چاپی: ${lesson.title}` : "نسخه چاپی درس",
    robots: { index: false, follow: false },
  };
}

/**
 * Printable lesson.
 *
 * A single lesson laid out for paper: the reading content, the step-by-step
 * guides and the FAQs, rendered by the static print renderer so nothing is
 * collapsed, clipped or stateful. The browser's own "Save as PDF" produces the
 * file, which handles Persian shaping and font embedding correctly.
 */
export default async function LessonPrintPage({ params }: PrintLessonProps) {
  const { moduleSlug, lessonSlug } = await params;

  const user = await requireUser(`/login?next=${encodeURIComponent(`/course/${moduleSlug}/${lessonSlug}/print`)}`);

  const [lesson, settings] = await Promise.all([getLessonBySlug(lessonSlug), getAllSettings()]);

  if (!lesson || lesson.chapter.module.slug !== moduleSlug) notFound();

  const courseModule = lesson.chapter.module;
  const topic = getTopicGroup(courseModule.group);
  const visibleBlocks = lesson.blocks.filter((block) => block.isVisible);

  /*
   * The printable export is the lesson text, so it is gated by the same
   * sequence rule as the lesson itself — otherwise the export would be a way
   * around the lock. Administrators are exempt, as everywhere else.
   */
  if (user.role !== "ADMIN") {
    const access = await getLessonAccess(user.id, lesson.id);
    if (!access.allowed && access.prerequisite) {
      return (
        <LockedLessonNotice
          lessonTitle={lesson.title}
          prerequisite={access.prerequisite}
          position={access.position}
          total={access.total}
          completedCount={access.completedCount}
          message={settings.course.sequenceMessage}
        />
      );
    }
  }

  const ArrowIcon = getIcon("ArrowLeft");
  const PrinterIcon = getIcon("Printer");

  return (
    <div className="mx-auto max-w-[21cm] px-5 py-6 sm:px-8 sm:py-8">
      {/* Toolbar — hidden on paper, and not part of the document body */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-300 bg-neutral-50 p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold">نسخه چاپی این درس</p>
          <p className="mt-0.5 text-xs text-neutral-600">
            دکمه را بزنید و در پنجره چاپ، گزینه «Save as PDF» را انتخاب کنید. اندازه پیشنهادی کاغذ A4 است.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton label="چاپ یا ذخیره PDF" />
          <a
            href={`/course/${courseModule.slug}/${lesson.slug}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-neutral-400 px-4 text-sm transition-colors hover:bg-neutral-100"
          >
            <ArrowIcon size={17} aria-hidden="true" />
            بازگشت به درس
          </a>
          <a
            href={`/course/${courseModule.slug}/print`}
            className="inline-flex h-10 items-center rounded-xl px-3 text-sm text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            چاپ کل ماژول
          </a>
        </div>
      </div>

      {/* Document */}
      <header className="border-b-2 border-neutral-800 pb-4">
        <p className="text-xs text-neutral-600">
          {settings.site.name} — {topic.title} › {courseModule.title} › {lesson.chapter.title}
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-snug">{lesson.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">{lesson.summary}</p>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
          <span>زمان مطالعه: {formatDuration(lesson.estimatedMinutes)}</span>
          <span>آخرین به‌روزرسانی: {formatPersianDate(lesson.updatedAt)}</span>
          <span>{toPersianDigits(visibleBlocks.length)} بخش</span>
        </p>
      </header>

      <PrintBlocks blocks={visibleBlocks} />

      {lesson.faqs.length > 0 ? (
        <section className="break-inside-avoid mt-6">
          <h2 className="mb-3 border-b border-neutral-300 pb-1.5 text-base font-bold">
            پرسش‌های پرتکرار این درس
          </h2>
          <dl className="flex flex-col gap-3">
            {lesson.faqs.map((faq) => (
              <div key={faq.id} className="break-inside-avoid">
                <dt className="text-sm font-bold">{faq.question}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-neutral-700">
                  {faq.answer.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-300 pt-3 text-[0.6875rem] text-neutral-600">
        <span>
          {settings.site.name} — {settings.site.tagline}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <PrinterIcon size={13} aria-hidden="true" />
          چاپ‌شده از {settings.site.name}
        </span>
      </footer>
    </div>
  );
}
