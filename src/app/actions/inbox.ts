"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin, getCurrentUser } from "@/lib/auth/session";
import { ERROR_MESSAGES, logError, toUserMessage } from "@/lib/errors";
import { checkRateLimit, clientKey, RATE_LIMITS } from "@/lib/rate-limit";
import { headers } from "next/headers";
import {
  createContactMessage,
  createCourseRequest,
  REQUEST_STATUSES,
  MESSAGE_STATUSES,
  updateContactMessageStatus,
  updateCourseRequest,
  type MessageStatus,
  type RequestStatus,
} from "@/services/inbox-service";

/**
 * Contact and course-request submissions.
 *
 * Both endpoints are public, so they are rate limited by client address and the
 * text is length-capped. Nothing here trusts the client for identity: the user
 * id, when present, always comes from the session.
 */

export type SubmitOutcome = { ok: true; message: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(issues: { path: (string | number | symbol)[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "_");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "نام خود را کامل بنویسید.").max(120),
  email: z.string().trim().email("ایمیل وارد‌شده معتبر نیست.").max(160),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal("")),
  subject: z.string().trim().min(3, "موضوع را بنویسید.").max(200),
  message: z.string().trim().min(10, "متن پیام را کامل‌تر بنویسید.").max(4000),
});

export async function submitContactAction(formData: FormData): Promise<SubmitOutcome> {
  const parsed = contactSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    message: String(formData.get("message") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "لطفاً موارد مشخص‌شده را اصلاح کنید.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const headerList = await headers();
  const limit = checkRateLimit({
    key: `contact:${clientKey(headerList)}`,
    ...RATE_LIMITS.register,
  });
  if (!limit.allowed) {
    return { ok: false, message: "تعداد پیام‌های ارسالی زیاد بوده است. کمی بعد دوباره تلاش کنید." };
  }

  try {
    const user = await getCurrentUser();

    await createContactMessage({
      ...parsed.data,
      phone: parsed.data.phone || null,
      userId: user?.id ?? null,
    });

    revalidatePath("/admin/inbox");

    return {
      ok: true,
      message: "پیام شما ثبت شد. در اولین فرصت پاسخ می‌دهیم.",
    };
  } catch (error) {
    logError("contact:submit", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

const requestSchema = z.object({
  title: z.string().trim().min(3, "عنوان دوره پیشنهادی را بنویسید.").max(200),
  description: z.string().trim().min(10, "کمی بیشتر درباره دوره توضیح بدهید.").max(2000),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  name: z.string().trim().min(2, "نام خود را کامل بنویسید.").max(120),
  email: z.string().trim().email("ایمیل وارد‌شده معتبر نیست.").max(160),
});

export async function submitCourseRequestAction(formData: FormData): Promise<SubmitOutcome> {
  const parsed = requestSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    priority: String(formData.get("priority") ?? "NORMAL"),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "لطفاً موارد مشخص‌شده را اصلاح کنید.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const headerList = await headers();
  const limit = checkRateLimit({
    key: `request:${clientKey(headerList)}`,
    ...RATE_LIMITS.register,
  });
  if (!limit.allowed) {
    return { ok: false, message: "تعداد درخواست‌های ارسالی زیاد بوده است. کمی بعد دوباره تلاش کنید." };
  }

  try {
    const user = await getCurrentUser();

    await createCourseRequest({
      ...parsed.data,
      category: parsed.data.category || null,
      userId: user?.id ?? null,
    });

    revalidatePath("/admin/inbox");

    return {
      ok: true,
      message: "درخواست شما ثبت شد. از پیشنهاد شما ممنونیم — در برنامه‌ریزی دوره‌های بعدی بررسی می‌شود.",
    };
  } catch (error) {
    logError("courseRequest:submit", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

// ── Admin side ───────────────────────────────────────────────

export async function updateMessageStatusAction(id: string, status: string): Promise<SubmitOutcome> {
  try {
    await assertAdmin();
    if (!(MESSAGE_STATUSES as readonly string[]).includes(status)) {
      return { ok: false, message: ERROR_MESSAGES.validation };
    }

    await updateContactMessageStatus(id, status as MessageStatus);
    revalidatePath("/admin/inbox");
    return { ok: true, message: `وضعیت پیام به «${status}» تغییر کرد.` };
  } catch (error) {
    logError("contact:updateStatus", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

export async function updateCourseRequestAction(id: string, status: string, adminNote?: string): Promise<SubmitOutcome> {
  try {
    await assertAdmin();
    if (!(REQUEST_STATUSES as readonly string[]).includes(status)) {
      return { ok: false, message: ERROR_MESSAGES.validation };
    }

    await updateCourseRequest(id, { status: status as RequestStatus, adminNote: adminNote ?? null });
    revalidatePath("/admin/inbox");
    return { ok: true, message: "درخواست به‌روزرسانی شد." };
  } catch (error) {
    logError("courseRequest:update", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

/**
 * Form-shaped wrappers.
 *
 * `AdminForm` calls its action with a single FormData argument, so these take
 * the record id via `.bind(null, id)` and read the rest from the form. They
 * exist as real exported actions rather than inline closures because every
 * export of a `"use server"` module must be an async function.
 */
export async function updateMessageStatusFormAction(id: string, formData: FormData): Promise<SubmitOutcome> {
  return updateMessageStatusAction(id, String(formData.get("status") ?? "READ"));
}

export async function updateCourseRequestFormAction(id: string, formData: FormData): Promise<SubmitOutcome> {
  return updateCourseRequestAction(
    id,
    String(formData.get("status") ?? "NEW"),
    String(formData.get("adminNote") ?? ""),
  );
}
