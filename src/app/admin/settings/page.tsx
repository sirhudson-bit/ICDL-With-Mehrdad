import type { Metadata } from "next";

import { SettingsForm, type SettingsField } from "@/components/admin/settings-form";
import { MailTestPanel } from "@/components/admin/mail-test-panel";
import { Card, CardContent } from "@/components/ui/primitives";
import { SECRET_SETTING_FIELDS, SETTINGS_LABELS, maskSettings, type SettingsKey } from "@/lib/settings";
import { getAllSettings } from "@/services/settings-service";

export const metadata: Metadata = {
  title: "تنظیمات سایت",
  robots: { index: false, follow: false },
};

/** Field definitions per settings group. Matching Zod schemas live in lib/settings. */
const FIELDS: Record<SettingsKey, SettingsField[]> = {
  site: [
    { name: "name", label: "نام سایت", kind: "text", placeholder: "ICDL With Mehrdad" },
    { name: "tagline", label: "شعار کوتاه", kind: "text" },
    { name: "description", label: "توضیح سایت", kind: "textarea", hint: "در توضیحات متا و صفحه اصلی استفاده می‌شود." },
    { name: "logoUrl", label: "نشانی لوگو", kind: "text", placeholder: "https://…" },
    { name: "faviconUrl", label: "نشانی فاوآیکون", kind: "text" },
    { name: "themeColor", label: "رنگ اصلی (کد رنگ)", kind: "text", placeholder: "#4f46e5" },
    { name: "contactEmail", label: "ایمیل پشتیبانی", kind: "text" },
    {
      name: "donateLabel",
      label: "دکمه حمایت — متن دکمه",
      kind: "text",
      hint: "متن دکمه «خرید یک قهوه». اگر نشانی دکمه خالی باشد، دکمه در سایت نمایش داده نمی‌شود.",
    },
    {
      name: "donateUrl",
      label: "دکمه حمایت — نشانی",
      kind: "text",
      placeholder: "https://www.coffeete.ir/…",
    },
    { name: "footerText", label: "متن پاصفحه", kind: "textarea" },
  ],
  appearance: [
    {
      name: "fontFamily",
      label: "فونت",
      kind: "select",
      options: [
        { value: "vazirmatn", label: "وزیرمتن (پیشنهادی)" },
        { value: "system", label: "فونت سیستم" },
      ],
    },
    {
      name: "radiusScale",
      label: "گردی گوشه‌ها",
      kind: "select",
      options: [
        { value: "soft", label: "کم" },
        { value: "medium", label: "متوسط" },
        { value: "round", label: "زیاد" },
      ],
    },
    {
      name: "defaultTheme",
      label: "حالت پیش‌فرض رنگ",
      kind: "select",
      options: [
        { value: "system", label: "هماهنگ با سیستم کاربر" },
        { value: "light", label: "روشن" },
        { value: "dark", label: "تیره" },
      ],
    },
  ],
  home: [
    { name: "heroBadge", label: "برچسب بالای عنوان", kind: "text" },
    { name: "heroTitle", label: "عنوان اصلی صفحه", kind: "text" },
    { name: "heroSubtitle", label: "توضیح زیر عنوان", kind: "textarea" },
    { name: "showHero", label: "نمایش بخش معرفی", kind: "boolean" },
    { name: "showContinueLearning", label: "نمایش «ادامه یادگیری»", kind: "boolean" },
    { name: "showStats", label: "نمایش آمار", kind: "boolean" },
    { name: "showModules", label: "نمایش ماژول‌ها", kind: "boolean" },
    { name: "showPopularSearches", label: "نمایش جستجوهای پرتکرار", kind: "boolean" },
    { name: "showAudience", label: "نمایش بخش مخاطبان", kind: "boolean" },
    { name: "showHowItWorks", label: "نمایش بخش «چطور یاد می‌گیرید»", kind: "boolean" },
    { name: "audienceTitle", label: "عنوان بخش مخاطبان", kind: "text" },
    {
      name: "audienceItems",
      label: "کارت‌های بخش مخاطبان",
      kind: "records",
      itemNoun: "کارت",
      maxItems: 8,
      hint: "هر کارت یک عنوان و یک توضیح کوتاه دارد.",
      itemFields: [
        { name: "title", label: "عنوان" },
        { name: "description", label: "توضیح", wide: true },
      ],
    },
    { name: "howItWorksTitle", label: "عنوان بخش روش یادگیری", kind: "text" },
    {
      name: "howItWorksSteps",
      label: "مراحل روش یادگیری",
      kind: "records",
      itemNoun: "مرحله",
      maxItems: 8,
      hint: "ترتیب مراحل همان ترتیب نمایش در سایت است.",
      itemFields: [
        { name: "title", label: "عنوان مرحله" },
        { name: "description", label: "توضیح", wide: true },
      ],
    },
  ],
  course: [
    { name: "title", label: "عنوان دوره", kind: "text" },
    { name: "subtitle", label: "زیرعنوان دوره", kind: "text" },
    { name: "description", label: "توضیح دوره", kind: "textarea" },
    { name: "certificateNote", label: "متن پایانی دوره", kind: "textarea" },
    {
      name: "sequenceMessage",
      label: "پیام «درس قفل است»",
      kind: "textarea",
      hint: "برای همه کاربران (به‌جز مدیر) درس‌ها به ترتیب باز می‌شوند؛ این متن وقتی نمایش داده می‌شود که کاربر بخواهد درسی را جلوتر از ترتیب باز کند.",
    },
  ],
  navigation: [
    {
      name: "footerLinks",
      label: "پیوندهای پاورقی",
      kind: "records",
      itemNoun: "پیوند",
      maxItems: 12,
      hint: "این پیوندها به‌صورت خودکار در دو ستون پاورقی تقسیم می‌شوند.",
      itemFields: [
        { name: "label", label: "عنوان" },
        { name: "href", label: "نشانی", placeholder: "/course" },
      ],
    },
    {
      name: "footerAbout",
      label: "معرفی کوتاه در پاورقی",
      kind: "textarea",
    },
    {
      name: "creditText",
      label: "متن اعتبار سازنده",
      kind: "text",
      hint: "کنار سال در نوار پایانی نمایش داده می‌شود، مثلاً «Designed with love by Mehrdad Roustaei».",
    },
    {
      name: "showSocials",
      label: "نمایش شبکه‌های اجتماعی",
      kind: "boolean",
    },
    {
      name: "socialLinks",
      label: "شبکه‌های اجتماعی و راه‌های تماس",
      kind: "records",
      itemNoun: "شبکه",
      maxItems: 6,
      hint: "آیکون هر شبکه را به‌صورت فایل SVG بارگذاری کنید (حداکثر ۶۴ کیلوبایت)؛ تا وقتی فایلی بارگذاری نشده، آیکون پیش‌فرض نمایش داده می‌شود.",
      itemFields: [
        { name: "label", label: "عنوان" },
        { name: "href", label: "نشانی", placeholder: "https://…" },
        { name: "iconUrl", label: "آیکون (فایل SVG)", kind: "upload", wide: true },
      ],
    },
    {
      name: "footerNote",
      label: "یادداشت پایین سایت",
      kind: "textarea",
      hint: "زیر معرفی دوره در پاورقی نمایش داده می‌شود.",
    },
  ],
  chatbot: [
    { name: "enabled", label: "چت‌بات فعال باشد", kind: "boolean" },
    {
      name: "provider",
      label: "موتور پاسخ‌دهی",
      kind: "select",
      hint: "«خودکار» تا وقتی GapGPT کامل تنظیم شده باشد از آن استفاده می‌کند و در غیر این صورت دستیار داخلی (بدون کلید و بدون اینترنت) پاسخ می‌دهد.",
      options: [
        { value: "auto", label: "خودکار — GapGPT در صورت تنظیم، وگرنه دستیار داخلی (پیشنهادی)" },
        { value: "gapgpt", label: "فقط GapGPT" },
        { value: "local", label: "دستیار داخلی — بدون کلید API و بدون اینترنت" },
      ],
    },

    // ── GapGPT credentials ─────────────────────────────────
    {
      name: "baseUrl",
      label: "GapGPT — نشانی سرویس",
      kind: "text",
      placeholder: "https://api.gapgpt.app/v1",
    },
    { name: "apiKey", label: "GapGPT — کلید API", kind: "text" },
    {
      name: "model",
      label: "GapGPT — نام مدل",
      kind: "text",
      placeholder: "gpt-5.4",
      hint: "نام مدل را از فهرست مدل‌های GapGPT وارد کنید؛ مثلاً gpt-5.4 یا claude-sonnet-4-6.",
    },
    {
      name: "apiStyle",
      label: "GapGPT — نوع نقطه پایانی",
      kind: "select",
      hint: "GapGPT با chat-completions سازگار است. اگر مدل انتخابی فقط از مسیر جدید responses پشتیبانی کند، گزینه «خودکار» ابتدا chat و سپس responses را امتحان می‌کند.",
      options: [
        { value: "auto", label: "خودکار — ابتدا chat/completions و سپس responses (پیشنهادی)" },
        { value: "chat", label: "فقط chat/completions" },
        { value: "responses", label: "فقط responses" },
      ],
    },

    // ── Behaviour ──────────────────────────────────────────
    {
      name: "systemPrompt",
      label: "پرامپت سیستمی (شخصیت و قواعد پاسخ)",
      kind: "textarea",
      hint: "لحن، زبان و محدوده پاسخ‌ها را تعیین می‌کند.",
    },
    { name: "quickActions", label: "دکمه‌های سریع گفتگو", kind: "list" },
    { name: "temperature", label: "خلاقیت (Temperature)", kind: "number", min: 0, max: 2, step: 0.1 },
    { name: "maxTokens", label: "حداکثر توکن پاسخ", kind: "number", min: 64, max: 8192 },
    { name: "historyLimit", label: "تعداد پیام‌های حافظه گفتگو", kind: "number", min: 0, max: 50 },
    { name: "lessonContextChars", label: "حجم متن درس ارسالی به مدل (کاراکتر)", kind: "number", min: 0, max: 20000 },
  ],
  search: [
    {
      name: "provider",
      label: "موتور جستجو",
      kind: "select",
      hint: "حالت پایگاه داده برای SQLite و PostgreSQL مناسب است. Meilisearch بعداً اضافه می‌شود.",
      options: [
        { value: "database", label: "جستجوی پایگاه داده (پیش‌فرض)" },
        { value: "meilisearch", label: "Meilisearch" },
      ],
    },
    { name: "meilisearchUrl", label: "نشانی Meilisearch", kind: "text" },
    { name: "meilisearchApiKey", label: "کلید Meilisearch", kind: "text" },
    { name: "resultsPerPage", label: "تعداد نتایج در هر صفحه", kind: "number", min: 5, max: 50 },
    { name: "popularQueries", label: "جستجوهای پرتکرار", kind: "list" },
    { name: "enableHistory", label: "ذخیره تاریخچه جستجوی کاربران", kind: "boolean" },
  ],
  auth: [
    { name: "allowRegistration", label: "کاربران بتوانند ثبت‌نام کنند", kind: "boolean" },
    {
      name: "defaultRole",
      label: "نقش پیش‌فرض کاربران جدید",
      kind: "select",
      options: [
        { value: "LEARNER", label: "کاربر عادی" },
        { value: "ADMIN", label: "مدیر" },
      ],
    },
    { name: "welcomeMessage", label: "پیام خوش‌آمد در صفحه ثبت‌نام", kind: "textarea" },
    {
      name: "resetTokenMinutes",
      label: "اعتبار پیوند بازیابی رمز عبور (دقیقه)",
      kind: "number",
      min: 5,
      max: 1440,
      hint: "مدت زمانی که پیوند ارسالی برای تغییر رمز عبور معتبر می‌ماند. پیش‌فرض ۶۰ دقیقه است.",
    },
  ],
  mail: [
    {
      name: "enabled",
      label: "ارسال ایمیل فعال باشد",
      kind: "boolean",
      hint: "تا وقتی این گزینه خاموش است (یا نشانی سرور خالی باشد)، ایمیل واقعی ارسال نمی‌شود و متن پیام فقط در گزارش سرور ثبت می‌شود؛ همین برای آزمایش جریان بازیابی رمز کافی است.",
    },
    { name: "host", label: "نشانی سرور SMTP", kind: "text", placeholder: "smtp.gmail.com" },
    {
      name: "port",
      label: "درگاه سرور",
      kind: "number",
      min: 1,
      max: 65535,
      hint: "درگاه ۴۶۵ برای TLS مستقیم و ۵۸۷ برای STARTTLS رایج است.",
    },
    {
      name: "secure",
      label: "اتصال امن مستقیم (TLS)",
      kind: "boolean",
      hint: "برای درگاه ۴۶۵ روشن و برای ۵۸۷ خاموش باشد.",
    },
    { name: "username", label: "نام کاربری SMTP", kind: "text" },
    { name: "password", label: "رمز عبور SMTP", kind: "text" },
    { name: "fromName", label: "نام فرستنده", kind: "text", placeholder: "ICDL With Mehrdad" },
    { name: "fromEmail", label: "ایمیل فرستنده", kind: "text", placeholder: "no-reply@example.com" },
    { name: "replyTo", label: "ایمیل پاسخ (اختیاری)", kind: "text", placeholder: "support@example.com" },
  ],
  pwa: [
    {
      name: "enabled",
      label: "نسخه نصب‌شدنی فعال باشد",
      kind: "boolean",
      hint: "با فعال بودن، سایت روی گوشی نصب می‌شود و مثل یک برنامه باز می‌شود.",
    },
    { name: "showInstallPrompt", label: "نمایش دکمه «نصب برنامه» به کاربر", kind: "boolean" },
    {
      name: "offlineSupport",
      label: "پشتیبانی از حالت آفلاین",
      kind: "boolean",
      hint: "صفحه‌های بازدیدشده ذخیره می‌شوند و در قطعی اینترنت نمایش داده می‌شوند.",
    },
    { name: "appName", label: "نام کامل برنامه", kind: "text", placeholder: "ICDL With Mehrdad" },
    {
      name: "shortName",
      label: "نام کوتاه (زیر آیکون)",
      kind: "text",
      hint: "حداکثر ۱۲ نویسه؛ زیر آیکون در صفحه گوشی نمایش داده می‌شود.",
    },
    { name: "description", label: "توضیح برنامه", kind: "textarea" },
    {
      name: "themeColor",
      label: "رنگ نوار بالای برنامه",
      kind: "text",
      placeholder: "#4f46e5",
    },
    {
      name: "backgroundColor",
      label: "رنگ پس‌زمینه زمان باز شدن",
      kind: "text",
      placeholder: "#ffffff",
    },
    {
      name: "display",
      label: "حالت نمایش",
      kind: "select",
      options: [
        { value: "standalone", label: "بدون نوار مرورگر (پیشنهادی)" },
        { value: "minimal-ui", label: "حداقلی" },
        { value: "fullscreen", label: "تمام‌صفحه" },
        { value: "browser", label: "مثل یک برگه معمولی مرورگر" },
      ],
    },
    {
      name: "orientation",
      label: "جهت صفحه",
      kind: "select",
      options: [
        { value: "portrait-primary", label: "عمودی (پیشنهادی)" },
        { value: "any", label: "آزاد" },
        { value: "landscape-primary", label: "افقی" },
      ],
    },
    {
      name: "shortcuts",
      label: "میان‌برهای برنامه نصب‌شده",
      kind: "records",
      itemNoun: "میان‌بر",
      maxItems: 6,
      hint: "با نگه‌داشتن انگشت روی آیکون برنامه نمایش داده می‌شوند.",
      itemFields: [
        { name: "label", label: "عنوان" },
        { name: "href", label: "نشانی", placeholder: "/course" },
        { name: "icon", label: "نام آیکون", placeholder: "BookOpen" },
      ],
    },
  ],
};

