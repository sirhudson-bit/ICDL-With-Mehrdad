import type { MetadataRoute } from "next";

import { getSettings } from "@/services/settings-service";

/**
 * Web app manifest.
 *
 * Driven entirely by the PWA settings group, so the administrator can rename the
 * installed app, change its colours and disable installation without a deploy.
 * `display: standalone` opens an installed copy without browser chrome, which is
 * what makes the course feel like an app on a phone.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [site, course, pwa] = await Promise.all([
    getSettings("site"),
    getSettings("course"),
    getSettings("pwa"),
  ]);

  return {
    name: pwa.appName || `${site.name} — ${course.title}`,
    short_name: pwa.shortName || site.name,
    description: pwa.description || site.description,
    start_url: "/",
    scope: "/",
    display: pwa.display,
    orientation: pwa.orientation,
    lang: "fa",
    dir: "rtl",
    background_color: pwa.backgroundColor,
    theme_color: pwa.themeColor || site.themeColor || "#4f46e5",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: pwa.shortcuts.map((shortcut) => ({
      name: shortcut.label,
      short_name: shortcut.label,
      url: shortcut.href,
    })),
  };
}
