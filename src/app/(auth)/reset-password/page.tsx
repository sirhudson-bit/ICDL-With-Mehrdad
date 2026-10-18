import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent } from "@/components/ui/primitives";
import { inspectResetToken } from "@/services/password-reset-service";

export const metadata: Metadata = {
  title: "تعیین رمز عبور جدید",
  description: "با استفاده از پیوند ارسال‌شده، رمز عبور حساب خود را تغییر دهید.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  const state = await inspectResetToken(token);

  return (
    <Card>
      <CardContent className="p-6 pt-6 sm:p-7 sm:pt-7">
        <h1 className="text-lg font-bold sm:text-xl">تعیین رمز عبور جدید</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {state.valid
            ? "یک رمز عبور قوی انتخاب کنید. پس از تغییر، باید با رمز جدید وارد شوید."
            : "برای تعیین رمز عبور جدید، از پیوندی که به ایمیل شما ارسال شده استفاده کنید."}
        </p>

        <div className="mt-6">
          <ResetPasswordForm token={token} valid={state.valid} />
        </div>
      </CardContent>
    </Card>
  );
}
