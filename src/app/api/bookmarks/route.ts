import { z } from "zod";

import { assertUser } from "@/lib/auth/session";
import { ERROR_MESSAGES, toUserMessage } from "@/lib/errors";
import { crossSiteResponse } from "@/lib/http/origin";
import { listBookmarks, removeBookmark, toggleBookmark } from "@/services/bookmark-service";
import { BOOKMARK_TYPES } from "@/types";

const createSchema = z
  .object({
    // A favourite targets either a lesson or a whole module.
    lessonId: z.string().trim().min(1).optional().nullable(),
    moduleId: z.string().trim().min(1).optional().nullable(),
    /** Optional: derived from the target when omitted. */
    type: z.enum(BOOKMARK_TYPES).optional(),
    blockId: z.string().trim().max(60).optional().nullable(),
    label: z.string().trim().min(1).max(300),
    excerpt: z.string().trim().max(500).optional().nullable(),
  })
  .refine((data) => Boolean(data.lessonId || data.moduleId), {
    message: "برای نشان‌دار کردن، یک درس یا یک دوره لازم است.",
    path: ["lessonId"],
  });

/** GET /api/bookmarks — the current user's favourites. */
export async function GET() {
  try {
    const user = await assertUser();
    const bookmarks = await listBookmarks(user.id);
    return Response.json({ ok: true, bookmarks });
  } catch (error) {
    return Response.json({ ok: false, message: toUserMessage(error) }, { status: 401 });
  }
}

/** POST /api/bookmarks — toggle a bookmark on or off. */
export async function POST(request: Request) {
  let user;
  try {
    user = await assertUser();
  } catch {
    return Response.json({ ok: false, message: ERROR_MESSAGES.unauthorized }, { status: 401 });
  }

  const crossSite = crossSiteResponse(request);
  if (crossSite) return crossSite;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, message: ERROR_MESSAGES.validation }, { status: 400 });
  }

  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    // Surface the actual reason rather than a generic "invalid data", which is
    // what made this endpoint hard to diagnose from the button alone.
    const first = parsed.error.issues[0];
    return Response.json(
      {
        ok: false,
        message: first?.message ?? ERROR_MESSAGES.validation,
        fieldErrors: first ? { [String(first.path[0] ?? "_")]: first.message } : undefined,
      },
      { status: 422 },
    );
  }

  try {
    // A module favourite is a MODULE bookmark; anything else keeps its own kind.
    const type = parsed.data.type ?? (parsed.data.moduleId ? "MODULE" : "LESSON");

    const result = await toggleBookmark({ userId: user.id, ...parsed.data, type });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    // A genuine server failure must not masquerade as "not signed in".
    return Response.json({ ok: false, message: toUserMessage(error) }, { status: 500 });
  }
}

/** DELETE /api/bookmarks?id=… — remove a bookmark. */
export async function DELETE(request: Request) {
  try {
    const user = await assertUser();

    const crossSite = crossSiteResponse(request);
    if (crossSite) return crossSite;

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return Response.json({ ok: false, message: ERROR_MESSAGES.validation }, { status: 422 });
    }

    await removeBookmark(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, message: toUserMessage(error) }, { status: 401 });
  }
}
