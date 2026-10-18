import { prisma } from "@/lib/db";
import { AppError, ERROR_MESSAGES } from "@/lib/errors";
import { normalizePersian } from "@/lib/persian";
import { issueCertificateIfEligible } from "@/services/certificate-service";
import { setLessonStatus } from "@/services/progress-service";
import { getSettings } from "@/services/settings-service";
import type {
  FillBlankPayload,
  MatchingPayload,
  MultipleChoicePayload,
  PracticalPayload,
  QuestionPayload,
  QuestionType,
  SubmittedAnswer,
  TrueFalsePayload,
} from "@/types";

/**
 * Quiz grading and attempt recording.
 *
 * Grading happens on the server only: the correct answers are never sent to the
 * browser before an attempt is submitted, so the client cannot simply read them
 * out of the payload.
 */

type QuestionRecord = {
  id: string;
  type: string;
  prompt: string;
  explanation: string | null;
  hint: string | null;
  points: number;
  data: unknown;
};

export type QuestionResult = {
  questionId: string;
  correct: boolean;
  earned: number;
  points: number;
  correctAnswer: string;
  explanation: string | null;
};

export type AttemptResult = {
  attemptId: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  durationSeconds: number | null;
  results: QuestionResult[];
};

function asPayload<T>(data: unknown): T | null {
  if (data && typeof data === "object") return data as T;
  return null;
}

/** Turns the stored payload into a human-readable expected answer (for review). */
function describeCorrectAnswer(question: QuestionRecord): string {
  switch (question.type as QuestionType) {
    case "MULTIPLE_CHOICE": {
      const payload = asPayload<MultipleChoicePayload>(question.data);
      return payload?.options.find((option) => option.id === payload.correctOptionId)?.text ?? "";
    }
    case "TRUE_FALSE": {
      const payload = asPayload<TrueFalsePayload>(question.data);
      return payload?.isTrue ? "درست" : "نادرست";
    }
    case "FILL_BLANK": {
      const payload = asPayload<FillBlankPayload>(question.data);
      return payload?.accepted[0] ?? "";
    }
    case "MATCHING": {
      const payload = asPayload<MatchingPayload>(question.data);
      if (!payload) return "";
      return payload.pairs
        .map(([leftId, rightId]) => {
          const left = payload.left.find((item) => item.id === leftId)?.text ?? leftId;
          const right = payload.right.find((item) => item.id === rightId)?.text ?? rightId;
          return `${left} → ${right}`;
        })
        .join("، ");
    }
    case "PRACTICAL": {
      const payload = asPayload<PracticalPayload>(question.data);
      return payload?.checklist.join("، ") ?? "";
    }
    default:
      return "";
  }
}

/**
 * Grades one answer.
 *
 * Matching and practical questions award partial credit so a learner who gets
 * most of a task right is not scored the same as one who got none of it.
 */
