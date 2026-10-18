"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { requestCertificateAction, resetMyProgressAction } from "@/app/actions/learner";
import { getIcon } from "@/components/icon";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";

/** Issues the certificate on demand, reporting what is still outstanding. */
export function ClaimCertificateButton({ eligible }: { eligible: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const AwardIcon = getIcon("Award");

  return (
    <Button
      size="lg"
      variant={eligible ? "success" : "outline"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const outcome = await requestCertificateAction();
          if (!outcome.ok) {
            toast({ title: "صدور گواهی انجام نشد", description: outcome.message, tone: "warning", durationMs: 6000 });
            return;
          }
          toast({ title: outcome.message ?? "گواهی صادر شد", tone: "success" });
          router.refresh();
        })
      }
    >
      <AwardIcon size={20} aria-hidden="true" />
      {pending ? "در حال بررسی…" : eligible ? "دریافت گواهی" : "بررسی شرایط دریافت گواهی"}
    </Button>
  );
}

/** Resets the learner's own progress, behind an explicit confirmation. */
export function ResetProgressButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const ResetIcon = getIcon("RotateCcw");

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm(
          "پیشرفت شما بازنشانی شود؟\n\nهمه درس‌های تکمیل‌شده، نتایج آزمون‌ها و علاقه‌مندی‌ها پاک می‌شوند. حساب کاربری شما حذف نمی‌شود و گواهی صادرشده نیز باقی می‌ماند.",
        );
        if (!confirmed) return;

        startTransition(async () => {
          const outcome = await resetMyProgressAction();
          if (!outcome.ok) {
            toast({ title: "بازنشانی انجام نشد", description: outcome.message, tone: "error" });
            return;
          }
          toast({ title: outcome.message ?? "پیشرفت بازنشانی شد", tone: "success", durationMs: 4000 });
          router.refresh();
        });
      }}
    >
      <ResetIcon size={17} aria-hidden="true" />
      {pending ? "در حال بازنشانی…" : "بازنشانی پیشرفت من"}
    </Button>
  );
}
