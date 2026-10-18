import nodemailer from "nodemailer";

import { logError } from "@/lib/errors";
import { passwordResetEmail } from "@/lib/mail/templates";
import type { MailSettings } from "@/lib/settings";
import { getSettings } from "@/services/settings-service";

/**
 * Outgoing mail.
 *
 * There is a single delivery path — SMTP via nodemailer — and a deliberate
 * fallback: while mail is disabled or unconfigured the message is written to
 * the server log instead of being sent. That keeps password reset usable during
 * development and on a fresh install, where no SMTP credentials exist yet, and
 * the reset link stays retrievable from the server output.
 */

export type MailTransport = "smtp" | "log";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type MailSendResult =
  | { ok: true; transport: MailTransport; delivered: boolean }
  | { ok: false; transport: MailTransport; error: string };

function isConfigured(mail: MailSettings): boolean {
  return mail.enabled && mail.host.trim().length > 0 && mail.fromEmail.trim().length > 0;
}

/** True when a real message would be attempted; false means log-only. */
export async function isMailConfigured(): Promise<boolean> {
  return isConfigured(await getSettings("mail"));
}

function formatFrom(mail: MailSettings): string {
  const name = mail.fromName.trim();
  const address = mail.fromEmail.trim() || mail.username.trim();
  return name ? `"${name}" <${address}>` : address;
}

function writeToServerLog(message: MailMessage): void {
  // The body carries password-reset links, so it is only echoed outside
  // production: a live server must never write usable tokens into its logs.
  const body =
    process.env.NODE_ENV === "production"
      ? "(متن ایمیل در حالت تولید در لاگ ثبت نمی‌شود.)"
      : message.text;

  console.info(
    [
      "",
      "──────────── ایمیل ارسال‌نشده (SMTP تنظیم نشده) ────────────",
      `To:      ${message.to}`,
      `Subject: ${message.subject}`,
      "",
      body,
      "──────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

export async function sendMail(message: MailMessage): Promise<MailSendResult> {
  const mail = await getSettings("mail");

  if (!isConfigured(mail)) {
    writeToServerLog(message);
    return { ok: true, transport: "log", delivered: false };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: mail.host.trim(),
      port: mail.port,
      secure: mail.secure,
      auth: mail.username.trim() ? { user: mail.username.trim(), pass: mail.password } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    await transporter.sendMail({
      from: formatFrom(mail),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo?.trim() || mail.replyTo.trim() || undefined,
    });

    return { ok: true, transport: "smtp", delivered: true };
  } catch (error) {
    logError("mail:send", error);
    return {
      ok: false,
      transport: "smtp",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Renders and sends the password-reset message. Used by learners and admins alike. */
export async function sendPasswordResetEmail(input: {
  to: string;
  recipientName: string;
  siteName: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<MailSendResult> {
  const email = passwordResetEmail({
    siteName: input.siteName,
    recipientName: input.recipientName,
    resetUrl: input.resetUrl,
    expiresMinutes: input.expiresMinutes,
  });

  return sendMail({ to: input.to, subject: email.subject, text: email.text, html: email.html });
}
