"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import { ERROR_MESSAGES, logError, toUserMessage } from "@/lib/errors";
import { toggleBookmark } from "@/services/bookmark-service";
import { setLessonStatus } from "@/services/progress-service";
import { submitAttempt } from "@/services/quiz-service";
import type { AttemptResult } from "@/services/quiz-service";
import { BOOKMARK_TYPES, PROGRESS_STATUSES } from "@/types";

/**
 * Lesson-related server actions.
 *
 * Progress and quiz writes go through server actions rather than route
 * handlers: they are triggered by user interaction, need the session cookie,
 * and benefit from automatic revalidation of the affected pages.
 */

export type ActionOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/** Records that a lesson was opened. Safe to call repeatedly. */
export async function markLessonViewedAction(lessonId: string): Promise<ActionOutcome<null>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: ERROR_MESSAGES.unauthorized };

    if (!lessonId) return { ok: false, message: ERROR_MESSAGES.validation };

    await setLessonStatus(user.id, lessonId, "IN_PROGRESS");
    return { ok: true, data: null };
  } catch (error) {
    logError("action:markLessonViewed", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

const PROGRESS_VALUES = PROGRESS_STATUSES;

/** Explicitly sets a lesson's status (completed / in progress / reset). */
export async function setLessonStatusAction(
  lessonId: string,
  status: string,
  revalidate?: string,
): Promise<ActionOutcome<null>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: ERROR_MESSAGES.unauthorized };

    if (!lessonId || !(PROGRESS_VALUES as readonly string[]).includes(status)) {
      return { ok: false, message: ERROR_MESSAGES.validation };
    }

    await setLessonStatus(user.id, lessonId, status as (typeof PROGRESS_VALUES)[number]);

    if (revalidate) revalidatePath(revalidate);
    revalidatePath("/progress");

    return { ok: true, data: null };
  } catch (error) {
    logError("action:setLessonStatus", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

/** Grades and stores a quiz attempt, then returns the full result for review. */
export async function submitQuizAction(input: {
  quizId: string;
  answers: Record<string, unknown>;
  durationSeconds?: number | null;
}): Promise<ActionOutcome<AttemptResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: ERROR_MESSAGES.unauthorized };

    if (!input.quizId || typeof input.answers !== "object" || input.answers === null) {
      return { ok: false, message: ERROR_MESSAGES.validation };
    }

    const result = await submitAttempt({
      userId: user.id,
      quizId: input.quizId,
      answers: input.answers,
      durationSeconds: input.durationSeconds ?? null,
    });

    revalidatePath("/progress");
    return { ok: true, data: result };
  } catch (error) {
    logError("action:submitQuiz", error);
    return { ok: false, message: toUserMessage(error) };
  }
}

/** Toggles a bookmark from a form or button without going through the API. */
export async function toggleBookmarkAction(input: {
  lessonId: string;
  type?: string;
  blockId?: string | null;
  label: string;
  excerpt?: string | null;
}): Promise<ActionOutcome<{ bookmarked: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: ERROR_MESSAGES.unauthorized };

    const type = (BOOKMARK_TYPES as readonly string[]).includes(input.type ?? "")
      ? (input.type as (typeof BOOKMARK_TYPES)[number])
      : "LESSON";

    const result = await toggleBookmark({
      userId: user.id,
      lessonId: input.lessonId,
      type,
      blockId: input.blockId ?? null,
      label: input.label,
      excerpt: input.excerpt ?? null,
    });

    revalidatePath("/bookmarks");
    return { ok: true, data: { bookmarked: result.bookmarked } };
  } catch (error) {
    logError("action:toggleBookmark", error);
    return { ok: false, message: toUserMessage(error) };
  }
}
