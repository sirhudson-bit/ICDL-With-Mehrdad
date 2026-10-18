import Link from "next/link";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { CertificateDocument } from "@/components/certificate/certificate-document";
import { ClaimCertificateButton } from "@/components/learner/progress-actions";
import { PrintButton } from "@/components/ui/print-button";
import { Badge, ButtonLink, Card, CardContent, Progress } from "@/components/ui/primitives";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { formatDuration, formatPercent, toPersianDigits } from "@/lib/persian";
import { getEligibility, getUserCertificate } from "@/services/certificate-service";
import { getAllSettings } from "@/services/settings-service";

export const metadata: Metadata = {
  title: "گواهی پایان دوره",
  description: "گواهی پایان دوره ICDL — قابل چاپ و قابل استعلام.",
  robots: { index: false, follow: false },
};

/**
 * Certificate page.
 *
 * Before the requirements are met it shows exactly what is outstanding; once
 * they are, it renders the certificate itself. The certificate block is the
 * only part that prints — everything else on the page is marked `no-print`.
 */
export default async function CertificatePage() {
  const user = await requireUser("/login?next=/certificate");

  const [settings, eligibility, certificate] = await Promise.all([
    getAllSettings(),
    getEligibility(user.id),
    getUserCertificate(user.id),
  ]);

  const AwardIcon = getIcon("Award");
  const ShieldIcon = getIcon("ShieldCheck");
  const verifyUrl = `${publicEnv.siteUrl}/certificate/verify?code=${certificate?.code ?? ""}`;

  return (
    <Container size="default" className="py-8 sm:py-10">
      <header className="no-print mb-6">
        <h1 className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <AwardIcon size={22} aria-hidden="true" />
          </span>
          گواهی پایان دوره
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          گواهی پس از تکمیل همه درس‌های دوره و موفقیت در همه آزمون‌ها صادر می‌شود. گواهی قابل چاپ است و
          هر کسی می‌تواند با کد استعلام، صحت آن را بررسی کند.
        </p>
      </header>

      {/* ── Not yet eligible ─────────────────────────────── */}
      {!certificate ? (
        <div className="no-print space-y-5">
          <Card>
            <CardContent className="p-5 pt-5">
              <h2 className="text-sm font-bold sm:text-base">وضعیت شما تا دریافت گواهی</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card-muted p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">درس‌های تکمیل‌شده</span>
                    <span className="font-bold tabular-nums">
                      {toPersianDigits(eligibility.completedLessons)} / {toPersianDigits(eligibility.totalLessons)}
                    </span>
                  </div>
                  <Progress
                    className="mt-2.5"
                    value={
                      eligibility.totalLessons === 0
                        ? 0
                        : (eligibility.completedLessons / eligibility.totalLessons) * 100
                    }
                    tone="primary"
                  />
                </div>

                <div className="rounded-2xl border border-border bg-card-muted p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">آزمون‌های گذرانده‌شده</span>
                    <span className="font-bold tabular-nums">
                      {toPersianDigits(eligibility.passedQuizzes)} / {toPersianDigits(eligibility.totalQuizzes)}
                    </span>
                  </div>
                  <Progress
                    className="mt-2.5"
                    value={
                      eligibility.totalQuizzes === 0
                        ? 0
                        : (eligibility.passedQuizzes / eligibility.totalQuizzes) * 100
                    }
                    tone="success"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Badge tone="outline">میانگین نمره: {formatPercent(eligibility.averageScore)}</Badge>
                <Badge tone="outline">
                  زمان یادگیری: {formatDuration(eligibility.totalMinutes)}
                </Badge>
              </div>

              {eligibility.blockers.length > 0 ? (
                <div className="mt-4 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-3">
                  <p className="text-sm font-bold text-warning">برای دریافت گواهی این موارد باقی مانده است:</p>
                  <ul className="mt-1.5 flex flex-col gap-1 text-xs leading-relaxed text-foreground">
                    {eligibility.blockers.map((blocker) => (
                      <li key={blocker}>• {blocker}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <ClaimCertificateButton eligible={eligibility.eligible} />
                <ButtonLink href="/certificate/sample" variant="outline">
                  دیدن نمونه گواهی
                </ButtonLink>
                <ButtonLink href="/course" variant="ghost">
                  ادامه درس‌ها
                </ButtonLink>
                <ButtonLink href="/progress" variant="ghost">
                  مشاهده پیشرفت
                </ButtonLink>
              </div>
            </CardContent>
          </Card>

          {eligibility.eligible ? null : (
            <p className="text-center text-xs text-subtle-foreground">
              پس از گذراندن آخرین آزمون، گواهی به‌صورت خودکار صادر می‌شود.
            </p>
          )}
        </div>
      ) : null}

      {/* ── The certificate ──────────────────────────────── */}
      {certificate ? (
        <>
          <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
            <Badge tone="success" size="lg">
              <ShieldIcon size={16} aria-hidden="true" />
              گواهی شما صادر شده است
            </Badge>
            <div className="flex flex-wrap items-center gap-2">
              <PrintButton label="چاپ یا ذخیره PDF" variant="primary" />
              <ButtonLink href={`/certificate/verify?code=${certificate.code}`} variant="outline">
                استعلام گواهی
              </ButtonLink>
            </div>
          </div>

          <CertificateDocument
            siteName={settings.site.name}
            siteTagline={settings.site.tagline}
            verifyUrl={verifyUrl}
            data={{
              code: certificate.code,
              studentName: certificate.studentName,
              courseTitle: certificate.courseTitle,
              lessonsCompleted: certificate.lessonsCompleted,
              quizzesPassed: certificate.quizzesPassed,
              averageScore: certificate.averageScore,
              totalMinutes: certificate.totalMinutes,
              issuedAt: certificate.issuedAt,
            }}
          />

          <p className="no-print mt-4 text-center text-xs text-subtle-foreground">
            برای دریافت فایل PDF، دکمه «چاپ یا ذخیره PDF» را بزنید و در پنجره چاپ، گزینه «Save as PDF» را
            انتخاب کنید.
          </p>
        </>
      ) : null}

      <p className="no-print mt-8 text-center text-xs text-subtle-foreground">
        کد گواهی خود را گم کرده‌اید؟{" "}
        <Link href="/certificate/verify" className="text-primary hover:underline">
          صفحه استعلام گواهی
        </Link>
      </p>
    </Container>
  );
}
