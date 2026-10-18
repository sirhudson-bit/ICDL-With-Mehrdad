import { z } from "zod";

/**
 * Site configuration.
 *
 * Every key here is stored in the `Setting` table and edited from
 * Admin → Settings, so the platform can be rebranded and reconfigured without
 * touching source code. The schemas double as the defaults: a missing database
 * row falls back to these values, which keeps the app working on a fresh
 * database and makes migration painless.
 */

// ── Site identity ────────────────────────────────────────────

export const siteSettingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(160),
  description: z.string().trim().max(400),
  logoUrl: z.string().trim().max(2000),
  faviconUrl: z.string().trim().max(2000),
  themeColor: z.string().trim().max(30),
  footerText: z.string().trim().max(300),
  contactEmail: z.string().trim().max(160),
  /** "Buy the admin a coffee" support button. Empty URL hides the button. */
  donateLabel: z.string().trim().max(80),
  donateUrl: z.string().trim().max(500),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

const DEFAULT_SITE: SiteSettings = {
  name: "ICDL With Mehrdad",
  tagline: "آموزش ICDL از صفر تا کاربردی",
  description:
    "پلتفرم آموزش تعاملی مهارت‌های هفت‌گانه ICDL به زبان ساده برای کسانی که تازه با کامپیوتر آشنا شده‌اند.",
  logoUrl: "",
  faviconUrl: "",
  themeColor: "#4f46e5",
  footerText: "ICDL With Mehrdad — یادگیری ساده، تعاملی و قدم‌به‌قدم مهارت‌های کامپیوتر",
  contactEmail: "",
  donateLabel: "خرید یک قهوه برای مدیر",
  donateUrl: "https://www.coffeete.ir/Romesas",
};

// ── Appearance ───────────────────────────────────────────────

export const appearanceSettingsSchema = z.object({
  fontFamily: z.enum(["vazirmatn", "system"]),
  radiusScale: z.enum(["soft", "medium", "round"]),
  defaultTheme: z.enum(["light", "dark", "system"]),
});

export type AppearanceSettings = z.infer<typeof appearanceSettingsSchema>;

const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontFamily: "vazirmatn",
  radiusScale: "medium",
  defaultTheme: "system",
};

// ── Homepage composition ─────────────────────────────────────

export const homeSettingsSchema = z.object({
  heroTitle: z.string().trim().min(1).max(160),
  heroSubtitle: z.string().trim().min(1).max(400),
  heroBadge: z.string().trim().max(80),
  showHero: z.boolean(),
  showContinueLearning: z.boolean(),
  showStats: z.boolean(),
  showModules: z.boolean(),
  showPopularSearches: z.boolean(),
  showAudience: z.boolean(),
  showHowItWorks: z.boolean(),
  audienceTitle: z.string().trim().max(160),
  audienceItems: z.array(z.object({ title: z.string().max(120), description: z.string().max(300) })).max(8),
  howItWorksTitle: z.string().trim().max(160),
  howItWorksSteps: z.array(z.object({ title: z.string().max(120), description: z.string().max(300) })).max(8),
});

export type HomeSettings = z.infer<typeof homeSettingsSchema>;

