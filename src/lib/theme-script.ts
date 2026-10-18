/**
 * Pre-paint theme bootstrap.
 *
 * Lives outside the client component module on purpose: a server component that
 * imports a value from a `"use client"` file receives a client reference rather
 * than the value itself, which would break the injected script.
 */

export const THEME_STORAGE_KEY = "icdl-theme";

/** Placeholder replaced at render time with the configured default theme. */
export const THEME_DEFAULT_PLACEHOLDER = "__DEFAULT__";

export const themeInitScript = `(function(){try{
  var KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
  var stored = localStorage.getItem(KEY);
  var choice = stored === "light" || stored === "dark" || stored === "system" ? stored : ${JSON.stringify(THEME_DEFAULT_PLACEHOLDER)};
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var resolved = (choice === "system" || choice === ${JSON.stringify(THEME_DEFAULT_PLACEHOLDER)}) ? (prefersDark ? "dark" : "light") : choice;
  var root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}catch(e){}})();`;
