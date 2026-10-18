"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { ERROR_MESSAGES, logError } from "@/lib/errors";
import { toEnglishDigits } from "@/lib/persian";
import { checkRateLimit, clientKey, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Newsletter subscription.
 *
 * The footer form only asks for an address, so the action is deliberately
 * forgiving: re-subscribing is not an error (the row is reactivated), and the
 * response never reveals whether the address was already on the list.
 */

export type NewsletterOutcome = { ok: true; message: string } | { ok: false; message: string };

const emailSchema = z
  .string()
  .trim()
  .min(1, "ایمیل را وارد کنید.")
  .max(160)
  .email("ایمیل وارد شده معتبر نیست.");

export async function subscribeToNewsletterAction(formData: FormData): Promise<NewsletterOutcome> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? ERROR_MESSAGES.validation };
  }

  const limit = checkRateLimit({
    key: `newsletter:${clientKey(await headers())}`,
    ...RATE_LIMITS.newsletter,
  });
  if (!limit.allowed) {
    return { ok: false, message: "تعداد درخواست‌ها زیاد بوده است. کمی بعد دوباره تلاش کنید." };
  }

  const email = toEnglishDigits(parsed.data).toLowerCase();

  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email },
      update: { isActive: true },
    });

    return { ok: true, message: "ثبت شد! از این پس خبرها را برای شما می‌فرستیم." };
  } catch (error) {
    logError("newsletter:subscribe", error);
    return { ok: false, message: ERROR_MESSAGES.generic };
  }
}
