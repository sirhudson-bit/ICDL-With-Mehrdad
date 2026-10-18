"use client";

import { useState, useTransition } from "react";

import { resetPasswordAction } from "@/app/actions/password-reset";
import { PasswordStrengthInput } from "@/components/auth/password-strength-input";
import { getIcon } from "@/components/icon";
import { Alert, Button, ButtonLink, Field, Input } from "@/components/ui/primitives";

/**
 * "Choose a new password" form.
 *
 * Renders an invalid-link notice instead of the form when the token has already
 * been used or has expired, so the visitor is not left guessing after submit.
 */
export function ResetPasswordForm({
  token,
  valid,
}: {
  token: string;
  valid: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = (formData: FormData) => {
    setErrors({});
    setMessage(null);

    startTransition(async () => {
      const outcome = await resetPasswordAction(formData);

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setMessage(outcome.message);
        return;
      }

      setDone(true);
      setMessage(outcome.message);
    });
  };

  const LockIcon = getIcon("Lock");

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title="رمز عبور تغییر کرد">
          {message}
        </Alert>
        <ButtonLink href="/login" block size="lg">
          ورود با رمز جدید
        </ButtonLink>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger" title="پیوند بازیابی معتبر نیست">
          این پیوند منقضی شده یا قبلاً استفاده شده است. برای دریافت پیوند تازه، دوباره درخواست بازیابی رمز
          عبور بدهید.
        </Alert>
        <ButtonLink href="/forgot-password" block size="lg">
          درخواست پیوند جدید
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

      <input type="hidden" name="token" value={token} />

      <Field label="رمز عبور جدید" htmlFor="password" required error={errors.password}>
        <PasswordStrengthInput name="password" id="password" required minLength={8} />
      </Field>

      <Field label="تکرار رمز عبور جدید" htmlFor="confirmPassword" required error={errors.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "در حال ذخیره…" : "ذخیره رمز عبور جدید"}
        <LockIcon size={17} aria-hidden="true" />
      </Button>
    </form>
  );
}
