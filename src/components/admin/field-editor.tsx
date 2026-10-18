"use client";

import { useEffect, useRef, useState } from "react";

import { getIcon } from "@/components/icon";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import {
  DEMO_FIELDS,
  DEMO_KIND_FIELDS,
  EXERCISE_FIELDS,
  EXERCISE_KIND_FIELDS,
  type FieldDescriptor,
} from "@/lib/content/block-fields";
import { cn } from "@/lib/utils";

/**
 * Generic visual field editor.
 *
 * Renders the right control for each field descriptor so administrators build
 * lessons through forms — text, lists, tables, step builders, exercise
 * designers — and never touch JSON. Collections support add, remove and
 * reorder, and the values it emits already match the block schemas, so anything
 * saved here also passes validation on the server.
 */

type Value = Record<string, unknown>;

export function FieldEditor({
  fields,
  value,
  onChange,
  className,
}: {
  fields: FieldDescriptor[];
  value: Value;
  onChange: (next: Value) => void;
  className?: string;
}) {
  if (fields.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong bg-card-muted px-3 py-2 text-xs text-muted-foreground">
        این بلوک تنظیماتی ندارد.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {fields.map((field) => (
        <FieldRow
          key={field.name}
          field={field}
          value={value}
          onChange={(next) => onChange({ ...value, ...next })}
        />
      ))}
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor;
  value: Value;
  onChange: (next: Value) => void;
}) {
  const current = value[field.name];

  const set = (next: unknown) => onChange({ [field.name]: next });

  switch (field.kind) {
    case "text":
      return (
        <Field label={field.label} hint={field.hint}>
          <Input value={typeof current === "string" ? current : ""} onChange={(event) => set(event.target.value)} placeholder={field.placeholder} />
        </Field>
      );

    case "textarea":
      return (
        <Field label={field.label} hint={field.hint}>
          <Textarea value={typeof current === "string" ? current : ""} onChange={(event) => set(event.target.value)} rows={4} />
        </Field>
      );

    case "html":
      return (
        <Field label={field.label} hint={field.hint ?? "می‌توانید متن را پررنگ، کج یا لیست کنید."}>
          <RichTextField value={typeof current === "string" ? current : ""} onChange={set} />
        </Field>
      );

    case "number":
      return (
        <Field label={field.label} hint={field.hint}>
          <Input
            type="number"
            min={field.min}
            max={field.max}
            value={typeof current === "number" ? current : Number(current) || 0}
            onChange={(event) => set(Number(event.target.value))}
          />
        </Field>
      );

    case "select":
    case "tone":
    case "level": {
      const options = field.options ?? [];
      const raw = current === undefined || current === null ? "" : String(current);

      return (
        <Field label={field.label} hint={field.hint}>
          <Select
            value={raw}
            onChange={(event) => {
              const next = event.target.value;
              if (field.kind === "level") set(Number(next));
              else if (field.name === "isTrue" || field.name === "attach") set(next === "true");
              else if (field.name === "columns" || field.name === "targetRow" || field.name === "targetColumn") set(Number(next));
              else set(next);
            }}
          >
            <option value="">انتخاب کنید…</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      );
    }

    case "textList":
    case "slugList": {
      const list = Array.isArray(current) ? (current as unknown[]).map((item) => String(item)) : [];
      return (
        <StringListField
          label={field.label}
          hint={field.hint}
          emptyLabel={field.emptyLabel ?? "مورد"}
          list={list}
          onChange={(next) => set(next)}
          placeholder={field.kind === "slugList" ? "نامک درس" : undefined}
        />
      );
    }

    case "image": {
      if (Array.isArray(current)) {
        return (
          <ImageListField
            label={field.label}
            images={current as { url: string; alt?: string; caption?: string }[]}
            onChange={set}
          />
        );
      }
      const image = (current ?? {}) as { url?: string; alt?: string; caption?: string };
      return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card-muted p-3">
          <Field label={field.label} hint="نشانی کامل تصویر را وارد کنید.">
            <Input
              dir="ltr"
              value={image.url ?? ""}
              onChange={(event) => set({ ...image, url: event.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label="متن جانشین">
            <Input value={image.alt ?? ""} onChange={(event) => set({ ...image, alt: event.target.value })} />
          </Field>
          <Field label="توضیح زیر تصویر">
            <Input value={image.caption ?? ""} onChange={(event) => set({ ...image, caption: event.target.value })} />
          </Field>
          {image.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin URL, preview only
            <img src={image.url} alt="" className="max-h-40 w-fit rounded-lg border border-border object-contain" />
          ) : null}
        </div>
      );
    }

    case "table":
      return (
        <TableField
          label={field.label}
          hint={field.hint}
          headers={
            Array.isArray(value.headers) ? (value.headers as unknown[]).map((item) => String(item)) : []
          }
          rows={Array.isArray(current) ? (current as string[][]) : []}
          onChange={set}
        />
      );

    case "steps":
      return (
        <CollectionField
          label={field.label}
          hint={field.hint}
          emptyLabel={field.emptyLabel ?? "مرحله"}
          items={Array.isArray(current) ? (current as Value[]) : []}
          onChange={set}
          render={(item, update) => (
            <div className="flex flex-col gap-3">
              <Field label="عنوان مرحله">
                <Input value={String(item.title ?? "")} onChange={(event) => update({ title: event.target.value })} />
              </Field>
              <Field label="توضیح مرحله">
                <RichTextField value={String(item.html ?? "")} onChange={(html) => update({ html })} />
              </Field>
              <Field label="نکته این مرحله (اختیاری)">
                <Input value={String(item.tip ?? "")} onChange={(event) => update({ tip: event.target.value })} />
              </Field>
              <Field label="نشانی تصویر (اختیاری)">
                <Input
                  dir="ltr"
                  value={String(item.imageUrl ?? "")}
                  onChange={(event) => update({ imageUrl: event.target.value })}
                />
              </Field>
            </div>
          )}
          createItem={() => ({ title: "مرحله جدید", html: "<p>توضیح این مرحله…</p>", tip: "", imageUrl: "" })}
        />
      );

    case "faqItems":
      return (
        <CollectionField
          label={field.label}
          emptyLabel={field.emptyLabel ?? "پرسش"}
          items={Array.isArray(current) ? (current as Value[]) : []}
          onChange={set}
          render={(item, update) => (
            <div className="flex flex-col gap-3">
              <Field label="پرسش">
                <Input value={String(item.question ?? "")} onChange={(event) => update({ question: event.target.value })} />
              </Field>
              <Field label="پاسخ">
                <RichTextField value={String(item.answer ?? "")} onChange={(html) => update({ answer: html })} />
              </Field>
            </div>
          )}
          createItem={() => ({ question: "پرسش جدید؟", answer: "<p>پاسخ…</p>" })}
        />
      );

    case "resourceItems":
      return (
        <CollectionField
          label={field.label}
          emptyLabel={field.emptyLabel ?? "فایل"}
          items={Array.isArray(current) ? (current as Value[]) : []}
          onChange={set}
          render={(item, update) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نام فایل">
                <Input value={String(item.label ?? "")} onChange={(event) => update({ label: event.target.value })} />
              </Field>
              <Field label="نوع">
                <Select value={String(item.kind ?? "link")} onChange={(event) => update({ kind: event.target.value })}>
                  <option value="pdf">PDF</option>
                  <option value="doc">سند ورد</option>
                  <option value="sheet">فایل اکسل</option>
                  <option value="slide">فایل پاورپوینت</option>
                  <option value="zip">فایل فشرده</option>
                  <option value="link">پیوند</option>
                </Select>
              </Field>
              <Field label="نشانی فایل">
                <Input dir="ltr" value={String(item.url ?? "")} onChange={(event) => update({ url: event.target.value })} />
              </Field>
              <Field label="حجم (اختیاری)">
                <Input value={String(item.size ?? "")} onChange={(event) => update({ size: event.target.value })} />
              </Field>
            </div>
          )}
          createItem={() => ({ label: "فایل جدید", url: "", kind: "link", size: "" })}
        />
      );

    case "shortcutItems":
      return (
        <CollectionField
          label={field.label}
          emptyLabel={field.emptyLabel ?? "میان‌بر"}
          items={Array.isArray(current) ? (current as Value[]) : []}
          onChange={set}
          render={(item, update) => (
            <div className="flex flex-col gap-3">
              <Field label="کلیدها" hint="کلیدها را با + جدا کنید، مثلاً Ctrl + C">
                <Input
                  dir="ltr"
                  value={Array.isArray(item.keys) ? (item.keys as string[]).join(" + ") : ""}
                  onChange={(event) =>
                    update({ keys: event.target.value.split("+").map((key) => key.trim()).filter(Boolean) })
                  }
                />
              </Field>
              <Field label="توضیح کار">
                <Input
                  value={String(item.description ?? "")}
                  onChange={(event) => update({ description: event.target.value })}
                />
              </Field>
            </div>
          )}
          createItem={() => ({ keys: ["Ctrl"], description: "توضیح میان‌بر" })}
        />
      );

    case "optionsWithCorrect":
      return (
        <OptionsField
          label={field.label}
          options={(current as { id: string; text: string }[]) ?? []}
          correctId={String(value.correctOptionId ?? "")}
          onChange={(options, correctId) => onChange({ options, correctOptionId: correctId })}
        />
      );

    case "matchingPairs":
      return (
        <PairsField
          label={field.label}
          data={value as { left?: { id: string; text: string }[]; right?: { id: string; text: string }[]; pairs?: [string, string][] }}
          onChange={(next) => onChange(next)}
        />
      );

    case "exercise": {
      const exercise = (current ?? { kind: "mcq" }) as Value;
      const kind = String(exercise.kind ?? "mcq") as keyof typeof EXERCISE_FIELDS;

      return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card-muted p-3">
          <Field label={field.label} hint="نوع تمرین و محتوای آن را مشخص کنید.">
            <Select
              value={kind}
              onChange={(event) =>
                set({ kind: event.target.value, ...defaultExercise(String(event.target.value)) })
              }
            >
              {EXERCISE_KIND_FIELDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <FieldEditor
            fields={EXERCISE_FIELDS[kind] ?? []}
            value={exercise}
            onChange={(next) => set({ ...exercise, ...next, kind })}
          />
        </div>
      );
    }

    case "demo": {
      const demo = (current ?? { kind: "windowsDesktop" }) as Value;
      const kind = String(demo.kind ?? "windowsDesktop") as keyof typeof DEMO_FIELDS;

      return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card-muted p-3">
          <Field label={field.label}>
            <Select value={kind} onChange={(event) => set({ kind: event.target.value })}>
              {DEMO_KIND_FIELDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <FieldEditor fields={DEMO_FIELDS[kind] ?? []} value={demo} onChange={(next) => set({ ...demo, ...next, kind })} />
        </div>
      );
    }

    case "items": {
      const list = Array.isArray(current) ? (current as Value[]) : [];
      const keys = Object.keys(field.template ?? {});

      return (
        <CollectionField
          label={field.label}
          hint={field.hint}
          emptyLabel={field.emptyLabel ?? "مورد"}
          items={list}
          onChange={set}
          render={(item, update) => (
            <div className="grid gap-3 sm:grid-cols-2">
              {keys.map((key) => (
                <Field key={key} label={ITEM_LABELS[key] ?? key}>
                  {typeof item[key] === "boolean" ? (
                    <Select
                      value={String(item[key])}
                      onChange={(event) => update({ [key]: event.target.value === "true" })}
                    >
                      <option value="true">بله</option>
                      <option value="false">خیر</option>
                    </Select>
                  ) : (
                    <Input
                      value={String(item[key] ?? "")}
                      onChange={(event) => update({ [key]: event.target.value })}
                      dir={key === "url" || key === "to" || key === "cc" ? "ltr" : undefined}
                    />
                  )}
                </Field>
              ))}
            </div>
          )}
          createItem={() => ({ ...(field.template ?? {}) })}
        />
      );
    }

    default:
      return null;
  }
}

