import type { BlockType, BlockData, CalloutTone, ExerciseKind, DemoKind } from "./blocks";

/**
 * Presentation metadata for the block palette used by the admin content
 * builder. Kept deliberately free of Zod so the editor bundle stays small.
 */

export type BlockCategory = "structure" | "text" | "media" | "interactive" | "assessment" | "support";

export type BlockLibraryEntry = {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  category: BlockCategory;
  createDefault: () => BlockData;
};

export const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  structure: "ساختار درس",
  text: "متن و توضیح",
  media: "تصویر و ویدئو",
  interactive: "تعاملی و تمرین",
  assessment: "ارزشیابی",
  support: "پشتیبانی",
};

export const BLOCK_LIBRARY: BlockLibraryEntry[] = [
  {
    type: "objectives",
    label: "اهداف درس",
    description: "فهرست چیزهایی که کاربر در این درس یاد می‌گیرد",
    icon: "Target",
    category: "structure",
    createDefault: () => ({
      title: "در این درس یاد می‌گیرید",
      items: ["نوشتن هدف اول", "نوشتن هدف دوم"],
    }),
  },
  {
    type: "heading",
    label: "سرتیتر",
    description: "سرتیتر بخش‌بندی برای تقسیم درس به قسمت‌های کوچک",
    icon: "Heading2",
    category: "structure",
    createDefault: () => ({ text: "سرتیتر بخش", level: 2 }),
  },
  {
    type: "text",
    label: "متن",
    description: "پاراگراف توضیحی با امکان قالب‌بندی ساده",
    icon: "Type",
    category: "text",
    createDefault: () => ({ html: "<p>متن توضیح خود را اینجا بنویسید.</p>" }),
  },
  {
    type: "definition",
    label: "تعریف اصطلاح",
    description: "تعریف یک اصطلاح تخصصی به زبان ساده",
    icon: "BookMarked",
    category: "text",
    createDefault: () => ({
      term: "اصطلاح",
      definition: "<p>تعریف ساده این اصطلاح…</p>",
    }),
  },
  {
    type: "callout",
    label: "کادر توضیح",
    description: "کادر رنگی برای تأکید روی یک مطلب مهم",
    icon: "MessageSquare",
    category: "text",
    createDefault: () => ({
      tone: "info",
      title: "توجه",
      html: "<p>متن توضیح…</p>",
    }),
  },
  {
    type: "tip",
    label: "نکته",
    description: "نکته کاربردی و میان‌بر برای ساده‌تر شدن کار",
    icon: "Lightbulb",
    category: "text",
    createDefault: () => ({ title: "نکته", html: "<p>نکته کاربردی…</p>" }),
  },
  {
    type: "warning",
    label: "هشدار",
    description: "هشدار درباره اشتباه‌های رایج یا خطر امنیتی",
    icon: "TriangleAlert",
    category: "text",
    createDefault: () => ({ title: "هشدار", html: "<p>مراقب باشید…</p>" }),
  },
  {
    type: "example",
    label: "مثال",
    description: "مثال واقعی برای درک بهتر مفهوم",
    icon: "Quote",
    category: "text",
    createDefault: () => ({ title: "مثال", html: "<p>مثال واقعی…</p>" }),
  },
  {
    type: "image",
    label: "تصویر",
    description: "افزودن تصویر همراه با متن جانشین و توضیح",
    icon: "Image",
    category: "media",
    createDefault: () => ({ url: "", alt: "توضیح تصویر", caption: "" }),
  },
  {
    type: "gallery",
    label: "گالری تصویر",
    description: "چند تصویر در کنار هم برای مقایسه",
    icon: "Images",
    category: "media",
    createDefault: () => ({
      columns: 2,
      images: [
        { url: "", alt: "تصویر ۱" },
        { url: "", alt: "تصویر ۲" },
      ],
    }),
  },
  {
    type: "video",
    label: "ویدئو",
    description: "ویدئوی آموزشی از یوتیوب یا فایل",
    icon: "PlayCircle",
    category: "media",
    createDefault: () => ({ url: "", title: "ویدئوی آموزشی" }),
  },
  {
    type: "table",
    label: "جدول",
    description: "جدول ساده برای مقایسه یا فهرست کردن موارد",
    icon: "Table",
    category: "structure",
    createDefault: () => ({
      headers: ["عنوان ۱", "عنوان ۲"],
      rows: [["مقدار ۱", "مقدار ۲"]],
    }),
  },
  {
    type: "keyboard",
    label: "میان‌بر کیبورد",
    description: "نمایش کلیدهای میان‌بر به شکل کلید واقعی",
    icon: "Keyboard",
    category: "text",
    createDefault: () => ({
      title: "میان‌برهای کیبورد",
      shortcuts: [{ keys: ["Ctrl", "C"], description: "کپی کردن" }],
    }),
  },
  {
    type: "code",
    label: "متن فنی / نمونه",
    description: "نمایش متن فنی، دستور یا نمونه با فونت ثابت",
    icon: "Code",
    category: "text",
    createDefault: () => ({ code: "نمونه متن", language: "" }),
  },
  {
    type: "steps",
    label: "مرحله به مرحله",
    description: "آموزش گام‌به‌گام با شماره مرحله و پیشرفت",
    icon: "ListOrdered",
    category: "interactive",
    createDefault: () => ({
      title: "مرحله به مرحله",
      steps: [
        { title: "مرحله اول", html: "<p>توضیح مرحله اول…</p>" },
        { title: "مرحله دوم", html: "<p>توضیح مرحله دوم…</p>" },
      ],
    }),
  },
  {
    type: "practice",
    label: "تمرین عملی",
    description: "کار عملی که کاربر باید روی کامپیوتر خود انجام دهد",
    icon: "PencilRuler",
    category: "interactive",
    createDefault: () => ({
      title: "تمرین کنید",
      html: "<p>این تمرین را روی کامپیوتر خود انجام دهید…</p>",
      checklist: ["تمرین را انجام دادم"],
    }),
  },
  {
    type: "exercise",
    label: "تمرین تعاملی",
    description: "تمرین داخل صفحه با بازخورد فوری (اکسل، ورد، مرورگر و…)",
    icon: "MousePointerClick",
    category: "interactive",
    createDefault: () => ({
      title: "تمرین تعاملی",
      instructions: "<p>تمرین زیر را انجام دهید.</p>",
      maxAttempts: 3,
      exercise: {
        kind: "mcq",
        options: [
          { id: "a", text: "گزینه اول" },
          { id: "b", text: "گزینه دوم" },
        ],
        correctOptionId: "a",
      },
    }),
  },
  {
    type: "demo",
    label: "نمایش تعاملی",
    description: "شبیه‌سازی قابل کاوش محیط ویندوز، ورد، اکسل و مرورگر",
    icon: "MonitorPlay",
    category: "interactive",
    createDefault: () => ({
      title: "نمایش تعاملی",
      demo: { kind: "windowsDesktop" },
    }),
  },
  {
    type: "quiz",
    label: "محل نمایش آزمون",
    description: "آزمون درس در این نقطه از صفحه نمایش داده می‌شود",
    icon: "ClipboardCheck",
    category: "assessment",
    createDefault: () => ({ title: "آزمون این درس", anchor: true }),
  },
  {
    type: "faq",
    label: "پرسش‌های پرتکرار",
    description: "پرسش و پاسخ درباره همین موضوع",
    icon: "HelpCircle",
    category: "support",
    createDefault: () => ({
      title: "پرسش‌های پرتکرار",
      items: [{ question: "پرسش نمونه؟", answer: "<p>پاسخ نمونه…</p>" }],
    }),
  },
  {
    type: "resource",
    label: "فایل تمرین",
    description: "لینک دانلود فایل تمرین یا منابع تکمیلی",
    icon: "Paperclip",
    category: "support",
    createDefault: () => ({
      title: "فایل‌های تمرین",
      items: [{ label: "فایل تمرین ۱", url: "#", kind: "link" }],
    }),
  },
  {
    type: "summary",
    label: "خلاصه درس",
    description: "جمع‌بندی کوتاه و نکات کلیدی درس",
    icon: "BookOpenCheck",
    category: "structure",
    createDefault: () => ({
      title: "خلاصه درس",
      html: "<p>در این درس یاد گرفتیم…</p>",
      points: [],
    }),
  },
  {
    type: "relatedLessons",
    label: "درس‌های مرتبط",
    description: "هدایت کاربر به درس‌های مرتبط بعدی",
    icon: "GitBranch",
    category: "support",
    createDefault: () => ({ title: "درس‌های مرتبط", lessonSlugs: [] }),
  },
  {
    type: "divider",
    label: "خط جداکننده",
    description: "جدا کردن بخش‌های مختلف درس",
    icon: "Minus",
    category: "structure",
    createDefault: () => ({}),
  },
];

