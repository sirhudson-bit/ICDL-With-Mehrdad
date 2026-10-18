import type { Metadata, Viewport } from "next";
import { DirectionProvider } from "@radix-ui/react-direction";

import "@fontsource-variable/vazirmatn/index.css";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { InstallPrompt, OfflineNotice, ServiceWorkerRegistrar } from "@/components/pwa/pwa-client";
import { ToastProvider } from "@/components/ui/toaster";
import { publicEnv } from "@/lib/env";
import { themeInitScript, THEME_DEFAULT_PLACEHOLDER } from "@/lib/theme-script";
import { getSettings } from "@/services/settings-service";

export async function generateMetadata(): Promise<Metadata> {
  const [site, course, pwa] = await Promise.all([
    getSettings("site"),
    getSettings("course"),
    getSettings("pwa"),
  ]);

  const title = `${site.name} — ${site.tagline}`;

  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: {
      default: title,
      template: `%s | ${site.name}`,
    },
    description: site.description,
    applicationName: site.name,
    keywords: [
      "آموزش ICDL",
      "ICDL از صفر",
      "آموزش کامپیوتر",
      "آموزش ورد",
      "آموزش اکسل",
      "آموزش پاورپوینت",
      "آموزش اکسس",
      "مهارت‌های هفت‌گانه",
      course.title,
    ],
    authors: [{ name: site.name }],
    creator: site.name,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "fa_IR",
      siteName: site.name,
      title,
      description: site.description,
      url: publicEnv.siteUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: site.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    // Enables "Add to Home Screen" on iOS, which ignores the web manifest.
    appleWebApp: {
      capable: true,
      title: pwa.shortName || site.name,
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
      ...(site.faviconUrl ? { shortcut: [{ url: site.faviconUrl }] } : {}),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1f2a" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [appearance, pwa] = await Promise.all([getSettings("appearance"), getSettings("pwa")]);
  const initScript = themeInitScript.replace(THEME_DEFAULT_PLACEHOLDER, appearance.defaultTheme);

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className="min-h-dvh">
        <DirectionProvider dir="rtl">
        <ThemeProvider defaultTheme={appearance.defaultTheme}>
          <ToastProvider>
            <a href="#main-content" className="skip-link no-print">
              رفتن به محتوای اصلی
            </a>
            <OfflineNotice />
            {children}
            <ServiceWorkerRegistrar enabled={pwa.enabled} offlineSupport={pwa.offlineSupport} />
            {pwa.showInstallPrompt ? <InstallPrompt enabled={pwa.enabled} /> : null}
          </ToastProvider>
        </ThemeProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