const ITEM_LABELS: Record<string, string> = {
  title: "عنوان",
  url: "نشانی",
  snippet: "توضیح کوتاه",
  name: "نام",
  kind: "نوع",
  sizeKb: "حجم (کیلوبایت)",
  modified: "تاریخ تغییر",
  to: "گیرنده",
  cc: "رونوشت",
  subject: "موضوع",
  bodyIncludes: "متن باید شامل",
  attach: "پیوست لازم است",
  id: "شناسه",
  label: "توضیح کار",
  match: "عبارت جستجو",
  body: "متن",
};

function defaultExercise(kind: string): Value {
  switch (kind) {
    case "mcq":
      return {
        options: [
          { id: "a", text: "گزینه اول" },
          { id: "b", text: "گزینه دوم" },
        ],
        correctOptionId: "a",
      };
    case "trueFalse":
      return { statement: "این جمله درست است.", isTrue: true };
    case "fillBlank":
      return { template: "متن با جای خالی ___", blanks: [{ accepted: ["پاسخ"], hint: "" }], caseSensitive: false };
    case "matching":
      return {
        left: [
          { id: "l1", text: "مورد اول" },
          { id: "l2", text: "مورد دوم" },
        ],
        right: [
          { id: "r1", text: "پاسخ اول" },
          { id: "r2", text: "پاسخ دوم" },
        ],
        pairs: [
          ["l1", "r1"],
          ["l2", "r2"],
        ],
      };
    case "orderSteps":
      return {
        items: [
          { id: "s1", text: "مرحله اول" },
          { id: "s2", text: "مرحله دوم" },
        ],
      };
    case "excelFormula":
      return {
        columns: ["A", "B"],
        rows: [
          ["عنوان", "مقدار"],
          ["نمونه", 10],
          [null, null],
        ],
        targetRow: 2,
        targetColumn: 1,
        acceptedFormulas: ["=B2*2"],
        acceptedValues: [],
      };
    case "wordFormat":
      return {
        text: "عنوان تمرین\nمتن پاراگراف تمرین",
        tasks: [{ id: "t1", kind: "bold", label: "متن را پررنگ کنید" }],
      };
    case "browserSearch":
      return {
        results: [{ title: "نتیجه نمونه", url: "www.example.com", snippet: "توضیح نتیجه" }],
        tasks: [{ id: "t1", kind: "search", label: "عبارت نمونه را جستجو کنید", match: "نمونه" }],
      };
    case "fileExplorer":
      return {
        files: [
          { id: "f1", name: "فایل-الف.docx", kind: "document", sizeKb: 120, modified: "۱۴۰۳/۰۱/۰۱" },
          { id: "f2", name: "فایل-ب.xlsx", kind: "spreadsheet", sizeKb: 80, modified: "۱۴۰۳/۰۲/۰۱" },
        ],
        tasks: [{ id: "t1", kind: "sortName", label: "فایل‌ها را بر اساس نام مرتب کنید" }],
      };
    case "emailCompose":
      return {
        expected: { to: "someone@example.com", cc: "", subject: "موضوع نمونه", bodyIncludes: "", attach: false },
        attachments: [{ id: "a1", name: "فایل-نمونه.docx" }],
      };
    default:
      return {};
  }
}

