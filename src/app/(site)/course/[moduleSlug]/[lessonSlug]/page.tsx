import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ChatWidget } from "@/components/chat/chat-widget";
import { getIcon } from "@/components/icon";
import { BookmarkButton } from "@/components/lesson/bookmark-button";
import { LessonBlockView, headingAnchor } from "@/components/lesson/blocks";
import {
  LessonCompletionControls,
  LessonPager,
  LessonViewedTracker,
} from "@/components/lesson/lesson-actions";
import { MobileLessonBar } from "@/components/lesson/mobile-lesson-bar";
import { LockedLessonNotice } from "@/components/lesson/locked-lesson";
import { RichText } from "@/components/lesson/rich-text";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { varyOptions } from "@/services/quiz-service";
import { TopicPath } from "@/components/topics/topic-path";
import { RelatedTopicsPanel } from "@/components/topics/related-topics";
import { Badge, ButtonLink, Card, CardContent, Progress } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { serializeJsonLd } from "@/lib/json-ld";
import { formatDuration, formatPercent, formatPersianDate, toPersianDigits, truncate } from "@/lib/persian";
import { getTopicGroup } from "@/lib/topics";
import { getLessonAccess } from "@/services/sequence-service";
import { getBookmarkedLessonIds, listBookmarks } from "@/services/bookmark-service";
import { getLessonBySlug, getLessonNeighbours, getModuleBySlug } from "@/services/course-service";
import { getLessonConversation } from "@/services/chat-service";
import { getLessonProgressMap, type LessonProgress } from "@/services/progress-service";
import { getBestAttempt } from "@/services/quiz-service";
import { getAllSettings } from "@/services/settings-service";
import { getRelatedTopics } from "@/services/topic-service";

type LessonPageProps = {
  params: Promise<{ moduleSlug: string; lessonSlug: string }>;
};

// Lessons carry the graded quiz and the interactive exercises, so the page and
// its data must never be served from a cache or reused between requests.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { moduleSlug, lessonSlug } = await params;
  const [lesson, courseModule] = await Promise.all([getLessonBySlug(lessonSlug), getModuleBySlug(moduleSlug)]);

  if (!lesson || !courseModule) return { title: "درس پیدا نشد" };

  const description = lesson.seoDescription ?? lesson.summary;
  const topic = getTopicGroup(courseModule.group);

  return {
    title: lesson.seoTitle ?? lesson.title,
    description,
    keywords: lesson.keywords ? lesson.keywords.split(",").map((word) => word.trim()) : undefined,
    alternates: { canonical: `/course/${courseModule.slug}/${lesson.slug}` },
    openGraph: {
      type: "article",
      title: `${lesson.title} | ${courseModule.title}`,
      description,
      url: `${publicEnv.siteUrl}/course/${courseModule.slug}/${lesson.slug}`,
      images: lesson.ogImageUrl ? [{ url: lesson.ogImageUrl }] : undefined,
      // The breadcrumb trail is part of how the lesson is described publicly.
      siteName: topic.title,
    },
    twitter: { card: "summary_large_image", title: lesson.title, description },
  };
}

/**
 * Lesson page.
 *
 * Composes the admin-authored blocks, the graded quiz, progress controls and
 * the lesson-aware assistant. The reading column is width-limited for comfort,
 * and the page ends with precisely-labelled related topics rather than a flat
 * list of links.
 */
