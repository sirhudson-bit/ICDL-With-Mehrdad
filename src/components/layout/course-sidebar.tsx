"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { getIcon } from "@/components/icon";
import { Badge, Progress } from "@/components/ui/primitives";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import type { ModuleTreeNode } from "@/services/course-service";
import type { ProgressStatus } from "@/types";

export type SidebarProgress = Record<string, { status: ProgressStatus; percent: number }>;

/**
 * Course navigation tree.
 *
 * Modules expand to their lessons, the active lesson is highlighted, and each
 * module shows its completion. Expanded by default only for the module the
 * learner is currently in, so the tree stays scannable.
 */
export function CourseSidebar({
  modules,
  activeLessonSlug,
  progress = {},
  modulePercent = {},
  onNavigate,
  className,
}: {
  modules: ModuleTreeNode[];
  activeLessonSlug?: string;
  progress?: SidebarProgress;
  modulePercent?: Record<string, number>;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  const activeModuleSlug = useMemo(() => {
    for (const courseModule of modules) {
      for (const chapter of courseModule.chapters) {
        if (chapter.lessons.some((lesson) => lesson.slug === activeLessonSlug)) return courseModule.slug;
      }
    }
    const segments = pathname.split("/").filter(Boolean);
    return segments[0] === "course" ? (segments[1] ?? null) : null;
  }, [modules, activeLessonSlug, pathname]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    activeModuleSlug ? { [activeModuleSlug]: true } : {},
  );

  const isExpanded = (slug: string) => expanded[slug] ?? slug === activeModuleSlug;

  const toggle = (slug: string) =>
    setExpanded((current) => ({ ...current, [slug]: !(current[slug] ?? slug === activeModuleSlug) }));

  const totalCompleted = useMemo(
    () => Object.values(progress).filter((item) => item.status === "COMPLETED").length,
    [progress],
  );

  const ChevronIcon = getIcon("ChevronDown");

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="فهرست دوره">
      <div className="mb-2 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>درس‌های تکمیل‌شده</span>
          <span className="font-bold tabular-nums text-foreground">{toPersianDigits(totalCompleted)}</span>
        </div>
        <Progress
          className="mt-2"
          value={modules.length === 0 ? 0 : (totalCompleted / countLessons(modules)) * 100}
          tone="success"
        />
      </div>

      {modules.map((courseModule) => {
        const lessonCount = courseModule.chapters.reduce((total, chapter) => total + chapter.lessons.length, 0);
        const percent = modulePercent[courseModule.slug] ?? 0;
        const open = isExpanded(courseModule.slug);
        const isCurrentModule = courseModule.slug === activeModuleSlug;

        return (
          <div key={courseModule.id} className={cn("tone-" + courseModule.color)}>
            <button
              type="button"
              onClick={() => toggle(courseModule.slug)}
              aria-expanded={open}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors",
                isCurrentModule ? "bg-muted" : "hover:bg-muted",
              )}
            >
              <span className="tone-icon inline-flex size-9 shrink-0 items-center justify-center rounded-xl">
                <ModuleGlyph name={courseModule.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{courseModule.title}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-subtle-foreground">
                  <span>{toPersianDigits(lessonCount)} درس</span>
                  {percent > 0 ? <span className="tone-text font-bold">{toPersianDigits(percent)}٪</span> : null}
                </span>
              </span>
              <ChevronIcon
                size={18}
                className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                aria-hidden="true"
              />
            </button>

            {open ? (
              <ul className="ms-4 border-s border-border ps-2 pt-1">
                {courseModule.chapters.map((chapter) => (
                  <li key={chapter.id} className="pb-1">
                    <p className="px-2 py-1 text-[0.6875rem] font-bold text-subtle-foreground">
                      {chapter.title}
                    </p>
                    <ul>
                      {chapter.lessons.map((lesson) => {
                        const state = progress[lesson.id];
                        const isActive = lesson.slug === activeLessonSlug;
                        const completed = state?.status === "COMPLETED";

                        return (
                          <li key={lesson.id}>
                            <Link
                              href={`/course/${courseModule.slug}/${lesson.slug}`}
                              onClick={onNavigate}
                              aria-current={isActive ? "page" : undefined}
                              className={cn(
                                "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs leading-relaxed transition-colors",
                                isActive
                                  ? "bg-primary-soft font-bold text-primary"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              <StatusDot completed={completed} active={isActive} />
                              <span className="min-w-0 flex-1">{lesson.title}</span>
                              {lesson.hasQuiz ? (
                                <Badge tone="outline" size="sm" className="shrink-0">
                                  آزمون
                                </Badge>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function countLessons(modules: ModuleTreeNode[]): number {
  return modules.reduce(
    (total, courseModule) =>
      total + courseModule.chapters.reduce((chapterTotal, chapter) => chapterTotal + chapter.lessons.length, 0),
    0,
  );
}

function StatusDot({ completed, active }: { completed: boolean; active: boolean }) {
  const Icon = getIcon(completed ? "CheckCircle2" : "Circle");
  return (
    <Icon
      size={16}
      className={cn(
        "shrink-0",
        completed ? "text-success" : active ? "text-primary" : "text-border-strong",
      )}
      aria-hidden="true"
    />
  );
}

function ModuleGlyph({ name }: { name: string }) {
  const Icon = getIcon(name);
  return <Icon size={19} aria-hidden="true" />;
}
