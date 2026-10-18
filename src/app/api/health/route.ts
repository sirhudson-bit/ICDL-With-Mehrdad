import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RATE_LIMITS, checkRateLimit, clientKey } from "@/lib/rate-limit";

/**
 * Build health check.
 *
 * Exists because "are my changes live?" has been genuinely hard to answer on
 * this project: production serves a compiled build, and a service worker sits
 * in front of the browser. Opening /api/health now answers it directly — the
 * buildId it reports must match the id in `.next/BUILD_ID` on disk, and the
 * mode tells you whether you are looking at `next dev` or `next start`.
 *
 * Deliberately reports only the build id and the mode, and is throttled: uptime
 * and clock details are reconnaissance value with no place in an endpoint that
 * anyone can call.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = checkRateLimit({
    key: `health:${clientKey(request.headers, "anonymous")}`,
    ...RATE_LIMITS.health,
  });

  if (!limit.allowed) {
    return Response.json(
      { ok: false },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  let buildId = "unknown";
  try {
    buildId = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    buildId = "dev-or-missing";
  }

  return Response.json(
    { ok: true, buildId, mode: process.env.NODE_ENV ?? "unknown" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
