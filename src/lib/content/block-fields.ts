import type { BlockType, DemoKind, ExerciseKind } from "@/lib/content/blocks";
import { BLOCK_CATEGORY_LABELS, BLOCK_LIBRARY } from "@/lib/content/block-library";

/**
 * Visual field descriptors for the content builder.
 *
 * Each block type declares what it contains, and one generic editor renders the
 * right controls. This is what lets administrators build lessons without ever
 * seeing JSON, while keeping the form definitions in a single reviewable place.
 */

export type FieldKind =
  | "text"
  | "textarea"
  | "html"
  | "number"
  | "select"
  | "tone"
  | "level"
  | "textList"
  | "slugList"
  | "image"
  | "table"
  | "steps"
  | "faqItems"
  | "resourceItems"
  | "shortcutItems"
  | "optionsWithCorrect"
  | "matchingPairs"
  | "items"
  | "exercise"
  | "demo";

export type FieldDescriptor = {
  name: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  /** Sub-fields for `items`-style collections. */
  template?: Record<string, unknown>;
  emptyLabel?: string;
};

const TONE_OPTIONS = [
  { value: "info", label: "اطلاع‌رسانی" },
  { value: "success", label: "موفقیت" },
  { value: "warning", label: "هشدار" },
  { value: "danger", label: "خطر" },
  { value: "neutral", label: "خنثی" },
];

const LEVEL_OPTIONS = [
  { value: "2", label: "سرتیتر اصلی" },
  { value: "3", label: "سرتیتر فرعی" },
  { value: "4", label: "سرتیتر کوچک" },
];

export const BLOCK_FIELDS: Record<BlockType, FieldDescriptor[]> = {
  objectives: [
    { name: "title", label: "عنوان", kind: "text" },
    { name: "items", label: "مواردی که یاد گرفته می‌شود", kind: "textList", emptyLabel: "هدف جدید" },
  ],
  heading: [
    { name: "text", label: "متن سرتیتر", kind: "text" },
    { name: "level", label: "سطح سرتیتر", kind: "level", options: LEVEL_OPTIONS },
  ],
  text: [{ name: "html", label: "متن", kind: "html" }],
  definition: [
    { name: "term", label: "اصطلاح", kind: "text" },
    { name: "definition", label: "تعریف", kind: "html" },
    { name: "example", label: "مثال (اختیاری)", kind: "text" },
  ],
  callout: [
    { name: "tone", label: "رنگ و حس کادر", kind: "tone", options: TONE_OPTIONS },
    { name: "title", label: "عنوان (اختیاری)", kind: "text" },
    { name: "html", label: "متن", kind: "html" },
  ],
  tip: [
    { name: "title", label: "عنوان", kind: "text" },
    { name: "html", label: "متن نکته", kind: "html" },
  ],
  warning: [
    { name: "title", label: "عنوان", kind: "text" },
    { name: "html", label: "متن هشدار", kind: "html" },
  ],
  example: [
    { name: "title", label: "عنوان", kind: "text" },
    { name: "html", label: "متن مثال", kind: "html" },
  ],
  image: [
    { name: "url", label: "نشانی تصویر", kind: "image" },
    { name: "alt", label: "متن جانشین (برای دسترس‌پذیری)", kind: "text" },
    { name: "caption", label: "توضیح زیر تصویر (اختیاری)", kind: "text" },
  ],
  gallery: [
    { name: "columns", label: "تعداد ستون", kind: "select", options: [{ value: "2", label: "دو ستون" }, { value: "3", label: "سه ستون" }] },
    { name: "images", label: "تصویرها", kind: "image", emptyLabel: "تصویر" },
  ],
  video: [
    { name: "url", label: "نشانی ویدیو (یوتیوب، آپارات یا فایل)", kind: "text" },
    { name: "title", label: "عنوان ویدیو", kind: "text" },
    { name: "caption", label: "توضیح (اختیاری)", kind: "text" },
  ],
  table: [
    { name: "caption", label: "عنوان جدول (اختیاری)", kind: "text" },
    { name: "headers", label: "سرستون‌ها", kind: "textList", emptyLabel: "سرستون جدید" },
    { name: "rows", label: "سطرها", kind: "table" },
  ],
  keyboard: [
    { name: "title", label: "عنوان", kind: "text" },
    { name: "shortcuts", label: "میان‌برها", kind: "shortcutItems", emptyLabel: "میان‌بر جدید" },
  ],
  code: [
    { name: "code", label: "متن", kind: "textarea", hint: "برای متن فنی یا نمونه دستور" },
    { name: "language", label: "زبان (اختیاری)", kind: "text" },
    { name: "caption", label: "توضیح (اختیاری)", kind: "text" },
  ],
  steps: [
    { name: "title", label: "عنوان", kind: "text" },
    {
      name: "steps",
      label: "مراحل",
      kind: "steps",
      emptyLabel: "مرحله جدید",
      template: { title: "مرحله جدید", html: "<p>توضیح این مرحله…</p>", tip: "", imageUrl: "" },
    },
  ],
  practice: [
    { name: "title", label: "عنوان", kind: "text" },
    { name: "html", label: "توضیح تمرین", kind: "html" },
    { name: "checklist", label: "چک‌لیست خودارزیابی", kind: "textList", emptyLabel: "مورد جدید" },
  ],
  exercise: [
    { name: "title", label: "عنوان تمرین", kind: "text" },
    { name: "instructions", label: "دستور تمرین", kind: "html" },
    { name: "maxAttempts", label: "تعداد نوبت بررسی", kind: "number", min: 1, max: 20 },
    { name: "exercise", label: "نوع و محتوای تمرین", kind: "exercise" },
  ],
  demo: [
    { name: "title", label: "عنوان نمایش", kind: "text" },
    { name: "instructions", label: "توضیح (اختیاری)", kind: "html" },
    { name: "demo", label: "محیط شبیه‌سازی‌شده", kind: "demo" },
  ],
  quiz: [{ name: "title", label: "عنوان بخش آزمون", kind: "text" }],
  faq: [
    { name: "title", label: "عنوان", kind: "text" },
    { name: "items", label: "پرسش و پاسخ‌ها", kind: "faqItems", emptyLabel: "پرسش جدید" },
  ],
  resource: [
    { name: "title", label: "عنوان", kind: "text" },
    { name: "items", label: "فایل‌ها", kind: "resourceItems", emptyLabel: "فایل جدید" },
  ],
  summary: [
    { name: "title", label: "عنوان", kind: "text" },
    { name: "html", label: "متن خلاصه", kind: "html" },
    { name: "points", label: "نکات کلیدی", kind: "textList", emptyLabel: "نکته جدید" },
  ],
  relatedLessons: [
    { name: "title", label: "عنوان", kind: "text" },
    {
      name: "lessonSlugs",
      label: "نامک درس‌ها",
      kind: "slugList",
      hint: "نامک هر درس، مثلاً moarefi-avalieh/fayl-va-pooshe/mafhoom-fayl-va-pooshe یا فقط بخش آخر آن",
    },
  ],
  divider: [],
};

