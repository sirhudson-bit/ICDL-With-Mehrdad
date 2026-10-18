import Link from "next/link";
import type { Metadata } from "next";

import { ContactTabs } from "@/components/forms/contact-tabs";
import { getIcon } from "@/components/icon";
import { DonateButton } from "@/components/fx/donate-button";
import { Reveal } from "@/components/fx/reveal";
import { Card, CardContent } from "@/components/ui/primitives";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/session";
import { toPersianDigits } from "@/lib/persian";
import { getAllSettings } from "@/services/settings-service";
import { getSupportContext } from "@/services/inbox-service";

export const metadata: Metadata = {
  title: "تماس با من",
  description:
    "برای پیشنهاد، انتقاد یا پرسش با ما در تماس باشید. شماره تماس ۰۹۱۰۸۱۷۶۹۳۷ و فرم پیام آنلاین.",
  alternates: { canonical: "/contact" },
};

/**
 * Contact page.
 *
 * Puts the phone number where it is impossible to miss, then offers the form for
 * anything that needs detail. The channels card also routes people to the two
 * places that answer most questions faster than a message does.
 */
export default async function ContactPage() {
  const [user, settings, support] = await Promise.all([
    getCurrentUser(),
    getAllSettings(),
    getSupportContext(),
  ]);

  const PhoneIcon = getIcon("Phone");
  const MailIcon = getIcon("Mail");
  const MessageIcon = getIcon("MessageSquare");
  const HelpIcon = getIcon("HelpCircle");
  const BookIcon = getIcon("BookOpen");

  const phone = "09108176937";
  // Iranian mobile numbers display grouped; the dial link stays machine-readable.
  const phoneDisplay = "۰۹۱۰۸۱۷۶۹۳۷";

  return (
    <Container size="default" className="py-8 sm:py-12">
      <header className="text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-3xl bg-primary-soft text-primary">
          <MessageIcon size={28} aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-xl font-bold sm:text-2xl">تماس با من</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          سؤال، پیشنهاد یا انتقادی دارید؟ خوشحال می‌شوم بشنوم. می‌توانید تماس بگیرید یا پیام خود را از
          فرم زیر بفرستید.
        </p>
      </header>

      <Reveal>
      {/* Contact channels */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <a
          href={`tel:${phone}`}
          className="stack-card flex items-center gap-4 p-4 transition-shadow hover:shadow-[var(--shadow-raised)]"
        >
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-success-soft text-success">
            <PhoneIcon size={24} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">تماس تلفنی</span>
            <span dir="ltr" className="block text-lg font-bold tracking-wide">
              {phoneDisplay}
            </span>
            <span className="mt-0.5 block text-[0.6875rem] text-subtle-foreground">
              پاسخ‌گویی در ساعات کاری
            </span>
          </span>
        </a>

        {settings.site.contactEmail ? (
          <a
            href={`mailto:${settings.site.contactEmail}`}
            className="stack-card flex items-center gap-4 p-4 transition-shadow hover:shadow-[var(--shadow-raised)]"
          >
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <MailIcon size={24} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">ایمیل</span>
              <span dir="ltr" className="block truncate text-sm font-bold">
                {settings.site.contactEmail}
              </span>
            </span>
          </a>
        ) : (
          <div className="stack-card flex items-center gap-4 p-4">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <MailIcon size={24} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">فرم پیام</span>
              <span className="block text-sm font-bold">از فرم همین صفحه استفاده کنید</span>
            </span>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Form */}
        <Card>
          <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
            <h2 className="text-base font-bold">پیام یا درخواست دوره</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              هر چه توضیح دقیق‌تر باشد، سریع‌تر می‌توانم کمک کنم. اگر درباره یک درس مشخص است، نام آن درس را
              هم بنویسید.
            </p>
            <div className="mt-5">
              <ContactTabs
                defaultName={user?.name}
                defaultEmail={user?.email}
                lockedName={Boolean(user)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Self-service */}
        <aside className="space-y-4">
          <Card>
            <CardContent className="p-5 pt-5">
              <h2 className="text-sm font-bold">شاید پاسخ سؤال شما همین‌جا باشد</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                بیشتر پرسش‌ها در {toPersianDigits(support.faqCount)} پرسش پرتکرار یا داخل خود درس‌ها پاسخ
                داده شده‌اند.
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                <li>
                  <Link
                    href="/help"
                    className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    <HelpIcon size={19} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    پرسش‌های پرتکرار
                  </Link>
                </li>
                <li>
                  <Link
                    href="/search"
                    className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    <BookIcon size={19} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    جستجو در {toPersianDigits(support.lessonCount)} درس دوره
                  </Link>
                </li>
                <li>
                  <Link
                    href="/request-course"
                    className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Icon name="Plus" />
                    </span>
                    درخواست ساخت دوره جدید
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 pt-5">
              <h2 className="text-sm font-bold">یادآوری</h2>
              <ul className="mt-2.5 flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>• برای پرسش درباره یک درس، از چت‌بات همان درس استفاده کنید؛ سریع‌ترین راه است.</li>
                <li>• برای پیگیری، ایمیل یا شماره‌ای را وارد کنید که در دسترس باشد.</li>
                <li>• اطلاعات شما فقط برای پاسخ دادن استفاده می‌شود.</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 pt-5 text-center">
              <p className="text-sm font-bold">از این پروژه حمایت می‌کنید؟</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                ساخت درس‌های بعدی زمان می‌برد. اگر دوست داشتید، یک قهوه مهمان من باشید.
              </p>
              <div className="mt-3 flex justify-center">
                <DonateButton label={settings.site.donateLabel} href={settings.site.donateUrl} />
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
      </Reveal>
    </Container>
  );
}

function Icon({ name }: { name: string }) {
  const Component = getIcon(name);
  return <Component size={15} aria-hidden="true" />;
}
