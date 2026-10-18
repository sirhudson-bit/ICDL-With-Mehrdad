/**
 * Outgoing email templates.
 *
 * Plain functions returning strings rather than a template engine: there are
 * only a handful of messages, and inlining the RTL markup keeps it reviewable
 * and dependency-free. Every interpolation is escaped because a learner's name
 * is user-supplied.
 */

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLayout(input: {
  siteName: string;
  heading: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
  outro: string;
  footerNote: string;
}): string {
  const site = escapeHtml(input.siteName);
  const button =
    input.ctaLabel && input.ctaUrl
      ? `<a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;margin:18px 0;padding:12px 26px;border-radius:12px;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(
          input.ctaLabel,
        )}</a>
      <p style="margin:6px 0 0;font-size:12px;color:#71717a;direction:ltr;text-align:left;word-break:break-all">${escapeHtml(
        input.ctaUrl,
      )}</p>`
      : "";

  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.heading)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Tahoma,'Segoe UI',Arial,sans-serif;color:#18181b">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:18px;overflow:hidden">
      <div style="padding:20px 26px;background:#4f46e5;color:#ffffff;font-size:16px;font-weight:700">${site}</div>
      <div style="padding:26px">
        <h1 style="margin:0 0 14px;font-size:18px;line-height:1.6">${escapeHtml(input.heading)}</h1>
        <p style="margin:0 0 10px;font-size:14px;line-height:2">${escapeHtml(input.intro)}</p>
        ${button}
        <p style="margin:14px 0 0;font-size:14px;line-height:2">${escapeHtml(input.outro)}</p>
      </div>
      <div style="padding:16px 26px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;line-height:1.9;color:#71717a">
        ${escapeHtml(input.footerNote)}
      </div>
    </div>
  </body>
</html>`;
}

/** The "choose a new password" link, used by both learners and administrators. */
export function passwordResetEmail(input: {
  siteName: string;
  recipientName: string;
  resetUrl: string;
  expiresMinutes: number;
}): RenderedEmail {
  const name = input.recipientName.trim() || "کاربر";
  const minutes = input.expiresMinutes;

  const text = [
    `${name} عزیز،`,
    "",
    "برای حساب شما درخواست تغییر رمز عبور ثبت شده است. برای تعیین رمز عبور جدید، پیوند زیر را باز کنید:",
    "",
    input.resetUrl,
    "",
    `این پیوند تا ${minutes} دقیقه دیگر معتبر است و فقط یک بار قابل استفاده است.`,
    "اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید؛ رمز عبور فعلی شما تغییر نمی‌کند.",
    "",
    input.siteName,
  ].join("\n");

  return {
    subject: `بازیابی رمز عبور — ${input.siteName}`,
    text,
    html: renderLayout({
      siteName: input.siteName,
      heading: "بازیابی رمز عبور",
      intro: `${name} عزیز، برای حساب شما درخواست تغییر رمز عبور ثبت شده است. با دکمه زیر رمز عبور جدید انتخاب کنید.`,
      ctaLabel: "تعیین رمز عبور جدید",
      ctaUrl: input.resetUrl,
      outro: `این پیوند تا ${minutes} دقیقه دیگر معتبر است و فقط یک بار قابل استفاده است. اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید؛ رمز عبور فعلی شما تغییر نمی‌کند.`,
      footerNote: `این پیام به‌صورت خودکار از طرف ${input.siteName} ارسال شده است.`,
    }),
  };
}
