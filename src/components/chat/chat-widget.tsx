"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getIcon } from "@/components/icon";
import { Badge, Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type ChatTurnView = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  provider: string | null;
  createdAt: string;
};

/**
 * Lesson-aware chatbot.
 *
 * The panel is rendered inline inside the lesson (so the "ask the chatbot"
 * affordance is always visible), and the same component powers the floating
 * button. The lesson slug is sent with every request, which is what lets the
 * assistant answer about the page the learner is actually reading.
 */
export function ChatWidget({
  lessonSlug,
  lessonTitle,
  contextLabel,
  quickActions,
  initialSessionId,
  initialMessages,
  isAuthenticated,
  variant = "inline",
}: {
  lessonSlug: string | null;
  lessonTitle: string | null;
  contextLabel: string | null;
  quickActions: string[];
  initialSessionId: string | null;
  initialMessages: ChatTurnView[];
  isAuthenticated: boolean;
  variant?: "inline" | "floating";
}) {
  const [open, setOpen] = useState(variant === "inline");
  const [messages, setMessages] = useState<ChatTurnView[]>(initialMessages);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Monotonic counter for optimistic message ids. A counter is used rather than
  // a timestamp because reading the clock inside a component is not pure.
  const localIdRef = useRef(0);

  // Keep the newest message in view.
  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, pending]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || pending) return;

    if (!isAuthenticated) {
      setError("برای استفاده از چت‌بات باید وارد حساب کاربری خود شوید.");
      return;
    }

    setError(null);
    setInput("");

    const optimistic: ChatTurnView = {
      id: `local-${(localIdRef.current += 1)}`,
      role: "USER",
      content: question,
      provider: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, lessonSlug, sessionId }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        message?: string;
        reply?: { sessionId: string; turn: ChatTurnView; degraded?: boolean };
      };

      if (!response.ok || !payload.ok || !payload.reply) {
        throw new Error(payload.message ?? "پاسخ دریافت نشد.");
      }

      setSessionId(payload.reply.sessionId);
      setMessages((current) => [...current, payload.reply!.turn]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ارتباط با چت‌بات برقرار نشد.");
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const clear = () => {
    setMessages([]);
    setSessionId(null);
  };

  const BotIcon = getIcon("Bot");
  const SendIcon = getIcon("Send");

  if (variant === "floating" && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print fixed bottom-20 end-4 z-[60] inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-raised)] transition-transform hover:-translate-y-0.5 lg:bottom-5 lg:end-5"
      >
        <BotIcon size={18} aria-hidden="true" />
        سؤال از چت‌بات
      </button>
    );
  }

  return (
    <section
      className={cn(
        "no-print flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]",
        variant === "floating" &&
          "fixed bottom-20 end-4 z-[60] h-[min(32rem,70dvh)] w-[min(24rem,calc(100vw-2rem))] shadow-[var(--shadow-raised)] lg:bottom-5 lg:end-5",
      )}
      aria-labelledby="chat-heading"
    >
      <header className="flex items-center gap-2.5 border-b border-border bg-primary-soft/60 px-4 py-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <BotIcon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="chat-heading" className="text-sm font-bold">
            سؤال از چت‌بات
          </h2>
          {contextLabel ? (
            <p className="truncate text-[0.6875rem] text-muted-foreground" title={contextLabel}>
              درباره: {contextLabel}
            </p>
          ) : (
            <p className="text-[0.6875rem] text-muted-foreground">پاسخ ساده و مرحله‌به‌مرحله</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="rounded-lg px-2 py-1 text-[0.6875rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              پاک کردن
            </button>
          ) : null}
          {variant === "floating" ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="بستن چت‌بات"
              className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CloseGlyph />
            </button>
          ) : null}
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3.5">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-card-muted p-3.5 text-sm leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">
              {lessonTitle ? `درباره این درس بپرسید: ${lessonTitle}` : "چه چیزی را توضیح بدهم؟"}
            </p>
            <p className="mt-1 text-xs">
              می‌توانید از دکمه‌های زیر استفاده کنید یا سؤال خود را بنویسید. من فقط بر اساس محتوای همین
              دوره پاسخ می‌دهم تا اطلاعات نادرست به شما ندهم.
            </p>
          </div>
        ) : null}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {pending ? (
          <div className="flex items-center gap-2 ps-1 text-xs text-muted-foreground" role="status">
            <span className="flex gap-1" aria-hidden="true">
              <span className="typing-dot size-1.5 rounded-full bg-current" />
              <span className="typing-dot size-1.5 rounded-full bg-current" />
              <span className="typing-dot size-1.5 rounded-full bg-current" />
            </span>
            در حال نوشتن پاسخ…
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger" role="alert">
            {error}
            {!isAuthenticated ? (
              <>
                {" "}
                <Link href="/login" className="font-bold underline">
                  ورود به حساب
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {quickActions.length > 0 ? (
        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto border-t border-border px-3 py-2">
          {quickActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => send(action)}
              disabled={pending}
              className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[0.6875rem] whitespace-nowrap text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          سؤال خود را بنویسید
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="سؤال خود را بنویسید…"
          className="max-h-28 min-h-11 flex-1 resize-y rounded-xl border border-input bg-card px-3 py-2.5 text-sm leading-relaxed outline-none focus-visible:border-primary"
        />
        <Button type="submit" size="icon" disabled={pending || input.trim().length === 0} aria-label="ارسال پرسش">
          <SendIcon size={17} />
        </Button>
      </form>

      <p className="border-t border-border bg-card-muted px-3 py-1.5 text-[0.625rem] text-subtle-foreground">
        پاسخ‌ها ممکن است کامل نباشند. برای اطمینان، محتوای درس و منابع رسمی را مبنا بگیرید.
      </p>
    </section>
  );
}

/** Minimal markdown: bold, bullet lists and line breaks. */
function MessageBubble({ message }: { message: ChatTurnView }) {
  const isUser = message.role === "USER";

  return (
    <div className={cn("flex", isUser ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        <FormattedText text={message.content} />
        {!isUser && message.provider === "local" ? (
          <span className="mt-1.5 block">
            <Badge tone="outline" size="sm">
              حالت آفلاین
            </Badge>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => {
        if (line.trim().length === 0) return null;

        const bullet = /^\s*[•\-*]\s+/.test(line);
        const numbered = /^\s*\d+[.)]\s+/.test(line);
        const content = line.replace(/^\s*([•\-*]|\d+[.)])\s+/, "");

        return (
          <p key={index} className={cn(bullet || numbered ? "ps-3" : undefined)}>
            {bullet ? <span className="me-1">•</span> : null}
            <Bold text={content} />
          </p>
        );
      })}
    </div>
  );
}

function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-bold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function CloseGlyph() {
  const Icon = getIcon("X");
  return <Icon size={15} aria-hidden="true" />;
}
