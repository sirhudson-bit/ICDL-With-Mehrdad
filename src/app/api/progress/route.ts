import { z } from "zod";

import { assertUser } from "@/lib/auth/session";
import { ERROR_MESSAGES, toUserMessage } from "@/lib/errors";
import { crossSiteResponse } from "@/lib/http/origin";
import { setLessonStatus } from "@/services/progress-service";
import { PROGRESS_STATUSES } from "@/types";

const schema = z.object({
  lessonId: z.string().trim().min(1),
  status: z.enum(PROGRESS_STATUSES),
});

/** POST /api/progress — mark a lesson as in progress, completed or reset. */
export async function POST(request: Request) {
  try {
    const user = await assertUser();

    const crossSite = crossSiteResponse(request);
    if (crossSite) return crossSite;

    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return Response.json({ ok: false, message: ERROR_MESSAGES.validation }, { status: 422 });
    }

    await setLessonStatus(user.id, parsed.data.lessonId, parsed.data.status);
    return Response.json({ ok: true });
  } catch (error) {
    const status = toUserMessage(error) === ERROR_MESSAGES.unauthorized ? 401 : 500;
    return Response.json({ ok: false, message: toUserMessage(error) }, { status });
  }
}