const DEFAULT_HOME: HomeSettings = {
  heroTitle: "آموزش ICDL از صفر تا کاربردی",
  heroSubtitle:
    "اگر تا حالا کمتر با کامپیوتر کار کرده‌اید، اینجا جای درستی است. قدم‌به‌قدم، با زبان ساده و تمرین‌های تعاملی یاد می‌گیرید.",
  heroBadge: "مخصوص مبتدی‌ها",
  showHero: true,
  showContinueLearning: true,
  showStats: true,
  showModules: true,
  showPopularSearches: true,
  showAudience: true,
  showHowItWorks: true,
  audienceTitle: "این دوره برای چه کسانی است؟",
  audienceItems: [
    {
      title: "کسانی که تازه با کامپیوتر آشنا شده‌اند",
      description: "از روشن کردن کامپیوتر شروع می‌کنیم و قدم‌به‌قدم جلو می‌رویم.",
    },
    {
      title: "دانش‌آموزان و دانشجویان",
      description: "برای نوشتن پروژه، گزارش و ارائه در Word، Excel و PowerPoint.",
    },
    {
      title: "کارمندان و جویندگان کار",
      description: "مهارت‌های اداری پایه که در همه آگهی‌های شغلی خواسته می‌شود.",
    },
    {
      title: "همه کسانی که می‌خواهند امن‌تر کار کنند",
      description: "یاد می‌گیرید از اطلاعات خود در برابر فیشینگ و بدافزار محافظت کنید.",
    },
  ],
  howItWorksTitle: "چطور یاد می‌گیرید؟",
  howItWorksSteps: [
    { title: "یک درس را باز کنید", description: "هر درس کوتاه است و در چند دقیقه تمام می‌شود." },
    { title: "قدم‌به‌قدم بخوانید", description: "با تصویر، نکته و هشدار، مفاهیم را ساده توضیح می‌دهیم." },
    { title: "تمرین تعاملی انجام دهید", description: "داخل خود صفحه تمرین کنید و بازخورد فوری بگیرید." },
    { title: "آزمون بدهید", description: "با یک آزمون کوتاه مطمئن شوید مطلب را یاد گرفته‌اید." },
    { title: "پیشرفت خود را ببینید", description: "درصد پیشرفت هر ماژول را دنبال کنید و ادامه دهید." },
  ],
};

// ── Course presentation ──────────────────────────────────────

export const courseSettingsSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(200),
  description: z.string().trim().max(600),
  certificateNote: z.string().trim().max(300),
  sequenceMessage: z.string().trim().max(300),
});

export type CourseSettings = z.infer<typeof courseSettingsSchema>;

const DEFAULT_COURSE: CourseSettings = {
  title: "دوره کامل ICDL",
  subtitle: "مهارت‌های هفت‌گانه به زبان ساده",
  description:
    "این دوره بر اساس ساختار استاندارد ICDL چیده شده است: از آشنایی با کامپیوتر و ویندوز شروع می‌کنیم و تا Word، Excel، PowerPoint، Access، اینترنت و مهارت‌های تکمیلی ادامه می‌دهیم.",
  certificateNote: "در پایان دوره می‌توانید تمام درس‌ها را تکمیل کنید و پیشرفت خود را ببینید.",
  sequenceMessage:
    "این دوره باید به ترتیب گذرانده شود. برای باز شدن این درس، ابتدا درس‌های قبلی را کامل کنید.",
};

// ── Navigation & footer ──────────────────────────────────────

const navLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(300),
});

export const navigationSettingsSchema = z.object({
  footerLinks: z.array(navLinkSchema).max(12),
  footerNote: z.string().trim().max(300),
  /** Credit line shown next to the copyright date. */
  creditText: z.string().trim().max(160),
  footerAbout: z.string().trim().max(400),
  showSocials: z.boolean(),
  socialLinks: z
    .array(
      z.object({
        label: z.string().trim().max(40),
        href: z.string().trim().max(300),
        /** Built-in icon, used until an SVG has been uploaded. */
        icon: z.string().trim().max(40).default(""),
        /** Path of the administrator-uploaded SVG, when there is one. */
        iconUrl: z.string().trim().max(300).default(""),
      }),
    )
    .max(6),
});

export type NavigationSettings = z.infer<typeof navigationSettingsSchema>;