// ─────────────────────────────────────────────────────────────
// Rich text
// ─────────────────────────────────────────────────────────────

const RTE_TOOLS = [
  { command: "bold", label: "پررنگ", glyph: "B" },
  { command: "italic", label: "کج", glyph: "I" },
  { command: "underline", label: "زیرخط", glyph: "U" },
  { command: "insertUnorderedList", label: "لیست نشانه‌دار", glyph: "•" },
  { command: "insertOrderedList", label: "لیست شماره‌دار", glyph: "۱" },
] as const;

/**
 * Lightweight rich text editor.
 *
 * A contentEditable surface with a formatting toolbar. `document.execCommand`
 * is formally deprecated but remains the only widely supported way to apply
 * inline formatting to a selection without pulling in an editor framework; the
 * output is sanitised on the server before it is ever rendered to a learner.
 */
function RichTextField({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Only write when the value changed externally, to preserve the caret.
    if (document.activeElement !== element && element.innerHTML !== value) {
      element.innerHTML = value;
    }
  }, [value]);

  const CodeIcon = getIcon("Code");

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-card">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card-muted p-1.5">
        {RTE_TOOLS.map((tool) => (
          <button
            key={tool.command}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              ref.current?.focus();
              document.execCommand(tool.command, false);
              onChange(ref.current?.innerHTML ?? "");
            }}
            className="inline-flex size-8 items-center justify-center rounded-lg text-sm font-bold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            {tool.glyph}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowSource((current) => !current)}
          aria-pressed={showSource}
          className={cn(
            "ms-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.6875rem] transition-colors",
            showSource ? "bg-card text-foreground" : "text-muted-foreground hover:bg-card",
          )}
        >
          <CodeIcon size={13} aria-hidden="true" />
          کد HTML
        </button>
      </div>

      {showSource ? (
        <Textarea
          dir="ltr"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={6}
          className="rounded-none border-0 font-mono text-xs"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="ویرایشگر متن"
          suppressContentEditableWarning
          onInput={() => onChange(ref.current?.innerHTML ?? "")}
          onBlur={() => onChange(ref.current?.innerHTML ?? "")}
          className="prose-fa min-h-24 px-3.5 py-2.5 text-sm outline-none"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Collection helpers
// ─────────────────────────────────────────────────────────────

function CollectionField({
  label,
  hint,
  emptyLabel,
  items,
  onChange,
  render,
  createItem,
}: {
  label: string;
  hint?: string;
  emptyLabel: string;
  items: Value[];
  onChange: (next: Value[]) => void;
  render: (item: Value, update: (patch: Value) => void) => React.ReactNode;
  createItem: () => Value;
}) {
  const PlusIcon = getIcon("Plus");

  const update = (index: number, patch: Value) => {
    onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      {hint ? <p className="text-xs text-subtle-foreground">{hint}</p> : null}

      <ol className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="inline-flex size-6 items-center justify-center rounded-lg bg-muted text-[0.6875rem] font-bold text-muted-foreground">
                {index + 1}
              </span>
              <span className="flex-1 text-xs text-muted-foreground truncate">
                {emptyLabel} {index + 1}
              </span>
              <IconButton label="انتقال به بالا" icon="ChevronDown" rotate onClick={() => move(index, -1)} disabled={index === 0} />
              <IconButton
                label="انتقال به پایین"
                icon="ChevronDown"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
              />
              <IconButton
                label="حذف"
                icon="Trash2"
                onClick={() => onChange(items.filter((_, position) => position !== index))}
                danger
              />
            </div>
            {render(item, (patch) => update(index, patch))}
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, createItem()])}
        className="self-start"
      >
        <PlusIcon size={14} aria-hidden="true" />
        افزودن {emptyLabel}
      </Button>
    </div>
  );
}

