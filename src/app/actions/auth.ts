"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppError, ERROR_MESSAGES, logError } from "@/lib/errors";
import { checkRateLimit, clientKey, RATE_LIMITS } from "@/lib/rate-limit";
import { persianNameSchema } from "@/lib/validation/name";
import { toEnglishDigits } from "@/lib/persian";
import { getSettings } from "@/services/settings-service";

export type AuthOutcome =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

const emailSchema = z
  .string()
  .trim()
  .min(1, "ایمیل را وارد کنید.")
  .max(160)
  .email("ایمیل وارد شده معتبر نیست.");

const passwordSchema = z
  .string()
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.")
  .max(200, "رمز عبور بیش از حد طولانی است.");

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "رمز عبور را وارد کنید.").max(200),
  next: z.string().max(300).optional(),
});

const registerSchema = z
  .object({
    // Persian letters only — see lib/validation/name.ts for the rules.
    name: persianNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیستند.",
    path: ["confirmPassword"],
  });

/** Only allow relative paths as redirect targets, to prevent open redirects. */
function safeRedirect(target: string | undefined, fallback: string): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  return target;
}

async function requestIdentity(prefix: string): Promise<string> {
  const headerList = await headers();
  return `${prefix}:${clientKey(headerList)}`;
}

export async function loginAction(formData: FormData): Promise<AuthOutcome> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    next: formData.get("next") ? String(formData.get("next")) : undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, message: "اطلاعات وارد‌شده کامل نیست.", fieldErrors };
  }

  const limit = checkRateLimit({ key: await requestIdentity("login"), ...RATE_LIMITS.login });
  if (!limit.allowed) {
    return {
      ok: false,
      message: `تعداد تلاش‌های ورود زیاد بوده است. ${limit.retryAfterSeconds} ثانیه دیگر دوباره تلاش کنید.`,
    };
  }

  // Normalise Persian digits so an Iranian keyboard does not block sign-in.
  const email = toEnglishDigits(parsed.data.email).toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, isActive: true },
    });

    // The same generic message is used for both cases so the form cannot be
    // used to discover which email addresses are registered.
    const invalidMessage = "ایمیل یا رمز عبور درست نیست.";
    if (!user) return { ok: false, message: invalidMessage };

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) return { ok: false, message: invalidMessage };

    if (!user.isActive) {
      return { ok: false, message: "حساب کاربری شما غیرفعال شده است. با پشتیبانی تماس بگیرید." };
    }

    const headerList = await headers();
    await createSession(user.id, {
      userAgent: headerList.get("user-agent"),
      ipAddress: clientKey(headerList, ""),
    });

    await prisma.activityLog.create({
      data: { userId: user.id, type: "LOGIN", message: "ورود به حساب کاربری" },
    });

    return { ok: true, redirectTo: safeRedirect(parsed.data.next, "/") };
  } catch (error) {
    logError("auth:login", error);
    return { ok: false, message: ERROR_MESSAGES.generic };
  }
}

export async function registerAction(formData: FormData): Promise<AuthOutcome> {
  const settings = await getSettings("auth");

  if (!settings.allowRegistration) {
    return { ok: false, message: "ثبت‌نام در حال حاضر غیرفعال است." };
  }

  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, message: "اطلاعات وارد‌شده کامل نیست.", fieldErrors };
  }

  const limit = checkRateLimit({ key: await requestIdentity("register"), ...RATE_LIMITS.register });
  if (!limit.allowed) {
    return { ok: false, message: "تعداد درخواست‌های ثبت‌نام زیاد بوده است. بعداً تلاش کنید." };
  }

  const email = toEnglishDigits(parsed.data.email).toLowerCase();
  const name = parsed.data.name.trim();

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return {
        ok: false,
        message: "این ایمیل قبلاً ثبت شده است.",
        fieldErrors: { email: "این ایمیل قبلاً ثبت شده است. وارد شوید یا ایمیل دیگری استفاده کنید." },
      };
    }

    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(parsed.data.password),
        // Never honour a client-supplied role: the setting is the only source.
        role: settings.defaultRole,
      },
      select: { id: true },
    });

    const headerList = await headers();
    await createSession(created.id, {
      userAgent: headerList.get("user-agent"),
      ipAddress: clientKey(headerList, ""),
    });

    await prisma.activityLog.create({
      data: { userId: created.id, type: "REGISTER", message: "حساب کاربری جدید ساخته شد" },
    });

    return { ok: true, redirectTo: "/course" };
  } catch (error) {
    logError("auth:register", error);

    // Two people registering the same address at once: the pre-check above
    // misses it, so the database constraint is the real guard and its violation
    // deserves the same friendly message rather than a generic failure.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return {
        ok: false,
        message: "این ایمیل قبلاً ثبت شده است.",
        fieldErrors: { email: "این ایمیل قبلاً ثبت شده است. وارد شوید یا ایمیل دیگری استفاده کنید." },
      };
    }

    return { ok: false, message: ERROR_MESSAGES.generic };
  }
}

export async function logoutAction(): Promise<{ ok: true }> {
  try {
    await destroySession();
  } catch (error) {
    logError("auth:logout", error);
  }
  return { ok: true };
}

/** Used by the account page to re-authenticate before sensitive changes. */
export async function assertCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError(ERROR_MESSAGES.unauthorized, { code: "UNAUTHORIZED" });
  return user;
}
