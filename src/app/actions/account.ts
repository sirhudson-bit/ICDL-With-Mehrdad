"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCurrentUser } from "@/app/actions/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { persianNameSchema } from "@/lib/validation/name";
import { destroyAllSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ERROR_MESSAGES, logError, toUserMessage } from "@/lib/errors";
import { RATE_LIMITS, checkRateLimit } from "@/lib/rate-limit";

export type AccountOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

const profileSchema = z.object({
  name: persianNameSchema,
  bio: z.string().trim().max(300).optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "رمز عبور فعلی را وارد کنید."),
    newPassword: z.string().min(8, "رمز عبور جدید باید حداقل ۸ کاراکتر باشد.").max(200),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "تکرار رمز عبور جدید درست نیست.",
    path: ["confirmPassword"],
  });

export async function updateProfileAction(formData: FormData): Promise<AccountOutcome> {
  try {
    const user = await assertCurrentUser();

    const parsed = profileSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      bio: String(formData.get("bio") ?? "") || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0] ?? "_")] ??= issue.message;
      }
      return { ok: false, message: "اطلاعات وارد‌شده معتبر نیست.", fieldErrors };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        bio: parsed.data.bio ?? null,
      },
    });

    revalidatePath("/settings");
    return { ok: true, message: "اطلاعات حساب شما ذخیره شد." };
  } catch (error) {
    logError("account:updateProfile", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

export async function changePasswordAction(formData: FormData): Promise<AccountOutcome> {
  try {
    const current = await assertCurrentUser();

    // The current password can be guessed from this form, so attempts are capped
    // per account rather than per client address.
    const limit = checkRateLimit({
      key: `password-change:${current.id}`,
      ...RATE_LIMITS.passwordChange,
    });
    if (!limit.allowed) {
      return { ok: false, message: ERROR_MESSAGES.rateLimited };
    }

    const parsed = passwordSchema.safeParse({
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0] ?? "_")] ??= issue.message;
      }
      return { ok: false, message: "اطلاعات وارد‌شده معتبر نیست.", fieldErrors };
    }

    const stored = await prisma.user.findUnique({
      where: { id: current.id },
      select: { passwordHash: true },
    });

    if (!stored || !(await verifyPassword(parsed.data.currentPassword, stored.passwordHash))) {
      return {
        ok: false,
        message: "رمز عبور فعلی درست نیست.",
        fieldErrors: { currentPassword: "رمز عبور فعلی درست نیست." },
      };
    }

    await prisma.user.update({
      where: { id: current.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    });

    // Changing a password invalidates every other session.
    await destroyAllSessions(current.id);

    return { ok: true, message: "رمز عبور تغییر کرد. لطفاً دوباره وارد شوید." };
  } catch (error) {
    logError("account:changePassword", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

export async function deleteAccountAction(): Promise<AccountOutcome> {
  try {
    const user = await assertCurrentUser();

    if (user.role === "ADMIN") {
      return { ok: false, message: "حساب مدیر را نمی‌توان از این طریق حذف کرد." };
    }

    await prisma.user.delete({ where: { id: user.id } });
    return { ok: true, message: "حساب کاربری شما حذف شد." };
  } catch (error) {
    logError("account:delete", error);
    return { ok: false, message: ERROR_MESSAGES.generic };
  }
}
