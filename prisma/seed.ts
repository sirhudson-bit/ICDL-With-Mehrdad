import { PrismaClient, type Prisma } from "@prisma/client";

import { curriculum, curriculumStats, type SeedLesson, type SeedQuestion } from "./content";
import {
  blockToSearchText,
  validateBlockData,
  type BlockData,
  type BlockType,
} from "../src/lib/content/blocks";
import { hashPassword } from "../src/lib/auth/password";
import { buildSearchText, normalizePersian, toPersianDigits } from "../src/lib/persian";
import { SETTINGS_DEFAULTS, SETTINGS_SCHEMAS, type SettingsKey } from "../src/lib/settings";

const prisma = new PrismaClient();

const SEED_DOMAIN = "icdl.local";

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

type PreparedBlock = { type: BlockType; data: BlockData; searchText: string };

/**
 * Validates the entire curriculum before a single row is written, so a typo in
 * the content surfaces as a clear error instead of a half-populated database.
 */
function prepareContent() {
  const errors: string[] = [];
  const seenLessonSlugs = new Set<string>();
  const seenChapterSlugs = new Set<string>();
  const seenModuleSlugs = new Set<string>();

  const prepared = curriculum.map((courseModule, moduleIndex) => {
    if (seenModuleSlugs.has(courseModule.slug)) errors.push(`ماژول تکراری: ${courseModule.slug}`);
    seenModuleSlugs.add(courseModule.slug);

    const chapters = courseModule.chapters.map((chapter) => {
      if (seenChapterSlugs.has(chapter.slug)) errors.push(`فصل تکراری: ${chapter.slug}`);
      seenChapterSlugs.add(chapter.slug);

      const lessons = chapter.lessons.map((lesson) => {
        if (seenLessonSlugs.has(lesson.slug)) {
          errors.push(`نامک درس تکراری (باید یکتا باشد): ${lesson.slug}`);
        }
        seenLessonSlugs.add(lesson.slug);

        const blocks: PreparedBlock[] = lesson.blocks.map((block, blockIndex) => {
          const result = validateBlockData(block.type, block.data);
          if (!result.ok) {
            errors.push(
              `${courseModule.slug}/${chapter.slug}/${lesson.slug} بلوک #${blockIndex + 1} (${block.type}): ${result.errors.join(", ")}`,
            );
            return { type: block.type, data: block.data as BlockData, searchText: "" };
          }
          return {
            type: block.type,
            data: result.data,
            searchText: blockToSearchText(block.type, result.data),
          };
        });

        return { lesson, blocks };
      });

      return { chapter, lessons };
    });

    return { courseModule, moduleIndex, chapters };
  });

  if (errors.length > 0) {
    throw new Error(`محتوای دوره معتبر نیست:\n${errors.map((error) => ` - ${error}`).join("\n")}`);
  }

  return prepared;
}

function lessonSearchText(lesson: SeedLesson, blocks: PreparedBlock[]): string {
  const quizText = lesson.quiz
    ? lesson.quiz.questions.map((question) => `${question.prompt} ${questionAnswerText(question)}`).join(" ")
    : "";
  const faqText = lesson.faqs?.map((item) => `${item.question} ${item.answer}`).join(" ") ?? "";

  return buildSearchText([
    lesson.title,
    lesson.summary,
    lesson.keywords ?? "",
    ...blocks.map((block) => block.searchText),
    quizText,
    faqText,
  ]);
}

function questionAnswerText(question: SeedQuestion): string {
  switch (question.type) {
    case "MULTIPLE_CHOICE":
      return question.options.map((option) => option.text).join(" ");
    case "MATCHING":
      return [...question.left, ...question.right].map((item) => item.text).join(" ");
    case "FILL_BLANK":
      return question.accepted.join(" ");
    case "PRACTICAL":
      return question.checklist.join(" ");
    default:
      return "";
  }
}

/** Strips the discriminator fields so the remaining object is the JSON payload. */
function questionData(question: SeedQuestion): Prisma.InputJsonValue {
  const { prompt: _prompt, hint: _hint, explanation: _explanation, points: _points, type: _type, ...payload } = question;
  return payload as unknown as Prisma.InputJsonValue;
}

// ─────────────────────────────────────────────────────────────
// Seeding
// ─────────────────────────────────────────────────────────────