function StringListField({
  label,
  hint,
  emptyLabel,
  list,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  emptyLabel: string;
  list: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      {hint ? <p className="text-xs text-subtle-foreground">{hint}</p> : null}

      <ul className="flex flex-col gap-2">
        {list.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <Input
              value={item}
              placeholder={placeholder}
              onChange={(event) => onChange(list.map((entry, position) => (position === index ? event.target.value : entry)))}
            />
            <IconButton
              label="حذف"
              icon="Trash2"
              danger
              onClick={() => onChange(list.filter((_, position) => position !== index))}
            />
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, ""])} className="self-start">
        افزودن {emptyLabel}
      </Button>
    </div>
  );
}

function ImageListField({
  label,
  images,
  onChange,
}: {
  label: string;
  images: { url: string; alt?: string; caption?: string }[];
  onChange: (next: { url: string; alt?: string; caption?: string }[]) => void;
}) {
  return (
    <CollectionField
      label={label}
      emptyLabel="تصویر"
      items={images as unknown as Value[]}
      onChange={(next) => onChange(next as { url: string; alt?: string; caption?: string }[])}
      createItem={() => ({ url: "", alt: "", caption: "" })}
      render={(item, update) => (
        <div className="flex flex-col gap-3">
          <Field label="نشانی تصویر">
            <Input dir="ltr" value={String(item.url ?? "")} onChange={(event) => update({ url: event.target.value })} />
          </Field>
          <Field label="متن جانشین">
            <Input value={String(item.alt ?? "")} onChange={(event) => update({ alt: event.target.value })} />
          </Field>
          <Field label="توضیح (اختیاری)">
            <Input value={String(item.caption ?? "")} onChange={(event) => update({ caption: event.target.value })} />
          </Field>
        </div>
      )}
    />
  );
}

