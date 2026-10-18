import Link from "next/link";
import type { Metadata } from "next";

import { AdminForm, ConfirmActionButton, TogglePublishButton } from "@/components/admin/action-form";
import { getIcon } from "@/components/icon";
import { Badge, ButtonLink, Card, CardContent, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import {
  deleteChapterAction,
  deleteModuleAction,
  moveLessonAction,
  moveModuleAction,
  saveChapterAction,
  saveLessonAction,
  saveModuleAction,
  togglePublishAction,
} from "@/app/actions/admin";
import { prisma } from "@/lib/db";
import { formatDuration, toPersianDigits } from "@/lib/persian";

export const metadata: Metadata = {
  title: "ساختار دوره",
  robots: { index: false, follow: false },
};

const ICON_OPTIONS = [
  "BookOpen",
  "Sparkles",
  "Cpu",
  "Monitor",
  "Globe",
  "FileText",
  "Table2",
  "Presentation",
  "Database",
  "GraduationCap",
  "Shield",
  "Wifi",
];

const COLOR_OPTIONS = [
  { value: "brand", label: "بنفش (پیش‌فرض)" },
  { value: "slate", label: "خاکستری" },
  { value: "sky", label: "آبی روشن" },
  { value: "violet", label: "بنفش روشن" },
  { value: "blue", label: "آبی" },
  { value: "emerald", label: "سبز" },
  { value: "orange", label: "نارنجی" },
  { value: "teal", label: "فیروزه‌ای" },
  { value: "amber", label: "کهربایی" },
];

/**
 * Course structure manager.
 *
 * Modules, chapters and lessons are edited in place with collapsible sections,
 * so the whole curriculum can be restructured — created, renamed, reordered,
 * published or removed — without touching source code.
 */
export default async function AdminContentPage() {
  const modules = await prisma.module.findMany({
    orderBy: { order: "asc" },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              slug: true,
              estimatedMinutes: true,
              isPublished: true,
              difficulty: true,
              _count: { select: { blocks: true } },
              quiz: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  const nextNumber = modules.reduce((max, courseModule) => Math.max(max, courseModule.number), -1) + 1;

  const PlusIcon = getIcon("Plus");
  const FolderIcon = getIcon("FolderTree");
  const ModuleIcon = getIcon("BookOpen");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <FolderIcon size={20} aria-hidden="true" />
            ساختار دوره
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {toPersianDigits(modules.length)} ماژول •{" "}
            {toPersianDigits(modules.reduce((total, courseModule) => total + courseModule.chapters.length, 0))} فصل •{" "}
            {toPersianDigits(
              modules.reduce(
                (total, courseModule) =>
                  total + courseModule.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0),
                0,
              ),
            )}{" "}
            درس
          </p>
        </div>
      </header>

      {/* New module */}
      <Card>
        <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <PlusIcon size={15} aria-hidden="true" />
              </span>
              افزودن ماژول جدید
            </summary>

            <div className="mt-4 border-t border-border pt-4">
              <AdminForm action={saveModuleAction} successMessage="ماژول ساخته شد" resetOnSuccess submitLabel="ساخت ماژول">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="عنوان ماژول" required>
                    <Input name="title" required placeholder="مثلاً: امنیت و نگهداری سیستم" />
                  </Field>
                  <Field label="زیرعنوان (اختیاری)">
                    <Input name="subtitle" />
                  </Field>
                  <Field label="شماره ماژول" hint="عدد ترتیبی که در کارت ماژول نمایش داده می‌شود.">
                    <Input name="number" type="number" min={0} max={99} defaultValue={nextNumber} />
                  </Field>
                  <Field label="آیکون">
                    <Select name="icon" defaultValue="BookOpen">
                      {ICON_OPTIONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="رنگ">
                    <Select name="color" defaultValue="brand">
                      {COLOR_OPTIONS.map((color) => (
                        <option key={color.value} value={color.value}>
                          {color.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="mt-3">
                  <Field label="توضیح ماژول" required>
                    <Textarea name="description" rows={3} required />
                  </Field>
                </div>

                <label className="mt-3 flex items-center gap-2.5 text-sm">
                  <input type="checkbox" name="isPublished" className="size-4 accent-[var(--primary)]" />
                  همین حالا منتشر شود
                </label>
              </AdminForm>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Module list */}
      {modules.map((courseModule, moduleIndex) => {
        const lessonCount = courseModule.chapters.reduce((total, chapter) => total + chapter.lessons.length, 0);

        return (
          <Card key={courseModule.id} className={`tone-${courseModule.color}`}>
            <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
              <div className="flex flex-wrap items-start gap-3">
                <span className="tone-icon inline-flex size-11 shrink-0 items-center justify-center rounded-2xl">
                  <ModuleIcon size={20} aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.6875rem] font-bold text-subtle-foreground">
                      ماژول {toPersianDigits(courseModule.number)}
                    </span>
                    <TogglePublishButton
                      action={togglePublishAction.bind(null, "module", courseModule.id)}
                      isPublished={courseModule.isPublished}
                      entityLabel="ماژول"
                    />
                  </div>
                  <h2 className="mt-1 text-base font-bold">{courseModule.title}</h2>
                  {courseModule.subtitle ? (
                    <p className="text-xs text-subtle-foreground">{courseModule.subtitle}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {toPersianDigits(courseModule.chapters.length)} فصل • {toPersianDigits(lessonCount)} درس •{" "}
                    {formatDuration(courseModule.estimatedMinutes)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <ConfirmActionButton
                    action={moveModuleAction.bind(null, courseModule.id, "up")}
                    label="انتقال به بالا"
                    icon="ChevronDown"
                    size="iconSm"
                    className={moduleIndex === 0 ? "pointer-events-none opacity-40" : undefined}
                    confirmTitle="ماژول یک پله بالا برود؟"
                  />
                  <ConfirmActionButton
                    action={moveModuleAction.bind(null, courseModule.id, "down")}
                    label="انتقال به پایین"
                    icon="ChevronRight"
                    size="iconSm"
                    confirmTitle="ماژول یک پله پایین بیاید؟"
                  />
                  <ConfirmActionButton
                    action={deleteModuleAction.bind(null, courseModule.id)}
                    label="حذف ماژول"
                    icon="Trash2"
                    variant="danger"
                    size="sm"
                    confirmTitle={`ماژول «${courseModule.title}» حذف شود؟`}
                    confirmDescription="همه فصل‌ها، درس‌ها، آزمون‌ها و پیشرفت کاربران در این ماژول حذف می‌شود."
                  />
                </div>
              </div>

              {/* Edit module */}
              <details className="group mt-4">
                <summary className="cursor-pointer list-none text-xs font-medium text-primary">
                  ویرایش اطلاعات ماژول
                </summary>
                <div className="mt-3 rounded-xl border border-border bg-card-muted p-3">
                  <AdminForm action={saveModuleAction} successMessage="ماژول ذخیره شد">
                    <input type="hidden" name="id" value={courseModule.id} />
                    <input type="hidden" name="slug" value={courseModule.slug} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="عنوان">
                        <Input name="title" defaultValue={courseModule.title} />
                      </Field>
                      <Field label="زیرعنوان">
                        <Input name="subtitle" defaultValue={courseModule.subtitle ?? ""} />
                      </Field>
                      <Field label="شماره">
                        <Input name="number" type="number" min={0} max={99} defaultValue={courseModule.number} />
                      </Field>
                      <Field label="آیکون">
                        <Select name="icon" defaultValue={courseModule.icon}>
                          {ICON_OPTIONS.map((icon) => (
                            <option key={icon} value={icon}>
                              {icon}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="رنگ">
                        <Select name="color" defaultValue={courseModule.color}>
                          {COLOR_OPTIONS.map((color) => (
                            <option key={color.value} value={color.value}>
                              {color.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="وضعیت">
                        <Select name="isPublished" defaultValue={courseModule.isPublished ? "true" : "false"}>
                          <option value="true">منتشرشده</option>
                          <option value="false">پیش‌نویس</option>
                        </Select>
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="توضیح">
                        <Textarea name="description" rows={3} defaultValue={courseModule.description} />
                      </Field>
                    </div>
                  </AdminForm>
                </div>
              </details>

              {/* Chapters */}
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {courseModule.chapters.map((chapter, chapterIndex) => (
                  <div key={chapter.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[0.6875rem] font-bold text-muted-foreground">
                        {toPersianDigits(chapterIndex + 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{chapter.title}</span>
                        <span className="block text-[0.6875rem] text-subtle-foreground">
                          {toPersianDigits(chapter.lessons.length)} درس
                        </span>
                      </span>
                      <TogglePublishButton
                        action={togglePublishAction.bind(null, "chapter", chapter.id)}
                        isPublished={chapter.isPublished}
                        entityLabel="فصل"
                      />
                      <ConfirmActionButton
                        action={deleteChapterAction.bind(null, chapter.id)}
                        label="حذف فصل"
                        icon="Trash2"
                        variant="danger"
                        size="iconSm"
                        confirmTitle={`فصل «${chapter.title}» حذف شود؟`}
                        confirmDescription="همه درس‌های این فصل هم حذف می‌شوند."
                      />
                    </div>

                    {/* Lessons */}
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {chapter.lessons.map((lesson, lessonIndex) => (
                        <li
                          key={lesson.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2"
                        >
                          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[0.625rem] font-bold text-muted-foreground">
                            {toPersianDigits(lessonIndex + 1)}
                          </span>
                          <Link
                            href={`/admin/content/lesson/${lesson.id}`}
                            className="min-w-0 flex-1 text-xs font-medium hover:text-primary"
                          >
                            {lesson.title}
                          </Link>
                          <Badge tone="outline" size="sm">
                            {toPersianDigits(lesson._count.blocks)} بلوک
                          </Badge>
                          {lesson.quiz ? (
                            <Badge tone="info" size="sm">
                              آزمون
                            </Badge>
                          ) : null}
                          <TogglePublishButton
                            action={togglePublishAction.bind(null, "lesson", lesson.id)}
                            isPublished={lesson.isPublished}
                            entityLabel="درس"
                          />
                          <ConfirmActionButton
                            action={moveLessonAction.bind(null, lesson.id, "up")}
                            label="بالا"
                            icon="ChevronDown"
                            size="iconSm"
                            className={lessonIndex === 0 ? "pointer-events-none opacity-40" : undefined}
                            confirmTitle="درس یک پله بالا برود؟"
                          />
                          <ConfirmActionButton
                            action={moveLessonAction.bind(null, lesson.id, "down")}
                            label="پایین"
                            icon="ChevronRight"
                            size="iconSm"
                            confirmTitle="درس یک پله پایین بیاید؟"
                          />
                          <ButtonLink href={`/admin/content/lesson/${lesson.id}`} variant="soft" size="sm">
                            ویرایش
                          </ButtonLink>
                        </li>
                      ))}
                    </ul>

                    {/* Add lesson */}
                    <details className="group mt-3">
                      <summary className="cursor-pointer list-none text-xs font-medium text-primary">
                        افزودن درس به این فصل
                      </summary>
                      <div className="mt-3 border-t border-border pt-3">
                        <AdminForm
                          action={saveLessonAction}
                          successMessage="درس ساخته شد"
                          resetOnSuccess
                          submitLabel="ساخت درس"
                        >
                          <input type="hidden" name="chapterId" value={chapter.id} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="عنوان درس" required>
                              <Input name="title" required />
                            </Field>
                            <Field label="زمان (دقیقه)">
                              <Input name="estimatedMinutes" type="number" min={1} max={300} defaultValue={10} />
                            </Field>
                          </div>
                          <div className="mt-3">
                            <Field label="خلاصه درس" required>
                              <Textarea name="summary" rows={2} required />
                            </Field>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <Field label="کلمات کلیدی">
                              <Input name="keywords" />
                            </Field>
                            <Field label="سطح">
                              <Select name="difficulty" defaultValue="BEGINNER">
                                <option value="BEGINNER">مبتدی</option>
                                <option value="INTERMEDIATE">متوسط</option>
                                <option value="ADVANCED">پیشرفته</option>
                              </Select>
                            </Field>
                          </div>
                          <label className="mt-3 flex items-center gap-2.5 text-sm">
                            <input type="checkbox" name="isPublished" className="size-4 accent-[var(--primary)]" />
                            منتشر شود
                          </label>
                        </AdminForm>
                      </div>
                    </details>

                    {/* Edit chapter */}
                    <details className="group mt-2">
                      <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground">
                        ویرایش فصل
                      </summary>
                      <div className="mt-3 border-t border-border pt-3">
                        <AdminForm action={saveChapterAction} successMessage="فصل ذخیره شد" submitLabel="ذخیره فصل">
                          <input type="hidden" name="id" value={chapter.id} />
                          <input type="hidden" name="moduleId" value={courseModule.id} />
                          <input type="hidden" name="slug" value={chapter.slug} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="عنوان فصل">
                              <Input name="title" defaultValue={chapter.title} />
                            </Field>
                            <Field label="توضیح (اختیاری)">
                              <Input name="description" defaultValue={chapter.description ?? ""} />
                            </Field>
                          </div>
                          <label className="mt-3 flex items-center gap-2.5 text-sm">
                            <input
                              type="checkbox"
                              name="isPublished"
                              defaultChecked={chapter.isPublished}
                              className="size-4 accent-[var(--primary)]"
                            />
                            منتشر شود
                          </label>
                        </AdminForm>
                      </div>
                    </details>
                  </div>
                ))}

                {/* Add chapter */}
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                      <PlusIcon size={13} aria-hidden="true" />
                      افزودن فصل به این ماژول
                    </span>
                  </summary>
                  <div className="mt-3 rounded-xl border border-border bg-card-muted p-3">
                    <AdminForm action={saveChapterAction} successMessage="فصل ساخته شد" resetOnSuccess submitLabel="ساخت فصل">
                      <input type="hidden" name="moduleId" value={courseModule.id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="عنوان فصل" required>
                          <Input name="title" required />
                        </Field>
                        <Field label="توضیح (اختیاری)">
                          <Input name="description" />
                        </Field>
                      </div>
                      <label className="mt-3 flex items-center gap-2.5 text-sm">
                        <input type="checkbox" name="isPublished" className="size-4 accent-[var(--primary)]" />
                        منتشر شود
                      </label>
                    </AdminForm>
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {modules.length === 0 ? (
        <Card>
          <CardContent className="p-8 pt-8 text-center">
            <p className="text-sm font-bold">هنوز ماژولی ساخته نشده است</p>
            <p className="mt-1 text-xs text-muted-foreground">
              با فرم بالا اولین ماژول را بسازید، یا از صفحه «ورود و خروج داده» محتوای آماده را وارد کنید.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <ButtonLink href="/admin/data" variant="outline" size="sm">
                ورود داده از فایل
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-center text-xs text-subtle-foreground">
        برای ویرایش محتوای هر درس (بلوک‌ها، آزمون و پرسش‌ها) روی دکمه «ویرایش» همان درس بزنید.
      </p>
    </div>
  );
}
