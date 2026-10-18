import type { NextRequest } from "next/server";

import { RATE_LIMITS, checkRateLimit, clientKey } from "@/lib/rate-limit";
import { suggestContent } from "@/services/search-service";

/** GET /api/search/suggest?q=… — lightweight endpoint for as-you-type suggestions. */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 120);

  const identity = clientKey(request.headers, "anonymous");
  const limitCheck = checkRateLimit({ key: `suggest:${identity}`, ...RATE_LIMITS.search });

  if (!limitCheck.allowed) {
    return Response.json({ ok: true, suggestions: [] });
  }

  const suggestions = await suggestContent(query, 6);
  return Response.json({ ok: true, suggestions });
}
