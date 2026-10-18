import type { Metadata } from "next";

import { CertificateDocument } from "@/components/certificate/certificate-document";
import { getIcon } from "@/components/icon";
import { Alert, ButtonLink } from "@/components/ui/primitives";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/session";
import { getCertificateSampleStats } from "@/services/certificate-service";
import { getAllSettings } from "@/services/settings-service";

export const metadata: Metadata = {
  title: "نمونه گواهی پایان دوره",
  description: "نمونه‌ای از گواهی پایان دوره که پس از تکمیل همه درس‌ها و قبولی در همه آزمون‌ها صادر می‌شود.",
  robots: { index: false, follow: false },
};

/**
 * Certificate sample.
 *
 * Shows what a completed certificate looks like before it has been earned, using
 * the very same document component as the real one — so the preview cannot drift
 * from the real layout — but with placeholder values, a "نمونه" watermark and no
 * verification code, so it can never be mistaken for an issued certificate.
 */
export default async function CertificateSamplePage() {
  await requireUser("/login?next=/certificate/sample");

  const [settings, stats] = await Promise.all([getAllSettings(), getCertificateSampleStats()]);

  const AwardIcon = getIcon("Award");

  return (
    <Container size="default" className="py-8 sm:py-10">
      <header className="no-print mb-6">
        <h1 className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <AwardIcon size={22} aria-hidden="true" />
          </span>
          نمونه گواهی پایان دوره
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          این تصویری از گواهی واقعی است؛ همان گواهی پس از تکمیل همه درس‌های دوره و قبولی در همه آزمون‌ها به
          نام شما صادر می‌شود.
        </p>
      </header>

      <Alert tone="info" title="این یک نمونه است" className="no-print mb-5">
        اعداد و کد روی این صفحه نمادین هستند. گواهی واقعی شماره استعلام یکتا دارد و هر کسی می‌تواند صحت آن را
        در صفحه استعلام بررسی کند.
      </Alert>

      <CertificateDocument
        sample
        siteName={settings.site.name}
        siteTagline={settings.site.tagline}
        verifyUrl=""
        data={{
          code: "ICDL-XXXX-XXXXXX",
          studentName: "نام و نام خانوادگی شما",
          courseTitle: settings.course.title,
          lessonsCompleted: stats.lessons,
          quizzesPassed: stats.quizzes,
          averageScore: 100,
          totalMinutes: stats.totalMinutes,
          issuedAt: new Date(),
        }}
      />

      <div className="no-print mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/certificate" variant="primary">
          وضعیت گواهی من
        </ButtonLink>
        <ButtonLink href="/course" variant="outline">
          ادامه درس‌ها
        </ButtonLink>
      </div>
    </Container>
  );
}
