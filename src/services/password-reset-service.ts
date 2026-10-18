import { createHash, randomBytes } from "node:crypto";

import { hashPassword } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { logError } from "@/lib/errors";
import { sendPasswordResetEmail } from "@/services/mail-service";
import { getSettings } from "@/services/settings-service";

/**
 * Password reset.
 *
 * Design notes:
 * - The raw token only exists in the emailed URL; the database stores its
 *   SHA-256 hash, so a database leak cannot be replayed.
 * - Tokens are single-use and time-limited, and issuing a new one retires the
 *   previous link.
 * - Requesting a reset never reveals whether an address is registered.
 * - Redeeming one drops every active session for that account, the same way a
 *   password change does.
 * - The flow is role-agnostic: learners and administrators recover identically.
 */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

type ResetTarget = { id: string; email: string; name: string };

async function issueResetLink(user: ResetTarget): Promise<{ delivered: boolean }> {
  const [auth, site] = await Promise.all([getSettings("auth"), getSettings("site")]);

  const rawToken = randomBytes(32).toString("base64url");
  const ttlMs = auth.resetTokenMinutes * 60 * 1000;

  // One live link at a time: issuing a new one retires any earlier token.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: {
      token: hashToken(rawToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });

  const resetUrl = `${publicEnv.siteUrl.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;

  try {
    const result = await sendPasswordResetEmail({
      to: user.email,
      recipientName: user.name,
      siteName: site.name,
      resetUrl,
      expiresMinutes: auth.resetTokenMinutes,
    });
    return { delivered: result.ok && result.delivered };
  } catch (error) {
    // Delivery failure must not surface as an error to the requester.
    logError("password-reset:send", error);
    return { delivered: false };
  }
}

/**
 * Starts the flow for an email address.
 *
 * Returns nothing and reveals nothing: a caller cannot distinguish a registered
 * address from an unknown one, by design.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, email: true, name: true, isActive: true },
  });

  if (!user || !user.isActive) return;

  const { delivered } = await issueResetLink(user);

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      type: "PASSWORD_RESET_REQUESTED",
      message: "درخواست بازیابی رمز عبور ثبت شد",
      metadata: { delivered },
    },
  });
}

/** Lets the reset page show a friendly message before the visitor types anything. */
export async function inspectResetToken(
  rawToken: string,
): Promise<{ valid: boolean; name?: string }> {
  if (!rawToken) return { valid: false };

  const record = await prisma.passwordResetToken.findUnique({
    where: { token: hashToken(rawToken) },
    select: { expiresAt: true, usedAt: true, user: { select: { name: true, isActive: true } } },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now() || !record.user.isActive) {
    return { valid: false };
  }

  return { valid: true, name: record.user.name };
}

export type ResetPasswordResult = { ok: true } | { ok: false; reason: "invalid" };

export async function applyPasswordReset(input: {
  token: string;
  newPassword: string;
}): Promise<ResetPasswordResult> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: hashToken(input.token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { isActive: true } },
    },
  });

  if (
    !record ||
    record.usedAt ||
    record.expiresAt.getTime() <= Date.now() ||
    !record.user.isActive
  ) {
    return { ok: false, reason: "invalid" };
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Any sibling links are now pointless.
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } }),
  ]);

  // Recovering an account (possibly because it was compromised) drops every session.
  await destroyAllSessions(record.userId);

  await prisma.activityLog.create({
    data: {
      userId: record.userId,
      type: "PASSWORD_RESET",
      message: "رمز عبور از طریق پیوند بازیابی تغییر کرد",
    },
  });

  return { ok: true };
}

/**
 * Admin-initiated reset: emails a link to the account owner. Returns `null` when
 * there is no such active account, so the caller can report that clearly without
 * exposing whether the link itself was delivered.
 */
export async function sendResetLinkToUser(
  userId: string,
): Promise<{ delivered: boolean } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, isActive: true },
  });

  if (!user || !user.isActive) return null;

  const { delivered } = await issueResetLink(user);

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      type: "PASSWORD_RESET_REQUESTED",
      message: "پیوند بازیابی رمز عبور توسط مدیر ارسال شد",
      metadata: { delivered },
    },
  });

  return { delivered };
}
