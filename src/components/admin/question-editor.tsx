"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteQuestionAction, saveQuestionAction } from "@/app/actions/admin";
import { FieldEditor } from "@/components/admin/field-editor";
import { getIcon } from "@/components/icon";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";
import { QUESTION_FIELDS } from "@/lib/content/block-fields";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

const QUESTION_TYPES = [
  { value: "MULTIPLE_CHOICE", label: "چند گزینه‌ای" },
  { value: "TRUE_FALSE", label: "درست / غلط" },
  { value: "FILL_BLANK", label: "جای خالی" },
  { value: "MATCHING", label: "تطبیق دادن" },
  { value: "PRACTICAL", label: "تمرین عملی" },
];

export type QuestionItem = {
  id: string;
  type: string;
  prompt: string;
  hint: string | null;
  explanation: string | null;
  points: number;
  data: Record<string, unknown>;
};

/**
 * Question editor.
 *
 * Shares the same generated field forms as the lesson builder, so an
 * administrator edits a quiz question with the same visual controls they use
 * for lesson content. The payload is serialised to JSON only at the boundary,
 * because the server action validates it against the question schema.
 */
export function QuestionEditor({
  quizId,
  question,
  onDone,
}: {
  quizId: string;
  question?: QuestionItem;
  onDone?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState(question?.type ?? "MULTIPLE_CHOICE");
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [hint, setHint] = useState(question?.hint ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [points, setPoints] = useState(question?.points ?? 1);
  const [data, setData] = useState<Record<string, unknown>>(question?.data ?? {});

  const save = () => {
    const formData = new FormData();
    formData.set("quizId", quizId);
    if (question) formData.set("id", question.id);
    formData.set("type", type);
    formData.set("prompt", prompt);
    formData.set("hint", hint);
    formData.set("explanation", explanation);
    formData.set("points", String(points));
    // The `type` discriminator is stored in its own column, so it is not part
    // of the JSON payload the server validates.
    const { type: _ignored, ...payload } = data;
    formData.set("data", JSON.stringify(payload));

    startTransition(async () => {
      const outcome = await saveQuestionAction(formData);
      if (!outcome.ok) {
        toast({ title: "ذخیره نشد", description: outcome.message, tone: "error" });
        return;
      }
      toast({ title: question ? "پرسش به‌روزرسانی شد" : "پرسش اضافه شد", tone: "success", durationMs: 2400 });
      onDone?.();
      router.refresh();
    });
  };

  const fields = QUESTION_FIELDS[type] ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Field label="نوع پرسش">
        <Select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            // Starting from an empty payload avoids carrying fields across types.
            setData({});
          }}
        >
          {QUESTION_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="متن پرسش">
        <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} placeholder="پرسش را بنویسید…" />
      </Field>

      <FieldEditor fields={fields} value={data} onChange={setData} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="راهنما (اختیاری)">
          <Input value={hint} onChange={(event) => setHint(event.target.value)} />
        </Field>
        <Field label="امتیاز">
          <Input type="number" min={1} max={20} value={points} onChange={(event) => setPoints(Number(event.target.value))} />
        </Field>
      </div>

      <Field label="توضیح پاسخ (اختیاری)" hint="پس از آزمون به کاربر نشان داده می‌شود.">
        <Textarea
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          rows={2}
          placeholder="چرا این پاسخ درست است؟"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={pending || prompt.trim().length < 5}>
          {pending ? "در حال ذخیره…" : question ? "ذخیره تغییرات" : "افزودن پرسش"}
        </Button>
        {onDone ? (
          <Button variant="ghost" onClick={onDone} disabled={pending}>
            انصراف
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Read-only list of a quiz's questions with edit and delete affordances. */
export function QuestionList({ quizId, questions }: { quizId: string; questions: QuestionItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const PlusIcon = getIcon("Plus");
  const EditIcon = getIcon("Pencil");
  const TrashIcon = getIcon("Trash2");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">
          پرسش‌ها {questions.length > 0 ? `(${toPersianDigits(questions.length)})` : ""}
        </p>
        {!adding ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <PlusIcon size={14} aria-hidden="true" />
            افزودن پرسش
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="rounded-2xl border border-primary/40 bg-card p-4">
          <QuestionEditor quizId={quizId} onDone={() => setAdding(false)} />
        </div>
      ) : null}

      {questions.length === 0 && !adding ? (
        <p className="rounded-xl border border-dashed border-border-strong bg-card px-3 py-6 text-center text-xs text-muted-foreground">
          هنوز پرسشی ساخته نشده است.
        </p>
      ) : null}

      <ol className="flex flex-col gap-2">
        {questions.map((question, index) => (
          <li
            key={question.id}
            className={cn(
              "rounded-2xl border bg-card p-3",
              editingId === question.id ? "border-primary/40" : "border-border",
            )}
          >
            <div className="flex items-start gap-2.5">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[0.6875rem] font-bold text-muted-foreground">
                {toPersianDigits(index + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{question.prompt}</p>
                <p className="mt-0.5 text-[0.6875rem] text-subtle-foreground">
                  {QUESTION_TYPES.find((option) => option.value === question.type)?.label ?? question.type} •{" "}
                  {toPersianDigits(question.points)} امتیاز
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingId((current) => (current === question.id ? null : question.id))}
                  aria-label="ویرایش پرسش"
                  className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <EditIcon size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const outcome = await deleteQuestionAction(question.id);
                      if (!outcome.ok) {
                        toast({ title: "حذف نشد", description: outcome.message, tone: "error" });
                        return;
                      }
                      toast({ title: "پرسش حذف شد", tone: "success", durationMs: 2200 });
                      router.refresh();
                    })
                  }
                  aria-label="حذف پرسش"
                  className="inline-flex size-7 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
                >
                  <TrashIcon size={14} aria-hidden="true" />
                </button>
              </span>
            </div>

            {editingId === question.id ? (
              <div className="mt-3 border-t border-border pt-3">
                <QuestionEditor quizId={quizId} question={question} onDone={() => setEditingId(null)} />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
