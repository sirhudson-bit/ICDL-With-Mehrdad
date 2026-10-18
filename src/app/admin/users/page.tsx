import type { Metadata } from "next";

import { AdminForm, ConfirmActionButton } from "@/components/admin/action-form";
import { getIcon } from "@/components/icon";
import { Badge, Card, CardContent, Field, Input, Select, StatTile } from "@/components/ui/primitives";
import { deleteUserAction, resetUserProgressAction, sendUserPasswordResetAction, updateUserAction } from "@/app/actions/admin";
import { prisma } from "@/lib/db";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { normalizePersian } from "@/lib/persian";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "مدیریت کاربران",
  robots: { index: false, follow: false },
};

/** User management: search, roles, activation, progress reset. */
export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  const searchParams = await props.searchParams;
  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  const currentUser = await getCurrentUser();

  const users = await prisma.user.findMany({
    where:
      query.length > 0
        ? {
            OR: [
              { name: { contains: query } },
              { email: { contains: query.toLowerCase() } },
            ],
          }
        : undefined,
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastActiveAt: true,
      streakCount: true,
      _count: { select: { progress: true, quizAttempts: true, bookmarks: true } },
    },
  });

  const [total, admins, active, completing] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.userProgress.count({ where: { status: "COMPLETED" } }),
  ]);

  const UsersIcon = getIcon("Users");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <UsersIcon size={20} aria-hidden="true" />
          مدیریت کاربران
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          نقش، وضعیت فعال بودن و پیشرفت هر کاربر را از اینجا مدیریت کنید.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="کل کاربران" value={toPersianDigits(total)} icon="Users" />
        <StatTile label="کاربران فعال" value={toPersianDigits(active)} icon="CheckCircle2" />
        <StatTile label="مدیران" value={toPersianDigits(admins)} icon="Shield" />
        <StatTile label="درس‌های تکمیل‌شده" value={toPersianDigits(completing)} icon="Trophy" />
      </section>

      {/* Search */}
      <Card>
        <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
          <form className="flex flex-wrap items-end gap-3" action="/admin/users" method="get" role="search">
            <div className="min-w-56 flex-1">
              <Field label="جستجوی کاربر" hint="نام یا ایمیل را بنویسید.">
                <Input name="q" defaultValue={query} placeholder="مثلاً زهرا یا zahra@…" dir="rtl" />
              </Field>
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              جستجو
            </button>
          </form>
          {query ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {toPersianDigits(users.length)} نتیجه برای «{query}»
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Users */}
      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
              <div className="flex flex-wrap items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted font-bold">
                  {user.name.charAt(0)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{user.name}</span>
                    <Badge tone={user.role === "ADMIN" ? "primary" : "outline"} size="sm">
                      {user.role === "ADMIN" ? "مدیر" : "کاربر"}
                    </Badge>
                    <Badge tone={user.isActive ? "success" : "danger"} size="sm">
                      {user.isActive ? "فعال" : "غیرفعال"}
                    </Badge>
                    {user.id === currentUser?.id ? (
                      <Badge tone="info" size="sm">
                        حساب شما
                      </Badge>
                    ) : null}
                  </div>

                  <p dir="ltr" className="mt-0.5 text-start text-xs text-muted-foreground">
                    {user.email}
                  </p>

                  <p className="mt-1 text-[0.6875rem] text-subtle-foreground">
                    {toPersianDigits(user._count.progress)} درس لمس‌شده •{" "}
                    {toPersianDigits(user._count.quizAttempts)} آزمون •{" "}
                    {toPersianDigits(user._count.bookmarks)} نشان • آخرین فعالیت{" "}
                    {formatRelativeTime(user.lastActiveAt)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <ConfirmActionButton
                    action={sendUserPasswordResetAction.bind(null, user.id)}
                    label="ارسال پیوند بازیابی رمز"
                    icon="Mail"
                    variant="outline"
                    size="sm"
                    confirmTitle={`پیوند بازیابی رمز برای «${user.name}» ارسال شود؟`}
                    confirmDescription="یک پیوند یکبارمصرف برای تغییر رمز عبور به ایمیل این کاربر فرستاده می‌شود."
                  />
                  <ConfirmActionButton
                    action={resetUserProgressAction.bind(null, user.id)}
                    label="بازنشانی پیشرفت"
                    icon="RotateCcw"
                    variant="outline"
                    size="sm"
                    confirmTitle={`پیشرفت «${user.name}» بازنشانی شود؟`}
                    confirmDescription="همه رکوردهای پیشرفت و نتایج آزمون این کاربر حذف می‌شوند."
                  />
                  {user.id !== currentUser?.id ? (
                    <ConfirmActionButton
                      action={deleteUserAction.bind(null, user.id)}
                      label="حذف کاربر"
                      icon="Trash2"
                      variant="danger"
                      size="sm"
                      confirmTitle={`حساب «${user.name}» حذف شود؟`}
                      confirmDescription="این حساب و همه داده‌های مربوط به آن برای همیشه حذف می‌شود."
                    />
                  ) : null}
                </div>
              </div>

              <details className="group mt-3">
                <summary className="cursor-pointer list-none text-xs font-medium text-primary">
                  ویرایش این کاربر
                </summary>
                <div className="mt-3 rounded-xl border border-border bg-card-muted p-3">
                  <AdminForm action={updateUserAction} successMessage="اطلاعات کاربر ذخیره شد">
                    <input type="hidden" name="id" value={user.id} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="نام">
                        <Input name="name" defaultValue={user.name} />
                      </Field>
                      <Field label="نقش">
                        <Select name="role" defaultValue={user.role}>
                          <option value="LEARNER">کاربر عادی</option>
                          <option value="ADMIN">مدیر</option>
                        </Select>
                      </Field>
                      <Field label="وضعیت">
                        <Select name="isActive" defaultValue={user.isActive ? "true" : "false"}>
                          <option value="true">فعال</option>
                          <option value="false">غیرفعال</option>
                        </Select>
                      </Field>
                    </div>
                  </AdminForm>
                </div>
              </details>
            </CardContent>
          </Card>
        ))}

        {users.length === 0 ? (
          <Card>
            <CardContent className="p-8 pt-8 text-center">
              <p className="text-sm font-bold">کاربری پیدا نشد</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {query ? "عبارت جستجو را تغییر دهید." : "هنوز کاربری ثبت‌نام نکرده است."}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <p className="text-center text-xs text-subtle-foreground">
        جستجو با نرمال‌سازی فارسی انجام می‌شود؛ «ي» و «ی» یکسان در نظر گرفته می‌شوند.
        {query ? ` (عبارت نرمال‌شده: ${normalizePersian(query)})` : ""}
      </p>
    </div>
  );
}
