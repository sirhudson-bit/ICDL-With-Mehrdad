"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { ERROR_MESSAGES, logError } from "@/lib/errors";
import { toEnglishDigits } from "@/lib/persian";
import { checkRateLimit, clientKey, RATE_LIMITS } from "@/lib/rate-limit";
import { applyPasswordReset, requestPasswordReset } from "@/services/password-reset-service";

/**
 * Password-reset server actions.
 *
 * Mirrors the auth actions' contract: per-field messages in Persian, and a
 * deliberately generic response when starting the flow so the form cannot be
 * used to discover which email addresses are registered.
 */

export type PasswordResetOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

const requestSchema = z.object({
  email: z.string().trim().min(1, "ایمیل را وارد کنید.").max(160).email("ایمیل وارد شده معتبر نیست."),
});

const resetSchema = z
  .object({
    token: z.string().trim().min(10, "پیوند بازیابی معتبر نیست.").max(300),
    password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.").max(200),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیستند.",
    path: ["confirmPassword"],
  });

async function requestIdentity(prefix: string): Promise<string> {
  const headerList = await headers();
  return `${prefix}:${clientKey(headerList)}`;
}

function fieldErrorsFrom(issues: { path: (string | number | symbol)[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    fieldErrors[String(issue.path[0] ?? "_")] ??= issue.message;
  }
  return fieldErrors;
}

export async function requestPasswordResetAction(formData: FormData): Promise<PasswordResetOutcome> {
  const parsed = requestSchema.safeParse({ email: String(formData.get("email") ?? "") });

  if (!parsed.success) {
    return {
      ok: false,
      message: "ایمیل وارد‌شده معتبر نیست.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const limit = checkRateLimit({
    key: await requestIdentity("password-reset"),
    ...RATE_LIMITS.passwordReset,
  });
  if (!limit.allowed) {
    return {
      ok: false,
      message: `تعداد درخواست‌ها زیاد بوده است. ${limit.retryAfterSeconds} ثانیه دیگر دوباره تلاش کنید.`,
    };
  }

  try {
    await requestPasswordReset(toEnglishDigits(parsed.data.email));
  } catch (error) {
    logError("password-reset:request", error);
    return { ok: false, message: ERROR_MESSAGES.generic };
  }

  // Identical wording whether or not the address exists.
  return {
    ok: true,
    message:
      "اگر این ایمیل در سایت ثبت شده باشد، پیوند بازیابی رمز عبور برای شما ارسال شد. صندوق ورودی (و پوشه اسپم) را بررسی کنید.",
  };
}

export async function resetPasswordAction(formData: FormData): Promise<PasswordResetOutcome> {
  const parsed = resetSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "اطلاعات وارد‌شده کامل نیست.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const limit = checkRateLimit({
    key: await requestIdentity("password-reset-confirm"),
    ...RATE_LIMITS.passwordResetConfirm,
  });
  if (!limit.allowed) {
    return { ok: false, message: "تعداد تلاش‌ها زیاد بوده است. کمی بعد دوباره تلاش کنید." };
  }

  try {
    const result = await applyPasswordReset({
      token: parsed.data.token,
      newPassword: parsed.data.password,
    });

    if (!result.ok) {
      return {
        ok: false,
        message: "این پیوند معتبر نیست یا منقضی شده است. لطفاً دوباره درخواست بازیابی رمز عبور بدهید.",
      };
    }

    return { ok: true, message: "رمز عبور شما تغییر کرد. حالا می‌توانید با رمز جدید وارد شوید." };
  } catch (error) {
    logError("password-reset:apply", error);
    return { ok: false, message: ERROR_MESSAGES.generic };
  }
}