// ── Exercise descriptors ─────────────────────────────────────

export const EXERCISE_FIELDS: Record<ExerciseKind, FieldDescriptor[]> = {
  mcq: [{ name: "options", label: "گزینه‌ها و پاسخ درست", kind: "optionsWithCorrect" }],
  trueFalse: [
    { name: "statement", label: "جمله", kind: "text" },
    { name: "isTrue", label: "پاسخ درست", kind: "select", options: [{ value: "true", label: "درست" }, { value: "false", label: "غلط" }] },
  ],
  fillBlank: [
    { name: "template", label: "متن با جای خالی", kind: "textarea", hint: "جای هر خالی را با سه زیرخط ___ مشخص کنید." },
    {
      name: "blanks",
      label: "پاسخ‌های پذیرفته‌شده",
      kind: "textList",
      emptyLabel: "پاسخ",
      hint: "برای هر جای خالی یک ردیف؛ چند پاسخ درست را با ویرگول جدا کنید.",
    },
  ],
  matching: [{ name: "pairs", label: "جفت‌های درست", kind: "matchingPairs" }],
  orderSteps: [{ name: "items", label: "مراحل به ترتیب درست", kind: "textList", emptyLabel: "مرحله" }],
  excelFormula: [
    { name: "columns", label: "عنوان ستون‌ها", kind: "textList", emptyLabel: "ستون" },
    { name: "rows", label: "داده‌های جدول", kind: "table" },
    { name: "targetRow", label: "شماره سطر سلول هدف", kind: "number", min: 1 },
    { name: "targetColumn", label: "شماره ستون سلول هدف", kind: "number", min: 1 },
    { name: "acceptedFormulas", label: "فرمول‌های درست", kind: "textList", emptyLabel: "فرمول", hint: "مثلاً =SUM(B2:B4" },
    { name: "acceptedValues", label: "مقادیر عددی درست (اختیاری)", kind: "textList", emptyLabel: "مقدار" },
  ],
  wordFormat: [
    { name: "text", label: "متن تمرین", kind: "textarea", hint: "هر خط یک پاراگراف است." },
    {
      name: "tasks",
      label: "قالب‌بندی‌های خواسته‌شده",
      kind: "textList",
      emptyLabel: "کار",
      hint: "هر کار را با یکی از کدهای bold، italic، underline، alignRight، alignCenter، bulletList، numberedList بنویسید؛ مثلاً: bold|پررنگ کردن عنوان",
    },
  ],
  browserSearch: [
    {
      name: "results",
      label: "نتایجی که نمایش داده می‌شود",
      kind: "items",
      emptyLabel: "نتیجه",
      template: { title: "عنوان نتیجه", url: "www.example.com", snippet: "توضیح کوتاه" },
    },
    {
      name: "tasks",
      label: "کارهای خواسته‌شده",
      kind: "items",
      emptyLabel: "کار",
      template: { kind: "search", label: "عبارت زیر را جستجو کنید", match: "" },
    },
  ],
  fileExplorer: [
    {
      name: "files",
      label: "فایل‌های نمایش‌داده‌شده",
      kind: "items",
      emptyLabel: "فایل",
      template: { name: "نام فایل.txt", kind: "document", sizeKb: 100, modified: "۱۴۰۳/۰۱/۰۱" },
    },
    {
      name: "tasks",
      label: "کارهای خواسته‌شده",
      kind: "items",
      emptyLabel: "کار",
      template: { kind: "sortName", label: "فایل‌ها را بر اساس نام مرتب کنید" },
    },
  ],
  emailCompose: [
    {
      name: "expected",
      label: "مقادیر درست",
      kind: "items",
      emptyLabel: "ایمیل",
      template: { to: "someone@example.com", cc: "", subject: "موضوع درست", bodyIncludes: "", attach: true },
    },
    {
      name: "attachments",
      label: "فایل‌های قابل پیوست",
      kind: "items",
      emptyLabel: "پیوست",
      template: { id: "file1", name: "فایل-تمرین.docx" },
    },
  ],
};

