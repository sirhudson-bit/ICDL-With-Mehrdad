/**
 * Shared domain types.
 *
 * The database stores enumerated values as strings so the schema stays
 * portable between SQLite and PostgreSQL. These unions are the single source of
 * truth for what those strings may be, and every write path validates against
 * them.
 */

export const ROLES = ["ADMIN", "LEARNER"] as const;
export type Role = (typeof ROLES)[number];

export const PROGRESS_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCHING",
  "PRACTICAL",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * Kinds of favourite.
 *
 * MODULE covers favouriting a whole course rather than a single lesson. It was
 * missing from this list while the service and the UI already supported it, so
 * every attempt to favourite a course failed validation with a 422 and the
 * button appeared to do nothing.
 */
export const BOOKMARK_TYPES = ["MODULE", "LESSON", "TIP", "DEFINITION", "EXERCISE"] as const;
export type BookmarkType = (typeof BOOKMARK_TYPES)[number];

export const CHAT_ROLES = ["USER", "ASSISTANT", "SYSTEM"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export const ACTIVITY_TYPES = [
  "LOGIN",
  "REGISTER",
  "LESSON_VIEWED",
  "LESSON_COMPLETED",
  "QUIZ_PASSED",
  "QUIZ_FAILED",
  "CONTENT_PUBLISHED",
  "CONTENT_UPDATED",
  "SETTINGS_UPDATED",
  "USER_UPDATED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// ── Question payloads (stored in Question.data) ──────────────

export type MultipleChoicePayload = {
  options: { id: string; text: string }[];
  correctOptionId: string;
};

export type TrueFalsePayload = {
  isTrue: boolean;
};

export type FillBlankPayload = {
  accepted: string[];
  caseSensitive?: boolean;
};

export type MatchingPayload = {
  left: { id: string; text: string }[];
  right: { id: string; text: string }[];
  pairs: [string, string][];
};

export type PracticalPayload = {
  checklist: string[];
};

export type QuestionPayload =
  | MultipleChoicePayload
  | TrueFalsePayload
  | FillBlankPayload
  | MatchingPayload
  | PracticalPayload;

/** A learner's answer to one question, as stored on QuizAttempt.answers. */
export type SubmittedAnswer = {
  questionId: string;
  /** Shape depends on the question type; see the grader in services/quiz-service. */
  value: unknown;
  correct: boolean;
  earned: number;
};

export type AttemptAnswerMap = Record<string, SubmittedAnswer>;
