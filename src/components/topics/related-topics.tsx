import Link from "next/link";

import { getIcon } from "@/components/icon";
import { Badge } from "@/components/ui/primitives";
import { formatDuration, toPersianDigits } from "@/lib/persian";
import { getTopicGroup } from "@/lib/topics";
import type { RelatedTopics } from "@/services/topic-service";
import { cn } from "@/lib/utils";

/**
 * Related topics.
 *
 * Grouped and labelled by kind so the connection is explicit — "same chapter",
 * "other parts of Office", "other chapters of this module" — instead of an
 * undifferentiated list of links. Each card carries its curriculum path so the
 * learner can place it.
 */
export function RelatedTopicsPanel({
  topics,
  currentModuleSlug,
}: {
  topics: RelatedTopics;
  currentModuleSlug: string;
}) {
  const hasAnything =
    topics.siblings.length > 0 ||
    topics.chapters.length > 0 ||
    topics.groupModules.length > 0 ||
    topics.otherStrands.length > 0;

  if (!hasAnything) return null;

  return (
    <div className="space-y-6">
      {/* Same chapter */}
      {topics.siblings.length > 0 ? (
        <section aria-labelledby="related-siblings">
          <SectionTitle
            id="related-siblings"
            title="ادامه همین فصل"
            description="درس‌های دیگر همین فصل با همین موضوع"
          />
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {topics.siblings.map((lesson) => {
              const topic = getTopicGroup(lesson.group);
              return (
                <li key={lesson.id} className={`tone-${topic.color}`}>
                  <Link
                    href={`/course/${lesson.moduleSlug}/${lesson.slug}`}
                    className="stack-card flex h-full flex-col gap-1.5 p-3.5 transition-shadow hover:shadow-[var(--shadow-raised)]"
                  >
                    <span className="text-[0.6875rem] text-subtle-foreground">
                      {lesson.chapterTitle}
                    </span>
                    <span className="text-sm font-bold leading-snug">{lesson.title}</span>
                    <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {lesson.summary}
                    </span>
                    <span className="mt-auto pt-1 text-[0.6875rem] text-subtle-foreground">
                      {formatDuration(lesson.estimatedMinutes)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Other chapters of this module */}
      {topics.chapters.length > 0 ? (
        <section aria-labelledby="related-chapters">
          <SectionTitle
            id="related-chapters"
            title="فصل‌های دیگر این ماژول"
            description="اگر می‌خواهید موضوع را کامل‌تر یاد بگیرید"
          />
          <ul className="flex flex-col gap-2">
            {topics.chapters.map((chapter) => (
              <li key={chapter.id}>
                <Link
                  href={`/course/${currentModuleSlug}#chapter-${chapter.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  <FolderGlyph />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{chapter.title}</span>
                    {chapter.description ? (
                      <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                        {chapter.description}
                      </span>
                    ) : null}
                  </span>
                  <Badge tone="outline" size="sm">
                    {toPersianDigits(chapter.lessonCount)} درس
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Sibling applications in the same strand — "Office > Excel" style */}
      {topics.groupModules.length > 0 ? (
        <section aria-labelledby="related-strand">
          <SectionTitle
            id="related-strand"
            title={`موضوع‌های مرتبط در ${getTopicGroup(topics.groupModules[0]!.group).title}`}
            description="هم‌خانواده‌های همین موضوع"
          />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topics.groupModules.map((courseModule) => (
              <RelatedModuleCard key={courseModule.id} module={courseModule} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* A change of subject */}
      {topics.otherStrands.length > 0 ? (
        <section aria-labelledby="related-strands">
          <SectionTitle id="related-strands" title="موضوع‌های دیگر دوره" description="شروع یک شاخه تازه" />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topics.otherStrands.map((courseModule) => (
              <RelatedModuleCard key={courseModule.id} module={courseModule} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function RelatedModuleCard({
  module,
}: {
  module: {
    slug: string;
    title: string;
    description: string;
    icon: string;
    color: string;
    group: string;
    lessonCount: number;
  };
}) {
  const Icon = getIcon(module.icon);
  const topic = getTopicGroup(module.group);

  return (
    <li className={cn("tone-" + module.color, "h-full")}>
      <Link
        href={`/course/${module.slug}`}
        className="tone-surface flex h-full flex-col gap-2 rounded-2xl border p-4 transition-transform hover:-translate-y-0.5"
      >
        <span className="flex items-center gap-2.5">
          <span className="tone-icon inline-flex size-11 shrink-0 items-center justify-center rounded-2xl">
            <Icon size={22} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.6875rem] font-bold opacity-80">{topic.title}</span>
            <span className="block truncate text-sm font-bold">{module.title}</span>
          </span>
        </span>
        <span className="line-clamp-2 text-xs leading-relaxed opacity-90">{module.description}</span>
        <span className="mt-auto pt-1 text-[0.6875rem] font-medium opacity-80">
          {toPersianDigits(module.lessonCount)} درس
        </span>
      </Link>
    </li>
  );
}

function SectionTitle({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3">
      <h3 id={id} className="text-sm font-bold sm:text-base">
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function FolderGlyph() {
  const Icon = getIcon("FolderTree");
  return <Icon size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />;
}
