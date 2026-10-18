"use client";

import { useState } from "react";

import { getIcon } from "@/components/icon";
import { CourseSidebar, type SidebarProgress } from "@/components/layout/course-sidebar";
import { Button } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from "@/components/ui/overlays";
import type { ModuleTreeNode } from "@/services/course-service";

/**
 * Slide-out course navigation for small screens.
 *
 * The desktop sidebar is hidden below `lg`, so this gives touch users the same
 * tree rather than a compressed version of it.
 */
export function MobileCourseNav({
  modules,
  activeLessonSlug,
  progress,
  modulePercent,
}: {
  modules: ModuleTreeNode[];
  activeLessonSlug?: string;
  progress: SidebarProgress;
  modulePercent: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const MenuIcon = getIcon("Menu");

  return (
    <div className="mb-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" block className="justify-between">
            <span className="inline-flex items-center gap-2">
              <MenuIcon size={17} aria-hidden="true" />
              فهرست درس‌ها
            </span>
            <span className="text-xs text-muted-foreground">نمایش</span>
          </Button>
        </DialogTrigger>
        <DialogContent
          size="md"
          className="start-0 top-0 h-dvh w-[min(22rem,100vw)] max-w-none translate-x-0 translate-y-0 rounded-none sm:start-1/2 sm:top-1/2 sm:h-auto sm:max-h-[80dvh] sm:w-[min(26rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <DialogHeader title="فهرست درس‌ها" description="برای رفتن به هر درس روی آن بزنید." />
          <div className="max-h-[70dvh] overflow-y-auto pe-1">
            <CourseSidebar
              modules={modules}
              activeLessonSlug={activeLessonSlug}
              progress={progress}
              modulePercent={modulePercent}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
