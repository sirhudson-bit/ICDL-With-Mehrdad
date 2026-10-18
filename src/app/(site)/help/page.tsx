import Link from "next/link";
import type { Metadata } from "next";

import { SearchBox } from "@/components/search/search-box";
import { getIcon } from "@/components/icon";
import { TourStartButton } from "@/components/onboarding/tour-start-button";
import { Reveal } from "@/components/fx/reveal";
import { RichText } from "@/components/lesson/rich-text";
import { Alert, Badge, ButtonLink, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { serializeJsonLd } from "@/lib/json-ld";
import { richTextToPlain } from "@/lib/sanitize";
import { getGlobalFaqs } from "@/services/course-service";
import { getAllSettings } from "@/services/settings-service";
import { toPersianDigits } from "@/lib/persian";

export const metadata: Metadata = {
  title: "راهنما و پرسش‌های پرتکرار",
  description:
    "پاسخ پرسش‌های رایج درباره دوره ICDL، نحوه یادگیری، پیشرفت، آزمون‌ها و چت‌بات هوش مصنوعی.",
  alternates: { canonical: "/help" },
};

/** Help centre: search, FAQs grouped by category, and support links. */
export default async function HelpPage(props: PageProps<"/help">) {
  const searchParams = await props.searchParams;
  const [faqs, settings] = await Promise.all([getGlobalFaqs(), getAllSettings()]);

  const categories = [...new Set(faqs.map((faq) => faq.category ?? "عمومی"))];

  /*
   * A category filter that actually filters.
   *
   * Previously the category chips were anchor links to sections on one long
   * page, so "filtering" still showed every other category underneath — the
   * learner could never narrow the list. Selecting a category now returns only
   * that category, and unknown values fall back to showing everything.
   */
  const requested = typeof searchParams.category === "string" ? searchParams.category : "";
  const activeCategory = requested && categories.includes(requested) ? requested : null;
  const visibleCategories = activeCategory ? [activeCategory] : categories;

  const HelpIcon = getIcon("HelpCircle");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: richTextToPlain(faq.answer) },
    })),
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <header className="text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <HelpIcon size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-xl font-bold sm:text-2xl">چطور می‌توانیم کمک کنیم؟</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          اگر سؤال شما درباره خود دوره است، پاسخش را همین‌جا پیدا می‌کنید. برای پرسش‌های مربوط به یک درس
          مشخص، از چت‌بات داخل همان درس استفاده کنید.
        </p>
        <div className="mx-auto mt-5 max-w-xl">
          <SearchBox popularSearches={settings.search.popularQueries} />
        </div>
      </header>

      {/*
        "Where do I start and what is each part for" — the FAQ list below answers
        specific questions, this explains the product itself.
      */}
      <Reveal className="mt-9">
        <section aria-labelledby="getting-started">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="getting-started" className="text-base font-bold sm:text-lg">
              شروع سریع در سه قدم
            </h2>
            <TourStartButton />
          </div>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { step: "۱", title: "یک حساب بسازید", body: "با ثبت‌نام رایگان، پیشرفت شما ذخیره می‌شود." },
              { step: "۲", title: "از فهرست دوره شروع کنید", body: "مسیر ماژول‌به‌ماژول را به ترتیب جلو ببرید." },
              { step: "۳", title: "بخوانید، تمرین کنید، آزمون بدهید", body: "هر درس یک آزمون کوتاه دارد؛ با قبولی، درس تکمیل می‌شود." },
            ].map((item, index) => (
              <li key={item.title}>
                <Reveal delayMs={index * 60}>
                  <Card className="h-full">
                    <CardContent className="flex h-full gap-3 p-4 pt-4">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                        {item.step}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{item.title}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {item.body}
                        </span>
                      </span>
                    </CardContent>
                  </Card>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <Reveal className="mt-9">
        <section aria-labelledby="site-parts">
          <h2 id="site-parts" className="text-base font-bold sm:text-lg">
            بخش‌های سایت و کاربرد هرکدام
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            هر بخش را می‌توانید از منوی بالا یا پاصفحه باز کنید. روی هر کارت بزنید تا مستقیم به همان بخش بروید.
          </p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "BookOpen", title: "فهرست دوره", body: "مسیر کامل دوره، ماژول به ماژول و درس به درس.", href: "/course" },
              { icon: "FileText", title: "صفحه هر درس", body: "متن، تصویر، مرحله‌به‌مرحله و شبیه‌سازی‌های تعاملی.", href: "/course" },
              { icon: "MousePointerClick", title: "تمرین‌های عملی", body: "اختیاری‌اند اما یادگیری را تثبیت می‌کنند.", href: "/exercises" },
              { icon: "ClipboardCheck", title: "آزمون‌ها", body: "نمره قبولی ۷۰٪ است و می‌توانید چند بار تلاش کنید.", href: "/course" },
              { icon: "TrendingUp", title: "پیشرفت من", body: "درصد پیشرفت، نتایج آزمون‌ها و درس‌های اخیر.", href: "/progress" },
              { icon: "LayoutDashboard", title: "پروفایل و داشبورد", body: "تمرین‌ها، درخواست‌ها و گواهی، همه در یک صفحه.", href: "/profile" },
              { icon: "Star", title: "علاقه‌مندی‌ها", body: "نکته‌ها و درس‌ها را نشان‌دار کنید تا بعداً پیدا شوند.", href: "/bookmarks" },
              { icon: "Award", title: "گواهی پایان دوره", body: "پس از تکمیل همه درس‌ها و قبولی در همه آزمون‌ها صادر می‌شود.", href: "/certificate" },
              { icon: "Bot", title: "چت‌بات آموزشی", body: "داخل هر درس سؤال بپرسید؛ پاسخ بر پایه همان درس است.", href: "/course" },
              { icon: "Search", title: "جستجو", body: "با نام نرم‌افزار یا بخشی از درس، سریع به موضوع برسید.", href: "/search" },
              { icon: "Mail", title: "تماس و درخواست دوره", body: "پیام بفرستید یا دوره جدید پیشنهاد دهید و وضعیتش را پیگیری کنید.", href: "/contact" },
              { icon: "Minus", title: "نمایش فشرده یا راحت", body: "در هر درس می‌توانید چیدمان را جمع‌وجورتر کنید.", href: "/course" },
            ].map((item, index) => {
              const Icon = getIcon(item.icon);
              return (
                <li key={item.title}>
                  <Reveal delayMs={Math.min(index, 5) * 40}>
                    <Link href={item.href} className="block h-full">
                      <Card className="h-full transition-transform duration-200 hover:-translate-y-0.5">
                        <CardContent className="flex h-full flex-col gap-2 p-4 pt-4">
                          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                            <Icon size={19} aria-hidden="true" />
                          </span>
                          <span className="text-sm font-bold">{item.title}</span>
                          <span className="text-xs leading-relaxed text-muted-foreground">{item.body}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </section>
      </Reveal>

      <Reveal className="mt-6">
        <Alert tone="info" title="درس‌ها به ترتیب باز می‌شوند">
          {settings.course.sequenceMessage} اگر می‌خواهید بدون محدودیت ببینید، می‌توانید فهرست و سرفصل‌ها را
          آزادانه مرور کنید یا از آزمون هر درس شروع کنید.
        </Alert>
      </Reveal>

      <nav aria-label="موضوع‌ها" className="mt-9 flex flex-wrap justify-center gap-2">
        {/* Real filters: each chip narrows the list instead of scrolling to it. */}
        <Link
          href="/help"
          aria-current={activeCategory === null ? "page" : undefined}
          className={
            activeCategory === null
              ? "rounded-full border border-primary bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary"
              : "rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          }
        >
          همه موضوع‌ها
        </Link>
        {categories.map((category) => (
          <Link
            key={category}
            href={`/help?category=${encodeURIComponent(category)}`}
            aria-current={activeCategory === category ? "page" : undefined}
            className={
              activeCategory === category
                ? "rounded-full border border-primary bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary"
                : "rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            }
          >
            {category}
          </Link>
        ))}
      </nav>

      {activeCategory ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          فقط پرسش‌های موضوع «{activeCategory}» نمایش داده می‌شود.{" "}
          <Link href="/help" className="text-primary hover:underline">
            نمایش همه موضوع‌ها
          </Link>
        </p>
      ) : null}

      <div className="mt-8 space-y-8">
        {faqs.length === 0 ? (
          <EmptyState
            icon="HelpCircle"
            title="هنوز پرسشی ثبت نشده است"
            description="مدیر سایت می‌تواند از پنل مدیریت، پرسش‌های پرتکرار را اضافه کند."
          />
        ) : (
          visibleCategories.map((category) => {
            const items = faqs.filter((faq) => (faq.category ?? "عمومی") === category);
            return (
              <Reveal key={category}>
                <section id={`cat-${encodeURIComponent(category)}`} className="scroll-mt-24">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-base font-bold sm:text-lg">{category}</h2>
                  <Badge tone="outline" size="sm">
                    {toPersianDigits(items.length)} پرسش
                  </Badge>
                </div>
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {items.map((faq) => (
                    <details key={faq.id} className="group px-4 py-3.5">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                        <ChevronGlyph />
                        {faq.question}
                      </summary>
                      <RichText html={faq.answer} className="mt-3 text-sm text-muted-foreground" />
                    </details>
                  ))}
                </div>
                </section>
              </Reveal>
            );
          })
        )}
      </div>

      <Reveal className="mt-10">
        <Card>
        <CardContent className="p-5 pt-5 text-center">
          <p className="text-sm font-bold">پاسخ سؤال خود را پیدا نکردید؟</p>
          <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
            داخل هر درس، دکمه «سؤال از چت‌بات» وجود دارد. چت‌بات می‌داند شما در کدام درس هستید و پاسخ را بر
            اساس همان محتوا می‌دهد.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/course">رفتن به درس‌ها</ButtonLink>
            <ButtonLink href="/search" variant="outline">
              جستجو در دوره
            </ButtonLink>
            {settings.site.contactEmail ? (
              <Link
                href={`mailto:${settings.site.contactEmail}`}
                className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium text-primary hover:underline"
              >
                ارسال ایمیل به پشتیبانی
              </Link>
            ) : null}
          </div>
        </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

function ChevronGlyph() {
  const Icon = getIcon("ChevronDown");
  return <Icon size={15} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />;
}
