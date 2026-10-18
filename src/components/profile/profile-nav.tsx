"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

/**
 * Sub-navigation for the account area.
 *
 * The learner pages (progress, favourites, settings, certificate) each lived on
 * their own with no way to move between them except the header menu. This gives
 * the account area one visible spine, and marks where the visitor currently is.
 */
const ITEMS = [
  { href: "/profile", label: "نمای کلی", icon: "LayoutDashboard" },
  { href: "/progress", label: "پیشرفت من", icon: "TrendingUp" },
  { href: "/profile/exercises", label: "تمرین‌های من", icon: "MousePointerClick" },
  { href: "/profile/requests", label: "درخواست‌های من", icon: "Mail" },
  { href: "/bookmarks", label: "علاقه‌مندی‌ها", icon: "Star" },
  { href: "/certificate", label: "گواهی پایان دوره", icon: "Award" },
  { href: "/settings", label: "تنظیمات حساب", icon: "Settings" },
] as const;

export function ProfileNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="بخش‌های حساب کاربری" className="no-print">
      <ul className="hide-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-card-muted p-1.5">
        {ITEMS.map((item) => {
          const Icon = getIcon(item.icon);
          const active = item.href === "/profile" ? pathname === "/profile" : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
                )}
              >
                <Icon size={17} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