const blockLibraryIndex = new Map<string, BlockLibraryEntry>(
  BLOCK_LIBRARY.map((entry) => [entry.type, entry]),
);

export function getBlockLibraryEntry(type: string): BlockLibraryEntry | undefined {
  return blockLibraryIndex.get(type);
}

export function getBlockLabel(type: string): string {
  return blockLibraryIndex.get(type)?.label ?? type;
}

export function createBlockData(type: BlockType): BlockData {
  const entry = blockLibraryIndex.get(type);
  if (!entry) {
    throw new Error(`نوع بلوک ناشناخته: ${type}`);
  }
  return entry.createDefault();
}

// ─────────────────────────────────────────────────────────────
// Tone + exercise + demo labels
// ─────────────────────────────────────────────────────────────

export const TONE_LABELS: Record<CalloutTone, string> = {
  info: "اطلاع‌رسانی",
  success: "موفقیت",
  warning: "هشدار",
  danger: "خطر",
  neutral: "خنثی",
};

export const EXERCISE_KIND_LABELS: Record<ExerciseKind, string> = {
  mcq: "چند گزینه‌ای",
  trueFalse: "درست / غلط",
  fillBlank: "جای خالی",
  matching: "تطبیق دادن",
  orderSteps: "مرتب‌سازی مراحل",
  excelFormula: "کار با اکسل (فرمول)",
  wordFormat: "کار با ورد (قالب‌بندی)",
  browserSearch: "کار با مرورگر",
  fileExplorer: "کار با فایل‌ها",
  emailCompose: "نوشتن ایمیل",
};

export const DEMO_KIND_LABELS: Record<DemoKind, string> = {
  windowsDesktop: "محیط ویندوز",
  fileExplorer: "پنجره فایل‌ها (File Explorer)",
  wordEditor: "محیط ورد",
  excelSheet: "محیط اکسل",
  browser: "مرورگر اینترنت",
  powerPoint: "محیط پاورپوینت",
};

export const RESOURCE_KIND_LABELS: Record<string, string> = {
  pdf: "PDF",
  doc: "سند ورد",
  sheet: "فایل اکسل",
  slide: "فایل پاورپوینت",
  zip: "فایل فشرده",
  link: "پیوند",
};
