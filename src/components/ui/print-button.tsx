"use client";

import { getIcon } from "@/components/icon";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Print / save-as-PDF trigger.
 *
 * The printable views are real pages with a print stylesheet rather than a
 * generated PDF binary: the browser's own "Save as PDF" produces a better
 * result for Persian text (correct shaping and embedded fonts) than a
 * server-side renderer would, and it needs no extra dependency.
 */
export function PrintButton({
  label = "چاپ یا ذخیره PDF",
  hint,
  className,
  variant = "primary",
  size = "md",
}: {
  label?: string;
  hint?: string;
  className?: string;
  variant?: "primary" | "outline" | "soft" | "success";
  size?: "sm" | "md" | "lg";
}) {
  const PrinterIcon = getIcon("Printer");

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <Button variant={variant} size={size} onClick={() => window.print()}>
        <PrinterIcon size={size === "lg" ? 20 : 17} aria-hidden="true" />
        {label}
      </Button>
      {hint ? <span className="text-[0.6875rem] text-subtle-foreground">{hint}</span> : null}
    </span>
  );
}