async function clearContent() {
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.searchHistory.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.lessonBlock.deleteMany();
  await prisma.faq.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.module.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.media.deleteMany();
  await prisma.setting.deleteMany();
  // Seed-owned accounts only, so real accounts survive a re-seed.
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${SEED_DOMAIN}` } } });
}

async function seedSettings() {
  const keys = Object.keys(SETTINGS_SCHEMAS) as SettingsKey[];

  for (const key of keys) {
    const schema = SETTINGS_SCHEMAS[key];
    const parsed = schema.safeParse(SETTINGS_DEFAULTS[key]);
    if (!parsed.success) {
      throw new Error(`تنظیمات پیش‌فرض «${key}» معتبر نیست: ${parsed.error.message}`);
    }

    await prisma.setting.create({
      data: { key, value: parsed.data as Prisma.InputJsonValue },
    });
  }

  console.log(`  ✓ ${toPersianDigits(keys.length)} گروه تنظیمات ساخته شد`);
}

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? `mehrdad@${SEED_DOMAIN}`;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Mehrdad@1398";
  const learnerEmail = process.env.SEED_LEARNER_EMAIL ?? `learner@${SEED_DOMAIN}`;
  const learnerPassword = process.env.SEED_LEARNER_PASSWORD ?? "Learner@1398";

  const [adminHash, learnerHash] = await Promise.all([
    hashPassword(adminPassword),
    hashPassword(learnerPassword),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: "مهرداد",
      passwordHash: adminHash,
      role: "ADMIN",
      bio: "مدیر و مدرس این پلتفرم",
    },
  });

  const learner = await prisma.user.create({
    data: {
      email: learnerEmail,
      name: "کاربر نمونه",
      passwordHash: learnerHash,
      role: "LEARNER",
      streakCount: 4,
      lastStreakDate: new Date(),
    },
  });

  // A few extra learners so the admin dashboard has meaningful statistics.
  const sampleNames = ["زهرا محمدی", "علی رضایی", "مریم کریمی", "حسن نوری", "نرگس احمدی"];
  const sampleHash = await hashPassword("Sample@1398");
  const samples = [];
  for (const [index, name] of sampleNames.entries()) {
    samples.push(
      await prisma.user.create({
        data: {
          email: `sample${index + 1}@${SEED_DOMAIN}`,
          name,
          passwordHash: sampleHash,
          role: "LEARNER",
          streakCount: index % 5,
          lastActiveAt: new Date(Date.now() - index * 86_400_000 * 2),
        },
      }),
    );
  }

  console.log(`  ✓ حساب مدیر: ${adminEmail} / ${adminPassword}`);
  console.log(`  ✓ حساب کاربر نمونه: ${learnerEmail} / ${learnerPassword}`);
  console.log(`  ✓ ${toPersianDigits(samples.length)} کاربر نمونه اضافه شد`);

  return { admin, learner, samples };
}

async function main() {
  console.log("▶ آماده‌سازی پایگاه داده ICDL With Mehrdad\n");

  const prepared = prepareContent();

  console.log("• پاک کردن داده‌های قبلی…");
  await clearContent();

  console.log("• ساخت تنظیمات پیش‌فرض…");
  await seedSettings();

  console.log("• ساخت حساب‌های کاربری…");
  const users = await seedUsers();

  console.log("• درج ساختار دوره…");

  let moduleCount = 0;
  let chapterCount = 0;
  let lessonCount = 0;
  let blockCount = 0;
  let questionCount = 0;

  for (const [moduleIndex, { courseModule, chapters }] of prepared.entries()) {
    const lessonSummaries: string[] = [];
    let moduleMinutes = 0;

    const createdModule = await prisma.module.create({
      data: {
        slug: courseModule.slug,
        number: courseModule.number,
        title: courseModule.title,
        subtitle: courseModule.subtitle ?? null,
        description: courseModule.description,
        icon: courseModule.icon,
        color: courseModule.color,
        group: courseModule.group,
        estimatedMinutes: 0,
        isPublished: true,
        order: moduleIndex,
        searchText: "",
      },
    });
    moduleCount += 1;

    for (const [chapterIndex, { chapter, lessons }] of chapters.entries()) {
      const createdChapter = await prisma.chapter.create({
        data: {
          moduleId: createdModule.id,
          slug: chapter.slug,
          title: chapter.title,
          description: chapter.description ?? null,
          order: chapterIndex,
          isPublished: true,
          searchText: buildSearchText([
            chapter.title,
            chapter.description ?? "",
            ...lessons.map((item) => `${item.lesson.title} ${item.lesson.summary}`),
          ]),
        },
      });
      chapterCount += 1;

      for (const [lessonIndex, { lesson, blocks }] of lessons.entries()) {
        const minutes = lesson.estimatedMinutes ?? 10;
        moduleMinutes += minutes;
        lessonSummaries.push(`${lesson.title} ${lesson.summary} ${lesson.keywords ?? ""}`);

        const createdLesson = await prisma.lesson.create({
          data: {
            chapterId: createdChapter.id,
            slug: lesson.slug,
            title: lesson.title,
            summary: lesson.summary,
            keywords: lesson.keywords ?? "",
            order: lessonIndex,
            estimatedMinutes: minutes,
            difficulty: lesson.difficulty ?? "BEGINNER",
            isPublished: true,
            publishedAt: new Date(),
            seoTitle: lesson.seoTitle ?? `${lesson.title} | آموزش ICDL`,
            seoDescription: lesson.seoDescription ?? lesson.summary,
            searchText: lessonSearchText(lesson, blocks),
          },
        });
        lessonCount += 1;

        if (blocks.length > 0) {
          await prisma.lessonBlock.createMany({
            data: blocks.map((block, blockIndex) => ({
              lessonId: createdLesson.id,
              type: block.type,
              order: blockIndex,
              isVisible: true,
              data: block.data as unknown as Prisma.InputJsonValue,
            })),
          });
          blockCount += blocks.length;
        }

        if (lesson.quiz) {
          const createdQuiz = await prisma.quiz.create({
            data: {
              lessonId: createdLesson.id,
              title: lesson.quiz.title ?? `آزمون ${lesson.title}`,
              description: lesson.quiz.description ?? null,
              passingScore: lesson.quiz.passingScore ?? 70,
              timeLimitMinutes: lesson.quiz.timeLimitMinutes ?? null,
              isPublished: true,
            },
          });

          await prisma.question.createMany({
            data: lesson.quiz.questions.map((question, questionIndex) => ({
              quizId: createdQuiz.id,
              type: question.type,
              prompt: question.prompt,
              hint: question.hint ?? null,
              explanation: question.explanation ?? null,
              points: question.points ?? 1,
              order: questionIndex,
              data: questionData(question),
            })),
          });
          questionCount += lesson.quiz.questions.length;
        }

        if (lesson.faqs && lesson.faqs.length > 0) {
          await prisma.faq.createMany({
            data: lesson.faqs.map((item, faqIndex) => ({
              lessonId: createdLesson.id,
              question: item.question,
              answer: item.answer,
              category: item.category ?? null,
              order: faqIndex,
              isPublished: true,
              searchText: buildSearchText([item.question, item.answer]),
            })),
          });
        }
      }
    }

    await prisma.module.update({
      where: { id: createdModule.id },
      data: {
        estimatedMinutes: moduleMinutes,
        searchText: buildSearchText([
          courseModule.title,
          courseModule.subtitle ?? "",
          courseModule.description,
          ...lessonSummaries,
        ]),
      },
    });
  }

  console.log(`  ✓ ${toPersianDigits(moduleCount)} ماژول`);
  console.log(`  ✓ ${toPersianDigits(chapterCount)} فصل`);
  console.log(`  ✓ ${toPersianDigits(lessonCount)} درس`);
  console.log(`  ✓ ${toPersianDigits(blockCount)} بلوک محتوا`);
  console.log(`  ✓ ${toPersianDigits(questionCount)} پرسش آزمون`);

  console.log("• درج پرسش‌های پرتکرار عمومی…");
  const globalFaqs = [
    {
      question: "چطور یادگیری را شروع کنم؟",
      answer:
        "<p>از ماژول «آشنایی اولیه» شروع کنید. اگر با کامپیوتر راحت هستید، می‌توانید مستقیم به ماژول «مفاهیم پایه فناوری اطلاعات» بروید. هر درس کوتاه است و در چند دقیقه تمام می‌شود.</p>",
      category: "شروع کار",
    },
    {
      question: "آیا باید درس‌ها را به ترتیب بخوانم؟",
      answer:
        "<p>ترتیب پیشنهادی سازنده است، ولی اجباری نیست. اگر فقط به اکسل نیاز دارید، می‌توانید مستقیم به ماژول Excel بروید.</p>",
      category: "شروع کار",
    },
    {
      question: "پیشرفت من چگونه ذخیره می‌شود؟",
      answer:
        "<p>پیشرفت شما در حساب کاربری‌تان ذخیره می‌شود. با ورود به سایت از هر دستگاهی می‌توانید درس را از همان‌جایی که رها کرده‌اید ادامه دهید.</p>",
      category: "کاربری",
    },
    {
      question: "بدون حساب کاربری هم می‌توانم درس‌ها را بخوانم؟",
      answer:
        "<p>بله، خواندن درس‌ها آزاد است. اما برای ذخیره پیشرفت، نشان‌دار کردن درس‌ها و استفاده از چت‌بات، داشتن حساب کاربری لازم است.</p>",
      category: "کاربری",
    },
    {
      question: "چت‌بات چطور به من کمک می‌کند؟",
      answer:
        "<p>در هر درس دکمه «سؤال از چت‌بات» را می‌بینید. چت‌بات می‌داند شما در کدام درس هستید و می‌تواند همان مطلب را ساده‌تر توضیح دهد، مثال بزند یا مرحله‌به‌مرحله بگوید.</p>",
      category: "چت‌بات",
    },
    {
      question: "اگر جواب چت‌بات اشتباه بود چه کنم؟",
      answer:
        "<p>چت‌بات یک دستیار است و ممکن است اشتباه کند. همیشه محتوای همین دوره و منابع رسمی را معیار بگیرید و در صورت شک، از مدرس بپرسید.</p>",
      category: "چت‌بات",
    },
    {
      question: "چرا بعضی درس‌ها آزمون ندارند؟",
      answer:
        "<p>درس‌هایی که بیشتر جنبه آشنایی دارند آزمون ندارند. درس‌های عملی و مهم، آزمون کوتاه دارند تا مطمئن شوید مطلب را یاد گرفته‌اید.</p>",
      category: "آزمون",
    },
    {
      question: "می‌توانم آزمون را چند بار بدهم؟",
      answer:
        "<p>بله، تعداد دفعات آزمون محدود نیست. بهترین نتیجه شما ثبت می‌شود و می‌توانید هر بار پاسخ‌های درست را ببینید و یاد بگیرید.</p>",
      category: "آزمون",
    },
    {
      question: "اگر فرمول اکسل درست کار نکرد چه کنم؟",
      answer:
        "<p>سه دلیل رایج: ۱) علامت = در ابتدای فرمول نگذاشته‌اید، ۲) آدرس سلول‌ها غلط است، ۳) سلول روی قالب Text است. در درس «فرمول‌نویسی پایه» همه این موارد توضیح داده شده است.</p>",
      category: "اکسل",
    },
    {
      question: "چطور رمز عبور خود را امن‌تر کنم؟",
      answer:
        "<p>رمز بلند (حداقل ۱۲ کاراکتر)، ترکیبی از حرف و عدد و علامت، و متفاوت برای هر حساب. ورود دو مرحله‌ای را هم روشن کنید. در ماژول «اینترنت و ایمیل» گام‌به‌گام توضیح داده شده است.</p>",
      category: "امنیت",
    },
    {
      question: "درس‌های محبوب کدام‌اند؟",
      answer:
        "<p>ماژول‌های Excel و Word بیشترین کاربر را دارند، چون بیشترین کاربرد اداری را دارند. ماژول ویندوز هم برای مبتدی‌ها بسیار مهم است.</p>",
      category: "محتوای دوره",
    },
    {
      question: "محتوای دوره قابل ویرایش است؟",
      answer:
        "<p>بله. مدیر سایت از پنل مدیریت می‌تواند ماژول، فصل، درس، بلوک محتوا، آزمون و حتی تنظیمات چت‌بات را بدون تغییر کد ویرایش کند.</p>",
      category: "مدیریت",
    },
  ];

  await prisma.faq.createMany({
    data: globalFaqs.map((item, index) => ({
      lessonId: null,
      question: item.question,
      answer: item.answer,
      category: item.category,
      order: index,
      isPublished: true,
      searchText: buildSearchText([item.question, item.answer]),
    })),
  });
  console.log(`  ✓ ${toPersianDigits(globalFaqs.length)} پرسش پرتکرار عمومی`);

  console.log("• ساخت پیشرفت و فعالیت نمونه…");

  const earliestLessons = await prisma.lesson.findMany({
    where: { isPublished: true },
    orderBy: [{ chapter: { module: { order: "asc" } } }, { chapter: { order: "asc" } }, { order: "asc" }],
    select: { id: true, title: true, estimatedMinutes: true },
    take: 14,
  });

  if (earliestLessons.length > 0) {
    // Demo learner: a partly finished journey so "Continue learning" works.
    const completedLessons = earliestLessons.slice(0, 5);
    await prisma.userProgress.createMany({
      data: [
        ...completedLessons.map((lesson, index) => ({
          userId: users.learner.id,
          lessonId: lesson.id,
          status: "COMPLETED",
          percent: 100,
          completedAt: new Date(Date.now() - (completedLessons.length - index) * 3_600_000),
          lastViewedAt: new Date(Date.now() - (completedLessons.length - index) * 3_600_000),
        })),
        {
          userId: users.learner.id,
          lessonId: earliestLessons[5]!.id,
          status: "IN_PROGRESS",
          percent: 45,
          lastViewedAt: new Date(Date.now() - 1_800_000),
        },
      ],
    });

    await prisma.bookmark.createMany({
      data: [
        {
          userId: users.learner.id,
          lessonId: completedLessons[0]!.id,
          type: "LESSON",
          label: completedLessons[0]!.title,
          excerpt: "برای مرور دوباره این درس را نشان‌دار کردم.",
        },
        {
          userId: users.learner.id,
          lessonId: completedLessons[2]!.id,
          type: "TIP",
          label: `نکته مهم: ${completedLessons[2]!.title}`,
          excerpt: "نکته‌های عملی این درس را بعداً می‌خواهم ببینم.",
        },
      ],
    });

    // Sample learners get partial progress at different depths.
    for (const [index, sample] of users.samples.entries()) {
      const depth = Math.min(earliestLessons.length, 3 + index * 2);
      await prisma.userProgress.createMany({
        data: earliestLessons.slice(0, depth).map((lesson) => ({
          userId: sample.id,
          lessonId: lesson.id,
          status: "COMPLETED",
          percent: 100,
          completedAt: new Date(Date.now() - index * 86_400_000),
          lastViewedAt: new Date(Date.now() - index * 86_400_000),
        })),
      });
    }

    const quiz = await prisma.quiz.findFirst({ orderBy: { id: "asc" } });
    if (quiz) {
      await prisma.quizAttempt.create({
        data: {
          userId: users.learner.id,
          quizId: quiz.id,
          score: 80,
          maxScore: 100,
          correctCount: 4,
          totalCount: 5,
          passed: true,
          durationSeconds: 210,
          answers: [],
          completedAt: new Date(Date.now() - 3_600_000),
        },
      });
    }

    await prisma.searchHistory.createMany({
      data: [
        { userId: users.learner.id, query: "فرمول SUM", normalizedQuery: normalizePersian("فرمول SUM"), resultCount: 3 },
        { userId: users.learner.id, query: "چگونه PDF بسازم؟", normalizedQuery: normalizePersian("چگونه PDF بسازم؟"), resultCount: 4 },
      ],
    });

    await prisma.activityLog.createMany({
      data: [
        {
          userId: users.learner.id,
          type: "LESSON_COMPLETED",
          message: `درس «${completedLessons.at(-1)!.title}» تکمیل شد`,
          metadata: { lessonId: completedLessons.at(-1)!.id },
        },
        {
          userId: users.learner.id,
          type: "QUIZ_PASSED",
          message: "آزمون با موفقیت گذرانده شد",
          metadata: { score: 80 },
        },
        {
          userId: users.admin.id,
          type: "CONTENT_PUBLISHED",
          message: `محتوای دوره با ${toPersianDigits(curriculumStats.lessons)} درس منتشر شد`,
        },
      ],
    });
  }

  console.log("  ✓ پیشرفت، نشان‌ها و فعالیت نمونه ساخته شد");

  console.log("\n✅ آماده است!");
  console.log(
    `   ${toPersianDigits(curriculumStats.modules)} ماژول، ${toPersianDigits(curriculumStats.chapters)} فصل، ${toPersianDigits(curriculumStats.lessons)} درس، ${toPersianDigits(curriculumStats.questions)} پرسش`,
  );
  console.log("   ورود مدیر: mehrdad@icdl.local / Mehrdad@1398");
  console.log("   ورود کاربر: learner@icdl.local / Learner@1398\n");
}

main()
  .catch((error) => {
    console.error("\n❌ خطا در ساخت داده‌های اولیه:\n");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
