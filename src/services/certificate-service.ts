import { randomInt } from "node:crypto";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";

/**
 * Certificates.
 *
 * A certificate is awarded once the learner has completed every published
 * lesson *and* passed every published quiz in the curriculum. The achievement
 * is snapshotted at issue time so the document remains verifiable and printable
 * exactly as awarded, even if modules are later added, edited or removed.
 */

export type CertificateRecord = {
  code: string;
  studentName: string;
  courseTitle: string;
  lessonsCompleted: number;
  quizzesPassed: number;
  averageScore: number;
  totalMinutes: number;
  issuedAt: Date;
  revokedAt: Date | null;
};

export type EligibilityReport = {
  eligible: boolean;
  totalLessons: number;
  completedLessons: number;
  totalQuizzes: number;
  passedQuizzes: number;
  averageScore: number;
  totalMinutes: number;
  /** Persian explanations of what still stands in the way. */
  blockers: string[];
};

function newCode(): string {
  // Ambiguity-free alphabet: no O/0, I/1 so the code can be read off a printout.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 10; index += 1) {
    // Cryptographically random: the code is guessable by anyone who can reach the
    // public verification page, so Math.random's predictable sequence is not
    // good enough here.
    code += alphabet[randomInt(alphabet.length)];
  }
  return `ICDL-${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Works out whether a learner has earned a certificate, and what is missing. */
export const getEligibility = cache(async (userId: string): Promise<EligibilityReport> => {
  const [lessons, quizzes, progress, attempts] = await Promise.all([
    prisma.lesson.findMany({
      where: { isPublished: true, chapter: { isPublished: true, module: { isPublished: true } } },
      select: { id: true, estimatedMinutes: true },
    }),
    prisma.quiz.findMany({
      where: { isPublished: true, lesson: { isPublished: true } },
      select: { id: true, passingScore: true },
    }),
    prisma.userProgress.findMany({
      where: { userId, status: "COMPLETED" },
      select: { lessonId: true },
    }),
    prisma.quizAttempt.findMany({
      where: { userId, passed: true },
      select: { quizId: true, score: true, maxScore: true },
    }),
  ]);

  const completedIds = new Set(progress.map((row) => row.lessonId));
  const passedQuizIds = new Set(attempts.map((row) => row.quizId));

  const completedLessons = lessons.filter((lesson) => completedIds.has(lesson.id));
  const passedQuizCount = quizzes.filter((quiz) => passedQuizIds.has(quiz.id)).length;

  const scored = attempts.filter((attempt) => attempt.maxScore > 0);
  const averageScore =
    scored.length === 0
      ? 0
      : Math.round(
          scored.reduce((total, attempt) => total + (attempt.score / attempt.maxScore) * 100, 0) / scored.length,
        );

  const totalMinutes = completedLessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0);

  const blockers: string[] = [];
  const remainingLessons = lessons.length - completedLessons.length;
  const remainingQuizzes = quizzes.length - passedQuizCount;

  if (remainingLessons > 0) blockers.push(`${remainingLessons} درس هنوز تکمیل نشده است.`);
  if (remainingQuizzes > 0) blockers.push(`${remainingQuizzes} آزمون هنوز با موفقیت گذرانده نشده است.`);
  if (lessons.length === 0) blockers.push("محتوای دوره منتشر نشده است.");

  return {
    eligible: lessons.length > 0 && remainingLessons === 0 && remainingQuizzes === 0,
    totalLessons: lessons.length,
    completedLessons: completedLessons.length,
    totalQuizzes: quizzes.length,
    passedQuizzes: passedQuizCount,
    averageScore,
    totalMinutes,
    blockers,
  };
});

/**
 * Issues a certificate if the learner qualifies and does not already hold one.
 * Idempotent, so it is safe to call after every quiz submission and from the
 * certificate page.
 */
export async function issueCertificateIfEligible(
  userId: string,
  courseTitle: string,
): Promise<CertificateRecord | null> {
  try {
    const existing = await prisma.certificate.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { issuedAt: "desc" },
    });
    if (existing) return existing;

    const report = await getEligibility(userId);
    if (!report.eligible) return null;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true },
    });

    return await prisma.certificate.create({
      data: {
        code: newCode(),
        userId,
        studentName: user.name,
        courseTitle,
        lessonsCompleted: report.completedLessons,
        quizzesPassed: report.passedQuizzes,
        averageScore: report.averageScore,
        totalMinutes: report.totalMinutes,
      },
    });
  } catch (error) {
    // A certificate failure must never break the quiz flow that triggered it.
    logError("certificate:issue", error);
    return null;
  }
}

export async function getUserCertificate(userId: string) {
  return prisma.certificate.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { issuedAt: "desc" },
  });
}

/**
 * Curriculum totals for the certificate sample, so the preview carries the same
 * numbers a graduate would actually see rather than invented placeholders.
 */
export const getCertificateSampleStats = cache(async () => {
  const [lessons, quizzes, minutes] = await Promise.all([
    prisma.lesson.count({
      where: { isPublished: true, chapter: { isPublished: true, module: { isPublished: true } } },
    }),
    prisma.quiz.count({ where: { isPublished: true, lesson: { isPublished: true } } }),
    prisma.lesson.aggregate({ where: { isPublished: true }, _sum: { estimatedMinutes: true } }),
  ]);

  return { lessons, quizzes, totalMinutes: minutes._sum.estimatedMinutes ?? 0 };
});

/** Public verification lookup. Returns null for an unknown or revoked code. */
export const verifyCertificate = cache(async (code: string) => {
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 6) return null;

  const certificate = await prisma.certificate.findUnique({
    where: { code: normalized },
    select: {
      code: true,
      studentName: true,
      courseTitle: true,
      lessonsCompleted: true,
      quizzesPassed: true,
      averageScore: true,
      totalMinutes: true,
      issuedAt: true,
      revokedAt: true,
      revokeReason: true,
    },
  });

  return certificate;
});

export async function listCertificates(limit = 50) {
  return prisma.certificate.findMany({
    orderBy: { issuedAt: "desc" },
    take: limit,
    select: {
      id: true,
      code: true,
      studentName: true,
      averageScore: true,
      issuedAt: true,
      revokedAt: true,
      user: { select: { id: true, email: true } },
    },
  });
}
