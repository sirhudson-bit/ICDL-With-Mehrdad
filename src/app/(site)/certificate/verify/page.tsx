import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { Alert, Badge, ButtonLink, Card, CardContent } from "@/components/ui/primitives";
import { Container } from "@/components/ui/container";
import { formatDuration, formatPercent, formatPersianDate, toPersianDigits } from "@/lib/persian";
import { RATE_LIMITS, checkRateLimit, clientKey } from "@/lib/rate-limit";
import { verifyCertificate } from "@/services/certificate-service";
import { getAllSettings } from "@/services/settings-service";

type VerifyPageProps = { searchParams: Promise<{ code?: string }> };

export async function generateMetadata({ searchParams }: VerifyPageProps): Promise<Metadata> {
  const { code } = await searchParams;
  return {
    title: code ? `استعلام گواهی ${code}` : "استعلام گواهی",
    description:
      "صحت گواهی صادرشده از سوی این پلتفرم را با وارد کردن شماره گواهی بررسی کنید. این صفحه برای همه آزاد است.",
    robots: { index: true, follow: true },
    alternates: { canonical: "/certificate/verify" },
  };
}

/**
 * Public certificate verification.
 *
 * Deliberately open to everyone — the point of a verification page is that a
 * third party (an employer, say) can check a certificate without an account.
 * It therefore reveals only what is printed on the certificate and never links
 * to the holder's account.
 */
export default async function VerifyCertificatePage({ searchParams }: VerifyPageProps) {
  const { code = "" } = await searchParams;
  const settings = await getAllSettings();

  // Certificate codes are short enough to guess at speed, and a hit reveals the
  // holder's name, so lookups are capped per client.
  const limit = checkRateLimit({
    key: `cert-verify:${clientKey(await headers(), "anonymous")}`,
    ...RATE_LIMITS.certificateVerify,
  });

  const certificate = code.trim() && limit.allowed ? await verifyCertificate(code) : null;
  const searched = code.trim().length > 0;

  const ShieldIcon = getIcon("ShieldCheck");
  const WarnIcon = getIcon("TriangleAlert");
  const SearchIcon = getIcon("Search");

  return (
    <Container size="default" className="py-8 sm:py-12">
      <header className="text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-3xl bg-primary-soft text-primary">
          <ShieldIcon size={28} aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-xl font-bold sm:text-2xl">استعلام گواهی</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          شماره گواهی را وارد کنید تا از صحت آن مطمئن شوید. این صفحه برای همه آزاد است و شماره گواهی روی
          خود گواهی چاپ شده است.
        </p>
      </header>

      {/* Verification form */}
      <form
        method="get"
        action="/certificate/verify"
        className="no-print mx-auto mt-6 flex max-w-lg flex-wrap items-end gap-3"
        role="search"
      >
        <label htmlFor="code" className="sr-only">
          شماره گواهی
        </label>
        <div className="relative min-w-52 flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-muted-foreground">
            <SearchIcon size={19} aria-hidden="true" />
          </span>
          <input
            id="code"
            name="code"
            defaultValue={code}
            dir="ltr"
            required
            placeholder="ICDL-XXXX-XXXXXX"
            className="h-12 w-full rounded-2xl border border-border bg-card ps-11 pe-4 text-sm outline-none focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-[var(--primary-ring)]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-12 items-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          بررسی گواهی
        </button>
      </form>

      {/* Result */}
      {!limit.allowed ? (
        <div className="no-print mt-8">
          <Alert tone="danger" title="تعداد استعلام‌ها زیاد بوده است">
            برای جلوگیری از حدس‌زدن شماره گواهی‌ها، تعداد بررسی‌ها محدود شده است. چند دقیقه بعد دوباره
            تلاش کنید.
          </Alert>
        </div>
      ) : searched ? (
        <div className="mt-8">
          {certificate ? (
            certificate.revokedAt ? (
              <Alert tone="danger" title="این گواهی باطل شده است">
                گواهی با شماره <span dir="ltr" className="font-mono">{certificate.code}</span> توسط مدیر
                سیستم باطل شده است
                {certificate.revokeReason ? ` (دلیل: ${certificate.revokeReason})` : ""}. برای اطلاعات
                بیشتر با پشتیبانی تماس بگیرید.
              </Alert>
            ) : (
              <Card className="mx-auto max-w-2xl border-success/30">
                <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge tone="success" size="lg">
                      <ShieldIcon size={16} aria-hidden="true" />
                      گواهی معتبر است
                    </Badge>
                    <span className="text-xs text-muted-foreground">صادرشده توسط {settings.site.name}</span>
                  </div>

                  <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Detail label="نام دارنده گواهی" value={certificate.studentName} />
                    <Detail label="شماره گواهی" value={certificate.code} mono />
                    <Detail label="دوره" value={certificate.courseTitle} />
                    <Detail label="تاریخ صدور" value={formatPersianDate(certificate.issuedAt)} />
                    <Detail
                      label="درس‌های تکمیل‌شده"
                      value={toPersianDigits(certificate.lessonsCompleted)}
                    />
                    <Detail
                      label="آزمون‌های قبول‌شده"
                      value={toPersianDigits(certificate.quizzesPassed)}
                    />
                    <Detail label="میانگین نمره" value={formatPercent(certificate.averageScore)} />
                    <Detail label="زمان یادگیری" value={formatDuration(certificate.totalMinutes)} />
                  </dl>
                </CardContent>
              </Card>
            )
          ) : (
            <Card className="mx-auto max-w-2xl border-danger/30">
              <CardContent className="p-5 pt-5 text-center sm:p-6 sm:pt-6">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
                  <WarnIcon size={24} aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-bold">گواهی‌ای با این شماره پیدا نشد</p>
                <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                  شماره گواهی را دقیقاً همان‌طور که روی گواهی چاپ شده وارد کنید (با خط تیره‌ها). اگر شماره
                  را درست وارد کرده‌اید و باز هم پیدا نمی‌شود، ممکن است گواهی جعلی باشد.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="no-print mx-auto mt-8 max-w-2xl rounded-2xl border border-dashed border-border-strong bg-card px-5 py-6 text-center">
          <p className="text-sm font-medium">شماره گواهی را در کادر بالا وارد کنید.</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            اگر گواهی خود را دریافت کرده‌اید، می‌توانید از{" "}
            <Link href="/certificate" className="text-primary hover:underline">
              صفحه گواهی من
            </Link>{" "}
            آن را ببینید و چاپ کنید.
          </p>
          <div className="mt-4 flex justify-center">
            <ButtonLink href="/course" variant="outline" size="sm">
              دیدن فهرست دوره
            </ButtonLink>
          </div>
        </div>
      )}
    </Container>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card-muted p-3.5">
      <dt className="text-[0.6875rem] text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-0.5 font-mono text-sm font-bold" : "mt-0.5 text-sm font-bold"} dir={mono ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
