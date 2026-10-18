import { CourseSidebar, type SidebarProgress } from "@/components/layout/course-sidebar";
import { MobileCourseNav } from "@/components/layout/mobile-course-nav";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourseTree } from "@/services/course-service";
import { getLessonProgressMap, getModuleProgress } from "@/services/progress-service";

/**
 * Two-column course layout with persistent navigation.
 *
 * Implemented as a server component that each course page composes, rather than
 * a route layout, so the sidebar can highlight the active lesson — information
 * a layout cannot see.
 */
export async function CourseShell({
  children,
  activeLessonSlug,
}: {
  children: React.ReactNode;
  activeLessonSlug?: string;
}) {
  const user = await getCurrentUser();

  const [modules, progressMap, moduleProgress] = await Promise.all([
    getCourseTree(),
    user ? getLessonProgressMap(user.id) : Promise.resolve(new Map()),
    user ? getModuleProgress(user.id) : Promise.resolve([]),
  ]);

  const progress: SidebarProgress = {};
  for (const [lessonId, value] of progressMap) {
    progress[lessonId] = { status: value.status, percent: value.percent };
  }

  const modulePercent: Record<string, number> = {};
  for (const item of moduleProgress) {
    modulePercent[item.moduleSlug] = item.percent;
  }

  return (
    /*
     * The reading column is capped at a comfortable measure and centred in the
     * space left beside the sidebar. Without the cap, lines run several hundred
     * characters wide on a laptop and the lesson becomes hard to follow; on
     * small screens the gutter keeps text off the screen edge.
     */
    <Container size="wide" className="flex gap-6 py-5 sm:py-6 lg:py-8">
      <aside className="no-print sticky top-20 hidden h-[calc(100dvh-6rem)] w-64 shrink-0 overflow-y-auto pb-6 lg:block xl:w-72">
        <CourseSidebar
          modules={modules}
          activeLessonSlug={activeLessonSlug}
          progress={progress}
          modulePercent={modulePercent}
        />
      </aside>

      <div className="min-w-0 flex-1 pb-16 lg:pb-20">
        <div className="lg:hidden">
          <MobileCourseNav
            modules={modules}
            activeLessonSlug={activeLessonSlug}
            progress={progress}
            modulePercent={modulePercent}
          />
        </div>
        <div className="mx-auto w-full max-w-[46rem] lg:mx-0">{children}</div>
      </div>
    </Container>
  );
}
