"use server";

import { revalidatePath } from "next/cache";

import { assertUser } from "@/lib/auth/session";
import { ERROR_MESSAGES, logError, toUserMessage } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { getCourseProgress, resetUserProgress } from "@/services/progress-service";
import { getSettings } from "@/services/settings-service";
import { getEligibility, issueCertificateIfEligible, getUserCertificate } from "@/services/certificate-service";

/**
 * Learner-facing account actions: certificates and progress reset.
 *
 * Both are scoped to the signed-in user — no identifier is accepted from the
 * client, so one learner can never act on another's record.
 */

export type LearnerOutcome<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string };

/** Attempts to issue the certificate, then reports the current state. */
export async function requestCertificateAction(): Promise<
  LearnerOutcome<{ issued: boolean; code: string | null }>
> {
  try {
    const user = await assertUser();
    const course = await getSettings("course");

    const certificate = await issueCertificateIfEligible(user.id, course.title);
    if (certificate) {
      revalidatePath("/certificate");
      return {
        ok: true,
        data: { issued: true, code: certificate.code },
        message: "گواهی شما صادر شد.",
      };
    }

    const existing = await getUserCertificate(user.id);
    if (existing) {
      return { ok: true, data: { issued: true, code: existing.code }, message: "گواهی شما قبلاً صادر شده است." };
    }

    const report = await getEligibility(user.id);
    return {
      ok: false,
      message:
        report.blockers.length > 0
          ? `هنوز شرایط دریافت گواهی کامل نیست: ${report.blockers.join(" ")}`
          : "هنوز شرایط دریافت گواهی کامل نیست.",
    };
  } catch (error) {
    logError("certificate:request", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

/**
 * Resets the learner's own progress.
 *
 * Lessons, quiz attempts, bookmarks and the streak are cleared; the account,
 * its settings and any already-earned certificate are kept.
 */
export async function resetMyProgressAction(): Promise<LearnerOutcome> {
  try {
    const user = await assertUser();

    await resetUserProgress(user.id);
    await prisma.bookmark.deleteMany({ where: { userId: user.id } });
    await prisma.searchHistory.deleteMany({ where: { userId: user.id } });

    revalidatePath("/progress");
    revalidatePath("/course");
    revalidatePath("/bookmarks");
    revalidatePath("/");

    return {
      ok: true,
      data: null,
      message: "پیشرفت شما بازنشانی شد. می‌توانید از ابتدا شروع کنید.",
    };
  } catch (error) {
    logError("progress:resetSelf", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

/** Compact progress summary used by the reset confirmation copy. */
export async function getMyProgressSummaryAction(): Promise<LearnerOutcome<{ percent: number }>> {
  try {
    const user = await assertUser();
    const progress = await getCourseProgress(user.id);
    return { ok: true, data: { percent: progress.percent } };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? ERROR_MESSAGES.generic : ERROR_MESSAGES.generic };
  }
}
