"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { submitContactAction, submitCourseRequestAction } from "@/app/actions/inbox";
import { getIcon } from "@/components/icon";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";

/**
 * Public forms.
 *
 * Both are uncontrolled with `FormData` submission through server actions, so
 * they work before hydration and post progressively. Errors come back as
 * per-field Persian messages and the field values are preserved by the DOM.
 */

type Outcome = { ok: boolean; message?: string; fieldErrors?: Record<string, string> };

function useFormSubmit(action: (formData: FormData) => Promise<Outcome>, successTitle: string) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setFieldErrors({});
    setFailure(null);

    startTransition(async () => {
      const outcome = await action(formData);

      if (!outcome.ok) {
        setFieldErrors(outcome.fieldErrors ?? {});
        setFailure(outcome.message ?? "ارسال نشد.");
        toast({ title: "ارسال نشد", description: outcome.message, tone: "error" });
        return;
      }

      setSuccess(outcome.message ?? successTitle);
      form.reset();
      toast({ title: successTitle, description: outcome.message, tone: "success", durationMs: 5000 });
    });
  };

  return { pending, fieldErrors, success, failure, submit };
}

export function ContactForm({
  defaultName,
  defaultEmail,
  lockedName = false,
}: {
  defaultName?: string;
  defaultEmail?: string;
  /** Signed-in users keep the name from their profile; it is shown, not edited. */
  lockedName?: boolean;
}) {
  const { pending, fieldErrors, success, failure, submit } = useFormSubmit(submitContactAction, "پیام شما ثبت شد");
  const SendIcon = getIcon("Send");
  const UserIcon = getIcon("User");
  const CheckIcon = getIcon("CheckCircle2");

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {success ? (
        <Alert tone="success" title="پیام شما ثبت شد">
          {success}
        </Alert>
      ) : null}
      {failure ? (
        <Alert tone="danger" title="ارسال نشد">
          {failure}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {lockedName && defaultName ? (
          <Field
            label="نام و نام خانوادگی"
            hint="این نام از پروفایل شما خوانده می‌شود و قابل ویرایش نیست."
          >
            <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card-muted px-3.5 text-sm">
              <UserIcon size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium">{defaultName}</span>
              <CheckIcon size={16} className="shrink-0 text-success" aria-hidden="true" />
              <Link href="/settings" className="shrink-0 text-xs font-medium text-primary hover:underline">
                ویرایش
              </Link>
            </div>
            <input type="hidden" name="name" value={defaultName} />
          </Field>
        ) : (
          <Field label="نام و نام خانوادگی" htmlFor="contact-name" required error={fieldErrors.name}>
            <Input id="contact-name" name="name" defaultValue={defaultName} required autoComplete="name" />
          </Field>
        )}

        <Field label="ایمیل" htmlFor="contact-email" required error={fieldErrors.email}>
          <Input
            id="contact-email"
            name="email"
            type="email"
            dir="ltr"
            defaultValue={defaultEmail}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="شماره تماس (اختیاری)"
          htmlFor="contact-phone"
          error={fieldErrors.phone}
          hint="اگر می‌خواهید تلفنی پاسخ بگیرید."
        >
          <Input id="contact-phone" name="phone" dir="ltr" inputMode="tel" placeholder="09108176937" />
        </Field>

        <Field label="موضوع" htmlFor="contact-subject" required error={fieldErrors.subject}>
          <Input id="contact-subject" name="subject" required placeholder="مثلاً: سؤال درباره دوره اکسل" />
        </Field>
      </div>

      <Field label="متن پیام" htmlFor="contact-message" required error={fieldErrors.message}>
        <Textarea
          id="contact-message"
          name="message"
          rows={6}
          required
          placeholder="پیام، پیشنهاد یا سؤال خود را بنویسید…"
        />
      </Field>

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        <SendIcon size={18} aria-hidden="true" />
        {pending ? "در حال ارسال…" : "ارسال پیام"}
      </Button>
    </form>
  );
}

export function CourseRequestForm({ defaultName, defaultEmail }: { defaultName?: string; defaultEmail?: string }) {
  const { pending, fieldErrors, success, failure, submit } = useFormSubmit(
    submitCourseRequestAction,
    "درخواست شما ثبت شد",
  );
  const PlusIcon = getIcon("Plus");

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {success ? (
        <Alert tone="success" title="درخواست شما ثبت شد">
          {success}
        </Alert>
      ) : null}
      {failure ? (
        <Alert tone="danger" title="ارسال نشد">
          {failure}
        </Alert>
      ) : null}

      <Field label="عنوان دوره پیشنهادی" htmlFor="request-title" required error={fieldErrors.title}>
        <Input
          id="request-title"
          name="title"
          required
          placeholder="مثلاً: آموزش Google Sheets برای کار اداری"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="دسته‌بندی" htmlFor="request-category" error={fieldErrors.category}>
          <Input id="request-category" name="category" placeholder="مثلاً: آفیس، اینترنت، امنیت" list="request-categories" />
        </Field>

        <Field label="اولویت از نظر شما" htmlFor="request-priority" error={fieldErrors.priority}>
          <Select id="request-priority" name="priority" defaultValue="NORMAL">
            <option value="LOW">کم — بعداً هم می‌شود</option>
            <option value="NORMAL">معمولی</option>
            <option value="HIGH">زیاد — خیلی به آن نیاز دارم</option>
          </Select>
        </Field>
      </div>

      <datalist id="request-categories">
        {["آفیس", "ویندوز", "اینترنت و ایمیل", "امنیت", "موبایل", "طراحی", "حسابداری"].map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      <Field
        label="توضیح دوره"
        htmlFor="request-description"
        required
        error={fieldErrors.description}
        hint="چه چیزی باید آموزش داده شود و برای چه کسانی مناسب است؟"
      >
        <Textarea id="request-description" name="description" rows={5} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام شما" htmlFor="request-name" required error={fieldErrors.name}>
          <Input id="request-name" name="name" defaultValue={defaultName} required autoComplete="name" />
        </Field>

        <Field label="ایمیل" htmlFor="request-email" required error={fieldErrors.email}>
          <Input
            id="request-email"
            name="email"
            type="email"
            dir="ltr"
            defaultValue={defaultEmail}
            required
            autoComplete="email"
          />
        </Field>
      </div>

      <p className="text-xs leading-relaxed text-subtle-foreground">
        پیشنهادهای شما در برنامه‌ریزی محتوای بعدی بررسی می‌شوند. اگر دوره‌ای ساخته شود، از طریق ایمیل
        اطلاع می‌دهیم.
      </p>

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        <PlusIcon size={18} aria-hidden="true" />
        {pending ? "در حال ارسال…" : "ثبت درخواست دوره"}
      </Button>
    </form>
  );
}
