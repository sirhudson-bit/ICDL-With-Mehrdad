import { assertAdmin } from "@/lib/auth/session";
import { AppError, ERROR_MESSAGES, logError, toUserMessage } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http/origin";
import { RATE_LIMITS, checkRateLimit } from "@/lib/rate-limit";
import { MAX_ICON_BYTES, deleteIconSvg, prepareIconSvg, saveIconSvg } from "@/lib/svg-icon";

/**
 * Footer icon uploads — administrators only.
 *
 * The file is validated and sanitised in `lib/svg-icon.ts` before it is written,
 * and the response only ever contains the generated path.
 */

/** POST /api/admin/social-icons — store one SVG icon. */
export async function POST(request: Request) {
  try {
    const admin = await assertAdmin();
    assertSameOrigin(request);

    const limit = checkRateLimit({ key: `icon-upload:${admin.id}`, ...RATE_LIMITS.upload });
    if (!limit.allowed) {
      return Response.json({ ok: false, message: ERROR_MESSAGES.rateLimited }, { status: 429 });
    }

    // Reject an oversized body before it is buffered in memory.
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_ICON_BYTES + 16 * 1024) {
      return Response.json(
        { ok: false, message: "حجم فایل باید کمتر از ۶۴ کیلوبایت باشد." },
        { status: 413 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ ok: false, message: "فایلی انتخاب نشده است." }, { status: 422 });
    }

    if (file.size > MAX_ICON_BYTES) {
      return Response.json(
        { ok: false, message: "حجم فایل باید کمتر از ۶۴ کیلوبایت باشد." },
        { status: 413 },
      );
    }

    // Only SVG is accepted, decided by suffix and declared type; the content
    // itself is checked below, since neither of those can be trusted.
    if (!/\.svg$/i.test(file.name) || (file.type !== "" && file.type !== "image/svg+xml")) {
      return Response.json(
        { ok: false, message: "فقط فایل SVG پذیرفته می‌شود." },
        { status: 422 },
      );
    }

    const prepared = prepareIconSvg(await file.text());
    if (!prepared.ok) {
      return Response.json({ ok: false, message: prepared.reason }, { status: 422 });
    }

    const url = await saveIconSvg(prepared.svg);

    // Replacing an icon must not leave the previous file on disk.
    const previous = String(form.get("previous") ?? "");
    if (previous) await deleteIconSvg(previous);

    return Response.json({ ok: true, url });
  } catch (error) {
    if (!(error instanceof AppError)) logError("admin:iconUpload", error);

    return Response.json(
      { ok: false, message: toUserMessage(error) },
      { status: error instanceof AppError ? error.status : 500 },
    );
  }
}

/** DELETE /api/admin/social-icons?url=… — drop an icon that was uploaded. */
export async function DELETE(request: Request) {
  try {
    await assertAdmin();
    assertSameOrigin(request);

    const url = new URL(request.url).searchParams.get("url") ?? "";
    await deleteIconSvg(url);

    return Response.json({ ok: true });
  } catch (error) {
    if (!(error instanceof AppError)) logError("admin:iconDelete", error);

    return Response.json(
      { ok: false, message: toUserMessage(error) },
      { status: error instanceof AppError ? error.status : 500 },
    );
  }
}
