"use client";

import { cn } from "@/lib/utils";

/**
 * Renders HTML that has already been sanitised on the server.
 *
 * Client components cannot import the server-side sanitiser, so lesson content
 * is sanitised at the server boundary and handed down as a plain string. This
 * component exists to make that contract explicit at the call site.
 */
export function ClientHtml({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  return <div className={cn("prose-fa", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
