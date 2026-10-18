"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme-script";
import type { AppearanceSettings } from "@/lib/settings";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = THEME_STORAGE_KEY;

type ThemeContextValue = {
  theme: ThemeChoice;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeChoice, defaultTheme: ThemeChoice): "light" | "dark" {
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const effective = theme === "system" ? defaultTheme : theme;
  const resolved: "light" | "dark" =
    effective === "system" ? (prefersDark ? "dark" : "light") : effective;

  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  }

  return resolved;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode;
  defaultTheme?: AppearanceSettings["defaultTheme"];
}) {
  const [theme, setThemeState] = useState<ThemeChoice>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Adopt whatever the pre-paint script decided, then keep it in sync.
  //
  // Reading localStorage must happen after mount: doing it during render would
  // produce different markup on the server and the client. The effect performs
  // a single state update, which is exactly what the rule warns about only when
  // it cascades — here it settles after one pass.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
    const initial: ThemeChoice =
      stored === "light" || stored === "dark" || stored === "system" ? stored : defaultTheme;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from browser storage
    setThemeState(initial);
    setResolvedTheme(applyTheme(initial, defaultTheme));
  }, [defaultTheme]);

  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setResolvedTheme(applyTheme("system", defaultTheme));
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme, defaultTheme]);

  const setTheme = useCallback(
    (next: ThemeChoice) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage can be unavailable in private mode; the theme still applies.
      }
      setResolvedTheme(applyTheme(next, defaultTheme));
    },
    [defaultTheme],
  );

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme باید داخل ThemeProvider استفاده شود.");
  }
  return context;
}
