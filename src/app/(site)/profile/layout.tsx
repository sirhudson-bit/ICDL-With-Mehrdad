import type { Metadata } from "next";

import { ProfileNav } from "@/components/profile/profile-nav";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "پروفایل من",
  robots: { index: false, follow: false },
};

/**
 * Account area shell.
 *
 * The layout owns the container and the sub-navigation so every learner page
 * shares one spine; the pages below it render only their own content.
 */
export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/login?next=/profile");

  return (
    <Container size="default" className="py-8 sm:py-10">
      <ProfileNav />
      <div className="mt-6">{children}</div>
    </Container>
  );
}
