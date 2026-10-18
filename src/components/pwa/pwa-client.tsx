"use client";

import { useEffect, useState } from "react";

import { getIcon } from "@/components/icon";
import { Button, ButtonLink } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Service worker registration.
 *
 * Registered only in production. In development the worker would sit between
 * the browser and Turbopack's hot-updating chunks and serve stale modules,
 * which is a well-known source of confusing bugs.
 */
export function ServiceWorkerRegistrar({
  enabled = true,
  offlineSupport = true,
}: {
  enabled?: boolean;
  offlineSupport?: boolean;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!enabled || !offlineSupport) return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Registration failing is not fatal — the app works without offline support.
      });
    };

    // Defer until the page is idle so registration never competes with hydration.
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(register, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }

    const timer = setTimeout(register, 2500);
    return () => clearTimeout(timer);
  }, [enabled, offlineSupport]);

  return null;
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Add to home screen" prompt.
 *
 * Chrome fires `beforeinstallprompt` when the app is installable; the event is
 * captured and replayed from our own button so the invitation appears in the
 * interface rather than as a browser banner. Dismissals are remembered locally.
 */
export function InstallPrompt({ enabled = true }: { enabled?: boolean }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    try {
      if (window.localStorage.getItem("icdl-install-dismissed") === "1") return;
    } catch {
      // Ignore unavailable storage.
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [enabled]);

  if (!visible || !promptEvent) return null;

  const DownloadIcon = getIcon("Download");

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem("icdl-install-dismissed", "1");
    } catch {
      // Ignore write failures.
    }
  };

  return (
    <div
      className={cn(
        "no-print fixed inset-x-3 bottom-20 z-[70] rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-raised)]",
        "sm:inset-x-auto sm:end-5 sm:bottom-5 sm:max-w-sm",
      )}
      role="dialog"
      aria-label="نصب برنامه"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <DownloadIcon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">این دوره را روی گوشی نصب کنید</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            با نصب نسخه برنامه، دسترسی سریع‌تر و کار در حالت آفلاین امکان‌پذیر می‌شود.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={async () => {
                setVisible(false);
                await promptEvent.prompt();
                await promptEvent.userChoice.catch(() => undefined);
                setPromptEvent(null);
              }}
            >
              نصب برنامه
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              بعداً
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Offline notice shown inside the app shell when connectivity drops. */
export function OfflineNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  const WarnIcon = getIcon("Wifi");

  return (
    <div className="no-print sticky top-0 z-[65] flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-xs font-medium text-warning">
      <WarnIcon size={16} aria-hidden="true" />
      اتصال اینترنت قطع است — صفحه‌های بازدیدشده در دسترس می‌مانند.
      <ButtonLink href="/offline" variant="link" size="sm" className="text-warning">
        راهنما
      </ButtonLink>
    </div>
  );
}
