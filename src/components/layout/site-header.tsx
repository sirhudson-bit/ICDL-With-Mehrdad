"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { getIcon } from "@/components/icon";
import { useLogout } from "@/components/auth/logout";
import { Container } from "@/components/ui/container";
import { SearchBox } from "@/components/search/search-box";
import { useTheme, type ThemeChoice } from "@/components/theme-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Button, ButtonLink, Progress } from "@/components/ui/primitives";
import { formatPercent, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";

export type NavLink = { href: string; label: string; icon: string };

/** The four primary destinations, shown in the desktop bar and the mobile drawer. */
const NAV_LINKS: NavLink[] = [
  { href: "/", label: "خانه", icon: "Compass" },
  { href: "/course", label: "دوره‌ها", icon: "BookOpen" },
  { href: "/about", label: "درباره من", icon: "User" },
  { href: "/contact", label: "تماس با من", icon: "Phone" },
];

/** Everything else, kept reachable from the mobile drawer and the account menu. */
const SECONDARY_LINKS: NavLink[] = [
  { href: "/progress", label: "پیشرفت من", icon: "TrendingUp" },
  { href: "/exercises", label: "تمرین‌های عملی", icon: "MousePointerClick" },
  { href: "/bookmarks", label: "علاقه‌مندی‌ها", icon: "Star" },
  { href: "/certificate", label: "گواهی پایان دوره", icon: "Award" },
  { href: "/help", label: "راهنما", icon: "HelpCircle" },
  { href: "/request-course", label: "درخواست دوره", icon: "Rocket" },
];

/** Admin sections, listed in the account menu for administrators. */
const ADMIN_LINKS: NavLink[] = [
  { href: "/admin", label: "داشبورد", icon: "LayoutDashboard" },
  { href: "/admin/content", label: "ساختار دوره", icon: "FolderTree" },
  { href: "/admin/users", label: "کاربران", icon: "Users" },
  { href: "/admin/inbox", label: "پیام‌ها و درخواست‌ها", icon: "Mail" },
  { href: "/admin/certificates", label: "گواهی‌ها", icon: "Award" },
  { href: "/admin/faqs", label: "پرسش‌های پرتکرار", icon: "HelpCircle" },
  { href: "/admin/settings", label: "تنظیمات سایت", icon: "Settings" },
  { href: "/admin/data", label: "ورود و خروج داده", icon: "FileUp" },
];

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: "light", label: "روشن", icon: "Sun" },
  { value: "dark", label: "تیره", icon: "Moon" },
  { value: "system", label: "سیستم", icon: "Monitor" },
];

