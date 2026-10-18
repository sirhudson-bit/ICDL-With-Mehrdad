import type { Metadata } from "next";

import { AdminForm, ConfirmActionButton } from "@/components/admin/action-form";
import { getIcon } from "@/components/icon";
import { Card, CardContent, Field, Input, Textarea } from "@/components/ui/primitives";
import { deleteFaqAction, saveFaqAction } from "@/app/actions/admin";
import { prisma } from "@/lib/db";
import { toPersianDigits } from "@/lib/persian";

export const metadata: Metadata = {
  title: "پرسش‌های پرتکرار",
  robots: { index: false, follow: false },
};

/** Global help-centre FAQs. Lesson-specific FAQs are edited inside each lesson. */
export default async function AdminFaqsPage() {
  const faqs = await prisma.faq.findMany({
    where: { lessonId: null },
    orderBy: { order: "asc" },
  });

  const categories = [...new Set(faqs.map((faq) => faq.category ?? "عمومی"))];
  const HelpIcon = getIcon("HelpCircle");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <HelpIcon size={20} aria-hidden="true" />
          پرسش‌های پرتکرار
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          این پرسش‌ها در صفحه «راهنما» نمایش داده می‌شوند و در جستجوی سایت هم پیدا می‌شوند.
          {faqs.length > 0 ? ` (${toPersianDigits(faqs.length)} پرسش)` : ""}
        </p>
      </header>

      <Card>
        <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
          <h2 className="text-sm font-bold">افزودن پرسش جدید</h2>
          <div className="mt-4">
            <AdminForm action={saveFaqAction} successMessage="پرسش اضافه شد" resetOnSuccess submitLabel="افزودن">
              <input type="hidden" name="isPublished" value="on" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="پرسش" required>
                  <Input name="question" required placeholder="مثلاً: چطور یادگیری را شروع کنم؟" />
                </Field>
                <Field label="دسته‌بندی" hint="پرسش‌ها در صفحه راهنما بر اساس دسته گروه‌بندی می‌شوند.">
                  <Input name="category" placeholder="مثلاً: شروع کار" list="faq-categories" />
                </Field>
              </div>

              <datalist id="faq-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>

              <div className="mt-3">
                <Field label="پاسخ" required hint={"می‌توانید از تگ‌های ساده HTML مثل <p> و <strong> استفاده کنید."}>
                  <Textarea name="answer" rows={3} required placeholder="<p>پاسخ…</p>" />
                </Field>
              </div>
            </AdminForm>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {faqs.map((faq) => (
          <Card key={faq.id}>
            <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{faq.question}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {faq.answer.replace(/<[^>]+>/g, " ")}
                  </p>
                  {faq.category ? (
                    <p className="mt-1 text-[0.6875rem] text-subtle-foreground">دسته: {faq.category}</p>
                  ) : null}
                </div>
                <ConfirmActionButton
                  action={deleteFaqAction.bind(null, faq.id)}
                  label="حذف"
                  icon="Trash2"
                  variant="danger"
                  size="sm"
                  confirmTitle="این پرسش حذف شود؟"
                />
              </div>

              <details className="group mt-3">
                <summary className="cursor-pointer list-none text-xs font-medium text-primary">ویرایش</summary>
                <div className="mt-3 rounded-xl border border-border bg-card-muted p-3">
                  <AdminForm action={saveFaqAction} successMessage="پرسش ذخیره شد">
                    <input type="hidden" name="id" value={faq.id} />
                    <input type="hidden" name="isPublished" value={faq.isPublished ? "on" : "off"} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="پرسش">
                        <Input name="question" defaultValue={faq.question} />
                      </Field>
                      <Field label="دسته‌بندی">
                        <Input name="category" defaultValue={faq.category ?? ""} />
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="پاسخ">
                        <Textarea name="answer" rows={3} defaultValue={faq.answer} />
                      </Field>
                    </div>
                  </AdminForm>
                </div>
              </details>
            </CardContent>
          </Card>
        ))}

        {faqs.length === 0 ? (
          <Card>
            <CardContent className="p-8 pt-8 text-center">
              <p className="text-sm font-bold">هنوز پرسشی ثبت نشده است</p>
              <p className="mt-1 text-xs text-muted-foreground">با فرم بالا اولین پرسش را اضافه کنید.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
