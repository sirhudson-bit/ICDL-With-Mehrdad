"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getIcon } from "@/components/icon";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import type { BookmarkType } from "@/types";

/**
 * Bookmark toggle.
 *
 * Works for a whole lesson or for a specific tip/definition block within it.
 * Anonymous visitors are sent to the login page rather than shown a dead
 * button, since favourites are stored per account.
 */
export function BookmarkButton({
  lessonId,
  label,
  excerpt,
  type = "LESSON",
  blockId,
  initialBookmarked = false,
  isAuthenticated,
  variant = "icon",
  className,
}: {
  lessonId: string;
  label: string;
  excerpt?: string;
  type?: BookmarkType;
  blockId?: string;
  initialBookmarked?: boolean;
  isAuthenticated: boolean;
  variant?: "icon" | "labelled";
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  const BookmarkIcon = getIcon(bookmarked ? "BookmarkCheck" : "Bookmark");

  const onClick = () => {
    if (!isAuthenticated) {
      toast({
        title: "برای نشان‌دار کردن وارد شوید",
        description: "با حساب کاربری می‌توانید درس‌ها و نکته‌های مهم را ذخیره کنید.",
        tone: "info",
      });
      router.push("/login?next=back");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, label, excerpt, type, blockId }),
        });

        const payload = (await response.json()) as { ok: boolean; bookmarked?: boolean; message?: string };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.message ?? "خطا در ذخیره‌سازی");
        }

        setBookmarked(Boolean(payload.bookmarked));
        toast({
          title: payload.bookmarked ? "به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد",
          tone: "success",
          durationMs: 2600,
        });
        router.refresh();
      } catch (error) {
        toast({
          title: "ذخیره نشد",
          description: error instanceof Error ? error.message : "دوباره تلاش کنید.",
          tone: "error",
        });
      }
    });
  };

  if (variant === "labelled") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={bookmarked}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors disabled:opacity-60",
          bookmarked ? "border-primary/40 bg-primary-soft text-primary" : "border-border hover:bg-muted",
          className,
        )}
      >
        <BookmarkIcon size={17} aria-hidden="true" />
        {bookmarked ? "ذخیره شده" : "ذخیره در علاقه‌مندی‌ها"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      title={bookmarked ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-60",
        bookmarked ? "text-primary hover:bg-primary-soft" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <BookmarkIcon size={16} aria-hidden="true" />
    </button>
  );
}
