import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { forbiddenError, unauthorizedError } from "@/lib/errors";
import type { Role } from "@/types";

/**
 * Session management.
 *
 * Sessions are database-backed: the browser holds an opaque random token and
 * the database stores only its SHA-256 hash, so a database leak does not expose
 * usable session tokens. Cookies are httpOnly and sameSite=lax, and secure in
 * production.
 */

export const SESSION_COOKIE = "icdl_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionDurationMs(): number {
  return getEnv().SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function toSessionUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "ADMIN" ? "ADMIN" : "LEARNER",
    avatarUrl: user.avatarUrl,
  };
}

export type SessionMeta = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

/** Creates a session row and writes the signed cookie. Server-side only. */
export async function createSession(userId: string, meta: SessionMeta = {}): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationMs());

  await prisma.session.create({
    data: {
      token: hashToken(token),
      userId,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ipAddress: meta.ipAddress?.slice(0, 60) ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Detected from the site URL, not NODE_ENV: a `Secure` cookie over plain
    // HTTP is discarded by the browser and the user can never stay signed in.
    secure: getEnv().cookieSecure,
    path: "/",
    expires: expiresAt,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });
}

/** Deletes the current session row and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { token: hashToken(token) } })
      .catch(() => undefined);
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Invalidates every session of a user, e.g. after a password change. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Resolves the signed-in user for the current request.
 *
 * Wrapped in React's `cache` so a page that calls it in a layout, a page and
 * several components still performs a single database lookup per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, avatarUrl: true, isActive: true },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (!session.user.isActive) return null;

  // Refresh "last seen" at most every 15 minutes to avoid a write per request.
  const staleThreshold = Date.now() - 15 * 60 * 1000;
  if (session.user.id) {
    void prisma.user
      .updateMany({
        where: { id: session.user.id, lastActiveAt: { lt: new Date(staleThreshold) } },
        data: { lastActiveAt: new Date() },
      })
      .catch(() => undefined);
  }

  return toSessionUser(session.user);
});

export async function requireUser(redirectTo = "/login"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") throw forbiddenError();
  return user;
}

/** Throws instead of redirecting — for route handlers and server actions. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorizedError();
  return user;
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorizedError();
  if (user.role !== "ADMIN") throw forbiddenError();
  return user;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === "ADMIN";
}