const DEFAULT_NAVIGATION: NavigationSettings = {
  footerLinks: [
    { label: "دوره‌ها", href: "/course" },
    { label: "جستجو", href: "/search" },
    { label: "پرسش‌های پرتکرار", href: "/help" },
    { label: "پیشرفت من", href: "/progress" },
    { label: "گواهی پایان دوره", href: "/certificate" },
    { label: "درخواست دوره جدید", href: "/request-course" },
    { label: "تماس با من", href: "/contact" },
  ],
  footerNote: "همه محتوای این پلتفرم از پنل مدیریت قابل ویرایش است. تغییرات بدون نیاز به انتشار مجدد اعمال می‌شوند.",
  creditText: "Designed with love by Mehrdad Roustaei",
  footerAbout:
    "این پلتفرم برای یادگیری ساده و بی‌استرس مهارت‌های کامپیوتر ساخته شده است؛ قدم‌به‌قدم، فارسی و با تمرین‌های تعاملی.",
  showSocials: true,
  socialLinks: [
    { label: "تلگرام", href: "#", icon: "Send", iconUrl: "" },
    { label: "اینستاگرام", href: "#", icon: "Camera", iconUrl: "" },
    { label: "تماس تلفنی", href: "tel:09108176937", icon: "Phone", iconUrl: "" },
  ],
};

// ── AI chatbot ───────────────────────────────────────────────

export const chatbotSettingsSchema = z.object({
  enabled: z.boolean(),
  /**
   * Which service answers. "auto" uses GapGPT when it is fully configured and
   * otherwise falls back to the built-in offline knowledge provider, which needs
   * no key and answers strictly from the authored lesson content.
   */
  provider: z.enum(["auto", "gapgpt", "local"]),
  /** GapGPT base URL, e.g. https://api.gapgpt.app/v1 */
  baseUrl: z.string().trim().max(500),
  apiKey: z.string().trim().max(500),
  model: z.string().trim().max(120),
  /**
   * Which GapGPT endpoint to call. GapGPT is OpenAI-compatible and answers on
   * /chat/completions; some models are exposed only through the newer
   * /responses API. "auto" tries chat-completions first and falls back to
   * responses when that route is missing.
   */
  apiStyle: z.enum(["auto", "chat", "responses"]),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(64).max(8192),
  /** How many previous messages are replayed as conversation context. */
  historyLimit: z.number().int().min(0).max(50),
  /** How many characters of the current lesson are injected into the prompt. */
  lessonContextChars: z.number().int().min(0).max(20000),
  systemPrompt: z.string().trim().max(4000),
  quickActions: z.array(z.string().trim().min(1).max(80)).max(8),
});

export type ChatbotSettings = z.infer<typeof chatbotSettingsSchema>;

const DEFAULT_CHATBOT: ChatbotSettings = {
  enabled: true,
  provider: "auto",
  baseUrl: "https://api.gapgpt.app/v1",
  apiKey: "",
  model: "",
  apiStyle: "auto",
  temperature: 0.3,
  maxTokens: 1024,
  historyLimit: 8,
  lessonContextChars: 4000,
  systemPrompt: [
    "تو دستیار آموزشی پلتفرم «ICDL With Mehrdad» هستی.",
    "همیشه فارسی و ساده پاسخ بده؛ مخاطب تو یک کاربر مبتدی است.",
    "از اصطلاحات فنی پیچیده پرهیز کن و اگر ناچار به استفاده از آن‌ها شدی، همان لحظه ساده توضیح بده.",
    "پاسخ‌ها را کوتاه و مرحله‌به‌مرحله بنویس و در صورت امکان یک مثال کاربردی بزن.",
    "اگر کاربر درباره موضوعی خارج از آموزش ICDL پرسید، مؤدبانه او را به موضوع درس برگردان.",
    "هرگز اطلاعات نادرست حدس نزن؛ اگر مطمئن نیستی، بگو که مطمئن نیستی.",
  ].join("\n"),
  quickActions: [
    "ساده‌تر توضیح بده",
    "یک مثال بزن",
    "مرحله به مرحله بگو",
    "یک تمرین بده",
    "این قسمت را خلاصه کن",
  ],
};

// ── Search ───────────────────────────────────────────────────

export const searchSettingsSchema = z.object({
  /** Swapping this to "meilisearch" activates the Meilisearch adapter. */
  provider: z.enum(["database", "meilisearch"]),
  meilisearchUrl: z.string().trim().max(500),
  meilisearchApiKey: z.string().trim().max(500),
  resultsPerPage: z.number().int().min(5).max(50),
  popularQueries: z.array(z.string().trim().min(1).max(120)).max(12),
  enableHistory: z.boolean(),
});

