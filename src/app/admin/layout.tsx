import Link from "next/link";
import { redirect } from "next/navigation";

import { getIcon } from "@/components/icon";
import { ButtonLink } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { getAllSettings } from "@/services/settings-service";
import { toPersianDigits } from "@/lib/persian";

const NAV_ITEMS = [
  { href: "/admin", label: "داشبورد", icon: "LayoutDashboard" },
  { href: "/admin/content", label: "ساختار دوره", icon: "FolderTree" },
  { href: "/admin/users", label: "کاربران", icon: "Users" },
  { href: "/admin/inbox", label: "پیام‌ها و درخواست‌ها", icon: "Mail" },
  { href: "/admin/certificates", label: "گواهی‌ها", icon: "Award" },
  { href: "/admin/faqs", label: "پرسش‌های پرتکرار", icon: "HelpCircle" },
  { href: "/admin/settings", label: "تنظیمات", icon: "Settings" },
  { href: "/admin/data", label: "ورود و خروج داده", icon: "FileUp" },
];

/**
 * Admin shell.
 *
 * The role check happens here on the server, so every page nested under
 * `/admin` is protected even if it is reached directly by URL.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");

  const settings = await getAllSettings();
  const Logo = getIcon("Shield");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Logo size={18} aria-hidden="true" />
            </span>
            <span className="hidden flex-col sm:flex">
              <span className="text-sm font-bold">پنل مدیریت</span>
              <span className="text-[0.625rem] text-muted-foreground">{settings.site.name}</span>
            </span>
          </Link>

          <nav className="hide-scrollbar ms-2 flex flex-1 items-center gap-1 overflow-x-auto" aria-label="بخش‌های پنل مدیریت">
            {NAV_ITEMS.map((item) => {
              const Icon = getIcon(item.icon);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icon size={15} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-xl bg-muted px-2.5 py-1.5 text-[0.6875rem] text-muted-foreground sm:block">
              {user.name} • مدیر
            </span>
            <ButtonLink href="/" variant="outline" size="sm">
              دیدن سایت
            </ButtonLink>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-xl px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                خروج
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>

      <footer className="no-print border-t border-border px-4 py-4 text-center text-[0.6875rem] text-subtle-foreground sm:px-6">
        همه محتوای این پلتفرم از همین پنل قابل ویرایش است — نیازی به تغییر کد نیست. سال{" "}
        {toPersianDigits(new Date().getFullYear())}
      </footer>
    </div>
  );
}
