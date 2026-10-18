import Link from "next/link";

import { getIcon } from "@/components/icon";
import { DonateButton } from "@/components/fx/donate-button";
import { NewsletterForm } from "@/components/forms/newsletter-form";
import { Container } from "@/components/ui/container";
import { toPersianDigits } from "@/lib/persian";
import type { NavigationSettings, SiteSettings } from "@/lib/settings";

/**
 * Site footer.
 *
 * Everything here — links, copy, social entries and the credit line — comes from
 * the settings store, so the administrator can restructure it without code. The
 * layout is deliberately layered: a quick-access strip for the actions learners
 * repeat, then the navigation columns, then the copyright bar.
 */
export function SiteFooter({
  site,
  navigation,
}: {
  site: SiteSettings;
  navigation: NavigationSettings;
}) {
  const Logo = getIcon("GraduationCap");

  // Quick actions a learner reaches for repeatedly, kept out of the link list.
  const QUICK_LINKS = [
    { href: "/course", label: "فهرست دوره", icon: "BookOpen" },
    { href: "/search", label: "جستجو", icon: "Search" },
    { href: "/progress", label: "پیشرفت من", icon: "TrendingUp" },
    { href: "/certificate", label: "گواهی پایان دوره", icon: "Award" },
    { href: "/contact", label: "تماس با من", icon: "Phone" },
  ];

  const half = Math.ceil(navigation.footerLinks.length / 2);
  const linkColumns = [navigation.footerLinks.slice(0, half), navigation.footerLinks.slice(half)];

  return (
    <footer className="no-print relative mt-16 border-t border-border bg-card">
      {/* Decorative accent along the top edge */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-px h-px bg-gradient-to-l from-transparent via-primary/40 to-transparent"
      />

      {/* Quick access strip */}
      <div className="border-b border-border">
        <Container size="wide" className="py-5">
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {QUICK_LINKS.map((link) => {
              const Icon = getIcon(link.icon);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
                  >
                    <Icon size={17} aria-hidden="true" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </div>

      {/* Main footer */}
      <Container size="wide" className="grid gap-9 py-10 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        {/* Brand */}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Logo size={21} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{site.name}</span>
              <span className="block truncate text-[0.6875rem] text-subtle-foreground">{site.tagline}</span>
            </span>
          </div>

          <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground">{navigation.footerAbout}</p>

          {navigation.showSocials && navigation.socialLinks.length > 0 ? (
            <ul className="mt-4 flex flex-wrap items-center gap-2">
              {navigation.socialLinks.map((social) => {
                const Icon = getIcon(social.icon);
                return (
                  <li key={`${social.label}-${social.href}`}>
                    <a
                      href={social.href}
                      title={social.label}
                      aria-label={social.label}
                      className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-primary"
                    >
                      {social.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- administrator-uploaded SVG
                        <img src={social.iconUrl} alt="" className="size-5" />
                      ) : (
                        <Icon size={19} aria-hidden="true" />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {/* Links, split into two columns */}
        {linkColumns.map((column, index) => (
          <nav key={index} aria-label={index === 0 ? "دسترسی سریع" : "پیوندهای بیشتر"}>
            <h2 className="mb-3 text-sm font-bold">{index === 0 ? "دسترسی سریع" : "بیشتر"}</h2>
            <ul className="flex flex-col gap-2.5 text-sm">
              {column.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary"
                  >
                    <span aria-hidden="true" className="text-border-strong">
                      ‹
                    </span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* Newsletter + support. The old "about this course" blurb said nothing a
            visitor could act on; a signup they can use is worth the space. */}
        <div className="min-w-0">
          <h2 className="mb-3 text-sm font-bold">خبرنامه دوره</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            هر وقت درس یا تمرین تازه‌ای اضافه شود، یک ایمیل کوتاه برایتان می‌فرستیم.
          </p>
          <div className="mt-3">
            <NewsletterForm />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <DonateButton label={site.donateLabel} href={site.donateUrl} tone="inline" />
            {site.contactEmail ? (
              <a
                href={`mailto:${site.contactEmail}`}
                dir="ltr"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {site.contactEmail}
              </a>
            ) : null}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-subtle-foreground">{navigation.footerNote}</p>
        </div>
      </Container>

      {/* Copyright bar */}
      <div className="border-t border-border bg-card-muted/50">
        <Container
          size="wide"
          className="flex flex-col items-center gap-2 py-4 text-center text-xs text-subtle-foreground sm:flex-row sm:justify-between sm:text-start"
        >
          <p className="flex flex-wrap items-center justify-center gap-x-1.5">
            <span>{site.footerText}</span>
          </p>

          <p className="flex flex-wrap items-center justify-center gap-x-2">
            <span>© {toPersianDigits(new Date().getFullYear())}</span>
            <span aria-hidden="true" className="text-border-strong">
              •
            </span>
            {/* Credit line, editable from Admin → Settings → Navigation */}
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <span className="text-accent" aria-hidden="true">
                ♥
              </span>
              {navigation.creditText}
            </span>
          </p>
        </Container>
      </div>
    </footer>
  );
}
