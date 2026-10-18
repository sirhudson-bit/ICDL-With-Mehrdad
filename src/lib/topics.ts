import type { LucideIcon } from "lucide-react";

import { getIcon } from "@/components/icon";

/**
 * Curriculum taxonomy.
 *
 * The syllabus has nine modules, but learners think in broader strands — the
 * way Iranian platforms present "مهارت‌های کامپیوتری ← آفیس ← اکسل". Grouping
 * modules lets the navigation, breadcrumbs and related-topic suggestions show
 * that hierarchy precisely instead of listing bare module titles.
 *
 * Group metadata lives here rather than in the database so the taxonomy can be
 * reshaped without a migration; modules only store the group key.
 */

export const TOPIC_GROUPS = {
  fundamentals: {
    key: "fundamentals",
    title: "مبانی کامپیوتر",
    description: "از روشن کردن کامپیوتر تا مفاهیم پایه فناوری اطلاعات",
    icon: "Cpu",
    color: "sky",
    order: 0,
  },
  windows: {
    key: "windows",
    title: "سیستم‌عامل ویندوز",
    description: "محیط ویندوز، مدیریت فایل‌ها، نصب برنامه و تنظیمات",
    icon: "Monitor",
    color: "brand",
    order: 1,
  },
  online: {
    key: "online",
    title: "اینترنت و ایمیل",
    description: "مرورگر، جستجوی مؤثر، ایمیل و فضای ابری",
    icon: "Globe",
    color: "violet",
    order: 2,
  },
  office: {
    key: "office",
    title: "آموزش آفیس (Office)",
    description: "Word، Excel، PowerPoint و Access — پرکاربردترین مهارت‌های اداری",
    icon: "Briefcase",
    color: "emerald",
    order: 3,
  },
  advanced: {
    key: "advanced",
    title: "مهارت‌های تکمیلی",
    description: "پشتیبان‌گیری، امنیت عملی، نگهداری سیستم و کار با PDF",
    icon: "GraduationCap",
    color: "amber",
    order: 4,
  },
} as const;

export type TopicGroupKey = keyof typeof TOPIC_GROUPS;

export type TopicGroup = (typeof TOPIC_GROUPS)[TopicGroupKey];

export const TOPIC_GROUP_KEYS = Object.keys(TOPIC_GROUPS) as TopicGroupKey[];

export const TOPIC_GROUP_OPTIONS: { value: TopicGroupKey; label: string }[] = TOPIC_GROUP_KEYS.map(
  (key) => ({ value: key, label: TOPIC_GROUPS[key].title }),
);

export function isTopicGroupKey(value: string): value is TopicGroupKey {
  return value in TOPIC_GROUPS;
}

/** Falls back to `fundamentals` so an unknown key can never break rendering. */
export function getTopicGroup(key: string | null | undefined): TopicGroup {
  if (key && isTopicGroupKey(key)) return TOPIC_GROUPS[key];
  return TOPIC_GROUPS.fundamentals;
}

export function getTopicGroupIcon(key: string | null | undefined): LucideIcon {
  return getIcon(getTopicGroup(key).icon);
}

/** Orders groups by their declared sequence rather than alphabetically. */
export function sortTopicGroups<T extends { group: string }>(modules: T[]): { group: TopicGroup; modules: T[] }[] {
  const buckets = new Map<TopicGroupKey, T[]>();

  for (const courseModule of modules) {
    const topic = getTopicGroup(courseModule.group);
    const bucket = buckets.get(topic.key as TopicGroupKey) ?? [];
    bucket.push(courseModule);
    buckets.set(topic.key as TopicGroupKey, bucket);
  }

  return [...buckets.entries()]
    .map(([key, items]) => ({ group: TOPIC_GROUPS[key], modules: items }))
    .sort((a, b) => a.group.order - b.group.order);
}

/**
 * Builds the human-readable trail for a piece of content, e.g.
 * «آموزش آفیس (Office) › Excel (صفحات گسترده) › مهارت‌های اصلی Excel › توابع شرطی».
 * Used by breadcrumbs, search results and related-topic cards so the same
 * precise path is shown everywhere.
 */
export function buildTopicPath(input: {
  group?: string | null;
  moduleTitle?: string | null;
  chapterTitle?: string | null;
  lessonTitle?: string | null;
}): string[] {
  return [getTopicGroup(input.group).title, input.moduleTitle, input.chapterTitle, input.lessonTitle].filter(
    (part): part is string => Boolean(part && part.length > 0),
  );
}

/** Short two-level label, e.g. «آفیس › اکسل». */
export function buildShortPath(input: {
  group?: string | null;
  moduleTitle?: string | null;
  lessonTitle?: string | null;
}): string {
  const parts = [getTopicGroup(input.group).title, input.moduleTitle ?? input.lessonTitle];
  return parts.filter(Boolean).join(" › ");
}
