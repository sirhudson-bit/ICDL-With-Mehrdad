import { getIcon } from "@/components/icon";
import { Badge, ButtonLink, Card, CardContent, EmptyState, SectionHeading } from "@/components/ui/primitives";
import { formatPersianDate, formatPercent, toPersianDigits } from "@/lib/persian";
import { listCertificates } from "@/services/certificate-service";
import { getCourseStats } from "@/services/course-service";

export const metadata = {
  title: "گواهی‌های صادرشده",
  robots: { index: false, follow: false },
};

/**
 * Issued certificates.
 *
 * Read-only oversight: the list shows who holds a certificate, when it was
 * issued and how it scored, plus a link to the public verification page so an
 * admin can confirm what a third party would see.
 */
export default async function AdminCertificatesPage() {
  const [certificates, stats] = await Promise.all([listCertificates(), getCourseStats()]);

  const AwardIcon = getIcon("Award");
  const active = certificates.filter((certificate) => !certificate.revokedAt);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <AwardIcon size={21} aria-hidden="true" />
            گواهی‌های صادرشده
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {toPersianDigits(active.length)} گواهی فعال از {toPersianDigits(certificates.length)} گواهی صادرشده.
            گواهی پس از تکمیل همه {toPersianDigits(stats.lessons)} درس و قبولی در همه آزمون‌ها صادر می‌شود.
          </p>
        </div>
        <ButtonLink href="/certificate/sample" variant="outline" size="sm">
          دیدن نمونه گواهی
        </ButtonLink>
      </header>

      {certificates.length === 0 ? (
        <EmptyState
          icon="Award"
          title="هنوز گواهی‌ای صادر نشده است"
          description="با تکمیل درس‌ها و قبولی در آزمون‌ها توسط کاربران، گواهی‌ها به‌صورت خودکار صادر و در این فهرست نمایش داده می‌شوند."
        />
      ) : (
        <Card>
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
            <SectionHeading
              title="فهرست گواهی‌ها"
              description="برای مشاهده آنچه یک استعلام‌کننده می‌بیند، روی «استعلام» بزنید."
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-card-muted">
                    {["شماره گواهی", "دارنده", "میانگین", "تاریخ صدور", "وضعیت", ""].map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="border-b border-border px-3 py-2 text-start text-xs font-bold text-muted-foreground"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((certificate) => (
                    <tr key={certificate.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2.5">
                        <span dir="ltr" className="font-mono text-xs font-bold">
                          {certificate.code}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block text-xs font-medium">{certificate.studentName}</span>
                        <span dir="ltr" className="block text-[0.6875rem] text-subtle-foreground">
                          {certificate.user.email}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{formatPercent(certificate.averageScore)}</td>
                      <td className="px-3 py-2.5 text-xs">{formatPersianDate(certificate.issuedAt)}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={certificate.revokedAt ? "danger" : "success"} size="sm">
                          {certificate.revokedAt ? "باطل‌شده" : "معتبر"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <ButtonLink
                          href={`/certificate/verify?code=${certificate.code}`}
                          variant="ghost"
                          size="sm"
                          target="_blank"
                        >
                          استعلام
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
