import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { ERROR_MESSAGES, toUserMessage } from "@/lib/errors";
import { crossSiteResponse } from "@/lib/http/origin";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sendChatMessage } from "@/services/chat-service";

const requestSchema = z.object({
  message: z.string().trim().min(1, "متن پرسش را بنویسید.").max(2000),
  lessonSlug: z.string().trim().max(160).optional().nullable(),
  sessionId: z.string().trim().max(60).optional().nullable(),
});

/** POST /api/chat — ask the lesson-aware assistant a question. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, message: ERROR_MESSAGES.unauthorized }, { status: 401 });
  }

  const crossSite = crossSiteResponse(request);
  if (crossSite) return crossSite;

  const limitCheck = checkRateLimit({ key: `chat:${user.id}`, ...RATE_LIMITS.chat });
  if (!limitCheck.allowed) {
    return Response.json(
      {
        ok: false,
        message: "تعداد پرسش‌های شما زیاد بوده است. چند دقیقه صبر کنید و دوباره تلاش کنید.",
      },
      { status: 429, headers: { "Retry-After": String(limitCheck.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, message: ERROR_MESSAGES.validation }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? ERROR_MESSAGES.validation },
      { status: 422 },
    );
  }

  try {
    const reply = await sendChatMessage({
      userId: user.id,
      message: parsed.data.message,
      lessonSlug: parsed.data.lessonSlug ?? null,
      sessionId: parsed.data.sessionId ?? null,
    });

    return Response.json({ ok: true, reply });
  } catch (error) {
    return Response.json({ ok: false, message: toUserMessage(error) }, { status: 500 });
  }
}
