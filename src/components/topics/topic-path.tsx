import Link from "next/link";

import { getIcon } from "@/components/icon";
import { getTopicGroup } from "@/lib/topics";
import { cn } from "@/lib/utils";

/**
 * Hierarchical breadcrumb.
 *
 * Shows the full curriculum path rather than a single module name, so a learner
 * always knows whether they are in "Office → Excel → Conditional functions" or
 * somewhere unrelated. Levels that have a destination are links; the current
 * page is plain text.
 */
export function TopicPath({
  group,
  moduleTitle,
  moduleSlug,
  chapterTitle,
  chapterSlug,
  lessonTitle,
  className,
}: {
  group: string;
  moduleTitle?: string | null;
  moduleSlug?: string | null;
  chapterTitle?: string | null;
  chapterSlug?: string | null;
  lessonTitle?: string | null;
  className?: string;
}) {
  const topic = getTopicGroup(group);
  const GroupIcon = getIcon(topic.icon);

  const crumbs: { label: string; href?: string; icon?: string; toneClass?: string }[] = [
    { label: "خانه", href: "/", icon: "Compass" },
    { label: topic.title, href: `/course#group-${topic.key}`, icon: topic.icon },
  ];

  if (moduleTitle) {
    crumbs.push({
      label: moduleTitle,
      href: moduleSlug ? `/course/${moduleSlug}` : undefined,
    });
  }
  if (chapterTitle) {
    crumbs.push({
      label: chapterTitle,
      href: moduleSlug && chapterSlug ? `/course/${moduleSlug}#chapter-${chapterSlug}` : undefined,
    });
  }
  if (lessonTitle) {
    crumbs.push({ label: lessonTitle });
  }

  return (
    <nav aria-label="مسیر موضوع" className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1.5", className)}>
      <span className={cn("tone-" + topic.color, "inline-flex")}>
        <GroupIcon size={16} className="tone-text shrink-0" aria-hidden="true" />
      </span>

      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;

        return (
          <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span aria-hidden="true" className="text-border-strong">
                ›
              </span>
            ) : null}

            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="rounded-lg px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-primary sm:text-[0.8125rem]"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={cn(
                  "px-1.5 py-0.5 text-xs text-foreground sm:text-[0.8125rem]",
                  isLast && "font-bold",
                )}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
