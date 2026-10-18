"use client";

import { useState, useTransition } from "react";

import { subscribeToNewsletterAction } from "@/app/actions/newsletter";
import { getIcon } from "@/components/icon";
import { Button, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Footer newsletter form.
 *
 * One field and one button: the footer is not the place for a multi-step signup.
 * On success the form is replaced by a short confirmation, so the visitor cannot
 * submit the same address twice by accident.
 */
export function NewsletterForm() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const SendIcon = getIcon("Send");
  const CheckIcon = getIcon("CheckCircle2");

  if (done) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft px-3.5 py-2.5 text-xs text-success">
        <CheckIcon size={15} aria-hidden="true" />
        {done}
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);

        startTransition(async () => {
          const outcome = await subscribeToNewsletterAction(formData);
          if (!outcome.ok) {
            setError(outcome.message);
            return;
          }
          setDone(outcome.message);
        });
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="email"
          name="email"
          required
          dir="ltr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-label="ایمیل برای عضویت در خبرنامه"
          className="h-10 w-full max-w-56 text-xs"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending || email.trim().length === 0}>
          <SendIcon size={15} aria-hidden="true" />
          {pending ? "در حال ثبت…" : "عضویت"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className={cn("text-[0.6875rem] text-danger")}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
