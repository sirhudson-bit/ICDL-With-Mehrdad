"use client";

import { useState } from "react";

import { getIcon } from "@/components/icon";
import { WindowsSimulator } from "@/components/lesson/windows-simulator";
import { Button } from "@/components/ui/primitives";
import type { DemoData } from "@/lib/content/blocks";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

/**
 * Explorable environment demos.
 *
 * The counterpart to an exercise: nothing is graded, the learner is simply
 * invited to poke at a simulated Windows desktop, file manager, document,
 * spreadsheet, browser or slide deck so the real program feels familiar before
 * they open it.
 */
export function DemoViewer({ title, instructions, demo }: { title: string; instructions?: string; demo: DemoData }) {
  const MonitorIcon = getIcon("MonitorPlay");

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2.5 border-b border-border bg-card-muted px-4 py-3 sm:px-5">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <MonitorIcon size={18} aria-hidden="true" />
        </span>
        <h3 className="text-sm font-bold sm:text-base">{title}</h3>
        <span className="ms-auto hidden text-[0.625rem] text-subtle-foreground sm:block">
          نمایش تعاملی — هر کاری بکنید مشکلی پیش نمی‌آید
        </span>
      </header>

      <div className="p-3 sm:p-4">
        {instructions ? (
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{instructions}</p>
        ) : null}

        {demo.kind === "windowsDesktop" ? <WindowsSimulator hint={demo.hint} /> : null}
        {demo.kind === "fileExplorer" ? (
          <ExplorerDemo folders={demo.folders} files={demo.files} hint={demo.hint} />
        ) : null}
        {demo.kind === "wordEditor" ? <WordDemo initialText={demo.initialText} hint={demo.hint} /> : null}
        {demo.kind === "excelSheet" ? (
          <SheetDemo columns={demo.columns} rows={demo.rows} hint={demo.hint} />
        ) : null}
        {demo.kind === "browser" ? <BrowserDemo address={demo.address} results={demo.results} hint={demo.hint} /> : null}
        {demo.kind === "powerPoint" ? <SlidesDemo slides={demo.slides} hint={demo.hint} /> : null}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// File explorer
// ─────────────────────────────────────────────────────────────

function ExplorerDemo({ folders, files, hint }: { folders: string[]; files: string[]; hint?: string }) {
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-card-muted px-2.5 py-2">
        <button
          type="button"
          onClick={() => setOpenFolder(null)}
          disabled={openFolder === null}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-40"
        >
          <BackGlyph />
          بازگشت
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs">
          <FolderGlyph />
          <span dir="ltr" className="truncate text-muted-foreground">
            This PC{openFolder ? ` \\ Documents \\ ${openFolder}` : ""}
          </span>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3">
        {openFolder === null
          ? folders.map((folder) => (
              <li key={folder}>
                <button
                  type="button"
                  onDoubleClick={() => setOpenFolder(folder)}
                  onClick={() => setOpenFolder(folder)}
                  className="flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs transition-colors hover:bg-muted"
                >
                  <FolderGlyph size={26} />
                  <span>{folder}</span>
                </button>
              </li>
            ))
          : files.map((file) => (
              <li key={file}>
                <div className="flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs text-muted-foreground">
                  <FileGlyph size={26} />
                  <span className="text-center break-all">{file}</span>
                </div>
              </li>
            ))}
      </ul>

      <p className="border-t border-border bg-card-muted px-3 py-2 text-[0.6875rem] text-muted-foreground">
        {openFolder === null
          ? "روی یک پوشه کلیک کنید تا باز شود."
          : `محتوای پوشه «${openFolder}» — برای بازگشت دکمه بازگشت را بزنید.`}
      </p>
      {hint ? <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Word
// ─────────────────────────────────────────────────────────────

function WordDemo({ initialText, hint }: { initialText?: string; hint?: string }) {
  const [value, setValue] = useState(initialText ?? "اینجا تمرین کنید…");
  const [bold, setBold] = useState(false);
  const [align, setAlign] = useState<"right" | "center">("right");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-card-muted px-2 py-1.5">
        <button
          type="button"
          onClick={() => setBold((current) => !current)}
          aria-pressed={bold}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-lg border text-sm font-bold transition-colors",
            bold ? "border-primary/40 bg-primary-soft text-primary" : "border-border hover:bg-muted",
          )}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => setAlign("right")}
          aria-pressed={align === "right"}
          className={cn(
            "rounded-lg border px-2 py-1 text-xs transition-colors",
            align === "right" ? "border-primary/40 bg-primary-soft text-primary" : "border-border hover:bg-muted",
          )}
        >
          راست‌چین
        </button>
        <button
          type="button"
          onClick={() => setAlign("center")}
          aria-pressed={align === "center"}
          className={cn(
            "rounded-lg border px-2 py-1 text-xs transition-colors",
            align === "center" ? "border-primary/40 bg-primary-soft text-primary" : "border-border hover:bg-muted",
          )}
        >
          وسط‌چین
        </button>
        <span className="ms-auto text-[0.625rem] text-subtle-foreground">Word شبیه‌سازی‌شده</span>
      </div>

      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="ویرایشگر متن"
        rows={5}
        className="w-full resize-y bg-card px-4 py-3 text-sm leading-loose outline-none"
        style={{
          fontWeight: bold ? 700 : 400,
          textAlign: align,
        }}
      />
      {hint ? <p className="border-t border-border bg-card-muted px-3 py-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Excel
// ─────────────────────────────────────────────────────────────

function SheetDemo({
  columns,
  rows,
  hint,
}: {
  columns: string[];
  rows: (string | number | null)[][];
  hint?: string;
}) {
  const [data, setData] = useState<(string | number | null)[][]>(() => {
    const base = rows.length > 0 ? rows.map((row) => [...row]) : [["", "", ""]];
    return base;
  });

  const setCell = (rowIndex: number, columnIndex: number, value: string) => {
    setData((current) => {
      const next = current.map((row) => [...row]);
      while (next.length <= rowIndex) next.push(columns.map(() => null));
      next[rowIndex]![columnIndex] = value;
      return next;
    });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-card-muted">
            <th className="w-9 border-e border-border px-2 py-1.5" />
            {columns.map((column) => (
              <th key={column} scope="col" className="border-e border-border px-2 py-1.5 text-xs font-bold text-muted-foreground">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <th scope="row" className="border-e border-t border-border bg-card-muted px-2 py-1.5 text-xs font-bold text-muted-foreground">
                {toPersianDigits(rowIndex + 1)}
              </th>
              {columns.map((_, columnIndex) => (
                <td key={columnIndex} className="border-e border-t border-border p-0">
                  <input
                    value={row[columnIndex] === null || row[columnIndex] === undefined ? "" : String(row[columnIndex])}
                    onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)}
                    aria-label={`سلول ${columns[columnIndex]}${rowIndex + 1}`}
                    className="h-9 w-full bg-transparent px-2 text-center text-sm outline-none focus-visible:bg-primary-soft"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hint ? <p className="border-t border-border bg-card-muted px-3 py-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Browser
// ─────────────────────────────────────────────────────────────

function BrowserDemo({
  address,
  results,
  hint,
}: {
  address: string;
  results: { title: string; url: string; snippet: string }[];
  hint?: string;
}) {
  const [tabs, setTabs] = useState<string[]>([address]);
  const [active, setActive] = useState(0);
  const [input, setInput] = useState(address);

  const openTab = () => {
    setTabs((current) => [...current, "تب جدید"]);
    setActive(tabs.length);
    setInput("");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-1 border-b border-border bg-card-muted p-1.5">
        {tabs.map((tab, index) => (
          <span
            key={`${tab}-${index}`}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.6875rem]",
              index === active ? "bg-card font-bold" : "text-muted-foreground hover:bg-card/60",
            )}
          >
            <button type="button" onClick={() => setActive(index)}>
              {tab}
            </button>
            {tabs.length > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setTabs((current) => current.filter((_, position) => position !== index));
                  setActive(0);
                }}
                aria-label={`بستن ${tab}`}
                className="text-muted-foreground"
              >
                <CloseGlyph />
              </button>
            ) : null}
          </span>
        ))}
        <button
          type="button"
          onClick={openTab}
          aria-label="تب جدید"
          className="inline-flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-card"
        >
          <PlusGlyph />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <BackGlyph />
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
          <SearchGlyph />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setTabs((current) => current.map((tab, index) => (index === active ? input || "صفحه جدید" : tab)));
              }
            }}
            dir="ltr"
            aria-label="نوار آدرس"
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
      </div>

      <div className="p-3">
        {results.length === 0 ? (
          <p className="py-8 text-center text-sm text-subtle-foreground">نتیجه‌ای برای نمایش نیست.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {results.map((result) => (
              <li key={result.url} className="rounded-xl border border-border p-2.5">
                <p className="text-sm font-bold text-primary">{result.title}</p>
                <p dir="ltr" className="text-[0.6875rem] text-success">
                  {result.url}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{result.snippet}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint ? <p className="border-t border-border bg-card-muted px-3 py-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PowerPoint
// ─────────────────────────────────────────────────────────────

function SlidesDemo({ slides, hint }: { slides: { title: string; body?: string }[]; hint?: string }) {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-card-muted px-3 py-2">
        <span className="text-xs font-bold">ارائه</span>
        <span className="ms-auto text-[0.6875rem] text-muted-foreground">
          اسلاید {toPersianDigits(current + 1)} از {toPersianDigits(slides.length)}
        </span>
      </div>

      <div className="p-3">
        <div className="flex aspect-video flex-col justify-center rounded-xl border border-border bg-card-muted p-6 text-center shadow-inner">
          <h4 className="text-base font-bold sm:text-lg">{slide?.title}</h4>
          {slide?.body ? <p className="mt-2 text-sm text-muted-foreground">{slide.body}</p> : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <Button size="sm" variant="outline" onClick={() => setCurrent((index) => Math.max(0, index - 1))} disabled={current === 0}>
          قبلی
        </Button>
        <ol className="flex flex-wrap items-center justify-center gap-1">
          {slides.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <button
                type="button"
                onClick={() => setCurrent(index)}
                aria-label={`اسلاید ${index + 1}`}
                aria-current={index === current ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === current ? "w-6 bg-primary" : "w-3 bg-border-strong hover:bg-muted-foreground",
                )}
              />
            </li>
          ))}
        </ol>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCurrent((index) => Math.min(slides.length - 1, index + 1))}
          disabled={current === slides.length - 1}
        >
          بعدی
        </Button>
      </div>
      {hint ? <p className="border-t border-border bg-card-muted px-3 py-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Glyphs
// ─────────────────────────────────────────────────────────────

function FolderGlyph({ size = 16 }: { size?: number }) {
  const Icon = getIcon("FolderTree");
  return <Icon size={size} className="text-amber-500" aria-hidden="true" />;
}
function FileGlyph({ size = 16 }: { size?: number }) {
  const Icon = getIcon("FileText");
  return <Icon size={size} aria-hidden="true" />;
}
function BackGlyph() {
  const Icon = getIcon("ArrowRight");
  return <Icon size={14} aria-hidden="true" />;
}
function SearchGlyph() {
  const Icon = getIcon("Search");
  return <Icon size={13} className="text-muted-foreground" aria-hidden="true" />;
}
function PlusGlyph() {
  const Icon = getIcon("Plus");
  return <Icon size={13} aria-hidden="true" />;
}
function CloseGlyph() {
  const Icon = getIcon("X");
  return <Icon size={11} aria-hidden="true" />;
}
