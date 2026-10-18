import { sanitizeRichText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

/**
 * Renders administrator-authored rich text.
 *
 * The HTML is sanitised on the server immediately before rendering. Using
 * `dangerouslySetInnerHTML` is the point here — the content is HTML by design,
 * and the sanitiser is what makes it safe.
 */
export function RichText({
  html,
  className,
  as: Tag = "div",
}: {
  html: string;
  className?: string;
  as?: "div" | "p" | "span";
}) {
  const clean = sanitizeRichText(html);
  if (!clean) return null;

  return (
    <Tag className={cn("prose-fa", className)} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
