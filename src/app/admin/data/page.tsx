import type { Metadata } from "next";

import { DataPanel } from "@/components/admin/data-panel";
import { getIcon } from "@/components/icon";
import { Card, CardContent } from "@/components/ui/primitives";
import { getCourseStats } from "@/services/course-service";
import { toPersianDigits } from "@/lib/persian";

export const metadata: Metadata = {
  title: "ورود و خروج داده",
  robots: { index: false, follow: false },
};

/** Content portability: structured JSON in and out. */
export default async function AdminDataPage() {
  const stats = await getCourseStats();
  const DataIcon = getIcon("FileUp");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <DataIcon size={20} aria-hidden="true" />
          ورود و خروج داده
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          محتوای دوره را به‌صورت فایل ساختاریافته ذخیره یا بازیابی کنید — بدون دست‌زدن به پایگاه داده.
        </p>
      </header>

      <Card>
        <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span>{toPersianDigits(stats.modules)} ماژول</span>
            <span>{toPersianDigits(stats.lessons)} درس</span>
            <span>{toPersianDigits(stats.blocks)} بلوک محتوا</span>
            <span>{toPersianDigits(stats.questions)} پرسش آزمون</span>
          </div>
        </CardContent>
      </Card>

      <DataPanel />

      <Card>
        <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
          <h2 className="text-sm font-bold">نکته‌های مهم</h2>
          <ul className="mt-2.5 flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <li>• پیش از هر تغییر بزرگ، یک خروجی بگیرید و آن را در جای امنی نگه دارید.</li>
            <li>• فایل خروجی برای ورود داده در نصب دیگر، یا بازگرداندن محتوا پس از تغییرات ناخواسته مناسب است.</li>
            <li>• ورود داده هرگز کاربران و پیشرفت آن‌ها را تغییر نمی‌دهد؛ فقط محتوای دوره را به‌روزرسانی می‌کند.</li>
            <li>• پس از ورود داده، فهرست جستجو و شمار درس‌ها به‌صورت خودکار بازسازی می‌شود.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
