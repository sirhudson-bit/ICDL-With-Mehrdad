import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card, CardContent } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "بازیابی رمز عبور",
  description: "با وارد کردن ایمیل حساب، پیوند تغییر رمز عبور برای شما ارسال می‌شود.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardContent className="p-6 pt-6 sm:p-7 sm:pt-7">
        <h1 className="text-lg font-bold sm:text-xl">بازیابی رمز عبور</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          ایمیل حساب خود را وارد کنید. اگر این ایمیل در سایت ثبت شده باشد، پیوندی برای تعیین رمز عبور جدید
          ارسال می‌شود.
        </p>

        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
      </CardContent>
    </Card>
  );
}
