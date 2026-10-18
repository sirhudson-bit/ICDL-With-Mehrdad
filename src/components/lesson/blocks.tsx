import { getIcon } from "@/components/icon";
import { BookmarkButton } from "@/components/lesson/bookmark-button";
import { ChecklistCard } from "@/components/lesson/checklist-card";
import { DemoViewer } from "@/components/lesson/demo-viewer";
import { RichText } from "@/components/lesson/rich-text";
import { StepViewer } from "@/components/lesson/step-viewer";
import { ExerciseRunner } from "@/components/exercise/runner";
import { Card, CardContent, Divider, Kbd } from "@/components/ui/primitives";
import type { BlockType, DemoData, ExerciseData } from "@/lib/content/blocks";
import { RESOURCE_KIND_LABELS } from "@/lib/content/block-library";
import { formatDuration, slugify, truncate } from "@/lib/persian";
import { sanitizeRichText } from "@/lib/sanitize";
import { getRelatedLessons } from "@/services/course-service";
import { cn } from "@/lib/utils";

/**
 * Lesson content renderer.
 *
 * One component per block type, all rendered on the server so the lesson body
 * ships as HTML. Only the genuinely interactive blocks (steps, practice,
 * exercises, demos, bookmarks) are client islands, which keeps the JavaScript
 * payload small even for long lessons.
 */

export type RenderableBlock = {
  id: string;
  type: string;
  data: unknown;
};

export function headingAnchor(text: string): string {
  return slugify(text);
}

export function LessonBlockView({
  block,
  lessonId,
  lessonTitle,
  isBookmarkedBlock,
  isAuthenticated,
}: {
  block: RenderableBlock;
  lessonId: string;
  lessonTitle: string;
  isBookmarkedBlock: boolean;
  isAuthenticated: boolean;
}) {
  return renderBlock({ block, lessonId, lessonTitle, isBookmarkedBlock, isAuthenticated });
}