export type SearchSettings = z.infer<typeof searchSettingsSchema>;

const DEFAULT_SEARCH: SearchSettings = {
  provider: "database",
  meilisearchUrl: "",
  meilisearchApiKey: "",
  resultsPerPage: 12,
  popularQueries: [
    "چگونه فایل را کپی کنم؟",
    "فرمول SUM چیست؟",
    "چگونه PDF بسازم؟",
    "CC و BCC چیست؟",
    "فیشینگ چیست؟",
    "چگونه در Word جدول بسازم؟",
    "نیم‌فاصله چیست؟",
    "توابع IF در اکسل",
  ],
  enableHistory: true,
};

// ── Auth & registration ──────────────────────────────────────

export const authSettingsSchema = z.object({
  allowRegistration: z.boolean(),
  defaultRole: z.enum(["LEARNER", "ADMIN"]),
  welcomeMessage: z.string().trim().max(300),
  /** How long a password-reset link stays valid, in minutes. */
  resetTokenMinutes: z.number().int().min(5).max(1440),
});

export type AuthSettings = z.infer<typeof authSettingsSchema>;

const DEFAULT_AUTH: AuthSettings = {
  allowRegistration: true,
  defaultRole: "LEARNER",
  welcomeMessage: "خوش آمدید! از همین‌جا یادگیری را شروع کنید.",
  resetTokenMinutes: 60,
};

// ── Outgoing mail ────────────────────────────────────────────

export const mailSettingsSchema = z.object({
  /**
   * Master switch. While off — or while no host is set — messages are written to
   * the server log instead of being delivered, which keeps password reset
   * usable on a machine without SMTP credentials.
   */
  enabled: z.boolean(),
  host: z.string().trim().max(200),
  port: z.number().int().min(1).max(65535),
  /** Implicit TLS: true for port 465, false for 587 which upgrades via STARTTLS. */
  secure: z.boolean(),
  username: z.string().trim().max(200),
  password: z.string().max(400),
  fromName: z.string().trim().max(80),
  fromEmail: z.string().trim().max(160),
  replyTo: z.string().trim().max(160),
});

export type MailSettings = z.infer<typeof mailSettingsSchema>;

const DEFAULT_MAIL: MailSettings = {
  enabled: false,
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
  fromName: "ICDL With Mehrdad",
  fromEmail: "",
  replyTo: "",
};

// ── Progressive Web App ──────────────────────────────────────

export const pwaSettingsSchema = z.object({
  /** Turning this off stops the service worker from registering at all. */
  enabled: z.boolean(),
  appName: z.string().trim().max(80),
  shortName: z.string().trim().max(20),
  description: z.string().trim().max(300),
  themeColor: z.string().trim().max(30),
  backgroundColor: z.string().trim().max(30),
  display: z.enum(["standalone", "minimal-ui", "fullscreen", "browser"]),
  orientation: z.enum(["any", "portrait-primary", "landscape-primary"]),
  /** Offer the in-app "install" invitation. */
  showInstallPrompt: z.boolean(),
  /** Serve an offline fallback page and cache visited pages. */
  offlineSupport: z.boolean(),
  /** Highlighted shortcuts shown in the installed app's long-press menu. */
  shortcuts: z
    .array(z.object({ label: z.string().trim().max(40), href: z.string().trim().max(200), icon: z.string().trim().max(40) }))
    .max(6),
});

export type PwaSettings = z.infer<typeof pwaSettingsSchema>;

const DEFAULT_PWA: PwaSettings = {
  enabled: true,
  appName: "ICDL With Mehrdad",
  shortName: "ICDL",
  description: "آموزش تعاملی مهارت‌های ICDL — درس‌ها، تمرین‌ها و آزمون‌ها به زبان ساده",
  themeColor: "#4f46e5",
  backgroundColor: "#ffffff",
  display: "standalone",
  orientation: "portrait-primary",
  showInstallPrompt: true,
  offlineSupport: true,
  shortcuts: [
    { label: "ادامه یادگیری", href: "/progress", icon: "TrendingUp" },
    { label: "فهرست دوره", href: "/course", icon: "BookOpen" },
    { label: "جستجو", href: "/search", icon: "Search" },
  ],
};

