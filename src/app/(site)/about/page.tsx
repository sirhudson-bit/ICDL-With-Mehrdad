import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { DonateButton } from "@/components/fx/donate-button";
import { Reveal } from "@/components/fx/reveal";
import { Badge, ButtonLink, Card, CardContent, SectionHeading } from "@/components/ui/primitives";
import { Container } from "@/components/ui/container";
import { toPersianDigits } from "@/lib/persian";
import { getCourseStats } from "@/services/course-service";
import { getAllSettings } from "@/services/settings-service";

export const metadata: Metadata = {
  title: "درباره من و تیم توسعه",
  description:
    "درباره پروژه ICDL With Mehrdad و تیمی که آن را می‌سازد: چه کسی محتوا را می‌نویسد، پلتفرم را توسعه می‌دهد و به یادگیرندگان پاسخ می‌دهد.",
  alternates: { canonical: "/about" },
};

/**
 * About the project and its team.
 *
 * This is a page about the people behind the platform — it is deliberately not
 * the visitor's own profile. The account area lives under /profile; the header
 * nav points here.
 */
export default async function AboutPage() {
  const [settings, stats] = await Promise.all([getAllSettings(), getCourseStats()]);

  const AwardIcon = getIcon("Award");
  const LifeBuoyIcon = getIcon("HelpCircle");
  const SparkIcon = getIcon("Sparkles");

  // The credit line is authored in settings (e.g. "Designed with love by …"),
  // so the name is taken from it rather than duplicated here.
  const creditName = /by\s+(.+)$/i.exec(settings.navigation.creditText)?.[1]?.trim();

  const TEAM = [
    {
      icon: "Users",
      role: "تدریس و طراحی آموزشی",
      name: creditName ?? settings.site.name,
      description:
        "چیدن مسیر یادگیری، نوشتن متن درس‌ها، ساختن تمرین‌های عملی و طراحی آزمون‌ها به‌گونه‌ای که برای یک کاربر مبتدی قابل فهم باشد.",
    },
    {
      icon: "Code",
      role: "طراحی و توسعه پلتفرم",
      name: settings.site.name,
      description:
        "ساخت و نگه‌داری این وب‌اپلیکیشن: صفحه درس‌ها، شبیه‌سازی‌های تعاملی، آزمون‌ها، پنل مدیریت و زیرساخت ارسال ایمیل و چت‌بات.",
    },
    {
      icon: "HelpCircle",
      role: "پشتیبانی یادگیرندگان",
      name: "تیم پاسخ‌گویی",
      description:
        "پاسخ دادن به پیام‌ها و درخواست‌ها، بررسی پیشنهادهای دوره جدید و رفع اشکال‌هایی که کاربران گزارش می‌کنند.",
    },
  ] as const;

  return (
    <Container size="default" className="py-8 sm:py-12">
      <header className="text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-3xl bg-primary-soft text-primary">
          <SparkIcon size={28} aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-xl font-bold sm:text-2xl">درباره من و تیم توسعه</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {settings.site.description}
        </p>
      </header>

      <Reveal className="mt-8">
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "ماژول آموزشی", value: toPersianDigits(stats.modules), icon: "BookOpen" },
            { label: "درس منتشرشده", value: toPersianDigits(stats.lessons), icon: "FileText" },
            { label: "پرسش آزمون", value: toPersianDigits(stats.questions), icon: "ClipboardCheck" },
          ].map((item) => {
            const Icon = getIcon(item.icon);
            return (
              <div key={item.label} className="stack-card flex items-center gap-4 p-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xl font-bold tabular-nums">{item.value}</span>
                  <span className="block text-xs text-muted-foreground">{item.label}</span>
                </span>
              </div>
            );
          })}
        </section>
      </Reveal>

      <Reveal className="mt-10">
        <SectionHeading
          title="تیم توسعه"
          description="سه نقش اصلی که این پلتفرم را سرپا نگه می‌دارد."
        />
      </Reveal>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        {TEAM.map((member, index) => {
          const Icon = getIcon(member.icon);
          return (
            <Reveal key={member.role} delayMs={index * 70}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col p-5 pt-5">
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-bold">{member.name}</p>
                  <Badge tone="outline" size="sm" className="mt-1 self-start">
                    {member.role}
                  </Badge>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{member.description}</p>
                </CardContent>
              </Card>
            </Reveal>
          );
        })}
      </section>

      <Reveal className="mt-10">
        <Card className="border-primary/25 bg-primary-soft/30">
          <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <AwardIcon size={19} className="text-primary" aria-hidden="true" />
              هدف این پروژه
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {settings.course.description}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {settings.navigation.footerAbout}
            </p>
            <p className="mt-4 text-[0.6875rem] text-subtle-foreground">{settings.navigation.creditText}</p>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal className="mt-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <ButtonLink href="/contact">
            <LifeBuoyIcon size={17} aria-hidden="true" />
            تماس با من
          </ButtonLink>
          <ButtonLink href="/request-course" variant="outline">
            پیشنهاد دوره جدید
          </ButtonLink>
          <ButtonLink href="/course" variant="ghost">
            دیدن دوره‌ها
          </ButtonLink>
        </div>
      </Reveal>

      <Reveal className="mt-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <DonateButton label={settings.site.donateLabel} href={settings.site.donateUrl} />
          <p className="text-xs text-muted-foreground">
            این پلتفرم بدون تبلیغات اداره می‌شود؛ هر حمایتی صرف تولید درس‌های بعدی می‌شود.
          </p>
        </div>
      </Reveal>
    </Container>
  );
}
