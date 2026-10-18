"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { requestPasswordResetAction } from "@/app/actions/password-reset";
import { getIcon } from "@/components/icon";
import { Alert, Button, ButtonLink, Field, Input } from "@/components/ui/primitives";

/**
 * "Forgot password" form.
 *
 * The success message is intentionally identical whether or not the address is
 * registered, so the form cannot be used to discover accounts.
 */
export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = (formData: FormData) => {
    setErrors({});
    setMessage(null);

    startTransition(async () => {
      const outcome = await requestPasswordResetAction(formData);

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setMessage(outcome.message);
        return;
      }

      setSent(true);
      setMessage(outcome.message);
    });
  };

  const MailIcon = getIcon("Mail");

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title="درخواست ثبت شد">
          {message}
        </Alert>
        <ButtonLink href="/login" block size="lg">
          بازگشت به صفحه ورود
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      {message ? (
        <p
          className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <Field label="ایمیل حساب" htmlFor="email" required error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "لطفاً صبر کنید…" : "ارسال پیوند بازیابی"}
        <MailIcon size={17} aria-hidden="true" />
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        رمز عبور خود را به یاد آوردید؟{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          بازگشت به ورود
        </Link>
      </p>
    </form>
  );
}
