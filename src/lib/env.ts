import { z } from "zod";

/**
 * Environment configuration.
 *
 * Validated once at startup so a missing secret fails loudly with an
 * actionable message instead of producing a confusing runtime error later.
 * Never import this module from a Client Component.
 */

const truthy = new Set(["1", "true", "yes", "on"]);

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL تعیین نشده است."),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET باید حداقل ۳۲ کاراکتر باشد تا امضای نشست امن بماند."),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  NEXT_PUBLIC_SITE_URL: z.string().trim().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_NAME: z.string().trim().default("ICDL With Mehrdad"),
  ALLOW_REGISTRATION: z.string().optional(),
  AI_PROVIDER: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_TEMPERATURE: z.string().optional(),
  AI_MAX_TOKENS: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  allowRegistrationByEnv: boolean;
  /**
   * Whether the session cookie is marked `Secure`.
   *
   * Derived from the public site URL rather than from NODE_ENV. A production
   * build served over plain HTTP (a LAN address during a demo, for example)
   * would otherwise set a `Secure` cookie that the browser silently discards —
   * the user "logs in" successfully and is then bounced back to the login page
   * forever. Set COOKIE_SECURE=true/false to override the detection.
   */
  cookieSecure: boolean;
};

function resolveCookieSecure(siteUrl: string, override: string | undefined): boolean {
  if (override !== undefined) {
    return truthy.has(override.toLowerCase());
  }
  return siteUrl.trim().toLowerCase().startsWith("https://");
}

function loadEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => ` - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `تنظیمات محیطی ناقص است. فایل .env را بررسی کنید:\n${details}\n\nراهنما: فایل .env.example را به .env کپی کنید.`,
    );
  }

  return {
    ...parsed.data,
    allowRegistrationByEnv: truthy.has((parsed.data.ALLOW_REGISTRATION ?? "true").toLowerCase()),
    cookieSecure: resolveCookieSecure(parsed.data.NEXT_PUBLIC_SITE_URL, parsed.data.COOKIE_SECURE),
  };
}

let cached: ServerEnv | null = null;

/**
 * Returns the validated environment. The schema is only evaluated on the
 * server; on the client this falls back to the public variables so that
 * accidentally importing the module does not crash the bundle.
 */
export function getEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    return {
      DATABASE_URL: "",
      AUTH_SECRET: "",
      SESSION_MAX_AGE_DAYS: 30,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME ?? "ICDL With Mehrdad",
      allowRegistrationByEnv: true,
      cookieSecure: false,
    };
  }

  cached ??= loadEnv();
  return cached;
}

export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? "ICDL With Mehrdad",
} as const;
