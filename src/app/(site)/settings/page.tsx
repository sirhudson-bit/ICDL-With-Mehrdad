import Link from "next/link";
import type { Metadata } from "next";

import { changePasswordAction, deleteAccountAction, updateProfileAction } from "@/app/actions/account";
import { AdminForm as ActionForm, ConfirmActionButton } from "@/components/admin/action-form";
import { PasswordStrengthInput } from "@/components/auth/password-strength-input";
import { getIcon } from "@/components/icon";
import { Reveal } from "@/components/fx/reveal";
import { Badge, ButtonLink, Card, CardContent, Field, Input, SectionHeading, Textarea } from "@/components/ui/primitives";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { getCourseProgress } from "@/services/progress-service";

export const metadata: Metadata = {
  title: "تنظیمات حساب",
  description: "ویرایش اطلاعات حساب کاربری، تغییر رمز عبور و تنظیمات شخصی.",
  robots: { index: false, follow: false },
};

/** Account page: profile, password and personal preferences. */
export default async function SettingsPage() {
  const user = await requireUser("/login?next=/settings");

  const [account, progress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        bio: true,
        role: true,
        createdAt: true,
        _count: { select: { bookmarks: true, quizAttempts: true } },
      },
    }),
    getCourseProgress(user.id),
  ]);

  const UserIcon = getIcon("UserCog");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <UserIcon size={20} aria-hidden="true" />
          </span>
          تنظیمات حساب
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          اطلاعات حساب، رمز عبور و ترجیحات شخصی خود را از اینجا مدیریت کنید.
        </p>
      </header>

      <Reveal>
      {/* Summary */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-5 pt-5">
          <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-xl font-bold text-primary">
            {account?.name.charAt(0) ?? "؟"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
              {account?.name}
              <Badge tone={account?.role === "ADMIN" ? "primary" : "outline"} size="sm">
                {account?.role === "ADMIN" ? "مدیر" : "کاربر عادی"}
              </Badge>
            </p>
            <p dir="ltr" className="mt-0.5 text-start text-xs text-muted-foreground">
              {account?.email}
            </p>
            <p className="mt-1 text-[0.6875rem] text-subtle-foreground">
              عضو از {account ? formatPersianDate(account.createdAt) : "—"} •{" "}
              {toPersianDigits(account?._count.bookmarks ?? 0)} نشان •{" "}
              {toPersianDigits(account?._count.quizAttempts ?? 0)} آزمون • پیشرفت دوره{" "}
              {toPersianDigits(progress.percent)}٪
            </p>
          </div>
          <ButtonLink href="/progress" variant="outline" size="sm">
            دیدن پیشرفت
          </ButtonLink>
        </CardContent>
      </Card>

      {/* Profile */}
      <SectionHeading title="اطلاعات شخصی" description="نام شما در بخش‌های مختلف سایت نمایش داده می‌شود." />
      <Card className="mb-8">
        <CardContent className="p-5 pt-5">
          <ActionForm action={updateProfileAction} successMessage="اطلاعات ذخیره شد" submitLabel="ذخیره اطلاعات">
            <div className="flex flex-col gap-4">
              <Field label="نام و نام خانوادگی" required>
                <Input name="name" defaultValue={account?.name ?? ""} required />
              </Field>

              <Field label="درباره من (اختیاری)" hint="حداکثر ۳۰۰ کاراکتر.">
                <Textarea name="bio" defaultValue={account?.bio ?? ""} rows={3} />
              </Field>

              <Field label="ایمیل" hint="تغییر ایمیل فعلاً از این صفحه امکان‌پذیر نیست.">
                <Input value={account?.email ?? ""} readOnly disabled dir="ltr" />
              </Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      {/* Appearance */}
      <SectionHeading
        title="ظاهر و ترجیحات"
        description="حالت نمایش روشن یا تیره از دکمه بالای صفحه قابل تغییر است و در همین مرورگر ذخیره می‌شود."
      />
      <Card className="mb-8">
        <CardContent className="p-5 pt-5">
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>• حالت نمایش (روشن / تیره / هماهنگ با سیستم) با دکمه خورشید در نوار بالا تغییر می‌کند.</li>
            <li>• وضعیت تیک‌های تمرین‌ها و مراحل درس‌ها در همین مرورگر ذخیره می‌شود.</li>
            <li>• برای پاک کردن این موارد، از تنظیمات مرورگر داده‌های سایت را پاک کنید.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Password */}
      <SectionHeading
        title="تغییر رمز عبور"
        description="پس از تغییر رمز، همه نشست‌های دیگر شما بسته می‌شود."
      />
      <Card className="mb-8">
        <CardContent className="p-5 pt-5">
          <ActionForm action={changePasswordAction} successMessage="رمز عبور تغییر کرد" submitLabel="تغییر رمز عبور">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="رمز عبور فعلی" required>
                <Input name="currentPassword" type="password" required dir="ltr" autoComplete="current-password" />
              </Field>
              <Field label="رمز عبور جدید" required>
                <PasswordStrengthInput name="newPassword" required minLength={8} />
              </Field>
              <Field label="تکرار رمز جدید" required>
                <Input name="confirmPassword" type="password" required dir="ltr" autoComplete="new-password" />
              </Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      {/* Sessions & account */}
      <SectionHeading title="خروج و حذف حساب" />
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 pt-5">
          <div className="min-w-0">
            <p className="text-sm font-medium">خروج از حساب</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              پیشرفت شما ذخیره می‌ماند و با ورود دوباره ادامه می‌دهید.
            </p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              خروج از حساب
            </button>
          </form>
        </CardContent>

        {account?.role !== "ADMIN" ? (
          <CardContent className="border-t border-border p-5 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-danger">حذف حساب کاربری</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  با حذف حساب، پیشرفت، نشان‌ها و نتایج آزمون‌های شما برای همیشه پاک می‌شود.
                </p>
              </div>
              <ConfirmActionButton
                action={deleteAccountAction}
                label="حذف حساب من"
                icon="Trash2"
                variant="danger"
                size="md"
                confirmTitle="حساب کاربری شما حذف شود؟"
                confirmDescription="این کار قابل بازگشت نیست. همه پیشرفت و نتایج آزمون شما پاک می‌شود."
              />
            </div>
          </CardContent>
        ) : null}
      </Card>

      <p className="mt-6 text-center text-xs text-subtle-foreground">
        برای دیدن راهنما به صفحه{" "}
        <Link href="/help" className="text-primary hover:underline">
          پرسش‌های پرتکرار
        </Link>{" "}
        سر بزنید.
      </p>
      </Reveal>
    </div>
  );
}
