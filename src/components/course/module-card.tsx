import Link from "next/link";

import { SpotlightCard } from "@/components/fx/spotlight-card";
import { getIcon, IconBubble } from "@/components/icon";
import { TopicArt } from "@/components/illustrations";
import { Badge, Progress } from "@/components/ui/primitives";
import { formatDuration, formatPercent, toPersianDigits } from "@/lib/persian";
import { getTopicGroup } from "@/lib/topics";
import { cn } from "@/lib/utils";
import type { ModuleTreeNode } from "@/services/course-service";

/**
 * Module card.
 *
 * Shows where the module sits in the curriculum (`آموزش آفیس › Excel`), how far
 * the learner has got, and how long it takes — the three things a returning
 * learner scans for. The strand art gives each subject a recognisable face at a
 * glance.
 */
export function ModuleCard({
  courseModule,
  progressPercent,
  completedLessons,
  continueHref,
  priority,
  highlight,
  className,
}: {
  courseModule: ModuleTreeNode;
  progressPercent?: number;
  completedLessons?: number;
  continueHref?: string;
  /** Position in the recommended learning order, shown as «گام N». */
  priority?: number;
  /** Marks the module the learner is working through, or the one after it. */
  highlight?: "current" | "next" | null;
  className?: string;
}) {
  const lessonCount = courseModule.chapters.reduce((total, chapter) => total + chapter.lessons.length, 0);
  const chapterCount = courseModule.chapters.length;
  const percent = progressPercent ?? 0;
  const isComplete = percent >= 100;
  const isStarted = percent > 0;

  const topic = getTopicGroup(courseModule.group);
  const ArrowIcon = getIcon("ArrowLeft");
  const ClockIcon = getIcon("Clock");
  const BookIcon = getIcon("BookOpen");

  return (
    <SpotlightCard
      className={cn(
        "stack-card group flex flex-col gap-4 p-5 transition-shadow duration-300 hover:shadow-[var(--shadow-raised)]",
        `tone-${courseModule.color}`,
        className,
      )}
    >
      {/* Strand art */}
      <div className="-mx-1 -mt-1 opacity-90">
        <TopicArt group={topic.key} className="max-h-28 w-full" />
      </div>

      <div className="flex items-start gap-3.5">
        <IconBubble name={courseModule.icon} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* The course is meant to be studied in order, so the recommended
                position is stated on the card rather than left to the layout. */}
            {priority !== undefined ? (
              <span className="tone-surface inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-bold">
                گام {toPersianDigits(priority)}
              </span>
            ) : null}
            {highlight === "current" ? (
              <Badge tone="success" size="sm">
                در حال یادگیری
              </Badge>
            ) : highlight === "next" ? (
              <Badge tone="primary" size="sm">
                نوبت شما
              </Badge>
            ) : null}
            <span className="tone-surface inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-bold">
              <TopicIcon name={topic.icon} />
              {topic.title}
            </span>
            {isComplete ? (
              <Badge tone="success" size="sm">
                <Glyph name="Check" />
                تکمیل شده
              </Badge>
            ) : null}
          </div>

          <h3 className="mt-1.5 text-base font-bold leading-snug">
            <Link href={`/course/${courseModule.slug}`} className="hover:text-primary">
              {courseModule.title}
            </Link>
          </h3>
          {courseModule.subtitle ? (
            <p className="mt-0.5 text-xs text-subtle-foreground">{courseModule.subtitle}</p>
          ) : null}
        </div>
      </div>

      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {courseModule.description}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <BookIcon size={15} aria-hidden="true" />
          {toPersianDigits(lessonCount)} درس
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon size={15} aria-hidden="true" />
          {formatDuration(courseModule.estimatedMinutes)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Glyph name="FolderTree" />
          {toPersianDigits(chapterCount)} فصل
        </span>
      </div>

      {/*
        Progress is stated in words as well as a bar, in every state. At 0% the
        bar used to be hidden entirely, so a learner could not tell "not started"
        apart from "progress not loading".
      */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          <span className={isComplete ? "font-medium text-success" : "text-muted-foreground"}>
            {isComplete ? "تکمیل شده" : isStarted ? "در حال یادگیری" : "شروع نشده"}
          </span>
          <span className="font-bold tabular-nums">
            {completedLessons !== undefined
              ? `${toPersianDigits(completedLessons)} از ${toPersianDigits(lessonCount)} درس — ${formatPercent(percent)}`
              : formatPercent(percent)}
          </span>
        </div>
        <Progress value={percent} tone={isComplete ? "success" : "primary"} />
      </div>

      <Link
        href={continueHref ?? `/course/${courseModule.slug}`}
        className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {isComplete ? "مرور دوباره" : isStarted ? `ادامه (${formatPercent(percent)})` : "شروع یادگیری"}
        <ArrowIcon size={17} aria-hidden="true" />
      </Link>
    </SpotlightCard>
  );
}

function TopicIcon({ name }: { name: string }) {
  const Icon = getIcon(name);
  return <Icon size={13} aria-hidden="true" />;
}

function Glyph({ name }: { name: string }) {
  const Icon = getIcon(name);
  return <Icon size={15} aria-hidden="true" />;
}
