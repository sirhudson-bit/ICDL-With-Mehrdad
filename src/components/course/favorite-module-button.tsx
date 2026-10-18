"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getIcon } from "@/components/icon";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

/**
 * "Add to favourites" for a whole course.
 *
 * Mirrors the lesson-level bookmark button so the same affordance appears on a
 * module page and on the favourites list.
 */
export function FavoriteModuleButton({
  moduleId,
  label,
  excerpt,
  initialFavorited,
  isAuthenticated,
  variant = "labelled",
  className,
}: {
  moduleId: string;
  label: string;
  excerpt?: string;
  initialFavorited: boolean;
  isAuthenticated: boolean;
  variant?: "labelled" | "icon";
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();

  const StarIcon = getIcon(favorited ? "Star" : "Star");

  const toggle = () => {
    if (!isAuthenticated) {
      toast({
        title: "برای افزودن به علاقه‌مندی‌ها وارد شوید",
        description: "با حساب کاربری می‌توانید دوره‌ها و درس‌ها را ذخیره کنید.",
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
          body: JSON.stringify({ moduleId, type: "MODULE", label, excerpt }),
        });

        const payload = (await response.json()) as { ok: boolean; bookmarked?: boolean; message?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.message ?? "ذخیره نشد");

        setFavorited(Boolean(payload.bookmarked));
        toast({
          title: payload.bookmarked ? "دوره به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد",
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

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={favorited}
        aria-label={favorited ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-xl transition-colors disabled:opacity-60",
          favorited ? "text-accent hover:bg-accent-soft" : "text-muted-foreground hover:bg-muted",
          className,
        )}
      >
        <StarIcon size={18} fill={favorited ? "currentColor" : "none"} aria-hidden="true" />
      </button>
    );
  }

  return (
    <Button
      variant={favorited ? "soft" : "outline"}
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      className={className}
    >
      <StarIcon size={18} fill={favorited ? "currentColor" : "none"} aria-hidden="true" />
      {favorited ? "در علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
    </Button>
  );
}
