"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { exportContentAction, importContentAction } from "@/app/actions/admin";
import { getIcon } from "@/components/icon";
import { Button, Field, Switch, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";

/**
 * Import / export panel.
 *
 * Export produces the same structured JSON the seed uses, so course content can
 * be version-controlled, moved between installations or reviewed as text.
 * Import is additive and validates everything before writing.
 */
export function DataPanel() {
  const router = useRouter();
  const { toast } = useToast();
  const [exported, setExported] = useState<string>("");
  const [filename, setFilename] = useState("icdl-content.json");
  const [importText, setImportText] = useState("");
  const [replaceBlocks, setReplaceBlocks] = useState(true);
  const [pending, startTransition] = useTransition();
  const [importing, startImport] = useTransition();

  const DownloadIcon = getIcon("Download");
  const UploadIcon = getIcon("FileUp");
  const CopyIcon = getIcon("Copy");

  const runExport = () => {
    startTransition(async () => {
      const outcome = await exportContentAction();
      if (!outcome.ok) {
        toast({ title: "خروجی گرفته نشد", description: outcome.message, tone: "error" });
        return;
      }
      setExported(outcome.data.json);
      setFilename(outcome.data.filename);
      toast({ title: "خروجی آماده شد", tone: "success", durationMs: 2400 });
    });
  };

  const download = () => {
    const blob = new Blob([exported], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const runImport = () => {
    startImport(async () => {
      const outcome = await importContentAction(importText, replaceBlocks);
      if (!outcome.ok) {
        toast({ title: "ورود داده انجام نشد", description: outcome.message, tone: "error" });
        return;
      }
      toast({
        title: outcome.data.summary,
        description: outcome.message,
        tone: "success",
        durationMs: 6000,
      });
      setImportText("");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Export */}
      <section className="stack-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <DownloadIcon size={17} aria-hidden="true" />
          خروجی گرفتن از محتوا
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          همه ماژول‌ها، فصل‌ها، درس‌ها، بلوک‌ها، آزمون‌ها و پرسش‌ها به‌صورت یک فایل JSON ساختاریافته
          ذخیره می‌شوند. از این فایل می‌توانید پشتیبان بگیرید یا محتوا را به نصب دیگری منتقل کنید.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={runExport} disabled={pending}>
            {pending ? "در حال آماده‌سازی…" : "ساخت خروجی"}
          </Button>
          {exported ? (
            <>
              <Button variant="outline" onClick={download}>
                <DownloadIcon size={15} aria-hidden="true" />
                دانلود فایل
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(exported);
                    toast({ title: "در حافظه کپی شد", tone: "success", durationMs: 2000 });
                  } catch {
                    toast({ title: "کپی نشد", tone: "error" });
                  }
                }}
              >
                <CopyIcon size={15} aria-hidden="true" />
                کپی
              </Button>
            </>
          ) : null}
        </div>

        {exported ? (
          <div className="mt-4">
            <Field label="پیش‌نمایش خروجی" hint={`${(exported.length / 1024).toFixed(0)} کیلوبایت`}>
              <Textarea dir="ltr" readOnly value={exported.slice(0, 4000)} rows={10} className="font-mono text-[0.6875rem]" />
            </Field>
          </div>
        ) : null}
      </section>

      {/* Import */}
      <section className="stack-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <UploadIcon size={17} aria-hidden="true" />
          ورود محتوا از فایل
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          فایل JSON را در کادر زیر بچسبانید. محتوا بر اساس نامک (slug) به‌روزرسانی می‌شود، بنابراین
          محتوای موجود پاک نمی‌شود و موارد جدید اضافه می‌شوند. هر بلوکی که اعتبارسنجی را رد کند،
          نادیده گرفته و گزارش می‌شود.
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card-muted px-3.5 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium">جایگزینی بلوک‌های درس‌های موجود</span>
            <span className="mt-0.5 block text-xs text-subtle-foreground">
              اگر خاموش باشد، فقط درس‌های جدید بلوک می‌گیرند.
            </span>
          </span>
          <Switch
            id="replace-blocks"
            label="جایگزینی بلوک‌ها"
            checked={replaceBlocks}
            onCheckedChange={setReplaceBlocks}
          />
        </div>

        <div className="mt-4">
          <Field label="محتوای JSON" htmlFor="import-json">
            <Textarea
              id="import-json"
              dir="ltr"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={10}
              placeholder='{ "version": 1, "modules": [ … ] }'
              className="font-mono text-[0.6875rem]"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={runImport} disabled={importing || importText.trim().length < 10} variant="success">
            {importing ? "در حال ورود داده…" : "ورود داده"}
          </Button>
          <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-border px-4 text-sm transition-colors hover:bg-muted">
            انتخاب فایل…
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setImportText(await file.text());
                toast({ title: "فایل خوانده شد", description: file.name, tone: "info", durationMs: 2400 });
              }}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
