"use client";

import { useMemo, useState, useTransition } from "react";

import { getIcon } from "@/components/icon";
import { setLessonStatusAction, submitQuizAction } from "@/app/actions/lesson";
import { useToast } from "@/components/ui/toaster";
import { Badge, Button, Progress } from "@/components/ui/primitives";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import type {
  FillBlankPayload,
  MatchingPayload,
  MultipleChoicePayload,
  PracticalPayload,
  QuestionType,
} from "@/types";

export type QuizQuestionView = {
  id: string;
  type: string;
  prompt: string;
  hint: string | null;
  points: number;
  data: unknown;
};

export type QuizView = {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitMinutes: number | null;
  questions: QuizQuestionView[];
};

export type AttemptSummary = {
  id: string;
  score: number;
  maxScore: number;
  passed: boolean;
  percent: number;
};

type ResultState = {
  percent: number;
  passed: boolean;
  score: number;
  maxScore: number;
  correctCount: number;
  totalCount: number;
  results: {
    questionId: string;
    correct: boolean;
    earned: number;
    points: number;
    correctAnswer: string;
    explanation: string | null;
  }[];
};

/**
 * Graded quiz.
 *
 * Correct answers are never sent to the browser before submission — grading
 * happens in a server action and the results come back with per-question
 * explanations, so the learner always finds out *why* an answer was wrong.
 */
