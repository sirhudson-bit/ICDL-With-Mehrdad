/**
 * In-memory rate limiting.
 *
 * Protects the login, registration, search and chatbot endpoints from trivial
 * abuse. This is deliberately per-instance: a multi-instance deployment should
 * point `checkRateLimit` at a shared store (Redis) behind the same signature.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Prevent unbounded growth on a long-running process.
const MAX_BUCKETS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /** Stable identity for the caller, e.g. `login:<ip>`. */
  key: string;
  limit: number;
  windowMs: number;
};

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      // Drop expired buckets rather than letting the map grow forever.
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 5 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  chat: { limit: 30, windowMs: 5 * 60 * 1000 },
  search: { limit: 90, windowMs: 60 * 1000 },
  /** Reset requests are cheap to spam, so they are throttled per client. */
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordResetConfirm: { limit: 10, windowMs: 60 * 60 * 1000 },
  /** Live field checks while someone types a registration form. */
  registerCheck: { limit: 90, windowMs: 60 * 1000 },
  /** Footer newsletter sign-ups. */
  newsletter: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** Administrator SVG icon uploads. */
  upload: { limit: 30, windowMs: 10 * 60 * 1000 },
  /** Guessing the current password from the account page. */
  passwordChange: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Public certificate lookups, which are guessable by design. */
  certificateVerify: { limit: 30, windowMs: 10 * 60 * 1000 },
  /** Build-id probe, which anyone can call. */
  health: { limit: 60, windowMs: 60 * 1000 },
} as const;

/** Best-effort client identity for rate limiting behind a proxy. */
export function clientKey(headers: Headers, fallback = "unknown"): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? fallback;
}