export const DEMO_FIELDS: Record<DemoKind, FieldDescriptor[]> = {
  windowsDesktop: [{ name: "hint", label: "راهنمای تمرین", kind: "text" }],
  fileExplorer: [
    { name: "folders", label: "پوشه‌ها", kind: "textList", emptyLabel: "پوشه" },
    { name: "files", label: "فایل‌ها", kind: "textList", emptyLabel: "فایل" },
    { name: "hint", label: "راهنمای تمرین", kind: "text" },
  ],
  wordEditor: [
    { name: "initialText", label: "متن اولیه", kind: "textarea" },
    { name: "hint", label: "راهنمای تمرین", kind: "text" },
  ],
  excelSheet: [
    { name: "columns", label: "عنوان ستون‌ها", kind: "textList", emptyLabel: "ستون" },
    { name: "rows", label: "داده‌ها", kind: "table" },
    { name: "hint", label: "راهنمای تمرین", kind: "text" },
  ],
  browser: [
    {
      name: "results",
      label: "نتایج نمایش‌داده‌شده",
      kind: "items",
      emptyLabel: "نتیجه",
      template: { title: "عنوان", url: "www.example.com", snippet: "توضیح" },
    },
    { name: "hint", label: "راهنمای تمرین", kind: "text" },
  ],
  powerPoint: [
    {
      name: "slides",
      label: "اسلایدها",
      kind: "items",
      emptyLabel: "اسلاید",
      template: { title: "عنوان اسلاید", body: "" },
    },
    { name: "hint", label: "راهنمای تمرین", kind: "text" },
  ],
};

export const EXERCISE_KIND_FIELDS: { value: ExerciseKind; label: string }[] = [
  { value: "mcq", label: "چند گزینه‌ای" },
  { value: "trueFalse", label: "درست / غلط" },
  { value: "fillBlank", label: "جای خالی" },
  { value: "matching", label: "تطبیق دادن" },
  { value: "orderSteps", label: "مرتب‌سازی مراحل" },
  { value: "excelFormula", label: "کار با اکسل (فرمول)" },
  { value: "wordFormat", label: "کار با ورد (قالب‌بندی)" },
  { value: "browserSearch", label: "کار با مرورگر" },
  { value: "fileExplorer", label: "کار با فایل‌ها" },
  { value: "emailCompose", label: "نوشتن ایمیل" },
];

export const DEMO_KIND_FIELDS: { value: DemoKind; label: string }[] = [
  { value: "windowsDesktop", label: "محیط ویندوز" },
  { value: "fileExplorer", label: "پنجره فایل‌ها" },
  { value: "wordEditor", label: "محیط ورد" },
  { value: "excelSheet", label: "محیط اکسل" },
  { value: "browser", label: "مرورگر اینترنت" },
  { value: "powerPoint", label: "محیط پاورپوینت" },
];

/** Fields shown when adding a new question, by question type. */
export const QUESTION_FIELDS: Record<string, FieldDescriptor[]> = {
  MULTIPLE_CHOICE: [{ name: "options", label: "گزینه‌ها و پاسخ درست", kind: "optionsWithCorrect" }],
  TRUE_FALSE: [
    { name: "isTrue", label: "پاسخ درست", kind: "select", options: [{ value: "true", label: "درست" }, { value: "false", label: "غلط" }] },
  ],
  FILL_BLANK: [{ name: "accepted", label: "پاسخ‌های پذیرفته‌شده", kind: "textList", emptyLabel: "پاسخ" }],
  MATCHING: [{ name: "pairs", label: "جفت‌های درست", kind: "matchingPairs" }],
  PRACTICAL: [{ name: "checklist", label: "موارد چک‌لیست", kind: "textList", emptyLabel: "مورد" }],
};

export { BLOCK_CATEGORY_LABELS, BLOCK_LIBRARY };
export type { BlockType };