export function QuizRunner({
  quiz,
  lessonId,
  bestAttempt,
  nextLesson,
}: {
  quiz: QuizView;
  lessonId: string;
  bestAttempt: AttemptSummary | null;
  /** Where to go once the quiz is passed; null on the final lesson. */
  nextLesson?: { slug: string; moduleSlug: string; title: string } | null;
}) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<ResultState | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();

  const answeredCount = useMemo(
    () => quiz.questions.filter((question) => isAnswered(question, answers[question.id])).length,
    [quiz.questions, answers],
  );

  const setAnswer = (questionId: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const submit = () => {
    startTransition(async () => {
      const outcome = await submitQuizAction({
        quizId: quiz.id,
        answers,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      });

      if (!outcome.ok) {
        toast({ title: "ثبت آزمون انجام نشد", description: outcome.message, tone: "error" });
        return;
      }

      setResult(outcome.data);
      toast({
        title: outcome.data.passed ? "آفرین! آزمون را گذراندید" : "آزمون ثبت شد",
        description: outcome.data.passed
          ? `امتیاز شما: ${toPersianDigits(outcome.data.percent)}٪`
          : "برای تقویت مطلب، درس را یک بار دیگر مرور کنید.",
        tone: outcome.data.passed ? "success" : "warning",
      });

      document.getElementById("quiz-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const retry = () => {
    setResult(null);
    setAnswers({});
  };

  const QuizIcon = getIcon("ClipboardCheck");

  if (quiz.questions.length === 0) return null;

  return (
    <section id="quiz" className="scroll-mt-24">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card-muted px-4 py-3.5 sm:px-5">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <QuizIcon size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="quiz-heading" className="text-sm font-bold sm:text-base">
              {quiz.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {toPersianDigits(quiz.questions.length)} پرسش • نمره قبولی{" "}
              {toPersianDigits(quiz.passingScore)}٪
              {quiz.timeLimitMinutes ? ` • زمان پیشنهادی ${toPersianDigits(quiz.timeLimitMinutes)} دقیقه` : ""}
            </p>
          </div>
          {bestAttempt ? (
            <Badge tone={bestAttempt.passed ? "success" : "warning"}>
              بهترین نتیجه: {toPersianDigits(bestAttempt.percent)}٪
            </Badge>
          ) : null}
        </header>

        {quiz.description ? (
          <p className="border-b border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground sm:px-5">
            {quiz.description}
          </p>
        ) : null}

        {result ? (
          <QuizResult
            result={result}
            quiz={quiz}
            lessonId={lessonId}
            onRetry={retry}
            nextLesson={nextLesson ?? null}
          />
        ) : (
          <>
            <div className="px-4 pt-4 sm:px-5">
              <Progress
                value={(answeredCount / quiz.questions.length) * 100}
                label={`${toPersianDigits(answeredCount)} از ${toPersianDigits(quiz.questions.length)} پرسش پاسخ داده شده`}
              />
            </div>

            <ol className="flex flex-col gap-5 px-4 py-5 sm:px-5">
              {quiz.questions.map((question, index) => (
                <li key={question.id} className="rounded-2xl border border-border p-4">
                  <div className="flex items-start gap-2.5">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                      {toPersianDigits(index + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-relaxed">{question.prompt}</p>
                      {question.hint ? (
                        <p className="mt-1 text-xs text-subtle-foreground">راهنما: {question.hint}</p>
                      ) : null}

                      <div className="mt-3">
                        <QuestionInput
                          question={question}
                          value={answers[question.id]}
                          onChange={(value) => setAnswer(question.id, value)}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <footer className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-4 sm:px-5">
              <Button onClick={submit} disabled={pending || answeredCount === 0} size="lg">
                {pending ? "در حال ثبت…" : "ثبت پاسخ‌ها و دیدن نتیجه"}
              </Button>
              <p className="text-xs text-muted-foreground">
                {answeredCount < quiz.questions.length
                  ? `${toPersianDigits(quiz.questions.length - answeredCount)} پرسش بی‌پاسخ مانده است.`
                  : "همه پرسش‌ها پاسخ داده شد."}
              </p>
            </footer>
          </>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Result view
// ─────────────────────────────────────────────────────────────

function QuizResult({
  result,
  quiz,
  lessonId,
  onRetry,
  nextLesson,
}: {
  result: ResultState;
  quiz: QuizView;
  lessonId: string;
  onRetry: () => void;
  nextLesson: { slug: string; moduleSlug: string; title: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const CheckIcon = getIcon("CheckCircle2");
  const WarnIcon = getIcon("TriangleAlert");

  const markComplete = () => {
    startTransition(async () => {
      const outcome = await setLessonStatusAction(lessonId, "COMPLETED", "/progress");
      if (!outcome.ok) toast({ title: "ثبت نشد", description: outcome.message, tone: "error" });
      else toast({ title: "درس به‌عنوان تکمیل‌شده ثبت شد", tone: "success" });
    });
  };

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-2xl border p-4",
          result.passed ? "border-success/30 bg-success-soft" : "border-warning/30 bg-warning-soft",
        )}
        role="status"
      >
        <span
          className={cn(
            "inline-flex size-12 items-center justify-center rounded-2xl",
            result.passed ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
          )}
        >
          {result.passed ? <CheckIcon size={24} aria-hidden="true" /> : <WarnIcon size={24} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">
            {result.passed ? "قبول شدید!" : "به نمره قبولی نرسیدید"}
          </p>
          <p className="mt-0.5 text-sm">
            نمره شما {toPersianDigits(result.percent)}٪ —{" "}
            {toPersianDigits(result.correctCount)} پاسخ درست از {toPersianDigits(result.totalCount)} پرسش
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            {result.passed
              ? "این درس برای شما به‌عنوان تکمیل‌شده ثبت شد."
              : "نگران نباشید؛ با مرور دوباره درس و تلاش مجدد، نتیجه بهتر می‌شود."}
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {quiz.questions.map((question, index) => {
          const detail = result.results.find((item) => item.questionId === question.id);
          if (!detail) return null;

          return (
            <li
              key={question.id}
              className={cn(
                "rounded-2xl border p-4",
                detail.correct ? "border-success/25 bg-success-soft/40" : "border-danger/20 bg-danger-soft/30",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    detail.correct ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
                  )}
                >
                  {detail.correct ? <CheckIcon size={14} aria-hidden="true" /> : toPersianDigits(index + 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-relaxed">{question.prompt}</p>
                  {!detail.correct ? (
                    <p className="mt-2 text-xs leading-relaxed">
                      <span className="font-bold text-success">پاسخ درست: </span>
                      {detail.correctAnswer}
                    </p>
                  ) : null}
                  {detail.explanation ? (
                    <p className="mt-2 rounded-xl bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                      {detail.explanation}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        {/*
          The next step, given the emphasis it deserves: after passing, moving on
          is the primary action, so it is a full-size blue button that pops in
          and nudges its arrow on hover. On the final lesson there is no next
          lesson, so it is omitted rather than pointing anywhere wrong.
        */}
        {result.passed && nextLesson ? (
          <a
            href={`/course/${nextLesson.moduleSlug}/${nextLesson.slug}`}
            className="group inline-flex h-12 animate-[var(--animate-pop)] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            <span
              className="text-base transition-transform duration-300 group-hover:-translate-x-1"
              aria-hidden="true"
            >
              ←
            </span>
            رفتن به درس بعدی
          </a>
        ) : null}
        <Button onClick={onRetry}>تلاش دوباره</Button>
        {result.passed ? (
          <Button variant="outline" onClick={markComplete} disabled={pending}>
            ثبت به‌عنوان تکمیل‌شده
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Question inputs
// ─────────────────────────────────────────────────────────────

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: QuizQuestionView;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const type = question.type as QuestionType;

  if (type === "MULTIPLE_CHOICE") {
    const payload = question.data as MultipleChoicePayload;
    const selected = typeof value === "string" ? value : "";

    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{question.prompt}</legend>
        {(payload.options ?? []).map((option) => (
          <label
            key={option.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
              selected === option.id ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40",
            )}
          >
            <input
              type="radio"
              name={question.id}
              value={option.id}
              checked={selected === option.id}
              onChange={() => onChange(option.id)}
              className="size-4 accent-[var(--primary)]"
            />
            {option.text}
          </label>
        ))}
      </fieldset>
    );
  }

  if (type === "TRUE_FALSE") {
    const selected = typeof value === "boolean" ? value : null;
    return (
      <div className="flex flex-wrap gap-2">
        {[true, false].map((option) => (
          <button
            key={String(option)}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={selected === option}
            className={cn(
              "inline-flex h-10 min-w-24 items-center justify-center rounded-xl border text-sm font-medium transition-colors",
              selected === option ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-muted",
            )}
          >
            {option ? "درست" : "نادرست"}
          </button>
        ))}
      </div>
    );
  }

  if (type === "FILL_BLANK") {
    const payload = question.data as FillBlankPayload;
    const parts = question.prompt.split("___");
    const current = typeof value === "string" ? value : "";

    if (parts.length > 1) {
      return (
        <div className="rounded-xl border border-border bg-card-muted p-3.5">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm leading-loose">
            {parts.map((part, index) => (
              <span key={index} className="flex flex-wrap items-center gap-x-1.5">
                <span>{part}</span>
                {index < parts.length - 1 ? (
                  <input
                    value={index === 0 ? current : ""}
                    onChange={(event) => onChange(event.target.value)}
                    aria-label={`جای خالی ${index + 1}`}
                    className="h-8 w-36 rounded-lg border border-input bg-card px-2 text-center text-sm outline-none focus-visible:border-primary"
                  />
                ) : null}
              </span>
            ))}
          </p>
        </div>
      );
    }

    return (
      <input
        value={current}
        onChange={(event) => onChange(event.target.value)}
        aria-label="پاسخ خود را بنویسید"
        placeholder={payload.accepted?.[0] ? "پاسخ را بنویسید…" : ""}
        className="h-11 w-full max-w-xs rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary"
      />
    );
  }

  if (type === "MATCHING") {
    const payload = question.data as MatchingPayload;
    const submitted = (value && typeof value === "object" ? value : {}) as Record<string, string>;

    return (
      <ul className="flex flex-col gap-2">
        {(payload.left ?? []).map((left) => (
          <li key={left.id} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border p-2.5">
            <span className="min-w-28 flex-1 text-sm">{left.text}</span>
            <select
              value={submitted[left.id] ?? ""}
              onChange={(event) => onChange({ ...submitted, [left.id]: event.target.value })}
              aria-label={`پاسخ برای ${left.text}`}
              className="h-10 flex-1 rounded-xl border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-primary"
            >
              <option value="">انتخاب کنید…</option>
              {(payload.right ?? []).map((right) => (
                <option key={right.id} value={right.id}>
                  {right.text}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    );
  }

  if (type === "PRACTICAL") {
    const payload = question.data as PracticalPayload;
    const checked = Array.isArray(value) ? (value as string[]) : [];

    return (
      <ul className="flex flex-col gap-2">
        {(payload.checklist ?? []).map((item) => {
          const isChecked = checked.includes(item);
          return (
            <li key={item}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                  isChecked ? "border-success/30 bg-success-soft" : "border-border hover:border-primary/40",
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() =>
                    onChange(isChecked ? checked.filter((entry) => entry !== item) : [...checked, item])
                  }
                  className="mt-0.5 size-4 accent-[var(--success)]"
                />
                <span>{item}</span>
              </label>
            </li>
          );
        })}
        <li className="text-xs text-subtle-foreground">
          این تمرین عملی است؛ آن را روی کامپیوتر خود انجام دهید و موارد انجام‌شده را علامت بزنید.
        </li>
      </ul>
    );
  }

  return null;
}

function isAnswered(question: QuizQuestionView, value: unknown): boolean {
  switch (question.type as QuestionType) {
    case "MULTIPLE_CHOICE":
      return typeof value === "string" && value.length > 0;
    case "TRUE_FALSE":
      return typeof value === "boolean";
    case "FILL_BLANK":
      return typeof value === "string" && value.trim().length > 0;
    case "MATCHING":
      return Object.values((value as Record<string, string>) ?? {}).some((entry) => entry);
    case "PRACTICAL":
      return Array.isArray(value) && value.length > 0;
    default:
      return false;
  }
}