function TableField({
  label,
  hint,
  headers,
  rows,
  onChange,
}: {
  label: string;
  hint?: string;
  headers: string[];
  rows: string[][];
  onChange: (next: string[][]) => void;
}) {
  const columnCount = Math.max(headers.length, 1);

  const setCell = (rowIndex: number, columnIndex: number, value: string) => {
    const next = rows.map((row) => [...row]);
    while (next.length <= rowIndex) next.push(new Array(columnCount).fill(""));
    const row = next[rowIndex]!;
    while (row.length < columnCount) row.push("");
    row[columnIndex] = value;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-subtle-foreground">
        {hint ?? `تعداد ستون‌ها بر اساس سرستون‌ها (${columnCount} ستون) تعیین می‌شود.`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-card-muted">
              {Array.from({ length: columnCount }, (_, columnIndex) => (
                <th key={columnIndex} scope="col" className="border-e border-border px-2 py-1.5 text-xs text-muted-foreground last:border-e-0">
                  {headers[columnIndex] ?? `ستون ${columnIndex + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columnCount }, (_, columnIndex) => (
                  <td key={columnIndex} className="border-e border-t border-border p-0 last:border-e-0">
                    <input
                      value={row[columnIndex] ?? ""}
                      onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)}
                      aria-label={`سلول سطر ${rowIndex + 1} ستون ${columnIndex + 1}`}
                      className="h-9 w-full min-w-24 bg-transparent px-2 text-sm outline-none focus-visible:bg-primary-soft"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, new Array(columnCount).fill("")])}
        >
          افزودن سطر
        </Button>
        {rows.length > 1 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(rows.slice(0, -1))}>
            حذف آخرین سطر
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function OptionsField({
  label,
  options,
  correctId,
  onChange,
}: {
  label: string;
  options: { id: string; text: string }[];
  correctId: string;
  onChange: (options: { id: string; text: string }[], correctId: string) => void;
}) {
  const list = options.length > 0 ? options : [{ id: "a", text: "" }];
  const PlusIcon = getIcon("Plus");

  const updateText = (index: number, text: string) => {
    onChange(list.map((option, position) => (position === index ? { ...option, text } : option)), correctId);
  };

  const remove = (index: number) => {
    const next = list.filter((_, position) => position !== index);
    const removedId = list[index]?.id;
    onChange(next, correctId === removedId ? (next[0]?.id ?? "") : correctId);
  };

  const add = () => {
    const id = String.fromCharCode(97 + list.length);
    onChange([...list, { id, text: "" }], correctId || id);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-subtle-foreground">گزینه درست را با دکمه رادیویی مشخص کنید.</p>

      <ul className="flex flex-col gap-2">
        {list.map((option, index) => (
          <li key={option.id} className="flex items-center gap-2">
            <label className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border">
              <input
                type="radio"
                name={`correct-${label}`}
                checked={correctId === option.id}
                onChange={() => onChange(list, option.id)}
                aria-label={`گزینه ${index + 1} پاسخ درست است`}
                className="size-4 accent-[var(--success)]"
              />
            </label>
            <Input
              value={option.text}
              placeholder={`گزینه ${index + 1}`}
              onChange={(event) => updateText(index, event.target.value)}
            />
            {list.length > 2 ? (
              <IconButton label="حذف گزینه" icon="Trash2" danger onClick={() => remove(index)} />
            ) : null}
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" size="sm" onClick={add} className="self-start">
        <PlusIcon size={14} aria-hidden="true" />
        افزودن گزینه
      </Button>
    </div>
  );
}

function PairsField({
  label,
  data,
  onChange,
}: {
  label: string;
  data: { left?: { id: string; text: string }[]; right?: { id: string; text: string }[]; pairs?: [string, string][] };
  onChange: (next: { left: { id: string; text: string }[]; right: { id: string; text: string }[]; pairs: [string, string][] }) => void;
}) {
  const left = data.left ?? [
    { id: "l1", text: "" },
    { id: "l2", text: "" },
  ];
  const right = data.right ?? [
    { id: "r1", text: "" },
    { id: "r2", text: "" },
  ];
  const pairs = data.pairs ?? left.map((item, index) => [item.id, right[index]?.id ?? ""] as [string, string]);

  const rebuild = (
    nextLeft: { id: string; text: string }[],
    nextRight: { id: string; text: string }[],
    mapping: Record<string, string>,
  ) => {
    onChange({
      left: nextLeft,
      right: nextRight,
      pairs: nextLeft.map((item) => [item.id, mapping[item.id] ?? ""] as [string, string]),
    });
  };

  const mapping: Record<string, string> = Object.fromEntries(pairs.map(([a, b]) => [a, b]));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-subtle-foreground">برای هر مورد سمت راست، پاسخ درست را از فهرست انتخاب کنید.</p>

      <ul className="flex flex-col gap-2">
        {left.map((item, index) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2">
            <Input
              value={item.text}
              placeholder={`مورد ${index + 1}`}
              onChange={(event) =>
                rebuild(
                  left.map((entry, position) => (position === index ? { ...entry, text: event.target.value } : entry)),
                  right,
                  mapping,
                )
              }
              className="min-w-40 flex-1"
            />
            <span className="text-muted-foreground" aria-hidden="true">
              ←
            </span>
            <Select
              value={mapping[item.id] ?? ""}
              aria-label={`پاسخ درست برای مورد ${index + 1}`}
              onChange={(event) => rebuild(left, right, { ...mapping, [item.id]: event.target.value })}
              className="min-w-40 flex-1"
            >
              <option value="">انتخاب کنید…</option>
              {right.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.text || option.id}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card-muted p-3">
        <p className="text-xs font-bold">موردهای سمت راست</p>
        {right.map((option, index) => (
          <Input
            key={option.id}
            value={option.text}
            placeholder={`پاسخ ${index + 1}`}
            onChange={(event) =>
              rebuild(
                left,
                right.map((entry, position) =>
                  position === index ? { ...entry, text: event.target.value } : entry,
                ),
                mapping,
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
  danger,
  rotate,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  rotate?: boolean;
}) {
  const Icon = getIcon(icon);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40",
        danger ? "text-danger hover:bg-danger-soft" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon size={14} className={rotate ? "rotate-180" : undefined} aria-hidden="true" />
    </button>
  );
}
