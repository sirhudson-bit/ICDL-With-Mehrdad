import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { RATE_LIMITS, checkRateLimit, clientKey } from "@/lib/rate-limit";
import { recordSearch, searchContent, type SearchHitType } from "@/services/search-service";

/** GET /api/search?q=…&type=lesson,courseModule&limit=12 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").slice(0, 200);
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 12) || 12, 1), 40);

  const requestedTypes = (params.get("type") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is SearchHitType => ["module", "chapter", "lesson", "faq"].includes(value));

  const user = await getCurrentUser();
  const identity = user?.id ?? clientKey(request.headers, "anonymous");
  const limitCheck = checkRateLimit({ key: `search:${identity}`, ...RATE_LIMITS.search });

  if (!limitCheck.allowed) {
    return Response.json(
      { ok: false, message: "تعداد جستجوهای شما زیاد بوده است. چند لحظه صبر کنید." },
      { status: 429, headers: { "Retry-After": String(limitCheck.retryAfterSeconds) } },
    );
  }

  if (query.trim().length === 0) {
    return Response.json({ ok: true, result: { query: "", hits: [], total: 0, suggestions: [], tookMs: 0 } });
  }

  const result = await searchContent(query, {
    limit,
    types: requestedTypes.length > 0 ? requestedTypes : undefined,
  });

  // Only authenticated searches are recorded, so the admin report is meaningful.
  if (user) {
    await recordSearch(user.id, query, result.total);
  }

  return Response.json({ ok: true, result });
}