function renderBlock({
  block,
  lessonId,
  lessonTitle,
  isBookmarkedBlock,
  isAuthenticated,
}: {
  block: RenderableBlock;
  lessonId: string;
  lessonTitle: string;
  isBookmarkedBlock: boolean;
  isAuthenticated: boolean;
}) {
  const type = block.type as BlockType;
  const data = block.data as Record<string, unknown>;

  switch (type) {
    case "objectives": {
      const items = (data.items as string[]) ?? [];
      const title = (data.title as string) ?? "در این درس یاد می‌گیرید";
      const TargetIcon = getIcon("Target");

      return (
        <Card className="border-primary/20 bg-primary-soft/40">
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-primary sm:text-base">
              <TargetIcon size={18} aria-hidden="true" />
              {title}
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      );
    }

    case "heading": {
      const text = (data.text as string) ?? "";
      const level = (data.level as number) ?? 2;
      const id = headingAnchor(text);

      if (level === 3) {
        return (
          <h3 id={id} className="scroll-mt-24 pt-2 text-base font-bold sm:text-lg">
            {text}
          </h3>
        );
      }
      if (level === 4) {
        return (
          <h4 id={id} className="scroll-mt-24 text-sm font-bold text-muted-foreground">
            {text}
          </h4>
        );
      }
      return (
        <h2
          id={id}
          className="scroll-mt-24 border-b border-border pb-2 pt-4 text-lg font-bold sm:text-xl"
        >
          {text}
        </h2>
      );
    }

    case "text": {
      return <RichText html={(data.html as string) ?? ""} />;
    }

    case "definition": {
      const term = (data.term as string) ?? "";
      const example = (data.example as string) ?? "";
      const BookIcon = getIcon("BookMarked");

      return (
        <Card className="border-s-4 border-s-info bg-card">
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
            <div className="flex items-start gap-2.5">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
                <BookIcon size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold sm:text-base">{term}</p>
                <RichText html={(data.definition as string) ?? ""} className="mt-1.5 text-sm" />
                {example ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-bold">مثال: </span>
                    {example}
                  </p>
                ) : null}
              </div>
              <BookmarkButton
                lessonId={lessonId}
                blockId={block.id}
                type="DEFINITION"
                label={`تعریف: ${term}`}
                excerpt={truncate(String(data.definition ?? "").replace(/<[^>]+>/g, " "), 200)}
                initialBookmarked={isBookmarkedBlock}
                isAuthenticated={isAuthenticated}
              />
            </div>
          </CardContent>
        </Card>
      );
    }

    case "callout": {
      const tone = (data.tone as string) ?? "info";
      return (
        <ToneBox
          tone={tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "danger" ? "danger" : tone === "neutral" ? "neutral" : "info"}
          title={data.title as string | undefined}
          html={(data.html as string) ?? ""}
        />
      );
    }

    case "tip": {
      return (
        <ToneBox
          tone="success"
          icon="Lightbulb"
          title={(data.title as string) || "نکته"}
          html={(data.html as string) ?? ""}
          bookmark={{
            lessonId,
            blockId: block.id,
            type: "TIP",
            label: `نکته: ${lessonTitle}`,
            excerpt: truncate(String(data.html ?? "").replace(/<[^>]+>/g, " "), 200),
            initialBookmarked: isBookmarkedBlock,
            isAuthenticated,
          }}
        />
      );
    }

    case "warning": {
      return (
        <ToneBox
          tone="warning"
          icon="TriangleAlert"
          title={(data.title as string) || "هشدار"}
          html={(data.html as string) ?? ""}
        />
      );
    }

    case "example": {
      return (
        <ToneBox
          tone="neutral"
          icon="Quote"
          title={(data.title as string) || "مثال"}
          html={(data.html as string) ?? ""}
        />
      );
    }

    case "image": {
      const url = (data.url as string) ?? "";
      if (!url) return null;
      const alt = (data.alt as string) ?? "";
      const caption = (data.caption as string) ?? "";

      return (
        <figure className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL with unknown dimensions */}
          <img src={url} alt={alt} loading="lazy" decoding="async" className="w-full object-cover" />
          {caption ? (
            <figcaption className="border-t border-border bg-card-muted px-4 py-2.5 text-xs text-muted-foreground">
              {caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    case "gallery": {
      const images = (data.images as { url: string; alt: string; caption?: string }[]) ?? [];
      const columns = (data.columns as number) ?? 2;

      return (
        <div className={cn("grid gap-3", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {images.map((item, index) => (
            <figure key={`${item.url}-${index}`} className="overflow-hidden rounded-2xl border border-border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL */}
              <img src={item.url} alt={item.alt} loading="lazy" decoding="async" className="aspect-video w-full object-cover" />
              {item.caption ? (
                <figcaption className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  {item.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      );
    }

    case "video": {
      const url = (data.url as string) ?? "";
      if (!url) return null;
      const title = (data.title as string) ?? "ویدئوی آموزشی";
      const embed = toEmbedUrl(url);
      const PlayIcon = getIcon("PlayCircle");

      return (
        <figure className="overflow-hidden rounded-2xl border border-border bg-card">
          {embed.type === "iframe" ? (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={embed.src}
                title={title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="size-full"
              />
            </div>
          ) : embed.type === "video" ? (
            <video src={embed.src} controls preload="metadata" className="aspect-video w-full bg-black">
              {title}
            </video>
          ) : (
            <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
              <PlayIcon size={30} aria-hidden="true" />
            </div>
          )}
          <figcaption className="flex items-center gap-2 border-t border-border bg-card-muted px-4 py-2.5 text-xs">
            <PlayIcon size={14} aria-hidden="true" />
            <span className="font-medium">{title}</span>
            {embed.type === "link" ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="ms-auto text-primary hover:underline">
                باز کردن در پنجره جدید
              </a>
            ) : null}
          </figcaption>
        </figure>
      );
    }

    case "table": {
      const headers = (data.headers as string[]) ?? [];
      const rows = (data.rows as string[][]) ?? [];
      const caption = (data.caption as string) ?? "";

      return (
        <figure className="overflow-hidden rounded-2xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              {caption ? <caption className="border-b border-border bg-card-muted px-3 py-2 text-xs font-bold text-muted-foreground">{caption}</caption> : null}
              <thead>
                <tr className="bg-card-muted">
                  {headers.map((header) => (
                    <th key={header} scope="col" className="border-e border-border px-3 py-2.5 text-start font-bold last:border-e-0">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="even:bg-card-muted/40">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border-e border-t border-border px-3 py-2.5 align-top leading-relaxed last:border-e-0">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      );
    }

    case "keyboard": {
      const shortcuts = (data.shortcuts as { keys: string[]; description: string }[]) ?? [];
      const title = (data.title as string) ?? "میان‌برهای کیبورد";
      const KeyboardIcon = getIcon("Keyboard");

      return (
        <Card>
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <KeyboardIcon size={17} aria-hidden="true" />
              {title}
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {shortcuts.map((shortcut, index) => (
                <li
                  key={`${shortcut.description}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card-muted px-3 py-2"
                >
                  <span className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <span key={`${key}-${keyIndex}`} className="flex items-center gap-1">
                        <Kbd>{key}</Kbd>
                        {keyIndex < shortcut.keys.length - 1 ? (
                          <span className="text-xs text-subtle-foreground">+</span>
                        ) : null}
                      </span>
                    ))}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{shortcut.description}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      );
    }

    case "code": {
      const code = (data.code as string) ?? "";
      const caption = (data.caption as string) ?? "";
      return (
        <figure className="overflow-hidden rounded-2xl border border-border">
          <pre dir="ltr" className="overflow-x-auto bg-card-muted p-4 text-left text-xs leading-relaxed">
            <code>{code}</code>
          </pre>
          {caption ? (
            <figcaption className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{caption}</figcaption>
          ) : null}
        </figure>
      );
    }

    case "steps": {
      const steps = (data.steps as { title: string; html: string; imageUrl?: string; tip?: string }[]) ?? [];
      return (
        <StepViewer
          title={(data.title as string) || "مرحله به مرحله"}
          steps={steps.map((step) => ({
            title: step.title,
            html: sanitizeRichText(step.html),
            imageUrl: step.imageUrl,
            tip: step.tip,
          }))}
          storageKey={`step-${block.id}`}
        />
      );
    }

    case "practice": {
      const html = (data.html as string) ?? "";
      const checklist = (data.checklist as string[]) ?? [];
      return (
        <ChecklistCard
          title={(data.title as string) || "تمرین کنید"}
          html={sanitizeRichText(html)}
          items={checklist}
          storageKey={`practice-${block.id}`}
        />
      );
    }

    case "exercise": {
      const payload = data.exercise;
      if (!payload) return null;
      return (
        <ExerciseRunner
          title={(data.title as string) || "تمرین تعاملی"}
          instructions={sanitizeRichText((data.instructions as string) ?? "")}
          // Shape is guaranteed by the block schema validated when the content was saved.
          exercise={payload as ExerciseData}
          maxAttempts={(data.maxAttempts as number) ?? 3}
          storageKey={`exercise-${block.id}`}
        />
      );
    }

    case "demo": {
      const payload = data.demo;
      if (!payload) return null;
      return (
        <DemoViewer
          title={(data.title as string) || "نمایش تعاملی"}
          instructions={(data.instructions as string) || undefined}
          // Shape is guaranteed by the block schema validated when the content was saved.
          demo={payload as DemoData}
        />
      );
    }

    case "faq": {
      const items = (data.items as { question: string; answer: string }[]) ?? [];
      const title = (data.title as string) ?? "پرسش‌های پرتکرار";
      const HelpIcon = getIcon("HelpCircle");

      return (
        <section id="faq" className="scroll-mt-24">
          <h3 className="flex items-center gap-2 text-sm font-bold sm:text-base">
            <HelpIcon size={17} aria-hidden="true" />
            {title}
          </h3>
          <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {items.map((item, index) => (
              <details key={`${item.question}-${index}`} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                  <ChevronGlyph />
                  {item.question}
                </summary>
                <RichText html={item.answer} className="mt-2.5 text-sm text-muted-foreground" />
              </details>
            ))}
          </div>
        </section>
      );
    }

    case "resource": {
      const items = (data.items as { label: string; url: string; kind?: string; size?: string }[]) ?? [];
      const title = (data.title as string) ?? "فایل‌های تمرین";
      const PaperIcon = getIcon("Paperclip");

      return (
        <Card>
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <PaperIcon size={17} aria-hidden="true" />
              {title}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {items.map((item, index) => (
                <li key={`${item.url}-${index}`}>
                  <a
                    href={item.url}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted"
                    download={item.kind !== "link" ? "" : undefined}
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <DownloadGlyph />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      <span className="block text-[0.6875rem] text-subtle-foreground">
                        {RESOURCE_KIND_LABELS[item.kind ?? "link"] ?? "پیوند"}
                        {item.size ? ` • ${item.size}` : ""}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      );
    }

    case "summary": {
      const points = (data.points as string[]) ?? [];
      const BookIcon = getIcon("BookOpenCheck");

      return (
        <Card className="border-success/25 bg-success-soft/40">
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-success">
              <BookIcon size={17} aria-hidden="true" />
              {(data.title as string) || "خلاصه درس"}
            </h3>
            <RichText html={(data.html as string) ?? ""} className="mt-2.5 text-sm" />
            {points.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm leading-relaxed">
                    <span className="mt-1.5 shrink-0 text-success">
                      <CheckGlyph />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      );
    }

    case "relatedLessons": {
      return <RelatedLessonsBlock references={(data.lessonSlugs as string[]) ?? []} title={(data.title as string) || "درس‌های مرتبط"} />;
    }

    case "divider": {
      return <Divider className="my-6" />;
    }

    case "quiz": {
      // The quiz is rendered by the lesson page so that attempts, progress and
      // placement stay in one place; the block only marks the spot.
      return null;
    }

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────

const TONE_STYLES = {
  info: { wrapper: "border-info/25 bg-info-soft", icon: "Info", iconClass: "bg-info/15 text-info" },
  success: { wrapper: "border-success/30 bg-success-soft", icon: "CheckCircle2", iconClass: "bg-success/15 text-success" },
  warning: { wrapper: "border-warning/30 bg-warning-soft", icon: "TriangleAlert", iconClass: "bg-warning/15 text-warning" },
  danger: { wrapper: "border-danger/25 bg-danger-soft", icon: "Circle", iconClass: "bg-danger/15 text-danger" },
  neutral: { wrapper: "border-border bg-card-muted", icon: "Quote", iconClass: "bg-muted text-muted-foreground" },
} as const;

function ToneBox({
  tone,
  title,
  html,
  icon,
  bookmark,
}: {
  tone: keyof typeof TONE_STYLES;
  title?: string;
  html: string;
  icon?: string;
  bookmark?: {
    lessonId: string;
    blockId: string;
    type: "TIP";
    label: string;
    excerpt: string;
    initialBookmarked: boolean;
    isAuthenticated: boolean;
  };
}) {
  const styles = TONE_STYLES[tone];
  const Icon = getIcon(icon ?? styles.icon);

  return (
    <section className={cn("rounded-2xl border p-4 sm:p-5", styles.wrapper)}>
      <div className="flex items-start gap-3">
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl", styles.iconClass)}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {title ? <p className="text-sm font-bold">{title}</p> : null}
          <RichText html={html} className={cn("text-sm", title && "mt-1.5")} />
        </div>
        {bookmark ? <BookmarkButton {...bookmark} /> : null}
      </div>
    </section>
  );
}

async function RelatedLessonsBlock({ references, title }: { references: string[]; title: string }) {
  const lessons = await getRelatedLessons(references);
  if (lessons.length === 0) return null;

  const BranchIcon = getIcon("GitBranch");

  return (
    <section className="rounded-2xl border border-border bg-card-muted p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <BranchIcon size={17} aria-hidden="true" />
        {title}
      </h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {lessons.map((lesson) => (
          <li key={lesson.id} className={`tone-${lesson.chapter.module.color}`}>
            <a
              href={`/course/${lesson.chapter.module.slug}/${lesson.slug}`}
              className="tone-surface flex h-full flex-col gap-1 rounded-xl border p-3 transition-transform hover:-translate-y-0.5"
            >
              <span className="text-[0.6875rem] opacity-80">{lesson.chapter.module.title}</span>
              <span className="text-sm font-bold">{lesson.title}</span>
              <span className="line-clamp-2 text-xs opacity-90">{lesson.summary}</span>
              <span className="mt-auto pt-1 text-[0.6875rem] opacity-80">
                {formatDuration(lesson.estimatedMinutes)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Converts a video URL into something embeddable, falling back to a link. */
function toEmbedUrl(url: string): { type: "iframe" | "video" | "link"; src: string } {
  const youtube = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  if (youtube?.[1]) return { type: "iframe", src: `https://www.youtube.com/embed/${youtube[1]}` };

  const vimeo = /vimeo\.com\/(\d+)/.exec(url);
  if (vimeo?.[1]) return { type: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };

  const aparat = /aparat\.com\/v\/([\w-]+)/.exec(url);
  if (aparat?.[1]) return { type: "iframe", src: `https://www.aparat.com/video/video/embed/videohash/${aparat[1]}/vt/frame` };

  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { type: "video", src: url };

  return { type: "link", src: url };
}

function ChevronGlyph() {
  const Icon = getIcon("ChevronDown");
  return <Icon size={15} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />;
}
function CheckGlyph() {
  const Icon = getIcon("Check");
  return <Icon size={15} aria-hidden="true" />;
}
function DownloadGlyph() {
  const Icon = getIcon("Download");
  return <Icon size={15} aria-hidden="true" />;
}