export function gradeQuestion(question: QuestionRecord, value: unknown): SubmittedAnswer {
  const points = question.points || 1;

  switch (question.type as QuestionType) {
    case "MULTIPLE_CHOICE": {
      const payload = asPayload<MultipleChoicePayload>(question.data);
      const correct = typeof value === "string" && value === payload?.correctOptionId;
      return { questionId: question.id, value, correct, earned: correct ? points : 0 };
    }

    case "TRUE_FALSE": {
      const payload = asPayload<TrueFalsePayload>(question.data);
      const correct = typeof value === "boolean" && value === payload?.isTrue;
      return { questionId: question.id, value, correct, earned: correct ? points : 0 };
    }

    case "FILL_BLANK": {
      const payload = asPayload<FillBlankPayload>(question.data);
      const answer = typeof value === "string" ? normalizePersian(value) : "";
      const accepted = payload?.accepted ?? [];
      const correct =
        answer.length > 0 &&
        accepted.some((candidate) =>
          payload?.caseSensitive
            ? candidate.trim() === String(value).trim()
            : normalizePersian(candidate) === answer,
        );
      return { questionId: question.id, value, correct, earned: correct ? points : 0 };
    }

    case "MATCHING": {
      const payload = asPayload<MatchingPayload>(question.data);
      const pairs = payload?.pairs ?? [];
      const submitted = (value && typeof value === "object" ? value : {}) as Record<string, string>;

      const matched = pairs.filter(([leftId, rightId]) => submitted[leftId] === rightId).length;
      const ratio = pairs.length === 0 ? 0 : matched / pairs.length;
      const earned = Math.round(points * ratio);

      return {
        questionId: question.id,
        value,
        correct: pairs.length > 0 && matched === pairs.length,
        earned: earned > points ? points : earned,
      };
    }

    case "PRACTICAL": {
      const payload = asPayload<PracticalPayload>(question.data);
      const checklist = payload?.checklist ?? [];
      const checked = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

      const done = checklist.filter((item) => checked.includes(item)).length;
      const ratio = checklist.length === 0 ? 0 : done / checklist.length;
      const earned = Math.round(points * ratio);

      return {
        questionId: question.id,
        value,
        correct: checklist.length > 0 && done === checklist.length,
        earned: earned > points ? points : earned,
      };
    }

    default:
      return { questionId: question.id, value, correct: false, earned: 0 };
  }
}

/** The quiz attached to a lesson, or null when the lesson has none. */
/**
 * Deterministic, seed-based reordering.
 *
 * Uses a hash of the seed rather than `Math.random()` so the order is stable
 * across re-renders and repeated requests within one attempt, and only changes
 * when the seed does (i.e. on a retake).
 */
