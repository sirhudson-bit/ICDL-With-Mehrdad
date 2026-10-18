"use client";

import { ContactForm, CourseRequestForm } from "@/components/forms/public-forms";
import { getIcon } from "@/components/icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";

/**
 * The two ways to reach the site owner, side by side.
 *
 * They used to live on separate pages, so a visitor who wanted to *ask* for a
 * course had to know that a second page existed. Tabs keep both one click away
 * and label them plainly, which is the part that was missing.
 */
export function ContactTabs({
  defaultName,
  defaultEmail,
  lockedName = false,
}: {
  defaultName?: string;
  defaultEmail?: string;
  lockedName?: boolean;
}) {
  const MailIcon = getIcon("Mail");
  const RocketIcon = getIcon("Rocket");

  return (
    <Tabs defaultValue="message">
      <TabsList className="w-full">
        <TabsTrigger value="message" className="flex-1 justify-center">
          <MailIcon size={17} aria-hidden="true" />
          ارسال پیام
        </TabsTrigger>
        <TabsTrigger value="request" className="flex-1 justify-center">
          <RocketIcon size={17} aria-hidden="true" />
          درخواست دوره جدید
        </TabsTrigger>
      </TabsList>

      <TabsContent value="message">
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          برای پرسش، پیشنهاد یا انتقاد. پاسخ را به ایمیل ثبت‌شده در پروفایل شما می‌فرستیم.
        </p>
        <ContactForm defaultName={defaultName} defaultEmail={defaultEmail} lockedName={lockedName} />
      </TabsContent>

      <TabsContent value="request">
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          دوره‌ای که لازم دارید در فهرست نیست؟ مشخصات آن را بنویسید تا در برنامه‌ریزی دوره‌های بعدی بررسی
          شود. وضعیت درخواست را می‌توانید در «درخواست‌های من» ببینید.
        </p>
        <CourseRequestForm defaultName={defaultName} defaultEmail={defaultEmail} />
      </TabsContent>
    </Tabs>
  );
}