// ── Registry ─────────────────────────────────────────────────

export const SETTINGS_SCHEMAS = {
  site: siteSettingsSchema,
  appearance: appearanceSettingsSchema,
  home: homeSettingsSchema,
  course: courseSettingsSchema,
  navigation: navigationSettingsSchema,
  chatbot: chatbotSettingsSchema,
  search: searchSettingsSchema,
  auth: authSettingsSchema,
  mail: mailSettingsSchema,
  pwa: pwaSettingsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;

export type SettingsShape = {
  site: SiteSettings;
  appearance: AppearanceSettings;
  home: HomeSettings;
  course: CourseSettings;
  navigation: NavigationSettings;
  chatbot: ChatbotSettings;
  search: SearchSettings;
  auth: AuthSettings;
  mail: MailSettings;
  pwa: PwaSettings;
};

export const SETTINGS_DEFAULTS: SettingsShape = {
  site: DEFAULT_SITE,
  appearance: DEFAULT_APPEARANCE,
  home: DEFAULT_HOME,
  course: DEFAULT_COURSE,
  navigation: DEFAULT_NAVIGATION,
  chatbot: DEFAULT_CHATBOT,
  search: DEFAULT_SEARCH,
  auth: DEFAULT_AUTH,
  mail: DEFAULT_MAIL,
  pwa: DEFAULT_PWA,
};

export const SETTINGS_LABELS: Record<SettingsKey, { title: string; description: string }> = {
  site: { title: "هویت سایت", description: "نام، شعار، توضیح، لوگو و رنگ اصلی" },
  appearance: { title: "ظاهر و قالب", description: "فونت، گردی گوشه‌ها و حالت پیش‌فرض رنگ" },
  home: { title: "صفحه اصلی", description: "متن‌های صفحه اول و بخش‌هایی که نمایش داده می‌شوند" },
  course: { title: "معرفی دوره", description: "عنوان و توضیح کلی دوره" },
  navigation: { title: "منو و پاصفحه", description: "پیوندهای پاورقی، متن پایین سایت و اعتبار سازنده" },
  chatbot: { title: "چت‌بات هوش مصنوعی", description: "انتخاب سرویس‌دهنده، مدل، پرامپت و دکمه‌های سریع" },
  search: { title: "جستجو", description: "موتور جستجو و عبارت‌های پرطرفدار" },
  auth: { title: "حساب کاربری", description: "ثبت‌نام، نقش پیش‌فرض، پیام خوش‌آمد و بازیابی رمز عبور" },
  mail: { title: "ایمیل (SMTP)", description: "سرویس ارسال ایمیل برای بازیابی رمز عبور و اطلاع‌رسانی" },
  pwa: { title: "نسخه نصب‌شدنی (PWA)", description: "نام برنامه، رنگ‌ها، پشتیبانی آفلاین و دکمه نصب" },
};

/** Settings keys that contain secrets and must be masked before reaching the client. */
export const SECRET_SETTING_FIELDS: Partial<Record<SettingsKey, string[]>> = {
  chatbot: ["apiKey"],
  search: ["meilisearchApiKey"],
  mail: ["password"],
};

/** Returns a copy of the chatbot settings with API keys replaced by a mask. */
export function maskSettings<K extends SettingsKey>(
  key: K,
  value: SettingsShape[K],
): SettingsShape[K] {
  const secretFields = SECRET_SETTING_FIELDS[key];
  if (!secretFields) return value;

  const clone = { ...(value as Record<string, unknown>) };
  for (const field of secretFields) {
    const current = clone[field];
    if (typeof current === "string" && current.length > 0) {
      clone[field] = `${current.slice(0, 4)}••••••••`;
    }
  }
  return clone as SettingsShape[K];
}
