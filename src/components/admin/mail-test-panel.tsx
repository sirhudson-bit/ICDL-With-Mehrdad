"use client";

import { useState, useTransition } from "react";

import { sendTestEmailAction } from "@/app/actions/admin";
import { getIcon } from "@/components/icon";
import { Button, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";

/**
 * "Send a test email" control shown under the mail settings.
 *
 * Lets an administrator verify the SMTP configuration without waiting for a
 * real password reset — and, when nothing is configured, confirms that the
 * log-only fallback is in effect.
 */
export function MailTestPanel() {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [to, setTo] = useState("");
  const SendIcon = getIcon("Send");

  const send = () => {
    startTransition(async () => {
      const outcome = await sendTestEmailAction(to);

      if (!outcome.ok) {
        toast({ title: "ارسال نشد", description: outcome.message, tone: "error" });
        return;
      }

      toast({ title: outcome.message ?? "ایمیل آزمایشی ارسال شد", tone: "success", durationMs: 4200 });
    });
  };

  return (
    <section className="stack-card p-4 sm:p-5">
      <h2 className="text-sm font-bold">آزمایش ارسال ایمیل</h2>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        پس از ذخیره تنظیمات بالا، یک ایمیل آزمایشی بفرستید تا از درستی آن مطمئن شوید. اگر سرور SMTP تنظیم
        نشده باشد، متن ایمیل به‌جای ارسال در گزارش سرور ثبت می‌شود.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Input
          type="email"
          dir="ltr"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="you@example.com"
          aria-label="ایمیل مقصد آزمایش"
          className="w-full max-w-xs"
        />
        <Button onClick={send} disabled={pending || to.trim().length === 0} variant="outline">
          {pending ? "در حال ارسال…" : "ارسال ایمیل آزمایشی"}
          <SendIcon size={16} aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
