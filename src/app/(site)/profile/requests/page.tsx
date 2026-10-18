import Link from "next/link";
import type { Metadata } from "next";

import { getIcon } from "@/components/icon";
import { Reveal } from "@/components/fx/reveal";
import { Alert, Badge, ButtonLink, Card, CardContent, EmptyState, SectionHeading } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { formatPersianDate, formatRelativeTime, toPersianDigits } from "@/lib/persian";
import {
  listMyContactMessages,
  listMyCourseRequests,
  MESSAGE_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  type MessageStatus,
  type RequestStatus,
} from "@/services/inbox-service";

export const metadata: Metadata = {
  title: "درخواست‌های من",
  description: "پیگیری پیام‌ها و درخواست‌های دوره‌ای که برای مدیر فرستاده‌اید.",
  robots: { index: false, follow: false },
};

/** Status → badge tone, so a glance is enough to read the state. */
const REQUEST_TONES: Record<RequestStatus, "outline" | "info" | "warning" | "success" | "danger"> = {
  NEW: "info",
  PLANNED: "warning",
  IN_PROGRESS: "warning",
  DONE: "success",
  DECLINED: "danger",
};

const MESSAGE_TONES: Record<MessageStatus, "outline" | "info" | "warning" | "success"> = {
  NEW: "info",
  READ: "outline",
  REPLIED: "success",
  ARCHIVED: "outline",
};

/**
 * Request management.
 *
 * Learners could send messages and course requests but had no way to see them
 * again or know whether anyone had looked at them. This is their side of the
 * inbox: what was sent, when, and where it stands.
 */
export default async function MyRequestsPage() {
  const user = await requireUser("/login?next=/profile/requests");

  const [requests, messages] = await Promise.all([
    listMyCourseRequests(user.id),
    listMyContactMessages(user.id),
  ]);

  const MailIcon = getIcon("Mail");
  const RocketIcon = getIcon("Rocket");
  const empty = requests.length === 0 && messages.length === 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <MailIcon size={22} aria-hidden="true" />
          </span>
          درخواست‌های من
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          هر پیام و درخواستی که برای مدیر فرستاده‌اید اینجا نگه داشته می‌شود تا بدانید چه زمانی بررسی شده است.
        </p>
      </header>

      {empty ? (
        <EmptyState
          icon="Mail"
          title="هنوز درخواستی ثبت نکرده‌اید"
          description="از صفحه «تماس با من» می‌توانید پیام بفرستید یا دوره‌ای برای ساخت پیشنهاد دهید. وضعیت هرکدام همین‌جا نمایش داده می‌شود."
        >
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/contact">فرستادن پیام</ButtonLink>
            <ButtonLink href="/request-course" variant="outline">
              پیشنهاد دوره جدید
            </ButtonLink>
          </div>
        </EmptyState>
      ) : null}

      {requests.length > 0 ? (
        <Reveal as="section">
          <SectionHeading
            title="درخواست‌های دوره"
            description={`${toPersianDigits(requests.length)} درخواست ثبت‌شده`}
          />
          <ul className="mt-3 flex flex-col gap-3">
            {requests.map((request) => (
              <li key={request.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                          <RocketIcon size={18} aria-hidden="true" />
                        </span>
                        <p className="text-sm font-bold">{request.title}</p>
                        {request.category ? (
                          <Badge tone="outline" size="sm">
                            {request.category}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {request.description}
                      </p>
                      <p className="mt-2 text-[0.6875rem] text-subtle-foreground">
                        ثبت‌شده {formatRelativeTime(request.createdAt)} • آخرین تغییر{" "}
                        {formatPersianDate(request.updatedAt)}
                      </p>
                      {request.adminNote ? (
                        <p className="mt-2 rounded-xl border border-info/25 bg-info-soft px-3 py-2 text-xs leading-relaxed">
                          <span className="font-bold">یادداشت مدیر: </span>
                          {request.adminNote}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={REQUEST_TONES[request.status as RequestStatus] ?? "outline"}>
                      {REQUEST_STATUS_LABELS[request.status as RequestStatus] ?? request.status}
                    </Badge>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}

      {messages.length > 0 ? (
        <Reveal as="section" delayMs={80}>
          <SectionHeading
            title="پیام‌های تماس"
            description={`${toPersianDigits(messages.length)} پیام ثبت‌شده`}
          />
          <ul className="mt-3 flex flex-col gap-3">
            {messages.map((message) => (
              <li key={message.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{message.subject}</p>
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {message.message}
                      </p>
                      <p className="mt-2 text-[0.6875rem] text-subtle-foreground">
                        {formatRelativeTime(message.createdAt)}
                      </p>
                    </div>
                    <Badge tone={MESSAGE_TONES[message.status as MessageStatus] ?? "outline"}>
                      {MESSAGE_STATUS_LABELS[message.status as MessageStatus] ?? message.status}
                    </Badge>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}

      {!empty ? (
        <Alert tone="info" title="راه سریع‌تر">
          برای پرسش درباره یک درس، چت‌بات همان درس سریع‌ترین پاسخ را می‌دهد.{" "}
          <Link href="/course" className="font-medium text-primary hover:underline">
            فهرست دوره
          </Link>
        </Alert>
      ) : null}
    </div>
  );
}
