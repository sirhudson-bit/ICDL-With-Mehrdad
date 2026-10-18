import type { Metadata } from "next";

import { RichText } from "@/components/lesson/rich-text";
import { LiveSearch, type SearchResultView } from "@/components/search/live-search";
import { getIcon } from "@/components/icon";
import { Reveal } from "@/components/fx/reveal";
import { ButtonLink, Card, CardContent } from "@/components/ui/primitives";
import { Container } from "@/components/ui/container";
import { toPersianDigits } from "@/lib/persian";
import { getGlobalFaqs } from "@/services/course-service";
import { searchContent, type SearchHitType } from "@/services/search-service";
import { getAllSettings } from "@/services/settings-service";

type SearchPageProps = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `جستجو: ${q}` : "جستجو در دوره",
    description: "جستجو در درس‌ها، تعریف‌ها، تمرین‌ها و پرسش‌های پرتکرار دوره ICDL.",
    robots: { index: false, follow: true },
  };
}

/**
 * Search page.
 *
 * The initial query is rendered on the server so a shared link, a refresh or a
 * crawler all get real results in the HTML. Once hydrated, `LiveSearch` takes
 * over and refetches over AJAX as the learner types.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "", type = "" } = await searchParams;
  const settings = await getAllSettings();

  const types = (type ? type.split(",") : []).filter((value): value is SearchHitType =>
    ["module", "chapter", "lesson", "faq"].includes(value),
  );

  const [initialResult, faqs]: [SearchResultView | null, Awaited<ReturnType<typeof getGlobalFaqs>>] =
    await Promise.all([
      q.trim()
        ? searchContent(q, {
            types: types.length > 0 ? types : undefined,
            limit: settings.search.resultsPerPage,
          })
        : Promise.resolve(null),
      // The most common questions, so the page is useful even before searching.
      getGlobalFaqs(),
    ]);

  const FAQ_PREVIEW = 8;
  const HelpIcon = getIcon("HelpCircle");

  return (
    <Container size="default" className="py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">جستجو در دوره</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          موضوع، نام نرم‌افزار، یک اصطلاح یا حتی جمله سؤال خود را بنویسید. نتایج همان‌طور که تایپ می‌کنید
          به‌روز می‌شوند.
        </p>
      </header>

      <LiveSearch
        initialQuery={q}
        initialResult={initialResult}
        initialType={type}
        popularSearches={settings.search.popularQueries}
      />

      {/* Frequently asked questions — answers many searches before they are typed. */}
      {faqs.length > 0 ? (
        <Reveal as="section" className="mt-12 border-t border-border pt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
                <HelpIcon size={20} className="text-muted-foreground" aria-hidden="true" />
                پرسش‌های پرتکرار
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                پاسخ کوتاه پرتکرارترین سؤال‌ها؛ اگر جواب را پیدا نکردید، از چت‌بات بپرسید.
              </p>
            </div>
            <ButtonLink href="/help" variant="ghost" size="sm">
              دیدن همه پرسش‌ها
            </ButtonLink>
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {faqs.slice(0, FAQ_PREVIEW).map((faq) => (
              <details key={faq.id} className="group px-4 py-3.5">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                  <ChevronGlyph />
                  {faq.question}
                </summary>
                <RichText html={faq.answer} className="mt-2.5 text-sm text-muted-foreground" />
              </details>
            ))}
          </div>

          {faqs.length > FAQ_PREVIEW ? (
            <div className="mt-4 text-center">
              <ButtonLink href="/help" variant="outline" size="sm">
                {toPersianDigits(faqs.length - FAQ_PREVIEW)} پرسش دیگر
              </ButtonLink>
            </div>
          ) : null}
        </Reveal>
      ) : null}

      {/* Contact fallback */}
      <Card className="mt-8">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 pt-5">
          <div className="min-w-0">
            <p className="text-sm font-bold">پاسخ سؤال خود را پیدا نکردید؟</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              می‌توانید پیام بگذارید یا تماس بگیرید؛ همچنین از چت‌بات همین صفحه بپرسید.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/contact" variant="outline" size="sm">
              تماس با من
            </ButtonLink>
            <ButtonLink href="/request-course" variant="ghost" size="sm">
              درخواست دوره
            </ButtonLink>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}

function ChevronGlyph() {
  const Icon = getIcon("ChevronDown");
  return <Icon size={17} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />;
}
