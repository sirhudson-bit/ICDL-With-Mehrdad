import { getIcon } from "@/components/icon";
import { formatDuration, formatPercent, formatPersianDate, toPersianDigits } from "@/lib/persian";

/**
 * The certificate document.
 *
 * Extracted so the real certificate and the sample preview cannot drift apart:
 * the sample is the same markup with invented values, a watermark and no
 * verification code, rather than a second hand-written copy of the layout.
 */

export type CertificateDocumentData = {
  code: string;
  studentName: string;
  courseTitle: string;
  lessonsCompleted: number;
  quizzesPassed: number;
  averageScore: number;
  totalMinutes: number;
  issuedAt: Date;
};

export function CertificateDocument({
  data,
  siteName,
  siteTagline,
  verifyUrl,
  sample = false,
}: {
  data: CertificateDocumentData;
  siteName: string;
  siteTagline: string;
  verifyUrl: string;
  sample?: boolean;
}) {
  const AwardIcon = getIcon("Award");

  return (
    <article className="certificate-sheet relative overflow-hidden rounded-3xl border-2 border-primary/30 bg-card p-6 shadow-[var(--shadow-raised)] sm:p-10">
      {sample ? (
        <>
          {/* A sample must never be mistakable for the real, verifiable document. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="-rotate-12 text-6xl font-black tracking-[0.2em] text-primary/10 sm:text-8xl">
              نمونه
            </span>
          </span>
          <span className="absolute end-4 top-4 rounded-full border border-warning/40 bg-warning-soft px-3 py-1 text-[0.6875rem] font-bold text-warning">
            نمونه — قابل استعلام نیست
          </span>
        </>
      ) : null}

      <header className="relative flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <AwardIcon size={26} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold">{siteName}</p>
            <p className="text-xs text-muted-foreground">{siteTagline}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">شماره گواهی: {data.code}</p>
      </header>

      <div className="relative py-8 text-center">
        <p className="text-xs tracking-wide text-muted-foreground">گواهی پایان دوره</p>
        <h2 className="mt-3 text-xl font-bold sm:text-2xl">{data.courseTitle}</h2>

        <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
          این گواهی به‌این‌پاس که
        </p>
        <p className="mt-2 text-2xl font-bold sm:text-3xl">{data.studentName}</p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          تمام درس‌های این دوره را با موفقیت به پایان رسانده و در همه آزمون‌های آن قبول شده است، صادر
          می‌شود.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-4 text-start sm:grid-cols-4">
          {[
            { label: "درس‌های تکمیل‌شده", value: toPersianDigits(data.lessonsCompleted) },
            { label: "آزمون‌های قبول‌شده", value: toPersianDigits(data.quizzesPassed) },
            { label: "میانگین نمره", value: formatPercent(data.averageScore) },
            { label: "زمان یادگیری", value: formatDuration(data.totalMinutes) },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-card-muted p-3.5">
              <dt className="text-[0.6875rem] text-muted-foreground">{item.label}</dt>
              <dd className="mt-0.5 text-base font-bold">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <footer className="relative flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-[0.6875rem] text-muted-foreground">تاریخ صدور</p>
          <p className="text-sm font-bold">{formatPersianDate(data.issuedAt)}</p>
        </div>

        <div className="text-center">
          <p className="text-[0.6875rem] text-muted-foreground">امضای مدرس</p>
          <p className="mt-1 font-bold">{siteName}</p>
        </div>

        <div className="text-end">
          <p className="text-[0.6875rem] text-muted-foreground">استعلام گواهی</p>
          {sample ? (
            <p className="text-[0.6875rem] text-muted-foreground">
              گواهی واقعی دارای کد استعلام یکتا است.
            </p>
          ) : (
            <p dir="ltr" className="text-[0.6875rem] font-medium">
              {verifyUrl}
            </p>
          )}
        </div>
      </footer>
    </article>
  );
}