function seededOrder(seed: string): (a: string, b: string) => number {
  const hash = (value: string) => {
    let h = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      h ^= value.charCodeAt(index);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  return (a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`);
}

/**
 * Varies a question's option order for a retake.
 *
 * Only multiple-choice questions are touched: their grading compares the
 * submitted value with `payload.correctOptionId`, so reordering the options
 * cannot change what the question tests or how it is scored. `MATCHING` and
 * `ORDER_STEPS` answers depend on position and are deliberately left alone.
 */
export function varyOptions(data: unknown, seed: string): unknown {
  if (!data || typeof data !== "object") return data;

  const payload = data as { options?: unknown };
  if (!Array.isArray(payload.options) || payload.options.length < 3) return data;

  const options = payload.options as { id?: unknown }[];
  if (!options.every((option) => option && typeof option === "object" && typeof option.id === "string")) {
    return data;
  }

  return {
    ...(data as Record<string, unknown>),
    options: [...options].sort((a, b) => seededOrder(seed)(String(a.id), String(b.id))),
  };
}

/**
 * The lesson's quiz.
 *
 * `seed` is optional so existing callers keep working. Pass the current
 * attempt's id: on a retake the seed changes, so multiple-choice options are
 * presented in a different order while testing exactly the same thing.
 */
export async function getQuizForLesson(lessonId: string, seed?: string) {
  const quiz = await prisma.quiz.findFirst({
    where: { lessonId, isPublished: true },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  if (!quiz || !seed) return quiz;

  return {
    ...quiz,
    questions: quiz.questions.map((question) =>
      question.type === "MULTIPLE_CHOICE"
        ? ({ ...question, data: varyOptions(question.data, `${seed}:${question.id}`) } as typeof question)
        : question,
    ),
  };
}

export async function getQuizById(quizId: string) {
  return prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: { order: "asc" } }, lesson: { select: { id: true, title: true, slug: true } } },
  });
}

export async function submitAttempt(input: {
  userId: string;
  quizId: string;
  answers: Record<string, unknown>;
  durationSeconds?: number | null;
}): Promise<AttemptResult> {
  const quiz = await getQuizById(input.quizId);
  if (!quiz) throw new AppError(ERROR_MESSAGES.notFound, { code: "NOT_FOUND" });

  const graded: SubmittedAnswer[] = quiz.questions.map((question) =>
    gradeQuestion(
      {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        explanation: question.explanation,
        hint: question.hint,
        points: question.points,
        data: question.data,
      },
      input.answers[question.id],
    ),
  );

  const maxScore = quiz.questions.reduce((total, question) => total + (question.points || 1), 0);
  const score = graded.reduce((total, answer) => total + answer.earned, 0);
  const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  const passed = percent >= quiz.passingScore;

  const attempt = await prisma.quizAttempt.create({
    data: {
      userId: input.userId,
      quizId: quiz.id,
      score,
      maxScore,
      correctCount: graded.filter((answer) => answer.correct).length,
      totalCount: quiz.questions.length,
      passed,
      durationSeconds: input.durationSeconds ?? null,
      answers: graded as unknown as object[],
      completedAt: new Date(),
    },
  });

  if (passed) {
    await setLessonStatus(input.userId, quiz.lessonId, "COMPLETED");
  } else {
    await setLessonStatus(input.userId, quiz.lessonId, "IN_PROGRESS");
  }

  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      type: passed ? "QUIZ_PASSED" : "QUIZ_FAILED",
      message: passed ? "آزمون با موفقیت گذرانده شد" : "آزمون تکمیل شد",
      metadata: { quizId: quiz.id, percent },
    },
  });

  // Passing the final outstanding quiz may complete the whole curriculum, so
  // eligibility is re-checked here and a certificate issued automatically.
  if (passed) {
    const course = await getSettings("course");
    await issueCertificateIfEligible(input.userId, course.title);
  }

  const results: QuestionResult[] = quiz.questions.map((question, index) => {
    const answer = graded[index]!;
    return {
      questionId: question.id,
      correct: answer.correct,
      earned: answer.earned,
      points: question.points || 1,
      correctAnswer: describeCorrectAnswer({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        explanation: question.explanation,
        hint: question.hint,
        points: question.points,
        data: question.data,
      }),
      explanation: question.explanation,
    };
  });

  return {
    attemptId: attempt.id,
    score,
    maxScore,
    percent,
    passed,
    correctCount: graded.filter((answer) => answer.correct).length,
    totalCount: quiz.questions.length,
    durationSeconds: attempt.durationSeconds,
    results,
  };
}

export async function getBestAttempt(userId: string, quizId: string) {
  return prisma.quizAttempt.findFirst({
    where: { userId, quizId },
    orderBy: [{ score: "desc" }, { completedAt: "desc" }],
  });
}

export async function getAttemptHistory(userId: string, quizId: string, limit = 5) {
  return prisma.quizAttempt.findMany({
    where: { userId, quizId },
    orderBy: { completedAt: "desc" },
    take: limit,
    select: {
      id: true,
      score: true,
      maxScore: true,
      passed: true,
      completedAt: true,
      correctCount: true,
      totalCount: true,
    },
  });
}

/** Quiz performance across the platform, for the admin dashboard. */
export async function getQuizOverview(limit = 6) {
  const quizzes = await prisma.quiz.findMany({
    select: {
      id: true,
      title: true,
      passingScore: true,
      lesson: { select: { title: true, slug: true } },
      attempts: { select: { passed: true, score: true, maxScore: true } },
    },
    take: 200,
  });

  return quizzes
    .map((quiz) => {
      const attempts = quiz.attempts;
      const passed = attempts.filter((attempt) => attempt.passed).length;
      const average =
        attempts.length === 0
          ? 0
          : Math.round(
              attempts.reduce(
                (total, attempt) =>
                  total + (attempt.maxScore === 0 ? 0 : (attempt.score / attempt.maxScore) * 100),
                0,
              ) / attempts.length,
            );

      return {
        id: quiz.id,
        title: quiz.title,
        lessonTitle: quiz.lesson.title,
        lessonSlug: quiz.lesson.slug,
        attempts: attempts.length,
        passRate: attempts.length === 0 ? 0 : Math.round((passed / attempts.length) * 100),
        averageScore: average,
      };
    })
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, limit);
}

export type { QuestionPayload };
