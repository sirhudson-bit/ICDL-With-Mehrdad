import Link from "next/link";
import { redirect } from "next/navigation";

import { getIcon } from "@/components/icon";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/services/settings-service";

/**
 * Focused layout for the authentication pages.
 *
 * Intentionally minimal — no site navigation — so a first-time visitor is not
 * distracted from the single action on the page.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const settings = await getSettings("site");
  const Logo = getIcon("GraduationCap");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-center p-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Logo size={20} aria-hidden="true" />
          </span>
          <span className="font-bold">{settings.name}</span>
        </Link>
      </header>

      <main id="main-content" className="flex flex-1 items-start justify-center px-4 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