export function SiteHeader({
  user,
  siteName,
  logoUrl,
  popularSearches,
  progressPercent,
  bookmarkCount,
}: {
  user: SessionUser | null;
  siteName: string;
  logoUrl: string;
  popularSearches: string[];
  progressPercent: number;
  bookmarkCount: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  /**
   * The account menu is click-driven, deliberately.
   *
   * It used to open on hover as well, which fought the click: the panel lives in
   * a portal with a 6px gap below the trigger, so travelling from the avatar into
   * the panel left the trigger, `pointerleave` closed the panel, the pointer then
   * re-entered the trigger and it reopened — the flicker. Because the pointer was
   * still "in" the trigger, clicking the avatar toggled the already-open menu
   * shut, so it felt unclickable. One interaction — click — removes both
   * problems and is what every other menu in the stack does.
   */
  const MenuIcon = getIcon("Menu");
  const UserIcon = getIcon("User");
  const LogOutIcon = getIcon("LogOut");
  const SearchIcon = getIcon("Search");
  const StarIcon = getIcon("Star");

  // Shared by the desktop dropdown and the mobile drawer.
  const { logout, pending: loggingOut } = useLogout();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="no-print sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-lg">
      <Container size="wide" className="flex h-16 items-center gap-3">
        {/* Mobile menu */}
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="باز کردن منو">
              <MenuIcon size={22} />
            </Button>
          </DialogTrigger>
          <DialogContent size="sm" className="top-0 translate-y-0 rounded-b-2xl rounded-t-none sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
            <DialogHeader title="منوی اصلی" description="به هر بخش سریع دسترسی داشته باشید." />
            <nav className="flex flex-col gap-1" aria-label="ناوبری موبایل">
              {[...NAV_LINKS, ...SECONDARY_LINKS].map((link) => {
                const Icon = getIcon(link.icon);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                      isActive(link.href) ? "bg-primary-soft text-primary" : "hover:bg-muted",
                    )}
                  >
                    <Icon size={21} aria-hidden="true" />
                    {link.label}
                    {link.href === "/bookmarks" && bookmarkCount > 0 ? (
                      <span className="ms-auto rounded-full bg-muted px-2 text-xs tabular-nums">
                        {toPersianDigits(bookmarkCount)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 border-t border-border pt-4">
              {user ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">وارد شده به عنوان </span>
                    <span className="font-bold">{user.name}</span>
                  </p>
                  <ButtonLink href="/profile" onClick={() => setMenuOpen(false)}>
                    پروفایل و داشبورد
                  </ButtonLink>
                  <ButtonLink href="/settings" variant="outline" onClick={() => setMenuOpen(false)}>
                    تنظیمات حساب
                  </ButtonLink>
                  {user.role === "ADMIN" ? (
                    <ButtonLink href="/admin" variant="soft" onClick={() => setMenuOpen(false)}>
                      پنل مدیریت
                    </ButtonLink>
                  ) : null}
                  {/*
                    Logout was only reachable from the desktop dropdown, so a
                    signed-in learner on a phone had no way to sign out at all.
                    Like the desktop item, it must not rely on a form submit:
                    the drawer unmounts on select and would cancel it.
                  */}
                  <button
                    type="button"
                    disabled={loggingOut}
                    onClick={() => void logout()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
                  >
                    <LogOutIcon size={18} aria-hidden="true" />
                    {loggingOut ? "در حال خروج…" : "خروج از حساب"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <ButtonLink href="/login" onClick={() => setMenuOpen(false)}>
                    ورود / ثبت‌نام
                  </ButtonLink>
                  <p className="text-xs text-muted-foreground">
                    با حساب کاربری، پیشرفت شما ذخیره می‌شود.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Brand */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={siteName}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-supplied arbitrary URL
            <img src={logoUrl} alt="" className="size-9 rounded-xl object-cover" />
          ) : (
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BrandGlyph />
            </span>
          )}
          <span className="hidden text-sm font-bold sm:block">{siteName}</span>
        </Link>

        {/* Desktop navigation */}
        <nav className="ms-2 hidden items-center gap-0.5 lg:flex" aria-label="ناوبری اصلی">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive(link.href) ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Search: a magnifier that opens a centred modal, so it never competes
            with the navigation for space and works the same on every screen. */}
        <div className="ms-auto flex items-center gap-1">
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="جستجو در دوره‌ها" className="shrink-0">
                <SearchIcon size={21} />
              </Button>
            </DialogTrigger>
            <DialogContent
              aria-describedby={undefined}
              size="lg"
              /*
               * A command palette rather than a centred box: anchored near the
               * top of the screen and sized by its results, so it grows and
               * shrinks with what is typed instead of sitting at a fixed height.
               */
              className="top-[9vh] max-h-[82dvh] -translate-y-0 rounded-3xl shadow-[var(--shadow-raised)]"
            >
              <DialogHeader
                title="جستجو در دوره"
                description="موضوع، نام نرم‌افزار یا بخشی از یک درس را بنویسید."
              />
              <SearchBox
                inline
                popularSearches={popularSearches}
                autoFocus
                onNavigate={() => setSearchOpen(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Favourites as an icon, with a count badge */}
          <Link
            href="/bookmarks"
            aria-label={bookmarkCount > 0 ? `علاقه‌مندی‌ها (${bookmarkCount})` : "علاقه‌مندی‌ها"}
            className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <StarIcon size={20} aria-hidden="true" />
            {bookmarkCount > 0 ? (
              <span className="absolute -end-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold text-foreground tabular-nums">
                {toPersianDigits(bookmarkCount)}
              </span>
            ) : null}
          </Link>
        </div>

        {/* Progress: label + state + bar + value. The previous version was a
            10px bare percentage with an unlabelled bar, which was unreadable at
            a glance and gave no sense of what was complete. */}
        {user ? (
          <Link
            href="/progress"
            aria-label={`پیشرفت دوره: ${formatPercent(progressPercent)}`}
            className="hidden shrink-0 items-center gap-2.5 rounded-xl border border-border px-3.5 py-2 transition-colors hover:bg-muted xl:flex"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-xs font-bold text-primary tabular-nums">
              {formatPercent(progressPercent)}
            </span>
            <span className="flex w-32 flex-col gap-1">
              <span className="flex items-center justify-between text-[0.6875rem] leading-none">
                <span className="font-medium text-foreground">پیشرفت دوره</span>
                <span className="text-muted-foreground">
                  {progressPercent >= 100
                    ? "تکمیل شده"
                    : progressPercent > 0
                      ? "در حال یادگیری"
                      : "شروع نشده"}
                </span>
              </span>
              <Progress value={progressPercent} tone={progressPercent >= 100 ? "success" : "primary"} />
            </span>
          </Link>
        ) : null}

        {/* Theme */}
        <ThemeMenu />

        {/* Account — click to open, exactly like the theme menu */}
        {user ? (
          <div>
            <DropdownMenu open={accountOpen} onOpenChange={setAccountOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-sm font-bold transition-colors hover:bg-muted"
                  aria-label="حساب کاربری"
                >
                  {user.name.trim().charAt(0) || <UserIcon size={18} />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-60 text-start">
                <DropdownMenuLabel>
                  <span className="block font-bold text-foreground">{user.name}</span>
                  <span className="block text-[0.6875rem]">{user.email}</span>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />
                <DropdownMenuItem icon="LayoutDashboard" asChild>
                  <Link href="/profile">پروفایل و داشبورد</Link>
                </DropdownMenuItem>
                <DropdownMenuItem icon="TrendingUp" asChild>
                  <Link href="/progress">پیشرفت من</Link>
                </DropdownMenuItem>
                <DropdownMenuItem icon="Star" asChild>
                  <Link href="/bookmarks">علاقه‌مندی‌ها</Link>
                </DropdownMenuItem>
                <DropdownMenuItem icon="Award" asChild>
                  <Link href="/certificate">گواهی پایان دوره</Link>
                </DropdownMenuItem>
                <DropdownMenuItem icon="Settings" asChild>
                  <Link href="/settings">تنظیمات حساب</Link>
                </DropdownMenuItem>

                {/* Administrators get the whole panel as a list, so any section is
                    one hover away rather than two page loads. */}
                {user.role === "ADMIN" ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>
                      <span className="block text-[0.6875rem] font-bold text-muted-foreground">
                        پنل مدیریت
                      </span>
                    </DropdownMenuLabel>
                    {ADMIN_LINKS.map((link) => (
                      <DropdownMenuItem key={link.href} icon={link.icon} asChild>
                        <Link href={link.href}>{link.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}

                <DropdownMenuSeparator />
                {/* onSelect fires before Radix unmounts the menu, and
                    preventDefault keeps it mounted while the request runs. */}
                <DropdownMenuItem
                  icon="LogOut"
                  onSelect={(event) => {
                    event.preventDefault();
                    void logout();
                  }}
                >
                  {loggingOut ? "در حال خروج…" : "خروج از حساب"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <ButtonLink href="/login" size="sm" className="shrink-0">
            ورود
          </ButtonLink>
        )}
      </Container>

      {/*
        The old mobile search row is gone: the magnifier button now opens the
        same centred search modal at every screen size, so an inline field here
        was a second, inconsistent way to do the same job.
      */}
    </header>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="تغییر حالت نمایش">
          <ThemeGlyph theme={theme} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>حالت نمایش</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            icon={option.icon}
            onSelect={() => setTheme(option.value)}
            className={cn(theme === option.value && "bg-muted font-bold")}
          >
            {option.label}
            {theme === option.value ? <CheckGlyph /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeGlyph({ theme }: { theme: ThemeChoice }) {
  const Icon = getIcon(theme === "dark" ? "Moon" : theme === "light" ? "Sun" : "Monitor");
  return <Icon size={21} aria-hidden="true" />;
}

function CheckGlyph() {
  const Icon = getIcon("Check");
  return <Icon size={17} className="ms-auto text-primary" aria-hidden="true" />;
}

function BrandGlyph() {
  const Icon = getIcon("GraduationCap");
  return <Icon size={22} aria-hidden="true" />;
}
