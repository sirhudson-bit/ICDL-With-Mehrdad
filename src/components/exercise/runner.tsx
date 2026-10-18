"use client";

import { useState } from "react";

import { BrowserSim, EmailComposeSim, ExcelFormulaSim, FileExplorerSim, WordFormatSim } from "@/components/exercise/simulators";
import { getIcon } from "@/components/icon";
import { ClientHtml } from "@/components/lesson/client-html";
import { Badge, Button } from "@/components/ui/primitives";
import type { ExerciseData } from "@/lib/content/blocks";
import {
  checkExercise,
  describeAnswer,
  initialAnswer,
  isAnswerComplete,
  type ExerciseCheck,
} from "@/lib/exercise/check";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

/**
 * Interactive exercise runner.
 *
 * One shell provides the consistent parts — instructions, the check button,
 * attempt counting, immediate feedback and an answer reveal — while each
 * exercise kind supplies only its input surface. Feedback explains what is
 * wrong rather than merely marking it incorrect, which is what makes practice
 * useful for a beginner.
 */
export function ExerciseRunner({
  title,
  instructions,
  exercise,
  maxAttempts = 3,
  storageKey,
}: {
  title: string;
  instructions: string;
  exercise: ExerciseData;
  maxAttempts?: number;
  storageKey: string;
}) {
  const [answer, setAnswer] = useState<unknown>(() => initialAnswer(exercise));
  const [result, setResult] = useState<ExerciseCheck | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [solved, setSolved] = useState(false);

  const attemptsLeft = Math.max(0, maxAttempts - attempts);
  const canReveal = attemptsLeft === 0 && !solved;
  const ready = isAnswerComplete(exercise, answer);

  const check = () => {
    const outcome = checkExercise(exercise, answer);
    setResult(outcome);
    setAttempts((count) => count + 1);
    if (outcome.correct) setSolved(true);
  };

  const reset = () => {
    setAnswer(initialAnswer(exercise));
    setResult(null);
    setRevealed(false);
  };

  const PuzzleIcon = getIcon("PuzzlePiece");
  const CheckIcon = getIcon("CheckCircle2");
  const CloseIcon = getIcon("TriangleAlert");

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]",
        solved ? "border-success/35" : "border-border",
      )}
      aria-labelledby={`${storageKey}-title`}
    >
      <header className="flex flex-wrap items-center gap-2.5 border-b border-border bg-card-muted px-4 py-3 sm:px-5">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-info-soft text-info">
          <PuzzleIcon size={18} aria-hidden="true" />
        </span>
        <h3 id={`${storageKey}-title`} className="text-sm font-bold sm:text-base">
          {title}
        </h3>
        <span className="ms-auto flex items-center gap-2">
          {solved ? (
            <Badge tone="success">
              <CheckIcon size={13} aria-hidden="true" />
              درست انجام شد
            </Badge>
          ) : (
            <Badge tone={attemptsLeft === 0 ? "warning" : "outline"}>
              {attemptsLeft === 0
                ? "نوبت‌های بررسی تمام شد"
                : `${toPersianDigits(attemptsLeft)} نوبت باقی مانده`}
            </Badge>
          )}
        </span>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        <ClientHtml html={instructions} className="text-sm" />

        <ExerciseInput
          exercise={exercise}
          answer={answer}
          onChange={setAnswer}
          disabled={solved || attemptsLeft === 0}
          storageKey={storageKey}
        />

        {result ? (
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-xl border p-3 text-sm",
              result.correct ? "border-success/30 bg-success-soft text-success" : "border-danger/25 bg-danger-soft text-danger",
            )}
            role="status"
          >
            {result.correct ? (
              <CheckIcon size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <CloseIcon size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {result.correct ? "آفرین! پاسخ درست است." : "پاسخ درست نبود."}
              </p>
              {result.detail ? <p className="mt-1 leading-relaxed opacity-90">{result.detail}</p> : null}
              {result.correct ? (
                <p className="mt-1 text-xs opacity-80">
                  حالا همین کار را روی کامپیوتر خودتان هم امتحان کنید.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {revealed ? (
          <div className="rounded-xl border border-border bg-card-muted p-3 text-sm">
            <p className="font-bold">پاسخ درست:</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">{describeAnswer(exercise)}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={check} disabled={solved || attemptsLeft === 0 || !ready}>
            بررسی پاسخ
          </Button>
          {attempts > 0 && !solved ? (
            <Button variant="outline" onClick={reset} disabled={attemptsLeft === 0}>
              تلاش دوباره
            </Button>
          ) : null}
          {canReveal ? (
            <Button variant="ghost" onClick={() => setRevealed(true)} disabled={revealed}>
              نمایش پاسخ درست
            </Button>
          ) : null}
          {solved ? (
            <Button variant="outline" onClick={reset}>
              تمرین دوباره
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Dispatches to the input surface for each exercise kind. */
function ExerciseInput({
  exercise,
  answer,
  onChange,
  disabled,
  storageKey,
}: {
  exercise: ExerciseData;
  answer: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  storageKey: string;
}) {
  switch (exercise.kind) {
    case "mcq": {
      const selected = typeof answer === "string" ? answer : "";
      return (
        <fieldset className="flex flex-col gap-2" disabled={disabled}>
          <legend className="sr-only">گزینه‌ها را انتخاب کنید</legend>
          {exercise.options.map((option) => {
            const isSelected = selected === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors",
                  isSelected ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40",
                  disabled && "cursor-not-allowed opacity-70",
                )}
              >
                <input
                  type="radio"
                  name={storageKey}
                  value={option.id}
                  checked={isSelected}
                  onChange={() => onChange(option.id)}
                  className="size-4 accent-[var(--primary)]"
                />
                <span>{option.text}</span>
              </label>
            );
          })}
        </fieldset>
      );
    }

    case "trueFalse": {
      const selected = typeof answer === "boolean" ? answer : null;
      return (
        <div className="flex flex-wrap gap-2">
          {[
            { value: true, label: "درست", tone: "success" as const },
            { value: false, label: "نادرست", tone: "danger" as const },
          ].map((option) => {
            const isSelected = selected === option.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option.value)}
                aria-pressed={isSelected}
                className={cn(
                  "inline-flex h-11 min-w-28 items-center justify-center rounded-xl border text-sm font-medium transition-colors disabled:opacity-60",
                  isSelected
                    ? option.tone === "success"
                      ? "border-success/40 bg-success-soft text-success"
                      : "border-danger/40 bg-danger-soft text-danger"
                    : "border-border hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    }

    case "fillBlank": {
      const values = Array.isArray(answer) ? (answer as string[]) : [];
      const parts = exercise.template.split("___");

      return (
        <div className="rounded-xl border border-border bg-card-muted p-4">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm leading-loose">
            {parts.map((part, index) => (
              <span key={index} className="flex flex-wrap items-center gap-x-1.5">
                <span>{part}</span>
                {index < exercise.blanks.length ? (
                  <span className="inline-flex flex-col items-center">
                    <input
                      value={values[index] ?? ""}
                      onChange={(event) => {
                        const next = [...values];
                        next[index] = event.target.value;
                        onChange(next);
                      }}
                      disabled={disabled}
                      aria-label={`جای خالی ${index + 1}`}
                      placeholder={exercise.blanks[index]?.hint ?? ""}
                      className="h-8 w-32 rounded-lg border border-input bg-card px-2 text-center text-sm outline-none focus-visible:border-primary disabled:opacity-60"
                    />
                  </span>
                ) : null}
              </span>
            ))}
          </p>
        </div>
      );
    }

    case "matching": {
      const submitted = (answer && typeof answer === "object" ? answer : {}) as Record<string, string>;
      return (
        <ul className="flex flex-col gap-2">
          {exercise.left.map((left) => (
            <li key={left.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
              <span className="min-w-32 flex-1 text-sm font-medium">{left.text}</span>
              <select
                value={submitted[left.id] ?? ""}
                disabled={disabled}
                onChange={(event) => onChange({ ...submitted, [left.id]: event.target.value })}
                aria-label={`تطبیق برای ${left.text}`}
                className="h-10 flex-1 rounded-xl border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-primary disabled:opacity-60"
              >
                <option value="">انتخاب کنید…</option>
                {exercise.right.map((right) => (
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

    case "orderSteps": {
      const order = Array.isArray(answer) ? (answer as string[]) : exercise.items.map((item) => item.id);
      const items = order
        .map((id) => exercise.items.find((item) => item.id === id))
        .filter((item): item is (typeof exercise.items)[number] => Boolean(item));

      const move = (from: number, to: number) => {
        if (to < 0 || to >= order.length) return;
        const next = [...order];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        onChange(next);
      };

      return (
        <ol className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              draggable={!disabled}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const from = Number(event.dataTransfer.getData("text/plain"));
                if (Number.isInteger(from)) move(from, index);
              }}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-sm",
                !disabled && "cursor-grab active:cursor-grabbing",
              )}
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                {toPersianDigits(index + 1)}
              </span>
              <span className="min-w-0 flex-1 leading-relaxed">{item.text}</span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={disabled || index === 0}
                  aria-label="انتقال به بالا"
                  className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <UpGlyph />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={disabled || index === items.length - 1}
                  aria-label="انتقال به پایین"
                  className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <DownGlyph />
                </button>
              </span>
            </li>
          ))}
        </ol>
      );
    }

    case "excelFormula":
      return (
        <ExcelFormulaSim
          exercise={exercise}
          answer={typeof answer === "string" ? answer : ""}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "wordFormat":
      return (
        <WordFormatSim
          exercise={exercise}
          answer={(answer as Record<string, boolean>) ?? {}}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "browserSearch":
      return (
        <BrowserSim
          exercise={exercise}
          answer={
            (answer as { query: string; openedIndex: number | null; bookmarkedIndex: number | null }) ?? {
              query: "",
              openedIndex: null,
              bookmarkedIndex: null,
            }
          }
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "fileExplorer":
      return (
        <FileExplorerSim
          exercise={exercise}
          answer={
            (answer as {
              sort: string | null;
              selectedId: string | null;
              clipboardId: string | null;
              pasted: boolean;
              deletedIds: string[];
              createdFolder: boolean;
            }) ?? {
              sort: null,
              selectedId: null,
              clipboardId: null,
              pasted: false,
              deletedIds: [],
              createdFolder: false,
            }
          }
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "emailCompose":
      return (
        <EmailComposeSim
          exercise={exercise}
          answer={
            (answer as { to: string; cc: string; subject: string; body: string; attachedIds: string[] }) ?? {
              to: "",
              cc: "",
              subject: "",
              body: "",
              attachedIds: [],
            }
          }
          onChange={onChange}
          disabled={disabled}
        />
      );

    default:
      return null;
  }
}

function UpGlyph() {
  const Icon = getIcon("ChevronDown");
  return <Icon size={15} className="rotate-180" aria-hidden="true" />;
}
function DownGlyph() {
  const Icon = getIcon("ChevronDown");
  return <Icon size={15} aria-hidden="true" />;
}
