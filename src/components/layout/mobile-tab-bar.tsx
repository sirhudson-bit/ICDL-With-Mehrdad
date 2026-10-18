"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

/**
 * Mobile tab bar.
 *
 * The desktop sidebar is hidden below `lg`, and a slide-out drawer alone is too
 * many taps for the primary destinations. This persistent bottom bar gives
 * thumb-reachable access to the four sections a learner moves between, matching
 * the pattern the major Iranian course platforms use on mobile.
 *
 * It is hidden on large screens and on the lesson page, which has its own sticky
 * action bar so the two never compete for the bottom edge.
 */
const TABS = [
  { href: "/", label: "خانه", icon: "Compass" },
  { href: "/course", label: "دوره", icon: "BookOpen" },
  { href: "/search", label: "جستجو", icon: "Search" },
  { href: "/progress", label: "پیشرفت", icon: "TrendingUp" },
] as const;

export function MobileTabBar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();

  // The lesson page provides its own sticky bar.
  if (pathname.includes("/course/") && pathname.split("/").length > 3) return null;

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg lg:hidden"
      aria-label="ناوبری سریع"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((tab) => {
          const Icon = getIcon(tab.icon);
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  // 56px min height keeps every target comfortably tappable.
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon size={23} aria-hidden="true" />
                <span className="text-[0.625rem] font-medium">{tab.label}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-0 h-0.5 w-10 rounded-full transition-opacity",
                    isActive ? "bg-primary opacity-100" : "opacity-0",
                  )}
                />
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <Link
            href={isAuthenticated ? "/bookmarks" : "/login"}
            aria-current={pathname.startsWith("/bookmarks") ? "page" : undefined}
            className={cn(
              "relative flex h-14 flex-col items-center justify-center gap-0.5 transition-colors",
              pathname.startsWith("/bookmarks") ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon20 name={isAuthenticated ? "Bookmark" : "LogIn"} />
            <span className="text-[0.625rem] font-medium">{isAuthenticated ? "ذخیره‌ها" : "ورود"}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function Icon20({ name }: { name: string }) {
  const Icon = getIcon(name);
  return <Icon size={23} aria-hidden="true" />;
}
