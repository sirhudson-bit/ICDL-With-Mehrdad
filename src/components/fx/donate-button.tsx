import { getIcon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { getSettings } from "@/services/settings-service";

/**
 * "Buy the admin a coffee" support button.
 *
 * Reads its label and destination from the site settings so the administrator
 * can rename it or point it somewhere else without a deploy; an empty URL hides
 * it entirely. Placed on the pages where someone is most likely to feel
 * generous: contact, about, the dashboard and the footer.
 */
export function DonateButton({
  label,
  href,
  className,
  tone = "solid",
}: {
  label: string;
  href: string;
  className?: string;
  /** "solid" is the standalone button; "inline" fits inside a text row. */
  tone?: "solid" | "inline";
}) {
  if (!href.trim()) return null;

  const CoffeeIcon = getIcon("Coffee");

  if (tone === "inline") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "group inline-flex items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-foreground",
          className,
        )}
      >
        <CoffeeIcon size={16} className="transition-transform duration-300 group-hover:-rotate-12" aria-hidden="true" />
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-foreground shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]",
        className,
      )}
    >
      <span className="inline-flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent transition-transform duration-300 group-hover:-rotate-12">
        <CoffeeIcon size={17} aria-hidden="true" />
      </span>
      {label}
    </a>
  );
}

/**
 * Same button, but it reads its own label and URL from the site settings — for
 * pages that do not already load them.
 */
export async function DonateButtonAuto({
  tone,
  className,
}: {
  tone?: "solid" | "inline";
  className?: string;
}) {
  const site = await getSettings("site");
  return <DonateButton label={site.donateLabel} href={site.donateUrl} tone={tone} className={className} />;
}
