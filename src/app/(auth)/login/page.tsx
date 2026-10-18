import Link from "next/link";
import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { Alert, Card, CardContent } from "@/components/ui/primitives";
import { getSettings } from "@/services/settings-service";

export const metadata: Metadata = {
  title: "ورود به حساب",
  description: "با ورود به حساب کاربری، پیشرفت درس‌های خود را ذخیره کنید و از چت‌بات کمک بگیرید.",
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const settings = await getSettings("auth");

  const nextParam = typeof searchParams.next === "string" ? searchParams.next : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Explains a redirect instead of leaving the visitor guessing why they landed here. */}
      {nextParam ? (
        <Alert tone="info" title="برای دیدن این بخش باید وارد شوید">
          محتوای درس‌ها، آزمون‌ها و گواهی فقط برای کاربران ثبت‌شده در دسترس است. فهرست دوره و سرفصل‌ها برای
          همه آزاد است. پس از ورود، به همان صفحه‌ای که می‌خواستید می‌روید.
        </Alert>
      ) : null}

      <Card>
        <CardContent className="p-6 pt-6 sm:p-7 sm:pt-7">
          <h1 className="text-lg font-bold sm:text-xl">ورود به حساب کاربری</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            برای ادامه یادگیری از همان‌جایی که رها کردید، وارد حساب خود شوید.
          </p>

          <div className="mt-6">
            <AuthForm mode="login" next={nextParam} allowRegistration={settings.allowRegistration} />
          </div>

          <p className="mt-5 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            می‌خواهید بدون حساب درس‌ها را ببینید؟{" "}
            <Link href="/course" className="font-medium text-primary hover:underline">
              فهرست دوره
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
