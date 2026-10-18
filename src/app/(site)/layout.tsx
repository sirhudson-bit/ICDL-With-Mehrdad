import { GlobalChat } from "@/components/chat/global-chat";
import { BackToTop } from "@/components/fx/back-to-top";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth/session";
import { countBookmarks } from "@/services/bookmark-service";
import { getCourseProgress, getModuleProgress } from "@/services/progress-service";
import { getAllSettings } from "@/services/settings-service";

/**
 * Learner-facing chrome.
 *
 * The header, footer and assistant are driven by the settings store so the
 * administrator can rebrand and reconfigure the platform without touching code.
 * The main region reserves space at the bottom on small screens so the fixed
 * mobile tab bar never covers the last line of content.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([getCurrentUser(), getAllSettings()]);

  const [courseProgress, moduleProgress, bookmarkCount] = await Promise.all([
    user ? getCourseProgress(user.id) : Promise.resolve(null),
    user ? getModuleProgress(user.id) : Promise.resolve([]),
    user ? countBookmarks(user.id) : Promise.resolve(0),
  ]);

  const modulePercent: Record<string, number> = {};
  for (const item of moduleProgress) modulePercent[item.moduleSlug] = item.percent;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        user={user}
        siteName={settings.site.name}
        logoUrl={settings.site.logoUrl}
        popularSearches={settings.search.popularQueries}
        progressPercent={courseProgress?.percent ?? 0}
        bookmarkCount={bookmarkCount}
      />

      <main id="main-content" className="flex-1 pb-20 lg:pb-0">
        {children}
      </main>

      <SiteFooter site={settings.site} navigation={settings.navigation} />

      <MobileTabBar isAuthenticated={Boolean(user)} />

      <BackToTop />

      {/* Runs once per browser; the help page can replay it. */}
      <OnboardingTour />

      {settings.chatbot.enabled ? (
        <GlobalChat quickActions={settings.chatbot.quickActions} isAuthenticated={Boolean(user)} />
      ) : null}
    </div>
  );
}