const ORDER: SettingsKey[] = [
  "site",
  "appearance",
  "home",
  "course",
  "navigation",
  "chatbot",
  "search",
  "auth",
  "mail",
  "pwa",
];

/** Settings page: every group is editable here without touching code. */
export default async function AdminSettingsPage() {
  const settings = await getAllSettings();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">تنظیمات سایت</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          همه بخش‌های سایت از همین‌جا قابل تغییر است: هویت، ظاهر، متن‌های صفحه اصلی، چت‌بات و جستجو.
        </p>
      </header>

      <Card>
        <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            هر بخش را باز کنید، مقادیر را تغییر دهید و ذخیره کنید. تغییرات بدون نیاز به انتشار مجدد،
            بلافاصله روی سایت اعمال می‌شود. کلیدهای API فقط روی سرور ذخیره می‌شوند؛ در این صفحه به‌جای
            خود کلید، مقدار ماسک‌شده نشان داده می‌شود و اگر آن را تغییر ندهید، کلید فعلی دست‌نخورده می‌ماند.
          </p>
        </CardContent>
      </Card>

      {ORDER.map((key) => (
        <div key={key} className="space-y-5">
          <SettingsForm
            settingsKey={key}
            title={SETTINGS_LABELS[key].title}
            description={SETTINGS_LABELS[key].description}
            fields={FIELDS[key]}
            initial={maskSettings(key, settings[key]) as unknown as Record<string, unknown>}
            secretFields={SECRET_SETTING_FIELDS[key] ?? []}
          />
          {key === "mail" ? <MailTestPanel /> : null}
        </div>
      ))}
    </div>
  );
}
