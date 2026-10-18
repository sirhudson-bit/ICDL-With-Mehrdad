"use client";

import { useMemo } from "react";

import { getIcon } from "@/components/icon";
import { Badge, Button } from "@/components/ui/primitives";
import type { ExerciseKindData } from "@/lib/content/blocks";
import { toEnglishDigits, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

/**
 * Interactive environment simulators.
 *
 * These are the "practice inside the page" pieces: a spreadsheet that really
 * evaluates formulas, a document with a working formatting toolbar, a browser,
 * a file manager and an email composer. Each one reports state upward so the
 * exercise runner can grade the attempt.
 */

// ─────────────────────────────────────────────────────────────
// Spreadsheet
// ─────────────────────────────────────────────────────────────

type CellValue = string | number | null;

function columnIndex(label: string): number {
  return label.toUpperCase().charCodeAt(0) - 65;
}

/** Evaluates the small subset of Excel syntax these exercises use. */
function evaluateFormula(
  formula: string,
  grid: CellValue[][],
  columns: string[],
): { value: number | null; error: string | null } {
  const expression = toEnglishDigits(formula).replace(/\s+/g, "").replace(/^=/, "");
  if (!expression) return { value: null, error: null };

  const readCell = (reference: string): number | null => {
    const match = /^([A-Za-z]+)(\d+)$/.exec(reference);
    if (!match) return null;
    const column = columnIndex(match[1]!);
    const row = Number(match[2]) - 1;
    if (column < 0 || column >= columns.length || row < 0 || row >= grid.length) return null;
    const raw = grid[row]?.[column];
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
      const parsed = Number(toEnglishDigits(raw).replace(/[^\d.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const expandRange = (range: string): number[] => {
    const [start, end] = range.split(":");
    if (!start || !end) return [];
    const startMatch = /^([A-Za-z]+)(\d+)$/.exec(start);
    const endMatch = /^([A-Za-z]+)(\d+)$/.exec(end);
    if (!startMatch || !endMatch) return [];

    const values: number[] = [];
    const startColumn = columnIndex(startMatch[1]!);
    const endColumn = columnIndex(endMatch[1]!);
    const startRow = Number(startMatch[2]!);
    const endRow = Number(endMatch[2]!);

    for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row += 1) {
      for (let column = Math.min(startColumn, endColumn); column <= Math.max(startColumn, endColumn); column += 1) {
        const reference = `${String.fromCharCode(65 + column)}${row}`;
        const value = readCell(reference);
        if (value !== null) values.push(value);
      }
    }
    return values;
  };

  const functionMatch = /^(SUM|AVERAGE|MIN|MAX|COUNT)\((.*)\)$/.exec(expression);
  if (functionMatch) {
    const name = functionMatch[1]!;
    const args = functionMatch[2]!.split(",").flatMap((argument) =>
      argument.includes(":") ? expandRange(argument) : [readCell(argument)].filter((value): value is number => value !== null),
    );

    if (args.length === 0) return { value: 0, error: null };
    if (name === "COUNT") return { value: args.length, error: null };

    const sum = args.reduce((total, value) => total + value, 0);
    switch (name) {
      case "SUM":
        return { value: sum, error: null };
      case "AVERAGE":
        return { value: sum / args.length, error: null };
      case "MIN":
        return { value: Math.min(...args), error: null };
      case "MAX":
        return { value: Math.max(...args), error: null };
      default:
        return { value: null, error: null };
    }
  }

  // Simple arithmetic over cell references, e.g. =B2+B3.
  if (/^[A-Za-z]+\d+([+\-*/][A-Za-z]+\d+)*$/.test(expression)) {
    const parts = expression.split(/([+\-*/])/);
    let total = readCell(parts[0]!);
    if (total === null) return { value: null, error: "خطا" };

    for (let index = 1; index < parts.length; index += 2) {
      const operator = parts[index];
      const operand = readCell(parts[index + 1] ?? "");
      if (operand === null) return { value: null, error: "خطا" };
      if (operator === "+") total += operand;
      if (operator === "-") total -= operand;
      if (operator === "*") total *= operand;
      if (operator === "/") total = operand === 0 ? total : total / operand;
    }
    return { value: total, error: null };
  }

  const numeric = Number(expression);
  if (Number.isFinite(numeric)) return { value: numeric, error: null };

  return { value: null, error: "#NAME?" };
}

export function ExcelFormulaSim({
  exercise,
  answer,
  onChange,
  disabled,
}: {
  exercise: ExerciseKindData<"excelFormula">;
  answer: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const preview = useMemo(() => {
    if (!answer.startsWith("=")) return { value: null as number | null, error: null as string | null };
    const grid = exercise.rows.map((row) => [...row]);
    grid[exercise.targetRow]![exercise.targetColumn] = answer;
    return evaluateFormula(answer, grid, exercise.columns);
  }, [answer, exercise]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <CellGlyph />
        <span>
          سلول هدف:{" "}
          <span dir="ltr" className="font-mono font-bold text-foreground">
            {exercise.columns[exercise.targetColumn]}
            {exercise.targetRow + 1}
          </span>
        </span>
        {preview.error ? <Badge tone="danger">خطا در فرمول</Badge> : null}
        {preview.value !== null && !preview.error ? (
          <Badge tone="success">
            نتیجه: {toPersianDigits(preview.value.toLocaleString("en-US", { maximumFractionDigits: 2 }))}
          </Badge>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="w-9 border-e border-border px-2 py-1.5 text-xs text-muted-foreground" />
              {exercise.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="border-e border-border px-2 py-1.5 text-center text-xs font-bold text-muted-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exercise.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th
                  scope="row"
                  className="border-e border-t border-border bg-muted px-2 py-1.5 text-center text-xs font-bold text-muted-foreground"
                >
                  {toPersianDigits(rowIndex + 1)}
                </th>
                {exercise.columns.map((_, columnIndexValue) => {
                  const isTarget =
                    rowIndex === exercise.targetRow && columnIndexValue === exercise.targetColumn;
                  const cell = row[columnIndexValue];

                  return (
                    <td
                      key={columnIndexValue}
                      className={cn(
                        "border-e border-t border-border p-0 align-middle",
                        isTarget && "bg-primary-soft ring-1 ring-inset ring-primary/40",
                      )}
                    >
                      {isTarget ? (
                        <input
                          value={answer}
                          onChange={(event) => onChange(event.target.value)}
                          disabled={disabled}
                          dir="ltr"
                          aria-label={`سلول ${exercise.columns[columnIndexValue]}${rowIndex + 1}`}
                          placeholder="=SUM(...)"
                          className="h-9 w-full min-w-24 bg-transparent px-2 text-center font-mono text-sm outline-none disabled:opacity-70"
                        />
                      ) : (
                        <span className="spreadsheet-cell block px-2 py-2 text-muted-foreground">
                          {cell === null || cell === undefined
                            ? ""
                            : typeof cell === "number"
                              ? toPersianDigits(cell.toLocaleString("en-US"))
                              : cell}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-subtle-foreground">
        راهنما: فرمول‌ها با علامت مساوی شروع می‌شوند. مثلاً{" "}
        <span dir="ltr" className="font-mono">
          =SUM(B2:B4)
        </span>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Document formatting
// ─────────────────────────────────────────────────────────────

const WORD_TOOLS: { kind: string; label: string; icon: string }[] = [
  { kind: "bold", label: "پررنگ", icon: "Type" },
  { kind: "italic", label: "کج", icon: "Type" },
  { kind: "underline", label: "زیرخط", icon: "Type" },
  { kind: "alignRight", label: "راست‌چین", icon: "ArrowRight" },
  { kind: "alignCenter", label: "وسط‌چین", icon: "ListChecks" },
  { kind: "bulletList", label: "لیست نشانه‌دار", icon: "ListOrdered" },
  { kind: "numberedList", label: "لیست شماره‌دار", icon: "ListOrdered" },
];

export function WordFormatSim({
  exercise,
  answer,
  onChange,
  disabled,
}: {
  exercise: ExerciseKindData<"wordFormat">;
  answer: Record<string, boolean>;
  onChange: (value: Record<string, boolean>) => void;
  disabled: boolean;
}) {
  const lines = exercise.text.split("\n").filter(Boolean);
  const [heading, ...rest] = lines;

  const toggle = (kind: string) => {
    if (disabled) return;
    onChange({ ...answer, [kind]: !answer[kind] });
  };

  const style = {
    fontWeight: answer.bold ? 700 : 400,
    fontStyle: answer.italic ? "italic" : "normal",
    textDecoration: answer.underline ? "underline" : "none",
    textAlign: answer.alignCenter ? "center" : answer.alignRight ? "right" : "start",
  } as const;

  const listKind = answer.bulletList ? "bullet" : answer.numberedList ? "number" : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-card-muted p-2">
        {WORD_TOOLS.filter((tool) => exercise.tasks.some((task) => task.kind === tool.kind)).map((tool) => {
          const Icon = getIcon(tool.icon);
          const active = Boolean(answer[tool.kind]);
          return (
            <button
              key={tool.kind}
              type="button"
              onClick={() => toggle(tool.kind)}
              disabled={disabled}
              aria-pressed={active}
              title={tool.label}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
                active ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-card hover:bg-muted",
              )}
            >
              <Icon size={14} aria-hidden="true" />
              {tool.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-4" style={style}>
        <p className="text-sm leading-loose">{heading}</p>
        {rest.length > 0 ? (
          listKind ? (
            <ul className="mt-2 text-sm leading-loose" style={{ listStyle: listKind === "bullet" ? "disc" : "decimal" }}>
              {rest.map((line, index) => (
                <li key={index} className="ms-5">
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-loose">{rest.join(" ")}</p>
          )
        ) : null}
      </div>

      <TaskList
        tasks={exercise.tasks.map((task) => ({ label: task.label, done: Boolean(answer[task.kind]) }))}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Browser
// ─────────────────────────────────────────────────────────────

export function BrowserSim({
  exercise,
  answer,
  onChange,
  disabled,
}: {
  exercise: ExerciseKindData<"browserSearch">;
  answer: { query: string; openedIndex: number | null; bookmarkedIndex: number | null };
  onChange: (value: { query: string; openedIndex: number | null; bookmarkedIndex: number | null }) => void;
  disabled: boolean;
}) {
  const hasQuery = answer.query.trim().length > 0;
  const shown = hasQuery ? exercise.results : [];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border">
        {/* Chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-card-muted px-2 py-2">
          <span className="flex gap-1.5 ps-1" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-danger/60" />
            <span className="size-2.5 rounded-full bg-warning/60" />
            <span className="size-2.5 rounded-full bg-success/60" />
          </span>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
            <SearchGlyph />
            <input
              value={answer.query}
              onChange={(event) => onChange({ ...answer, query: event.target.value, openedIndex: null })}
              disabled={disabled}
              placeholder="عبارت جستجو را بنویسید…"
              aria-label="نوار آدرس مرورگر"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <span className="hidden text-[0.625rem] text-subtle-foreground sm:block">مرورگر شبیه‌سازی‌شده</span>
        </div>

        {/* Results */}
        <div className="min-h-40 bg-card p-3">
          {!hasQuery ? (
            <p className="py-8 text-center text-sm text-subtle-foreground">
              عبارتی را جستجو کنید تا نتایج نمایش داده شود.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {shown.map((result, index) => {
                const isOpen = answer.openedIndex === index + 1;
                const isBookmarked = answer.bookmarkedIndex === index + 1;

                return (
                  <li key={result.url} className="rounded-xl border border-border p-3">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => onChange({ ...answer, openedIndex: index + 1 })}
                        disabled={disabled}
                        className="min-w-0 flex-1 text-start"
                      >
                        <span className="block text-sm font-bold text-primary hover:underline">{result.title}</span>
                        <span dir="ltr" className="mt-0.5 block truncate text-[0.6875rem] text-success">
                          {result.url}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {result.snippet}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange({ ...answer, bookmarkedIndex: index + 1 })}
                        disabled={disabled}
                        aria-label={`نشان‌دار کردن نتیجه ${index + 1}`}
                        className={cn(
                          "inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                          isBookmarked ? "text-accent" : "text-border-strong hover:bg-muted",
                        )}
                      >
                        <StarGlyph filled={isBookmarked} />
                      </button>
                    </div>
                    {isOpen ? (
                      <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-[0.6875rem] text-muted-foreground">
                        این صفحه باز شد (شبیه‌سازی).
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <TaskList
        tasks={exercise.tasks.map((task) => {
          const done =
            task.kind === "search"
              ? answer.query.trim().length > 0
              : task.kind === "openResult"
                ? answer.openedIndex === task.resultIndex
                : answer.bookmarkedIndex === task.resultIndex;
          return { label: task.label, done };
        })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// File manager
// ─────────────────────────────────────────────────────────────

const FILE_ICONS: Record<string, string> = {
  folder: "FolderTree",
  document: "FileText",
  image: "Image",
  archive: "Paperclip",
  spreadsheet: "FileSpreadsheet",
};

export function FileExplorerSim({
  exercise,
  answer,
  onChange,
  disabled,
}: {
  exercise: ExerciseKindData<"fileExplorer">;
  answer: {
    sort: string | null;
    selectedId: string | null;
    clipboardId: string | null;
    pasted: boolean;
    deletedIds: string[];
    createdFolder: boolean;
  };
  onChange: (value: typeof answer) => void;
  disabled: boolean;
}) {
  const files = useMemo(() => {
    const visible = exercise.files.filter((file) => !answer.deletedIds.includes(file.id));
    if (answer.sort === "name") return [...visible].sort((a, b) => a.name.localeCompare(b.name, "fa"));
    if (answer.sort === "size") return [...visible].sort((a, b) => b.sizeKb - a.sizeKb);
    if (answer.sort === "modified") return [...visible].sort((a, b) => b.modified.localeCompare(a.modified, "fa"));
    return visible;
  }, [exercise.files, answer.sort, answer.deletedIds]);

  const selected = exercise.files.find((file) => file.id === answer.selectedId);
  const clipboard = exercise.files.find((file) => file.id === answer.clipboardId);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card-muted p-2">
          <Button
            size="sm"
            variant={answer.sort === "name" ? "soft" : "outline"}
            disabled={disabled}
            onClick={() => onChange({ ...answer, sort: "name" })}
          >
            مرتب‌سازی بر اساس نام
          </Button>
          <Button
            size="sm"
            variant={answer.sort === "size" ? "soft" : "outline"}
            disabled={disabled}
            onClick={() => onChange({ ...answer, sort: "size" })}
          >
            مرتب‌سازی بر اساس حجم
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange({ ...answer, createdFolder: true })}
          >
            <PlusGlyph />
            پوشه جدید
          </Button>

          <div className="ms-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || !answer.selectedId}
              onClick={() => onChange({ ...answer, clipboardId: answer.selectedId })}
            >
              کپی
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || !answer.clipboardId}
              onClick={() => onChange({ ...answer, pasted: true })}
            >
              جای‌گذاری
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || !answer.selectedId}
              onClick={() =>
                onChange({
                  ...answer,
                  deletedIds: [...answer.deletedIds, answer.selectedId ?? ""],
                  selectedId: null,
                })
              }
            >
              حذف
            </Button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[0.6875rem] text-muted-foreground">
          <span>{toPersianDigits(files.length)} مورد</span>
          {selected ? <span>انتخاب‌شده: {selected.name}</span> : <span>موردی انتخاب نشده</span>}
          {clipboard ? <Badge tone="info">در حافظه: {clipboard.name}</Badge> : null}
          {answer.pasted && clipboard ? <Badge tone="success">جای‌گذاری شد</Badge> : null}
          {answer.createdFolder ? <Badge tone="success">پوشه جدید ساخته شد</Badge> : null}
        </div>

        {/* File list */}
        <ul className="divide-y divide-border">
          {answer.createdFolder ? (
            <li className="flex items-center gap-2.5 px-3 py-2 text-sm">
              <FolderGlyph />
              <span className="font-medium">پوشه جدید</span>
              <span className="ms-auto text-[0.6875rem] text-subtle-foreground">همین حالا</span>
            </li>
          ) : null}

          {files.map((file) => {
            const Icon = getIcon(FILE_ICONS[file.kind] ?? "FileText");
            const isSelected = file.id === answer.selectedId;

            return (
              <li key={file.id}>
                <button
                  type="button"
                  onClick={() => onChange({ ...answer, selectedId: file.id })}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors",
                    isSelected ? "bg-primary-soft" : "hover:bg-muted",
                  )}
                >
                  <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  {file.id === answer.clipboardId ? <Badge tone="info" size="sm">کپی‌شده</Badge> : null}
                  <span className="shrink-0 text-[0.6875rem] text-subtle-foreground tabular-nums">
                    {toPersianDigits(file.sizeKb)} کیلوبایت
                  </span>
                  <span className="hidden shrink-0 text-[0.6875rem] text-subtle-foreground sm:block">
                    {file.modified}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <TaskList
        tasks={exercise.tasks.map((task) => {
          let done = false;
          if (task.kind === "sortName") done = answer.sort === "name";
          if (task.kind === "sortSize") done = answer.sort === "size";
          if (task.kind === "select") done = answer.selectedId === task.fileId;
          if (task.kind === "copy") done = answer.clipboardId === task.fileId;
          if (task.kind === "paste") done = answer.pasted && answer.clipboardId !== null;
          if (task.kind === "delete") done = answer.deletedIds.includes(task.fileId ?? "");
          if (task.kind === "newFolder") done = answer.createdFolder;
          return { label: task.label, done };
        })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Email composer
// ─────────────────────────────────────────────────────────────

export function EmailComposeSim({
  exercise,
  answer,
  onChange,
  disabled,
}: {
  exercise: ExerciseKindData<"emailCompose">;
  answer: { to: string; cc: string; subject: string; body: string; attachedIds: string[] };
  onChange: (value: typeof answer) => void;
  disabled: boolean;
}) {
  const toggleAttachment = (id: string) => {
    const attached = answer.attachedIds.includes(id)
      ? answer.attachedIds.filter((item) => item !== id)
      : [...answer.attachedIds, id];
    onChange({ ...answer, attachedIds: attached });
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-card-muted px-3 py-2">
          <span className="text-xs font-bold">ایمیل جدید</span>
          <Button size="sm" disabled={disabled} onClick={() => undefined}>
            <SendGlyph />
            ارسال (نمایشی)
          </Button>
        </div>

        <div className="divide-y divide-border">
          {(
            [
              { key: "to", label: "گیرنده (To)", placeholder: "example@mail.com", dir: "ltr" },
              { key: "cc", label: "رونوشت (CC)", placeholder: "example@mail.com", dir: "ltr" },
              { key: "subject", label: "موضوع", placeholder: "موضوع ایمیل", dir: "rtl" },
            ] as const
          ).map((field) => (
            <div key={field.key} className="flex items-center gap-3 px-3 py-2">
              <label htmlFor={`mail-${field.key}`} className="w-28 shrink-0 text-xs text-muted-foreground">
                {field.label}
              </label>
              <input
                id={`mail-${field.key}`}
                dir={field.dir}
                value={answer[field.key]}
                onChange={(event) => onChange({ ...answer, [field.key]: event.target.value })}
                disabled={disabled}
                placeholder={field.placeholder}
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          ))}

          <div className="px-3 py-2">
            <textarea
              aria-label="متن ایمیل"
              value={answer.body}
              onChange={(event) => onChange({ ...answer, body: event.target.value })}
              disabled={disabled}
              rows={4}
              placeholder="متن ایمیل خود را بنویسید…"
              className="w-full resize-y bg-transparent text-sm leading-relaxed outline-none"
            />
          </div>
        </div>

        {exercise.attachments.length > 0 ? (
          <div className="border-t border-border px-3 py-2.5">
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClipGlyph />
              پیوست‌ها
            </p>
            <div className="flex flex-wrap gap-2">
              {exercise.attachments.map((attachment) => {
                const attached = answer.attachedIds.includes(attachment.id);
                return (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => toggleAttachment(attachment.id)}
                    disabled={disabled}
                    aria-pressed={attached}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                      attached ? "border-primary/40 bg-primary-soft text-primary" : "border-border hover:bg-muted",
                    )}
                  >
                    {attachment.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card-muted p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="mb-1 font-bold text-foreground">خواسته‌های این تمرین:</p>
        <ul className="flex flex-col gap-1">
          <li>
            گیرنده: <span dir="ltr" className="font-mono">{exercise.expected.to}</span>
          </li>
          {exercise.expected.cc ? (
            <li>
              رونوشت: <span dir="ltr" className="font-mono">{exercise.expected.cc}</span>
            </li>
          ) : null}
          <li>موضوع: {exercise.expected.subject}</li>
          {exercise.expected.bodyIncludes ? <li>متن ایمیل باید شامل «{exercise.expected.bodyIncludes}» باشد</li> : null}
          {exercise.expected.attach ? <li>یک فایل پیوست کنید</li> : null}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────

function TaskList({ tasks }: { tasks: { label: string; done: boolean }[] }) {
  if (tasks.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5 rounded-xl border border-border bg-card-muted p-3">
      {tasks.map((task) => {
        const Icon = getIcon(task.done ? "CheckCircle2" : "Circle");
        return (
          <li key={task.label} className="flex items-center gap-2 text-xs">
            <Icon
              size={15}
              className={cn("shrink-0", task.done ? "text-success" : "text-border-strong")}
              aria-hidden="true"
            />
            <span className={cn(task.done && "text-muted-foreground line-through")}>{task.label}</span>
            <span className="sr-only">{task.done ? "انجام شد" : "انجام نشده"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function CellGlyph() {
  const Icon = getIcon("Table2");
  return <Icon size={14} aria-hidden="true" />;
}
function SearchGlyph() {
  const Icon = getIcon("Search");
  return <Icon size={14} className="text-muted-foreground" aria-hidden="true" />;
}
function StarGlyph({ filled }: { filled: boolean }) {
  const Icon = getIcon("Star");
  return <Icon size={15} fill={filled ? "currentColor" : "none"} aria-hidden="true" />;
}
function FolderGlyph() {
  const Icon = getIcon("FolderTree");
  return <Icon size={16} className="text-muted-foreground" aria-hidden="true" />;
}
function PlusGlyph() {
  const Icon = getIcon("Plus");
  return <Icon size={14} aria-hidden="true" />;
}
function SendGlyph() {
  const Icon = getIcon("Send");
  return <Icon size={14} aria-hidden="true" />;
}
function ClipGlyph() {
  const Icon = getIcon("Paperclip");
  return <Icon size={14} aria-hidden="true" />;
}

/** Re-exported so the demo viewer can reuse the spreadsheet renderer. */
export { evaluateFormula };
