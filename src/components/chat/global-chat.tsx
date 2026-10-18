"use client";

import { usePathname } from "next/navigation";

import { ChatWidget } from "@/components/chat/chat-widget";

/**
 * Site-wide floating chatbot.
 *
 * Rendered once in the site layout so the assistant is reachable from every
 * page, including marketing pages where no lesson is open. When the visitor is
 * reading a lesson, the lesson slug is taken from the URL so the assistant
 * still answers with the right context — the API resolves the slug into module,
 * chapter, lesson text, steps and FAQs server-side.
 */
export function GlobalChat({
  quickActions,
  isAuthenticated,
}: {
  quickActions: string[];
  isAuthenticated: boolean;
}) {
  const pathname = usePathname();

  // `/course/{module}/{lesson}` → the lesson slug.
  const lessonMatch = /^\/course\/([^/]+)\/([^/]+)$/.exec(pathname);
  const lessonSlug = lessonMatch?.[2] ?? null;

  return (
    <ChatWidget
      lessonSlug={lessonSlug}
      lessonTitle={null}
      // The panel shows a short label; the full path is not known client-side.
      contextLabel={lessonSlug ? "درس جاری" : null}
      quickActions={quickActions}
      initialSessionId={null}
      initialMessages={[]}
      isAuthenticated={isAuthenticated}
      variant="floating"
    />
  );
}
