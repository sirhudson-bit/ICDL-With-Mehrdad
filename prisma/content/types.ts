import type { BlockDataOf, BlockType } from "../../src/lib/content/blocks";

/**
 * Authoring types for the seedable curriculum.
 *
 * These mirror the database models but are the shape a human writes, so the
 * curriculum can be reviewed and edited as plain data.
 */

export type SeedBlock = {
  [T in BlockType]: { type: T; data: BlockDataOf<T> };
}[BlockType];

export const QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCHING",
  "PRACTICAL",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export type MultipleChoiceQuestion = {
  type: "MULTIPLE_CHOICE";
  options: { id: string; text: string }[];
  correctOptionId: string;
};

export type TrueFalseQuestion = {
  type: "TRUE_FALSE";
  isTrue: boolean;
};

export type FillBlankQuestion = {
  type: "FILL_BLANK";
  accepted: string[];
  caseSensitive?: boolean;
};

export type MatchingQuestion = {
  type: "MATCHING";
  left: { id: string; text: string }[];
  right: { id: string; text: string }[];
  pairs: [string, string][];
};

/** A practical task the learner carries out off-screen and self-reports. */
export type PracticalQuestion = {
  type: "PRACTICAL";
  checklist: string[];
};

export type QuestionData =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | MatchingQuestion
  | PracticalQuestion;

export type SeedQuestion = {
  prompt: string;
  hint?: string;
  explanation?: string;
  points?: number;
} & QuestionData;

export type SeedQuiz = {
  title?: string;
  description?: string;
  passingScore?: number;
  timeLimitMinutes?: number;
  questions: SeedQuestion[];
};

export type SeedFaq = {
  question: string;
  answer: string;
  category?: string;
};

export type SeedLesson = {
  slug: string;
  title: string;
  summary: string;
  keywords?: string;
  estimatedMinutes?: number;
  difficulty?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  seoTitle?: string;
  seoDescription?: string;
  blocks: SeedBlock[];
  quiz?: SeedQuiz;
  faqs?: SeedFaq[];
};

export type SeedChapter = {
  slug: string;
  title: string;
  description?: string;
  lessons: SeedLesson[];
};

export type SeedModule = {
  slug: string;
  number: number;
  title: string;
  subtitle?: string;
  description: string;
  icon: string;
  color: string;
  /**
   * Curriculum strand, e.g. "office". Group metadata (title, icon, order) is
   * defined in src/lib/topics.ts — kept as a plain string here so the seed data
   * stays decoupled from UI modules.
   */
  group: string;
  chapters: SeedChapter[];
};

export type SeedCurriculum = SeedModule[];
