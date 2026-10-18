"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { toEnglishDigits } from "@/lib/persian";
import { checkRateLimit, clientKey, RATE_LIMITS } from "@/lib/rate-limit";
import { checkPersianName } from "@/lib/validation/name";

/**
 * Single-field validation for the registration form.
 *
 * Reuses the exact server-side rules the submit path uses (`checkPersianName`,
 * the same email shape and length limits) so the live message can never disagree
 * with what the final submit decides.
 *
 * The email check necessarily reveals whether an address is already registered;
 * that is the same information the submit path already returns, and it is rate
 * limited so the endpoint cannot be used to probe addresses in bulk.
 */

export type FieldCheck = { ok: boolean; message?: string };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type RegistrationField = "name" | "email" | "password" | "confirmPassword";

export async function validateRegistrationField(input: {
  field: RegistrationField;
  value: string;
  /** Current password value, needed to check the confirmation field. */
  password?: string;
}): Promise<FieldCheck> {
  const limit = checkRateLimit({
    key: `register-check:${clientKey(await headers())}`,
    ...RATE_LIMITS.registerCheck,
  });
  // Fail open: a throttled check must never block someone from typing.
  if (!limit.allowed) return { ok: true };

  switch (input.field) {
    case "name": {
      const message = checkPersianName(input.value);
      return message ? { ok: false, message } : { ok: true, message: "نام درست است." };
    }

    case "email": {
      const email = toEnglishDigits(input.value.trim()).toLowerCase();
      if (!email) return { ok: false, message: "ایمیل را وارد کنید." };
      if (email.length > 160 || !EMAIL_PATTERN.test(email)) {
        return { ok: false, message: "ایمیل وارد شده معتبر نیست." };
      }
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      return existing
        ? { ok: false, message: "این ایمیل قبلاً ثبت شده است." }
        : { ok: true, message: "این ایمیل آزاد است." };
    }

    case "password": {
      if (input.value.length < 8) return { ok: false, message: "رمز عبور باید حداقل ۸ کاراکتر باشد." };
      if (input.value.length > 200) return { ok: false, message: "رمز عبور بیش از حد طولانی است." };
      return { ok: true };
    }

    case "confirmPassword": {
      if (!input.value) return { ok: false, message: "تکرار رمز عبور را وارد کنید." };
      if (input.value !== (input.password ?? "")) {
        return { ok: false, message: "رمز عبور و تکرار آن یکسان نیستند." };
      }
      return { ok: true, message: "رمزها یکسان‌اند." };
    }
  }
}
