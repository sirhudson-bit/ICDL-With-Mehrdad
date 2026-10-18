import Link from "next/link";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { Reveal } from "@/components/fx/reveal";
import { Container } from "@/components/ui/container";
import { Badge, ButtonLink, Card, CardContent, EmptyState, SectionHeading } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { getTopicGroup } from "@/lib/topics";
import { groupBookmarks } from "@/services/bookmark-service";

export const metadata: Metadata = {
  title: "علاقه‌مندی‌ها",
  description: "دوره‌ها، درس‌ها، نکته‌ها و تعریف‌هایی که نشان‌دار کرده‌اید.",
  robots: { index: false, follow: false },
};

const SAVED_LABELS: Record<string, { title: string; icon: string }> = {
  TIP: { title: "نکته‌های ذخیره‌شده", icon: "Lightbulb" },
  DEFINITION: { title: "تعریف‌های ذخیره‌شده", icon: "BookMarked" },
  EXERCISE: { title: "تمرین‌های ذخیره‌شده", icon: "MousePointerClick" },
};

/**
 * Favourites.
 *
 * Three distinct lists rather than one mixed feed — whole courses, individual
 * lessons, and saved tips/definitions — each keeping the curriculum path
 * visible so a saved item can be placed without opening it.
 */
export default async function FavoritesPage() {
  const user = await requireUser("/login?next=/bookmarks");
  const { modules, lessons, blocks, total } = await groupBookmarks(user.id);

  const StarIcon = getIcon("Star");

  const savedGroups = Object.keys(SAVED_LABELS)
    .map((type) => ({ type, items: blocks.filter((bookmark) => bookmark.type === type) }))
    .filter((group) => group.items.length > 0);

  return (
    <Container size="default" className="py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <StarIcon size={22} fill="currentColor" aria-hidden="true" />
          </span>
          علاقه‌مندی‌ها
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          هر دوره، درس، نکته یا تعریفی که نشان‌دار کرده‌اید اینجا جمع می‌شود تا بعداً سریع پیدایش کنید.
        </p>
      </header>

      {total === 0 ? (
        <EmptyState
          icon="Star"
          title="هنوز چیزی نشان‌دار نکرده‌اید"
          description="در صفحه هر دوره یا هر درس، دکمه «افزودن به علاقه‌مندی‌ها» را بزنید. کنار نکته‌ها و تعریف‌های مهم هم آیکون ستاره وجود دارد."
        >
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/course">رفتن به فهرست دوره</ButtonLink>
            <ButtonLink href="/progress" variant="outline">
              دیدن پیشرفت من
            </ButtonLink>
          </div>
        </EmptyState>
      ) : (
        <div className="space-y-9">
          <p className="text-sm text-muted-foreground">
            {toPersianDigits(total)} مورد ذخیره‌شده
            {modules.length > 0 ? ` • ${toPersianDigits(modules.length)} دوره` : ""}
            {lessons.length > 0 ? ` • ${toPersianDigits(lessons.length)} درس` : ""}
          </p>

          {/* Favourite courses */}
          {modules.length > 0 ? (
            <Reveal as="section">
              <SectionHeading
                title="دوره‌های نشان‌دارشده"
                description={`${toPersianDigits(modules.length)} دوره`}
              />
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {modules.map((bookmark) => {
                  const courseModule = bookmark.module!;
                  const topic = getTopicGroup(courseModule.group);
                  const Icon = getIcon(courseModule.icon);

                  return (
                    <li key={bookmark.id} className={`tone-${courseModule.color}`}>
                      <Link
                        href={`/course/${courseModule.slug}`}
                        className="tone-surface flex h-full flex-col gap-2 rounded-2xl border p-4 transition-transform hover:-translate-y-0.5"
                      >
                        <span className="flex items-center gap-3">
                          <span className="tone-icon inline-flex size-12 shrink-0 items-center justify-center rounded-2xl">
                            <Icon size={24} aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[0.6875rem] font-bold opacity-80">{topic.title}</span>
                            <span className="block truncate text-sm font-bold">{courseModule.title}</span>
                          </span>
                        </span>
                        <span className="line-clamp-2 text-xs leading-relaxed opacity-90">
                          {courseModule.description}
                        </span>
                        <span className="mt-auto pt-1 text-[0.6875rem] opacity-80">
                          ذخیره‌شده {formatRelativeTime(bookmark.createdAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          ) : null}

          {/* Favourite lessons */}
          {lessons.length > 0 ? (
            <Reveal as="section">
              <SectionHeading
                title="درس‌های نشان‌دارشده"
                description={`${toPersianDigits(lessons.length)} درس`}
              />
              <ul className="flex flex-col gap-2.5">
                {lessons.map((bookmark) => {
                  const lesson = bookmark.lesson!;
                  const topic = getTopicGroup(lesson.chapter.module.group);

                  return (
                    <li key={bookmark.id}>
                      <Link
                        href={`/course/${lesson.chapter.module.slug}/${lesson.slug}`}
                        className="stack-card flex items-start gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-raised)]"
                      >
                        <span className="mt-0.5 shrink-0 text-accent">
                          <Icon20 name="BookOpen" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge tone="outline" size="sm">
                              {topic.title}
                            </Badge>
                            <span className="text-[0.6875rem] text-subtle-foreground">
                              {lesson.chapter.module.title}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm font-bold">{lesson.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                            {lesson.summary}
                          </span>
                          <span className="mt-1 block text-[0.6875rem] text-subtle-foreground">
                            ذخیره‌شده {formatRelativeTime(bookmark.createdAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          ) : null}

          {/* Saved tips and definitions */}
          {savedGroups.map((group) => {
            const label = SAVED_LABELS[group.type]!;

            return (
              <Reveal as="section" key={group.type}>
                <SectionHeading
                  title={label.title}
                  description={`${toPersianDigits(group.items.length)} مورد`}
                />
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {group.items.map((bookmark) => (
                    <li key={bookmark.id}>
                      <Card className="h-full">
                        <CardContent className="p-4 pt-4">
                          <span className="flex items-center gap-2">
                            <Icon20 name={label.icon} />
                            <span className="text-[0.6875rem] text-subtle-foreground">
                              {bookmark.lesson?.chapter.module.title ?? "—"}
                            </span>
                          </span>
                          <p className="mt-2 text-sm font-bold">{bookmark.label}</p>
                          {bookmark.excerpt ? (
                            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                              {bookmark.excerpt}
                            </p>
                          ) : null}
                          {bookmark.lesson ? (
                            <ButtonLink
                              href={`/course/${bookmark.lesson.chapter.module.slug}/${bookmark.lesson.slug}${
                                bookmark.blockId ? `#${bookmark.blockId}` : ""
                              }`}
                              variant="ghost"
                              size="sm"
                              className="mt-2"
                            >
                              باز کردن درس
                            </ButtonLink>
                          ) : null}
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
      )}
    </Container>
  );
}

function Icon20({ name }: { name: string }) {
  const Icon = getIcon(name);
  return <Icon size={19} aria-hidden="true" />;
}
