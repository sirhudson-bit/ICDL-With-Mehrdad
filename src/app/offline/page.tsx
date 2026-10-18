import Link from "next/link";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { ButtonLink } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "حالت آفلاین",
  description: "اتصال اینترنت قطع است. صفحه‌های بازدیدشده در دسترس می‌مانند.",
  robots: { index: false, follow: false },
};

/**
 * Offline fallback.
 *
 * Precached by the service worker and served when a navigation fails, so the
 * learner gets a useful page instead of the browser's error screen. It reads
 * nothing from the database beyond the site settings, and the settings service
 * falls back to defaults when the database is unreachable.
 */
export default function OfflinePage() {
  const WifiIcon = getIcon("Wifi");
  const BookIcon = getIcon("BookOpen");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-3xl bg-warning-soft text-warning">
        <WifiIcon size={30} aria-hidden="true" />
      </span>

      <h1 className="text-xl font-bold">فعلاً اتصال اینترنت ندارید</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        نگران نباشید؛ پیشرفت شما ذخیره شده است. صفحه‌هایی که قبلاً باز کرده‌اید در همین حالت هم قابل
        مشاهده‌اند. پس از وصل شدن اینترنت، همه‌چیز به‌روز می‌شود.
      </p>

      <div className="w-full rounded-2xl border border-border bg-card p-4 text-start">
        <p className="flex items-center gap-2 text-sm font-bold">
          <BookIcon size={17} aria-hidden="true" />
          در این حالت چه کاری می‌توانید بکنید؟
        </p>
        <ul className="mt-2.5 flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <li>• صفحه‌ای که قبلاً باز کرده‌اید را دوباره باز کنید.</li>
          <li>• اتصال Wi-Fi یا داده موبایل خود را بررسی کنید.</li>
          <li>• پس از وصل شدن، از «ادامه یادگیری» درس را ادامه دهید.</li>
        </ul>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/progress">ادامه یادگیری</ButtonLink>
        <ButtonLink href="/" variant="outline">
          صفحه اصلی
        </ButtonLink>
      </div>

      <p className="text-xs text-subtle-foreground">
        اگر اینترنت شما وصل است و همچنان این پیام را می‌بینید،{" "}
        <Link href="/" className="text-primary hover:underline">
          صفحه اصلی
        </Link>{" "}
        را دوباره بارگذاری کنید.
      </p>
    </div>
  );
}
