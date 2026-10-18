import { getIcon } from "@/components/icon";
import { RESOURCE_KIND_LABELS } from "@/lib/content/block-library";
import { formatDuration, toPersianDigits } from "@/lib/persian";
import { sanitizeRichText } from "@/lib/sanitize";

/**
 * Print-safe block renderer.
 *
 * A separate renderer from the on-screen one on purpose. The interactive
 * components used on the site hold state (a step viewer shows one step at a
 * time), size themselves against the viewport and clip their overflow with
 * scroll containers — all of which produce truncated, overlapping or blank
 * content once the page is paginated. This renderer emits plain semantic HTML:
 * every step expanded, every checklist item listed, no fixed heights, no
 * `overflow` containers and no client components. It is also greyscale-safe, so
 * a black-and-white printout stays readable.
 */

type Block = { id: string; type: string; data: unknown };

const CALLOUT_TONES: Record<string, { label: string; icon: string; border: string; background: string }> = {
  info: { label: "نکته", icon: "Info", border: "#93c5fd", background: "#eff6ff" },
  tip: { label: "نکته کاربردی", icon: "Lightbulb", border: "#86efac", background: "#f0fdf4" },
  warning: { label: "هشدار", icon: "TriangleAlert", border: "#fcd34d", background: "#fffbeb" },
  important: { label: "مهم", icon: "TriangleAlert", border: "#fca5a5", background: "#fef2f2" },
};

export function PrintBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="print-blocks flex flex-col gap-4">
      {blocks.map((block) => (
        <PrintBlock key={block.id} block={block} />
      ))}
    </div>
  );
}

