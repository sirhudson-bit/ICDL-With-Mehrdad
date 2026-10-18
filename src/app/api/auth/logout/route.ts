import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";
import { AppError, logError, toUserMessage } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http/origin";

/** POST /api/auth/logout — ends the session and returns to the homepage. */
export async function POST(request: Request) {
  try {
    // Another site can end a visitor's session with a plain form post, which the
    // session cookie's SameSite setting does not cover for top-level navigations.
    assertSameOrigin(request);

    await destroySession();
    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  } catch (error) {
    if (!(error instanceof AppError)) logError("auth:logout", error);

    return NextResponse.json(
      { ok: false, message: toUserMessage(error) },
      { status: error instanceof AppError ? error.status : 500 },
    );
  }
}
