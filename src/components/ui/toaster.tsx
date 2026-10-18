"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { getIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  durationMs: number;
};

type ToastContextValue = {
  toast: (input: { title: string; description?: string; tone?: ToastTone; durationMs?: number }) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: string; wrapper: string }> = {
  success: { icon: "CheckCircle2", wrapper: "text-success" },
  error: { icon: "TriangleAlert", wrapper: "text-danger" },
  info: { icon: "Info", wrapper: "text-info" },
  warning: { icon: "TriangleAlert", wrapper: "text-warning" },
};

const MAX_VISIBLE = 4;

/**
 * Toast notifications.
 *
 * Announced through `role="status"` (or `alert` for errors) so screen readers
 * pick them up, and auto-dismissed with a per-toast timer that is cleared on
 * unmount.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ title, description, tone = "info", durationMs = 4500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, title, description, tone, durationMs }]);

      timers.current.set(
        id,
        setTimeout(() => dismiss(id), durationMs),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  // Memoised so consumers relying on `toast` identity do not re-render.
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:inset-x-auto sm:start-6 sm:items-start"
        aria-live="polite"
      >
        {toasts.map((item) => {
          const config = TONE_STYLES[item.tone];
          const Icon = getIcon(config.icon);

          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              className="animate-[var(--animate-pop)] pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-raised)]"
            >
              <div className="flex items-start gap-3">
                <Icon size={18} className={cn("mt-0.5 shrink-0", config.wrapper)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{item.title}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="-me-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="بستن پیام"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast باید داخل ToastProvider استفاده شود.");
  }
  return context;
}
