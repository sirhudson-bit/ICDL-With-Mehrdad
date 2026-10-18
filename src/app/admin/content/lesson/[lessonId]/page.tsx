import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AdminForm, ConfirmActionButton } from "@/components/admin/action-form";
import { LessonBuilder } from "@/components/admin/lesson-builder";
import { QuestionList } from "@/components/admin/question-editor";
import { getIcon } from "@/components/icon";
import { Badge, ButtonLink, Card, CardContent, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import {
  deleteFaqAction,
  deleteLessonAction,
  deleteQuizAction,
  saveFaqAction,
  saveLessonAction,
  saveQuizAction,
} from "@/app/actions/admin";
import { prisma } from "@/lib/db";
import { formatDuration, toPersianDigits } from "@/lib/persian";

export const metadata: Metadata = {
  title: "ویرایش درس",
  robots: { index: false, follow: false },
};

/** Lesson editor: details, the visual block builder, quiz and FAQs. */
export default async function AdminLessonPage(props: PageProps<"/admin/content/lesson/[lessonId]">) {
  const { lessonId } = await props.params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      blocks: { orderBy: { order: "asc" } },
      quiz: { include: { questions: { orderBy: { order: "asc" } } } },
      faqs: { orderBy: { order: "asc" } },
      chapter: { include: { module: { select: { id: true, title: true, slug: true, chapters: { select: { id: true, title: true }, orderBy: { order: "asc" } } } } } },
    },
  });

  if (!lesson) notFound();

  const FileIcon = getIcon("FileText");
  const QuizIcon = getIcon("ClipboardCheck");

  return (
    <div className="space-y-6">
      <nav aria-label="مسیر" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/admin" className="hover:text-primary">
          داشبورد
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/admin/content" className="hover:text-primary">
          ساختار دوره
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-foreground">{lesson.title}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <FileIcon size={20} aria-hidden="true" />
            {lesson.title}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {lesson.chapter.module.title} • {lesson.chapter.title} •{" "}
            {formatDuration(lesson.estimatedMinutes)} • {toPersianDigits(lesson.blocks.length)} بلوک
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={lesson.isPublished ? "success" : "warning"}>
            {lesson.isPublished ? "منتشرشده" : "پیش‌نویس"}
          </Badge>
          <ButtonLink href={`/admin/preview/${lesson.id}`} variant="outline" size="sm" target="_blank">
            پیش‌نمایش
          </ButtonLink>
          {lesson.isPublished ? (
            <ButtonLink href={`/course/${lesson.chapter.module.slug}/${lesson.slug}`} variant="ghost" size="sm" target="_blank">
              دیدن در سایت
            </ButtonLink>
          ) : null}
        </div>
      </header>

      {/* Block builder */}
      <Card>
        <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
          <LessonBuilder
            lessonId={lesson.id}
            initialBlocks={lesson.blocks.map((block) => ({
              id: block.id,
              type: block.type,
              order: block.order,
              isVisible: block.isVisible,
              data: (block.data ?? {}) as Record<string, unknown>,
            }))}
            previewHref={`/admin/preview/${lesson.id}`}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Lesson details */}
        <Card>
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
            <h2 className="text-sm font-bold">اطلاعات درس</h2>
            <div className="mt-4">
              <AdminForm action={saveLessonAction} successMessage="اطلاعات درس ذخیره شد">
                <input type="hidden" name="id" value={lesson.id} />
                <input type="hidden" name="chapterId" value={lesson.chapterId} />

                <div className="flex flex-col gap-4">
                  <Field label="عنوان درس" required>
                    <Input name="title" defaultValue={lesson.title} required />
                  </Field>

                  <Field label="خلاصه درس" required hint="در فهرست درس‌ها و نتایج جستجو نمایش داده می‌شود.">
                    <Textarea name="summary" defaultValue={lesson.summary} rows={3} required />
                  </Field>

                  <Field label="کلمات کلیدی (برای جستجو)" hint="با ویرگول جدا کنید.">
                    <Input name="keywords" defaultValue={lesson.keywords} dir="rtl" />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="زمان (دقیقه)">
                      <Input name="estimatedMinutes" type="number" min={1} max={300} defaultValue={lesson.estimatedMinutes} />
                    </Field>
                    <Field label="سطح">
                      <Select name="difficulty" defaultValue={lesson.difficulty}>
                        <option value="BEGINNER">مبتدی</option>
                        <option value="INTERMEDIATE">متوسط</option>
                        <option value="ADVANCED">پیشرفته</option>
                      </Select>
                    </Field>
                    <Field label="فصل">
                      <Select name="chapterId" defaultValue={lesson.chapterId}>
                        {lesson.chapter.module.chapters.map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>
                            {chapter.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="عنوان سئو (اختیاری)">
                      <Input name="seoTitle" defaultValue={lesson.seoTitle ?? ""} />
                    </Field>
                    <Field label="توضیح سئو (اختیاری)">
                      <Input name="seoDescription" defaultValue={lesson.seoDescription ?? ""} />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      name="isPublished"
                      defaultChecked={lesson.isPublished}
                      className="size-4 accent-[var(--primary)]"
                    />
                    این درس منتشر شود
                  </label>
                </div>
              </AdminForm>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <ConfirmActionButton
                action={deleteLessonAction.bind(null, lesson.id)}
                label="حذف این درس"
                icon="Trash2"
                variant="danger"
                size="md"
                confirmTitle={`درس «${lesson.title}» حذف شود؟`}
                confirmDescription="همه بلوک‌ها، آزمون و پرسش‌های این درس هم حذف می‌شوند. این کار قابل بازگشت نیست."
              />
            </div>
          </CardContent>
        </Card>

        {/* Quiz */}
        <Card>
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <QuizIcon size={17} aria-hidden="true" />
              آزمون درس
            </h2>

            <div className="mt-4">
              <AdminForm
                action={saveQuizAction}
                successMessage="آزمون ذخیره شد"
                submitLabel={lesson.quiz ? "ذخیره تنظیمات آزمون" : "ساخت آزمون"}
              >
                <input type="hidden" name="lessonId" value={lesson.id} />

                <div className="flex flex-col gap-4">
                  <Field label="عنوان آزمون">
                    <Input name="title" defaultValue={lesson.quiz?.title ?? `آزمون ${lesson.title}`} />
                  </Field>
                  <Field label="توضیح آزمون (اختیاری)">
                    <Textarea name="description" defaultValue={lesson.quiz?.description ?? ""} rows={2} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="نمره قبولی (٪)">
                      <Input
                        name="passingScore"
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={lesson.quiz?.passingScore ?? 70}
                      />
                    </Field>
                    <Field label="زمان پیشنهادی (دقیقه)" hint="خالی بگذارید تا محدودیتی نباشد.">
                      <Input
                        name="timeLimitMinutes"
                        type="number"
                        min={1}
                        max={240}
                        defaultValue={lesson.quiz?.timeLimitMinutes ?? ""}
                      />
                    </Field>
                  </div>
                </div>
              </AdminForm>
            </div>

            {lesson.quiz ? (
              <div className="mt-5 border-t border-border pt-4">
                <QuestionList
                  quizId={lesson.quiz.id}
                  questions={lesson.quiz.questions.map((question) => ({
                    id: question.id,
                    type: question.type,
                    prompt: question.prompt,
                    hint: question.hint,
                    explanation: question.explanation,
                    points: question.points,
                    data: (question.data ?? {}) as Record<string, unknown>,
                  }))}
                />

                <div className="mt-4 border-t border-border pt-3">
                  <ConfirmActionButton
                    action={deleteQuizAction.bind(null, lesson.quiz.id)}
                    label="حذف کل آزمون"
                    icon="Trash2"
                    variant="danger"
                    size="sm"
                    confirmTitle="آزمون این درس حذف شود؟"
                    confirmDescription="همه پرسش‌ها و نتایج ثبت‌شده این آزمون حذف می‌شوند."
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border-strong bg-card-muted px-3 py-4 text-center text-xs text-muted-foreground">
                این درس هنوز آزمون ندارد. با دکمه بالا یکی بسازید.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lesson FAQs */}
      <Card>
        <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
          <h2 className="text-sm font-bold">پرسش‌های پرتکرار این درس</h2>

          {lesson.faqs.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {lesson.faqs.map((faq) => (
                <li key={faq.id} className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{faq.question}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {faq.answer.replace(/<[^>]+>/g, " ")}
                    </span>
                  </span>
                  <ConfirmActionButton
                    action={deleteFaqAction.bind(null, faq.id)}
                    label="حذف"
                    icon="Trash2"
                    variant="danger"
                    size="iconSm"
                    confirmTitle="این پرسش حذف شود؟"
                  />
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 border-t border-border pt-4">
            <AdminForm action={saveFaqAction} successMessage="پرسش ذخیره شد" resetOnSuccess submitLabel="افزودن پرسش">
              <input type="hidden" name="lessonId" value={lesson.id} />
              <input type="hidden" name="isPublished" value="on" />

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="پرسش" required>
                  <Input name="question" placeholder="مثلاً: اگر فرمول کار نکرد چه کنم؟" required />
                </Field>
                <Field label="دسته (اختیاری)">
                  <Input name="category" placeholder="مثلاً: اکسل" />
                </Field>
              </div>
              <div className="mt-3">
                <Field
                  label="پاسخ"
                  required
                  hint={"می‌توانید از تگ‌های ساده HTML مثل <p> و <strong> استفاده کنید."}
                >
                  <Textarea name="answer" rows={3} required placeholder="<p>پاسخ…</p>" />
                </Field>
              </div>
            </AdminForm>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
