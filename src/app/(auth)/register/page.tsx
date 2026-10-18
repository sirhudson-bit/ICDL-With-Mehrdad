import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent } from "@/components/ui/primitives";
import { getSettings } from "@/services/settings-service";

export const metadata: Metadata = {
  title: "ساخت حساب کاربری",
  description: "با یک حساب کاربری رایگان، پیشرفت خود را ذخیره کنید و از چت‌بات آموزشی کمک بگیرید.",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const settings = await getSettings("auth");

  // Registration can be switched off from the admin panel.
  if (!settings.allowRegistration) redirect("/login");

  return (
    <Card>
      <CardContent className="p-6 pt-6 sm:p-7 sm:pt-7">
        <h1 className="text-lg font-bold sm:text-xl">ساخت حساب کاربری رایگان</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {settings.welcomeMessage}
        </p>

        <ul className="mt-4 flex flex-col gap-2 rounded-xl bg-card-muted p-3.5 text-xs leading-relaxed text-muted-foreground">
          <li>• پیشرفت شما ذخیره می‌شود و از همان‌جا ادامه می‌دهید</li>
          <li>• می‌توانید درس‌ها و نکته‌های مهم را نشان‌دار کنید</li>
          <li>• می‌توانید از چت‌بات داخل هر درس سؤال بپرسید</li>
        </ul>

        <div className="mt-6">
          <AuthForm mode="register" allowRegistration={settings.allowRegistration} />
        </div>

        <p className="mt-5 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          با ساخت حساب،{" "}
          <Link href="/help" className="text-primary hover:underline">
            قوانین استفاده
          </Link>{" "}
          را می‌پذیرید.
        </p>
      </CardContent>
    </Card>
  );
}
