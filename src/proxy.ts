import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Access control proxy (Next.js 16's replacement for middleware).
 *
 * Visitors can browse the curriculum freely — the course landing page, module
 * pages with their full syllabus, search, help and contact — but the lesson
 * bodies, quizzes and certificates are reserved for registered learners.
 *
 * This is an optimistic check on the presence of the session cookie, chosen
 * because a proxy runs before rendering and cannot query the database. It is
 * therefore a redirect convenience, not the security boundary: every protected
 * page and server action independently calls `requireUser()`/`assertUser()`,
 * which validates the session against the database.
 */

const SESSION_COOKIE = "icdl_session";

/** Areas that always require an account. */
const PROTECTED_PREFIXES = ["/progress", "/bookmarks", "/favorites", "/settings", "/profile", "/certificate"];

/** Certificate verification is deliberately public — anyone must be able to check one. */
const PUBLIC_PREFIXES = ["/certificate/verify"];

/** `/course/{module}/{lesson}` — the lesson body itself. */
const LESSON_PATH = /^\/course\/[^/]+\/[^/]+$/;

/** Printable exports contain the full lesson text, so they are gated too. */
const PRINT_PATHS = [/^\/course\/[^/]+\/print$/, /^\/course\/[^/]+\/[^/]+\/print$/];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  const needsAccount =
    LESSON_PATH.test(pathname) ||
    PRINT_PATHS.some((pattern) => pattern.test(pathname)) ||
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  if (!needsAccount) return NextResponse.next();

  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname)}`;

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/course/:path*",
    "/progress/:path*",
    "/bookmarks/:path*",
    "/favorites/:path*",
    "/settings/:path*",
    "/certificate/:path*",
  ],
};
