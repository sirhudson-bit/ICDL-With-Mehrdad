/**
 * Error handling.
 *
 * Users of this platform are beginners, so raw technical errors must never
 * reach the interface. `AppError` carries a message that is safe to display;
 * anything else is logged server-side and replaced with a generic Persian
 * message.
 */

export const DEFAULT_ERROR_MESSAGE =
  "مشکلی در دریافت اطلاعات پیش آمده است. لطفاً دوباره تلاش کنید.";

export const ERROR_MESSAGES = {
  generic: DEFAULT_ERROR_MESSAGE,
  notFound: "موردی که دنبالش بودید پیدا نشد.",
  unauthorized: "برای دیدن این بخش باید وارد حساب خود شوید.",
  forbidden: "شما اجازه دسترسی به این بخش را ندارید.",
  validation: "اطلاعاتی که وارد کردید کامل یا درست نیست.",
  network: "ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.",
  rateLimited: "درخواست‌های شما زیاد بوده است. چند لحظه صبر کنید و دوباره تلاش کنید.",
  conflict: "این مورد از قبل وجود دارد.",
  aiUnavailable: "دستیار هوشمند در این لحظه در دسترس نیست. چند لحظه بعد دوباره تلاش کنید.",
  dbUnavailable: "ارتباط با پایگاه داده برقرار نشد. لطفاً بعداً تلاش کنید.",
} as const;

export type AppErrorCode =
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "INTERNAL";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    options: { code?: AppErrorCode; cause?: unknown; fieldErrors?: Record<string, string[]> } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code ?? "INTERNAL";
    this.status = STATUS_BY_CODE[this.code];
    this.fieldErrors = options.fieldErrors;
  }
}

export function notFoundError(message: string = ERROR_MESSAGES.notFound): AppError {
  return new AppError(message, { code: "NOT_FOUND" });
}

export function unauthorizedError(message: string = ERROR_MESSAGES.unauthorized): AppError {
  return new AppError(message, { code: "UNAUTHORIZED" });
}

export function forbiddenError(message: string = ERROR_MESSAGES.forbidden): AppError {
  return new AppError(message, { code: "FORBIDDEN" });
}

export function validationError(
  message: string = ERROR_MESSAGES.validation,
  fieldErrors?: Record<string, string[]>,
): AppError {
  return new AppError(message, { code: "VALIDATION", fieldErrors });
}

/** Extracts a display-safe Persian message from anything that was thrown. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return DEFAULT_ERROR_MESSAGE;
}

/** Logs the technical detail server-side, which is never shown to the user. */
export function logError(context: string, error: unknown): void {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[icdl] ${context} — ${detail}`, error instanceof Error ? error.stack : "");
}

/**
 * Wraps a server action so unexpected failures become friendly Persian
 * messages. Expected `AppError`s keep their own message.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, message, fieldErrors };
}

export async function runAction<T>(
  context: string,
  operation: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return actionOk(await operation());
  } catch (error) {
    if (!(error instanceof AppError)) {
      logError(context, error);
    }
    return actionFail(toUserMessage(error), error instanceof AppError ? error.fieldErrors : undefined);
  }
}

/** Flattens a Zod error into per-field Persian messages. */
export function zodFieldErrors(error: {
  issues: { path: (string | number | symbol)[]; message: string }[];
}): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}
