"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveSettingsAction } from "@/app/actions/admin";
import { SvgIconUpload } from "@/components/admin/svg-icon-upload";
import { getIcon } from "@/components/icon";
import { Button, Field, Input, Select, Switch, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export type SettingsItemField = {
  name: string;
  label: string;
  placeholder?: string;
  wide?: boolean;
  /** `upload` renders a file picker that stores the file and keeps its path. */
  kind?: "text" | "upload";
};

export type SettingsField = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "number" | "boolean" | "select" | "list" | "records";
  hint?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  /**
   * Sub-fields for `kind: "records"` — an array of objects edited as repeatable
   * rows. Used for footer links, audience items, how-it-works steps and PWA
   * shortcuts, which are structured data rather than plain strings.
   */
  itemFields?: SettingsItemField[];
  /** Singular noun for the "add" button, e.g. "پیوند". */
  itemNoun?: string;
  maxItems?: number;
};

/**
 * Generic settings form.
 *
 * Each settings group declares the fields it exposes; the form renders the
 * controls and sends a typed object to the server action, which validates it
 * against the group's Zod schema before saving.
 */
export function SettingsForm({
  settingsKey,
  fields,
  initial,
  title,
  description,
  secretFields = [],
}: {
  settingsKey: string;
  fields: SettingsField[];
  initial: Record<string, unknown>;
  title: string;
  description?: string;
  secretFields?: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...initial }));
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const set = (name: string, value: unknown) => setValues((current) => ({ ...current, [name]: value }));

  const save = () => {
    startTransition(async () => {
      const outcome = await saveSettingsAction(settingsKey, values);
      if (!outcome.ok) {
        toast({ title: "ذخیره نشد", description: outcome.message, tone: "error" });
        return;
      }
      toast({ title: outcome.message ?? "تنظیمات ذخیره شد", tone: "success", durationMs: 2600 });
      router.refresh();
    });
  };

  const ChevronIcon = getIcon("ChevronDown");

  return (
    <section className="stack-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-card-muted sm:p-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
        <ChevronIcon
          size={17}
          className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="border-t border-border p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const value = values[field.name];
              const isWide = field.kind === "textarea" || field.kind === "list" || field.kind === "records";

              return (
                <div key={field.name} className={isWide ? "sm:col-span-2" : undefined}>
                  {field.kind === "boolean" ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card-muted px-3.5 py-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{field.label}</span>
                        {field.hint ? (
                          <span className="mt-0.5 block text-xs text-subtle-foreground">{field.hint}</span>
                        ) : null}
                      </span>
                      <Switch
                        id={`${settingsKey}-${field.name}`}
                        label={field.label}
                        checked={Boolean(value)}
                        onCheckedChange={(checked) => set(field.name, checked)}
                      />
                    </div>
                  ) : (
                    <Field
                      label={field.label}
                      hint={
                        secretFields.includes(field.name) && typeof value === "string" && value.length > 0
                          ? "برای تغییر، مقدار جدید را کامل وارد کنید."
                          : field.hint
                      }
                      htmlFor={`${settingsKey}-${field.name}`}
                    >
                      {field.kind === "textarea" ? (
                        <Textarea
                          id={`${settingsKey}-${field.name}`}
                          value={String(value ?? "")}
                          onChange={(event) => set(field.name, event.target.value)}
                          rows={4}
                          placeholder={field.placeholder}
                        />
                      ) : field.kind === "select" ? (
                        <Select
                          id={`${settingsKey}-${field.name}`}
                          value={String(value ?? "")}
                          onChange={(event) => set(field.name, event.target.value)}
                        >
                          {(field.options ?? []).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      ) : field.kind === "number" ? (
                        <Input
                          id={`${settingsKey}-${field.name}`}
                          type="number"
                          step={field.step ?? 1}
                          min={field.min}
                          max={field.max}
                          value={Number(value ?? 0)}
                          onChange={(event) => set(field.name, Number(event.target.value))}
                        />
                      ) : field.kind === "list" ? (
                        <Textarea
                          id={`${settingsKey}-${field.name}`}
                          value={Array.isArray(value) ? (value as string[]).join("\n") : String(value ?? "")}
                          onChange={(event) =>
                            set(
                              field.name,
                              event.target.value
                                .split("\n")
                                .map((line) => line.trim())
                                .filter(Boolean),
                            )
                          }
                          rows={5}
                          placeholder={field.placeholder ?? "هر مورد در یک خط"}
                        />
                      ) : field.kind === "records" ? (
                        <RecordList
                          idPrefix={`${settingsKey}-${field.name}`}
                          rows={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
                          itemFields={field.itemFields ?? []}
                          itemNoun={field.itemNoun ?? "مورد"}
                          maxItems={field.maxItems ?? 12}
                          onChange={(rows) => set(field.name, rows)}
                        />
                      ) : (
                        <Input
                          id={`${settingsKey}-${field.name}`}
                          value={String(value ?? "")}
                          onChange={(event) => set(field.name, event.target.value)}
                          placeholder={field.placeholder}
                          dir={field.name.toLowerCase().includes("url") ? "ltr" : undefined}
                        />
                      )}
                    </Field>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button onClick={save} disabled={pending}>
              {pending ? "در حال ذخیره…" : "ذخیره این بخش"}
            </Button>
            <Button variant="ghost" onClick={() => setValues({ ...initial })} disabled={pending}>
              بازگرداندن به حالت اولیه
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Repeatable rows of structured data.
 *
 * Buttons rather than drag-and-drop: the lists are small, and keyboard- and
 * touch-friendly reordering matters more here than pointer-only dragging.
 */
function RecordList({
  idPrefix,
  rows,
  itemFields,
  itemNoun,
  maxItems,
  onChange,
}: {
  idPrefix: string;
  rows: Record<string, unknown>[];
  itemFields: SettingsItemField[];
  itemNoun: string;
  maxItems: number;
  onChange: (rows: Record<string, unknown>[]) => void;
}) {
  const PlusIcon = getIcon("Plus");
  const TrashIcon = getIcon("Trash2");
  const UpIcon = getIcon("ChevronUp");
  const DownIcon = getIcon("ChevronDown");

  const update = (index: number, name: string, next: string) => {
    const copy = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [name]: next } : row,
    );
    onChange(copy);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const copy = [...rows];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item!);
    onChange(copy);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong bg-card-muted px-3.5 py-3 text-xs text-muted-foreground">
          هنوز {itemNoun}ی اضافه نشده است.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <div key={index} className="rounded-xl border border-border bg-card-muted p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[0.6875rem] font-bold text-muted-foreground">
              {itemNoun} {index + 1}
            </span>
            <span className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="انتقال به بالا"
                className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <UpIcon size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label="انتقال به پایین"
                className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <DownIcon size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                aria-label="حذف"
                className="inline-flex size-7 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger-soft"
              >
                <TrashIcon size={15} aria-hidden="true" />
              </button>
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {itemFields.map((itemField) =>
              itemField.kind === "upload" ? (
                // Not a <label>: clicking it would open the file dialog twice.
                <div key={itemField.name} className={itemField.wide ? "sm:col-span-2" : undefined}>
                  <span className="mb-1 block text-[0.6875rem] text-muted-foreground">
                    {itemField.label}
                  </span>
                  <SvgIconUpload
                    id={`${idPrefix}-${index}-${itemField.name}`}
                    value={String(row[itemField.name] ?? "")}
                    onChange={(next) => update(index, itemField.name, next)}
                  />
                </div>
              ) : (
                <label key={itemField.name} className={itemField.wide ? "sm:col-span-2" : undefined}>
                  <span className="mb-1 block text-[0.6875rem] text-muted-foreground">
                    {itemField.label}
                  </span>
                  <Input
                    id={`${idPrefix}-${index}-${itemField.name}`}
                    value={String(row[itemField.name] ?? "")}
                    onChange={(event) => update(index, itemField.name, event.target.value)}
                    placeholder={itemField.placeholder}
                    className="h-9 text-xs"
                  />
                </label>
              ),
            )}
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={rows.length >= maxItems}
        onClick={() => onChange([...rows, Object.fromEntries(itemFields.map((f) => [f.name, ""]))])}
      >
        <PlusIcon size={16} aria-hidden="true" />
        افزودن {itemNoun}
      </Button>
    </div>
  );
}
