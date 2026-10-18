"use client";

import { useEffect } from "react";

import { getIcon } from "@/components/icon";
import { Button, ButtonLink } from "@/components/ui/primitives";

/**
 * Route-level error boundary.
 *
 * Shows a friendly Persian message and a retry action; the technical detail is
 * logged to the server console instead of the page.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const Icon = getIcon("TriangleAlert");

  useEffect(() => {
    console.error("[icdl] خطای مسیر:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-2xl flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-3xl bg-warning-soft text-warning">
        <Icon size={30} aria-hidden="true" />
      </span>
      <h1 className="text-xl font-bold">مشکلی در نمایش این صفحه پیش آمده است</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        نگران نباشید؛ اطلاعات و پیشرفت شما محفوظ است. می‌توانید دوباره تلاش کنید یا به صفحه
        اصلی برگردید.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>تلاش دوباره</Button>
        <ButtonLink href="/" variant="outline">
          صفحه اصلی
        </ButtonLink>
      </div>
      {error.digest ? (
        <p className="text-[0.6875rem] text-subtle-foreground">
          کد پیگیری خطا: <span dir="ltr">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