export default async function LessonPage({ params }: LessonPageProps) {
  const { moduleSlug, lessonSlug } = await params;

  const lesson = await getLessonBySlug(lessonSlug);
  if (!lesson || lesson.chapter.module.slug !== moduleSlug) notFound();

  const courseModule = lesson.chapter.module;

  const [user, settings, neighbours, topics] = await Promise.all([
    getCurrentUser(),
    getAllSettings(),
    getLessonNeighbours(lesson.id),
    getRelatedTopics({
      lessonId: lesson.id,
      moduleId: courseModule.id,
      chapterId: lesson.chapterId,
      group: courseModule.group,
    }),
  ]);

  /*
   * The course is sequential: a lesson only opens once every earlier lesson is
   * finished. Enforced here, on the server and before any content is fetched or
   * rendered, so a locked lesson cannot be read by editing the URL.
   *
   * Administrators are exempt — they have to be able to open and review any
   * lesson, and gating them made the content uneditable in practice. Everyone
   * else must work through the course in order; this is deliberately not
   * switchable from settings, because "only an administrator may skip ahead" is
   * a rule rather than a preference.
   */
  const access = user?.role === "ADMIN" ? null : await getLessonAccess(user?.id ?? null, lesson.id);

  if (access && !access.allowed && access.prerequisite) {
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

  const [bookmarkedIds, progressMap, bookmarks, bestAttempt, conversation] = await Promise.all([
    user ? getBookmarkedLessonIds(user.id) : Promise.resolve(new Set<string>()),
    user ? getLessonProgressMap(user.id) : Promise.resolve(new Map<string, LessonProgress>()),
    user ? listBookmarks(user.id) : Promise.resolve([]),
    user && lesson.quiz ? getBestAttempt(user.id, lesson.quiz.id) : Promise.resolve(null),
    user ? getLessonConversation(user.id, lesson.id) : Promise.resolve({ sessionId: null, messages: [] }),
  ]);

  const progress = progressMap.get(lesson.id);

  const bookmarkedBlockIds = new Set(
    bookmarks.map((mark) => mark.blockId).filter((blockId): blockId is string => Boolean(blockId)),
  );

  // Headings become the "on this page" list.
  const headings = lesson.blocks
    .filter((block) => block.type === "heading")
    .map((block) => {
      const data = block.data as { text?: string; level?: number };
      return { text: data.text ?? "", level: data.level ?? 2, anchor: headingAnchor(data.text ?? "") };
    })
    .filter((heading) => heading.text.length > 0);

  // The quiz renders where the author placed a quiz block, otherwise at the end.
  const quizAnchorIndex = lesson.blocks.findIndex((block) => block.type === "quiz");

  // If the body already carries its own FAQ block, do not repeat the lesson's
  // FAQ list underneath it — two FAQ areas on one page reads as a mistake.
  const hasFaqBlock = lesson.blocks.some((block) => block.type === "faq");

  const ClockIcon = getIcon("Clock");
  const QuizIcon = getIcon("ClipboardCheck");
  const UpdateIcon = getIcon("Calendar");
  const ListIcon = getIcon("ListOrdered");
  const PrinterIcon = getIcon("Printer");

  const topic = getTopicGroup(courseModule.group);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: lesson.title,
    description: lesson.summary,
    inLanguage: "fa-IR",
    educationalLevel: lesson.difficulty,
    timeRequired: `PT${lesson.estimatedMinutes}M`,
    dateModified: lesson.updatedAt.toISOString(),
    url: `${publicEnv.siteUrl}/course/${courseModule.slug}/${lesson.slug}`,
    isPartOf: {
      "@type": "Course",
      name: settings.course.title,
      description: settings.course.description,
      provider: { "@type": "Organization", name: settings.site.name },
    },
    // Mirrors the on-page breadcrumb so the hierarchy is machine-readable too.
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "خانه", item: publicEnv.siteUrl },
        { "@type": "ListItem", position: 2, name: topic.title, item: `${publicEnv.siteUrl}/course` },
        {
          "@type": "ListItem",
          position: 3,
          name: courseModule.title,
          item: `${publicEnv.siteUrl}/course/${courseModule.slug}`,
        },
        { "@type": "ListItem", position: 4, name: lesson.title },
      ],
    },
  };

  const renderQuiz = () =>
    lesson.quiz ? (
      <QuizRunner
        quiz={{
          id: lesson.quiz.id,
          title: lesson.quiz.title,
          description: lesson.quiz.description,
          passingScore: lesson.quiz.passingScore,
          timeLimitMinutes: lesson.quiz.timeLimitMinutes,
          questions: lesson.quiz.questions.map((question) => ({
            id: question.id,
            type: question.type,
            prompt: question.prompt,
            hint: question.hint,
            points: question.points,
            data:
              // On a retake the seed changes, so multiple-choice options appear
              // in a different order. Grading matches option ids, so this cannot
              // change what the question tests.
              question.type === "MULTIPLE_CHOICE" && bestAttempt
                ? (varyOptions(question.data, `${bestAttempt.id}:${question.id}`) as typeof question.data)
                : question.data,
          })),
        }}
        lessonId={lesson.id}
        // Drives the "Go to next lesson" action shown once the quiz is passed.
        nextLesson={
          neighbours.next
            ? {
                slug: neighbours.next.slug,
                moduleSlug: neighbours.next.moduleSlug,
                title: neighbours.next.title,
              }
            : null
        }
        bestAttempt={
          bestAttempt
            ? {
                id: bestAttempt.id,
                score: bestAttempt.score,
                maxScore: bestAttempt.maxScore,
                passed: bestAttempt.passed,
                percent:
                  bestAttempt.maxScore === 0
                    ? 0
                    : Math.round((bestAttempt.score / bestAttempt.maxScore) * 100),
              }
            : null
        }
      />
    ) : null;

  return (
    /*
     * The lesson page owns its margins: it is not rendered inside CourseShell
     * (it has its own table-of-contents aside rather than the module sidebar),
     * so without this wrapper the text sits flush against the window edge at
     * every screen size. `max-w-[72rem]` leaves room for the aside at desktop,
     * and the reading column inside the grid is capped separately for a
     * comfortable line length.
     */
    <article className="mx-auto w-full max-w-[72rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <LessonViewedTracker lessonId={lesson.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <TopicPath
        group={courseModule.group}
        moduleTitle={courseModule.title}
        moduleSlug={courseModule.slug}
        chapterTitle={lesson.chapter.title}
        chapterSlug={lesson.chapter.slug}
        lessonTitle={lesson.title}
      />

      {/* Lesson header */}
      <header
        className={`tone-${courseModule.color} rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary" size="sm">
                ماژول {toPersianDigits(courseModule.number)}
              </Badge>
              <span className="text-xs text-subtle-foreground">{lesson.chapter.title}</span>
              {lesson.quiz ? (
                <Badge tone="info" size="sm">
                  <QuizIcon size={14} aria-hidden="true" />
                  آزمون دارد
                </Badge>
              ) : null}
            </div>

            <h1 className="mt-2.5 text-xl font-bold leading-snug sm:text-2xl">{lesson.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{lesson.summary}</p>

            <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon size={16} aria-hidden="true" />
                {formatDuration(lesson.estimatedMinutes)}
              </span>
              <span>
                درس {toPersianDigits(neighbours.index + 1)} از {toPersianDigits(neighbours.total)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UpdateIcon size={16} aria-hidden="true" />
                {formatPersianDate(lesson.updatedAt)}
              </span>
              {progress ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-20">
                    <Progress
                      value={progress.percent}
                      tone={progress.status === "COMPLETED" ? "success" : "primary"}
                    />
                  </span>
                  {formatPercent(progress.percent)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2">
            <BookmarkButton
              lessonId={lesson.id}
              label={lesson.title}
              excerpt={truncate(lesson.summary, 180)}
              type="LESSON"
              initialBookmarked={bookmarkedIds.has(lesson.id)}
              isAuthenticated={Boolean(user)}
              variant="labelled"
            />
            {/* Printable handout for this single lesson. */}
            <ButtonLink
              href={`/course/${courseModule.slug}/${lesson.slug}/print`}
              variant="outline"
              size="md"
              className="no-print"
            >
              <PrinterIcon size={17} aria-hidden="true" />
              نسخه چاپی / PDF
            </ButtonLink>
          </div>
        </div>
      </header>

      {/* Mobile table of contents */}
      {headings.length > 1 ? (
        <details className="mt-6 rounded-2xl border border-border bg-card xl:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-bold">
            <ListIcon size={19} className="text-muted-foreground" aria-hidden="true" />
            فهرست این درس
            <span className="text-xs font-normal text-muted-foreground">
              ({toPersianDigits(headings.length)} بخش)
            </span>
          </summary>
          <ol className="flex flex-col gap-1.5 border-t border-border p-4">
            {headings.map((heading) => (
              <li key={heading.anchor} className={heading.level === 3 ? "ps-4" : undefined}>
                <a href={`#${heading.anchor}`} className="block py-1 text-sm text-muted-foreground">
                  {heading.text}
                </a>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <div className="grid gap-8 sm:gap-10 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="lesson-body min-w-0 space-y-8 sm:space-y-10 xl:max-w-[46rem]">
          {/* Content blocks */}
          {lesson.blocks.map((block, index) => (
            <div key={block.id}>
              {index === quizAnchorIndex ? renderQuiz() : null}
              {/* Exercises render where the author placed them. They used to be
                  pulled into a second, stepped viewer further down the page,
                  which meant every exercise appeared in two different shapes. */}
              <LessonBlockView
                block={{ id: block.id, type: block.type, data: block.data }}
                lessonId={lesson.id}
                lessonTitle={lesson.title}
                isBookmarkedBlock={bookmarkedBlockIds.has(block.id)}
                isAuthenticated={Boolean(user)}
              />
            </div>
          ))}

          {/* Quiz at the end when the author did not place it explicitly */}
          {quizAnchorIndex === -1 ? renderQuiz() : null}

          {/* Lesson FAQs — only when the body has not already answered them. */}
          {!hasFaqBlock && lesson.faqs.length > 0 ? (
            <section id="lesson-faq" className="scroll-mt-24">
              <h2 className="mb-3 text-base font-bold">پرسش‌های پرتکرار این درس</h2>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {lesson.faqs.map((faq) => (
                  <details key={faq.id} className="group px-4 py-3.5">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                      <ChevronGlyph />
                      {faq.question}
                    </summary>
                    <RichText html={faq.answer} className="mt-2.5 text-sm text-muted-foreground" />
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          {/* Completion. Navigation itself lives in the pager below, so the
              duplicate "back to the course list" link was removed. */}
          <Card className="mt-2">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
              <LessonCompletionControls
                lessonId={lesson.id}
                initialStatus={progress?.status ?? "NOT_STARTED"}
                isAuthenticated={Boolean(user)}
              />
            </CardContent>
          </Card>

          <LessonPager
            previous={
              neighbours.previous
                ? {
                    slug: neighbours.previous.slug,
                    title: neighbours.previous.title,
                    moduleSlug: neighbours.previous.moduleSlug,
                  }
                : null
            }
            next={
              neighbours.next
                ? {
                    slug: neighbours.next.slug,
                    title: neighbours.next.title,
                    moduleSlug: neighbours.next.moduleSlug,
                  }
                : null
            }
          />

          {/* Related topics — the two closest groups only. The outer heading is
              gone: the panel's own section titles already name each group. */}
          <section className="border-t border-border pt-10">
            <p className="mb-6 text-xs text-muted-foreground">
              ادامه مسیر شما در «{topic.title}» و موضوع‌های نزدیک به این درس
            </p>
            <RelatedTopicsPanel
              topics={{ ...topics, otherStrands: [] }}
              currentModuleSlug={courseModule.slug}
            />
          </section>
        </div>

        {/* Side: table of contents + assistant */}
        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          {headings.length > 1 ? (
            <nav
              className="no-print hidden rounded-2xl border border-border bg-card p-4 xl:block"
              aria-label="فهرست این درس"
            >
              <p className="mb-3 px-2 text-xs font-bold text-muted-foreground">در این درس</p>
              <ol className="flex flex-col gap-1.5">
                {headings.map((heading) => (
                  <li key={heading.anchor} className={heading.level === 3 ? "ps-3" : undefined}>
                    <a
                      href={`#${heading.anchor}`}
                      className="block text-xs leading-relaxed text-muted-foreground transition-colors hover:text-primary"
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}

          <div className="hidden xl:block">
            <ChatWidget
              lessonSlug={lesson.slug}
              lessonTitle={lesson.title}
              contextLabel={[courseModule.title, lesson.chapter.title, lesson.title].join(" › ")}
              quickActions={settings.chatbot.quickActions}
              initialSessionId={conversation.sessionId}
              initialMessages={conversation.messages}
              isAuthenticated={Boolean(user)}
              variant="inline"
            />
          </div>
        </aside>
      </div>

      {/* Mobile completion + navigation, always within thumb reach */}
      <MobileLessonBar
        lessonId={lesson.id}
        initialStatus={progress?.status ?? "NOT_STARTED"}
        progressPercent={progress?.percent ?? 0}
        isAuthenticated={Boolean(user)}
        previous={
          neighbours.previous
            ? {
                slug: neighbours.previous.slug,
                moduleSlug: neighbours.previous.moduleSlug,
                title: neighbours.previous.title,
              }
            : null
        }
        next={
          neighbours.next
            ? {
                slug: neighbours.next.slug,
                moduleSlug: neighbours.next.moduleSlug,
                title: neighbours.next.title,
              }
            : null
        }
      />
    </article>
  );
}

function ChevronGlyph() {
  const Icon = getIcon("ChevronDown");
  return <Icon size={17} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />;
}
