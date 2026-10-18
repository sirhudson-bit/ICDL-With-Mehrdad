import { getIcon } from "@/components/icon";
import { Alert, Card, CardContent, Field, Select, Textarea } from "@/components/ui/primitives";
import { AdminForm } from "@/components/admin/action-form";
import { updateCourseRequestFormAction, updateMessageStatusFormAction } from "@/app/actions/inbox";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import {
  getInboxCounts,
  listContactMessages,
  listCourseRequests,
  MESSAGE_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  type MessageStatus,
  type RequestStatus,
} from "@/services/inbox-service";

export const metadata = {
  title: "پیام‌ها و درخواست‌ها",
  robots: { index: false, follow: false },
};

/**
 * Admin inbox.
 *
 * Contact messages and course requests in one place, since both are answered in
 * the same sitting. Status changes go through AdminForm so the admin gets the
 * same toast feedback as everywhere else in the panel.
 */
export default async function AdminInboxPage() {
  const [messages, requests, counts] = await Promise.all([
    listContactMessages(),
    listCourseRequests(),
    getInboxCounts(),
  ]);

  const InboxIcon = getIcon("Mail");
  const RocketIcon = getIcon("Rocket");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <InboxIcon size={21} aria-hidden="true" />
          پیام‌ها و درخواست‌ها
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          پیام‌های فرم تماس و درخواست‌های ساخت دوره.
        </p>
      </header>

      {counts.total > 0 ? (
        <Alert tone="info" title="موارد جدید">
          {counts.newMessages > 0 ? `${toPersianDigits(counts.newMessages)} پیام جدید` : null}
          {counts.newMessages > 0 && counts.newRequests > 0 ? " و " : null}
          {counts.newRequests > 0 ? `${toPersianDigits(counts.newRequests)} درخواست جدید` : null}
        </Alert>
      ) : null}

      {/* Contact messages */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <InboxIcon size={19} aria-hidden="true" />
          پیام‌های تماس {messages.length > 0 ? `(${toPersianDigits(messages.length)})` : ""}
        </h2>

        {messages.length === 0 ? (
          <Card>
            <CardContent className="p-6 pt-6 text-center text-sm text-muted-foreground">
              هنوز پیامی از فرم تماس ثبت نشده است.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => (
              <li key={message.id}>
                <Card>
                  <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{message.subject}</span>
                          <span
                            className={
                              message.status === "NEW"
                                ? "rounded-full bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-medium text-primary"
                                : "rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
                            }
                          >
                            {MESSAGE_STATUS_LABELS[message.status as MessageStatus] ?? message.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {message.name} •{" "}
                          <a href={`mailto:${message.email}`} dir="ltr" className="hover:text-primary">
                            {message.email}
                          </a>
                          {message.phone ? (
                            <>
                              {" • "}
                              <a href={`tel:${message.phone}`} dir="ltr" className="hover:text-primary">
                                {message.phone}
                              </a>
                            </>
                          ) : null}
                          {" • "}
                          {formatRelativeTime(message.createdAt)}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{message.message}</p>
                      </div>

                      <div className="shrink-0">
                        <AdminForm
                          action={updateMessageStatusFormAction.bind(null, message.id)}
                          submitLabel="ثبت وضعیت"
                          submitVariant="outline"
                          compact
                        >
                          <Field label="وضعیت">
                            <Select name="status" defaultValue={message.status} className="h-9 text-xs">
                              {Object.entries(MESSAGE_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        </AdminForm>

                        <div className="mt-2 flex justify-end">
                          <a
                            href={`mailto:${message.email}?subject=${encodeURIComponent(`پاسخ: ${message.subject}`)}`}
                            className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs transition-colors hover:bg-muted"
                          >
                            پاسخ با ایمیل
                          </a>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Course requests */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <RocketIcon size={19} aria-hidden="true" />
          درخواست‌های دوره {requests.length > 0 ? `(${toPersianDigits(requests.length)})` : ""}
        </h2>

        {requests.length === 0 ? (
          <Card>
            <CardContent className="p-6 pt-6 text-center text-sm text-muted-foreground">
              هنوز درخواست دوره‌ای ثبت نشده است.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
              <li key={request.id}>
                <Card>
                  <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{request.title}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                            {REQUEST_STATUS_LABELS[request.status as RequestStatus] ?? request.status}
                          </span>
                          {request.category ? (
                            <span className="rounded-full bg-card-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                              {request.category}
                            </span>
                          ) : null}
                          {request.priority === "HIGH" ? (
                            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[0.6875rem] text-warning">
                              اولویت بالا
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {request.name} •{" "}
                          <a href={`mailto:${request.email}`} dir="ltr" className="hover:text-primary">
                            {request.email}
                          </a>
                          {" • "}
                          {formatRelativeTime(request.createdAt)}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{request.description}</p>
                      </div>

                      <div className="w-full shrink-0 sm:w-56">
                        <AdminForm
                          action={updateCourseRequestFormAction.bind(null, request.id)}
                          submitLabel="ثبت"
                          submitVariant="outline"
                          compact
                        >
                          <Field label="وضعیت">
                            <Select name="status" defaultValue={request.status} className="h-9 text-xs">
                              {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <div className="mt-2">
                            <Field label="یادداشت داخلی">
                              <Textarea name="adminNote" rows={2} defaultValue={request.adminNote ?? ""} className="text-xs" />
                            </Field>
                          </div>
                        </AdminForm>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
