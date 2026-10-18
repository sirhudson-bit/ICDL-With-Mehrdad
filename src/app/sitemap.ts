import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";

/**
 * Dynamic sitemap.
 *
 * Only published content is listed, so drafts never leak into search engines.
 * A database failure degrades to the static routes rather than breaking the
 * sitemap entirely.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl.replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/course`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/help`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/search`, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const modules = await prisma.module.findMany({
      where: { isPublished: true },
      orderBy: { order: "asc" },
      select: {
        slug: true,
        updatedAt: true,
        chapters: {
          where: { isPublished: true },
          select: {
            lessons: {
              where: { isPublished: true },
              select: { slug: true, updatedAt: true },
            },
          },
        },
      },
    });

    const entries: MetadataRoute.Sitemap = [];

    for (const courseModule of modules) {
      entries.push({
        url: `${base}/course/${courseModule.slug}`,
        lastModified: courseModule.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });

      for (const chapter of courseModule.chapters) {
        for (const lesson of chapter.lessons) {
          entries.push({
            url: `${base}/course/${courseModule.slug}/${lesson.slug}`,
            lastModified: lesson.updatedAt,
            changeFrequency: "monthly",
            priority: 0.7,
          });
        }
      }
    }

    return [...staticRoutes, ...entries];
  } catch (error) {
    logError("sitemap", error);
    return staticRoutes;
  }
}
