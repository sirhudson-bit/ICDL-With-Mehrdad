import { AppError, ERROR_MESSAGES } from "@/lib/errors";

/**
 * Reject cross-site state-changing requests.
 *
 * Server actions already get this check from Next itself. Route handlers do not,
 * and the session cookie being `SameSite=Lax` only covers the browser's own
 * cross-site rules — it is not a substitute for the server verifying the request
 * came from this site. `Sec-Fetch-Site` is used when the browser sends it, with
 * `Origin`/`Host` as the fallback.
 */
export function assertSameOrigin(request: Request): void {
  const site = request.headers.get("sec-fetch-site");

  if (site) {
    if (site === "same-origin" || site === "none") return;
    throw new AppError(ERROR_MESSAGES.forbidden, { code: "FORBIDDEN" });
  }

  const origin = request.headers.get("origin");

  // A request without an Origin header cannot have been forged by a browser:
  // cross-site form posts and fetches both carry one.
  if (!origin) return;

  const host = request.headers.get("host");

  try {
    if (host && new URL(origin).host === host) return;
  } catch {
    // Malformed Origin — fall through to the rejection below.
  }

  throw new AppError(ERROR_MESSAGES.forbidden, { code: "FORBIDDEN" });
}

/**
 * Route-handler form of the check: returns the rejection to send, or `null` when
 * the request is same-origin and may proceed.
 */
export function crossSiteResponse(request: Request): Response | null {
  try {
    assertSameOrigin(request);
    return null;
  } catch {
    return Response.json({ ok: false, message: ERROR_MESSAGES.forbidden }, { status: 403 });
  }
}
