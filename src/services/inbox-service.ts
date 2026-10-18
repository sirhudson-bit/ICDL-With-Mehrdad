import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { normalizePersian } from "@/lib/persian";
import { logAdminActivity } from "@/services/content-service";

/**
 * Inbox: contact messages and course requests.
 *
 * Both are written from public, unauthenticated forms, so they are stored with
 * the submitter's details rather than assuming an account exists. Signed-in
 * learners are linked to their account when available.
 */

export const MESSAGE_STATUSES = ["NEW", "READ", "REPLIED", "ARCHIVED"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const REQUEST_STATUSES = ["NEW", "PLANNED", "IN_PROGRESS", "DONE", "DECLINED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  NEW: "جدید",
  READ: "خوانده‌شده",
  REPLIED: "پاسخ داده‌شده",
  ARCHIVED: "بایگانی",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: "جدید",
  PLANNED: "برنامه‌ریزی‌شده",
  IN_PROGRESS: "در حال ساخت",
  DONE: "ساخته‌شده",
  DECLINED: "رد‌شده",
};

export type ContactInput = {
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  userId?: string | null;
};

export async function createContactMessage(input: ContactInput) {
  const created = await prisma.contactMessage.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      subject: input.subject.trim(),
      message: input.message.trim(),
      userId: input.userId ?? null,
      status: "NEW",
    },
    select: { id: true },
  });

  await logAdminActivity(
    input.userId ?? "system",
    "CONTENT_UPDATED",
    `پیام تماس جدید: ${input.subject.trim()}`,
    { messageId: created.id, email: input.email },
  );

  return created;
}

export type CourseRequestInput = {
  title: string;
  description: string;
  category?: string | null;
  priority?: string;
  name: string;
  email: string;
  userId?: string | null;
};

export async function createCourseRequest(input: CourseRequestInput) {
  const created = await prisma.courseRequest.create({
    data: {
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category?.trim() || null,
      priority: input.priority ?? "NORMAL",
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      userId: input.userId ?? null,
      status: "NEW",
    },
    select: { id: true },
  });

  await logAdminActivity(
    input.userId ?? "system",
    "CONTENT_UPDATED",
    `درخواست دوره جدید: ${input.title.trim()}`,
    { requestId: created.id },
  );

  return created;
}

export async function listContactMessages(limit = 100) {
  return prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      subject: true,
      message: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
  });
}

export async function listCourseRequests(limit = 100) {
  return prisma.courseRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      name: true,
      email: true,
      status: true,
      adminNote: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
  });
}

/** The signed-in learner's own messages, newest first. */
export async function listMyContactMessages(userId: string, limit = 50) {
  return prisma.contactMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, subject: true, message: true, status: true, createdAt: true },
  });
}

/** The signed-in learner's own course requests, newest first. */
export async function listMyCourseRequests(userId: string, limit = 50) {
  return prisma.courseRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      adminNote: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateContactMessageStatus(id: string, status: MessageStatus) {
  return prisma.contactMessage.update({ where: { id }, data: { status } });
}

export async function updateCourseRequest(
  id: string,
  input: { status?: RequestStatus; adminNote?: string | null },
) {
  return prisma.courseRequest.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
    },
  });
}

/** Unread counts for the admin navigation badge. */
export async function getInboxCounts() {
  const [newMessages, newRequests] = await Promise.all([
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.courseRequest.count({ where: { status: "NEW" } }),
  ]);

  return { newMessages, newRequests, total: newMessages + newRequests };
}

/**
 * Related help topics for the contact page, so visitors can often answer their
 * own question before writing in.
 */
export async function getSupportContext() {
  try {
    const [faqCount, lessonCount] = await Promise.all([
      prisma.faq.count({ where: { isPublished: true } }),
      prisma.lesson.count({ where: { isPublished: true } }),
    ]);
    return { faqCount: faqCount, lessonCount };
  } catch (error) {
    logError("inbox:supportContext", error);
    return { faqCount: 0, lessonCount: 0 };
  }
}

export { normalizePersian };
