import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";

/**
 * Crawler rules.
 *
 * The learner-facing content is public and indexable; personal and
 * administrative areas are excluded, since they either require authentication
 * or hold no content worth indexing.
 */
export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.siteUrl.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/settings", "/progress", "/bookmarks", "/login", "/register"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
