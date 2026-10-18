"use client";

import * as React from "react";

import { getIcon } from "@/components/icon";
import { Button } from "@/components/ui/primitives";

/**
 * SVG icon upload for a footer social entry.
 *
 * The administrator supplies the icon as a file, so this control shows the one
 * currently stored, replaces it, and can remove it. Replacing or removing also
 * deletes the file it replaced, which the server does.
 *
 * Only an obvious mismatch is caught here; whether the file is acceptable is
 * decided by the server, which sanitises it.
 */
export function SvgIconUpload({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const PlaceholderIcon = getIcon("Image");

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("previous", value);

      const response = await fetch("/api/admin/social-icons", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as
        | { ok: boolean; url?: string; message?: string }
        | null;

      if (!response.ok || !data?.ok || !data.url) {
        setError(data?.message ?? "بارگذاری آیکون انجام نشد.");
        return;
      }

      onChange(data.url);
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!value || busy) return;

    setBusy(true);
    setError(null);

    try {
      await fetch(`/api/admin/social-icons?url=${encodeURIComponent(value)}`, { method: "DELETE" });
      onChange("");
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2">
        <span className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- administrator-uploaded SVG
            <img src={value} alt="" className="size-5" />
          ) : (
            <PlaceholderIcon size={16} aria-hidden="true" className="text-subtle-foreground" />
          )}
        </span>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".svg,image/svg+xml"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "در حال بارگذاری…" : value ? "تغییر فایل SVG" : "بارگذاری فایل SVG"}
        </Button>

        {value ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
            حذف
          </Button>
        ) : null}
      </span>

      <span className="text-[0.625rem] leading-relaxed text-subtle-foreground">
        فقط فایل SVG (حداکثر ۶۴ کیلوبایت). اسکریپت و استایل داخل فایل حذف می‌شود.
      </span>

      {error ? <span className="text-[0.6875rem] text-danger">{error}</span> : null}
    </div>
  );
}