function PrintBlock({ block }: { block: Block }) {
  const data = (block.data ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");

  switch (block.type) {
    case "heading": {
      const level = Number(data.level ?? 2);
      const Tag = (level >= 3 ? "h3" : "h2") as "h2" | "h3";
      return (
        <Tag className={level >= 3 ? "mt-2 text-base font-bold" : "mt-3 border-b border-neutral-300 pb-1.5 text-lg font-bold"}>
          {text("text") || text("title")}
        </Tag>
      );
    }

    case "text":
      return <RichText html={text("html") || text("text")} />;

    case "objectives": {
      const items = toStringArray(data.items);
      return (
        <Section title={text("title") || "در این درس یاد می‌گیرید"} icon="Target">
          <ul className="flex list-disc flex-col gap-1 ps-5">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      );
    }

    case "definition":
      return (
        <Section title={text("term") || "تعریف"} icon="BookMarked">
          <RichText html={text("definition") || text("html")} />
        </Section>
      );

    case "callout":
    case "tip":
    case "warning": {
      const tone =
        CALLOUT_TONES[block.type === "callout" ? text("tone") || "info" : block.type] ?? CALLOUT_TONES.info!;
      return (
        <div
          className="rounded-lg border-s-4 px-3.5 py-3"
          style={{ borderInlineStartColor: tone.border, backgroundColor: tone.background }}
        >
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <PrintIcon name={tone.icon} />
            {text("title") || tone.label}
          </p>
          <div className="mt-1.5">
            <RichText html={text("html") || text("text")} />
          </div>
        </div>
      );
    }

    case "example":
      return (
        <Section title={text("title") || "مثال"} icon="Sparkles">
          <div className="rounded-lg bg-neutral-100 p-3">
            <RichText html={text("html") || text("text")} />
          </div>
        </Section>
      );

    case "image": {
      const src = text("url") || text("src");
      if (!src) return null;
      return (
        <figure className="break-inside-avoid">
          {/* Plain img: no next/image loader, no lazy state, nothing to hydrate. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={text("alt")} className="mx-auto max-h-[16cm] w-auto max-w-full" />
          {text("caption") ? (
            <figcaption className="mt-1.5 text-center text-xs text-neutral-600">{text("caption")}</figcaption>
          ) : null}
        </figure>
      );
    }

    case "gallery": {
      const images = Array.isArray(data.images) ? (data.images as Record<string, unknown>[]) : [];
      if (images.length === 0) return null;
      return (
        <div className="grid grid-cols-2 gap-3">
          {images.map((image, index) => (
            <figure key={index} className="break-inside-avoid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={String(image.url ?? "")}
                alt={String(image.alt ?? "")}
                className="mx-auto max-h-[9cm] w-auto max-w-full"
              />
              {image.caption ? (
                <figcaption className="mt-1 text-center text-xs text-neutral-600">
                  {String(image.caption)}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      );
    }

    case "video":
      return (
        <p className="rounded-lg border border-dashed border-neutral-400 px-3 py-2 text-xs text-neutral-600">
          ویدیو «{text("title") || "آموزش"}» در نسخه چاپی نمایش داده نمی‌شود.
          {text("url") ? <span dir="ltr" className="ms-1.5 font-mono">{text("url")}</span> : null}
        </p>
      );

    case "table": {
      const headers = toStringArray(data.headers ?? data.columns);
      const rows = Array.isArray(data.rows) ? (data.rows as unknown[][]) : [];
      if (headers.length === 0 && rows.length === 0) return null;
      return (
        <table className="w-full border-collapse text-sm">
          {text("caption") ? <caption className="mb-1.5 text-xs text-neutral-600">{text("caption")}</caption> : null}
          {headers.length > 0 ? (
            <thead>
              <tr>
                {headers.map((header, index) => (
                  <th
                    key={index}
                    className="border border-neutral-400 bg-neutral-100 px-2 py-1.5 text-start font-bold"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {(Array.isArray(row) ? row : Object.values(row as object)).map((cell, cellIndex) => (
                  <td key={cellIndex} className="border border-neutral-400 px-2 py-1.5 align-top">
                    {String(cell ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    case "keyboard": {
      const shortcuts = Array.isArray(data.shortcuts) ? (data.shortcuts as Record<string, unknown>[]) : [];
      const keys = toStringArray(data.keys);
      return (
        <Section title={text("title") || "کلیدهای میان‌بر"} icon="Keyboard">
          {keys.length > 0 ? (
            <p className="flex flex-wrap items-center gap-1.5">
              {keys.map((key) => (
                <kbd key={key} className="rounded border border-neutral-400 bg-neutral-100 px-1.5 py-0.5 text-xs">
                  {key}
                </kbd>
              ))}
            </p>
          ) : null}
          {shortcuts.length > 0 ? (
            <ul className="mt-1.5 flex flex-col gap-1">
              {shortcuts.map((shortcut, index) => (
                <li key={index}>
                  <span className="font-mono text-xs" dir="ltr">
                    {String(shortcut.keys ?? "")}
                  </span>
                  {" — "}
                  {String(shortcut.description ?? "")}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      );
    }

    case "code":
      return (
        <pre className="break-inside-avoid overflow-visible whitespace-pre-wrap rounded-lg border border-neutral-400 bg-neutral-100 p-3 text-xs">
          <code dir="ltr">{text("code")}</code>
        </pre>
      );

    case "steps": {
      const steps = Array.isArray(data.steps) ? (data.steps as Record<string, unknown>[]) : [];
      return (
        <Section title={text("title") || "مرحله‌به‌مرحله"} icon="ListOrdered">
          <ol className="flex list-decimal flex-col gap-2 ps-5">
            {steps.map((step, index) => (
              <li key={index} className="break-inside-avoid">
                <span className="font-bold">{String(step.title ?? "")}</span>
                {step.description ? (
                  <div className="mt-0.5">
                    <RichText html={String(step.description)} />
                  </div>
                ) : null}
                {step.tip ? (
                  <p className="mt-1 text-xs text-neutral-600">نکته: {String(step.tip)}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>
      );
    }

    case "practice":
    case "checklist": {
      const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];
      return (
        <Section title={text("title") || "تمرین عملی"} icon="ListChecks">
          <ul className="flex flex-col gap-1.5">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span aria-hidden="true">☐</span>
                <span>
                  {String(item.text ?? item.label ?? "")}
                  {item.hint ? (
                    <span className="block text-xs text-neutral-600">{String(item.hint)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      );
    }

    case "summary": {
      const points = toStringArray(data.points ?? data.items);
      return (
        <Section title={text("title") || "خلاصه این درس"} icon="BookOpenCheck">
          <ul className="flex list-disc flex-col gap-1 ps-5">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Section>
      );
    }

    case "faq": {
      const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];
      return (
        <Section title={text("title") || "پرسش و پاسخ"} icon="HelpCircle">
          <dl className="flex flex-col gap-2.5">
            {items.map((item, index) => (
              <div key={index} className="break-inside-avoid">
                <dt className="text-sm font-bold">{String(item.question ?? "")}</dt>
                <dd className="mt-0.5">
                  <RichText html={String(item.answer ?? "")} />
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      );
    }

    case "resource": {
      const resources = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];
      return (
        <Section title={text("title") || "منابع بیشتر"} icon="Paperclip">
          <ul className="flex flex-col gap-1.5">
            {resources.map((resource, index) => (
              <li key={index}>
                <span className="font-medium">{String(resource.title ?? "")}</span>
                {resource.kind ? (
                  <span className="text-xs text-neutral-600">
                    {" "}
                    ({RESOURCE_KIND_LABELS[String(resource.kind) as never] ?? String(resource.kind)})
                  </span>
                ) : null}
                {resource.url ? (
                  <span dir="ltr" className="ms-1.5 font-mono text-xs">
                    {String(resource.url)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      );
    }

    case "relatedLessons": {
      const lessons = Array.isArray(data.lessons) ? (data.lessons as Record<string, unknown>[]) : [];
      if (lessons.length === 0) return null;
      return (
        <Section title={text("title") || "درس‌های مرتبط"} icon="Link2">
          <ul className="flex list-disc flex-col gap-1 ps-5">
            {lessons.map((lesson, index) => (
              <li key={index}>
                {String(lesson.title ?? "")}
                {lesson.estimatedMinutes ? (
                  <span className="text-xs text-neutral-600"> ({formatDuration(Number(lesson.estimatedMinutes))})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      );
    }

    case "divider":
      return <hr className="my-2 border-neutral-300" />;

    // Interactive-only blocks: stateful on screen, meaningless on paper.
    case "exercise":
      return <InteractiveNote label="تمرین تعاملی" />;
    case "demo":
      return <InteractiveNote label="نمایش تعاملی نرم‌افزار" />;
    case "quiz":
      return <InteractiveNote label="آزمون این درس" />;

    default:
      return null;
  }
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid rounded-lg border border-neutral-300 p-3.5">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
        <PrintIcon name={icon} />
        {title}
      </h3>
      {children}
    </section>
  );
}

function InteractiveNote({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-neutral-400 px-3 py-2 text-xs text-neutral-600">
      {label} — این بخش تعاملی است و در نسخه چاپی نمایش داده نمی‌شود. برای انجام آن، درس را در سایت باز کنید.
    </p>
  );
}

/** Sanitises authored HTML before it reaches the printout. */
function RichText({ html }: { html: string }) {
  if (!html) return null;
  return (
    <div
      className="print-richtext text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
    />
  );
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return String(record.text ?? record.title ?? record.label ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

function PrintIcon({ name }: { name: string }) {
  const Icon = getIcon(name);
  return <Icon size={15} aria-hidden="true" className="shrink-0" />;
}

/** Escapes for use where raw text (not sanitised HTML) is rendered. */
export function plainText(value: string): string {
  return toPersianDigits(value);
}
