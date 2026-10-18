import { cache } from "react";

import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import {
  SECRET_SETTING_FIELDS,
  SETTINGS_DEFAULTS,
  SETTINGS_SCHEMAS,
  maskSettings,
  type SettingsKey,
  type SettingsShape,
} from "@/lib/settings";

/**
 * Settings access.
 *
 * Values live in the `Setting` table so the admin panel can change them without
 * a redeploy. Because the defaults double as the schema, a missing or corrupted
 * row degrades to the default instead of breaking the page.
 */

/**
 * Merges a stored value over the defaults for its group.
 *
 * Validation is per-group, not per-field, so a stored row written before a new
 * field existed used to fail the whole schema and silently revert the entire
 * group to its defaults — discarding whatever the administrator had saved. Layering
 * the stored value on top of the defaults means an older row keeps its values and
 * simply gains the default for anything newly added.
 */
function mergeWithDefaults<T extends object>(defaults: T, stored: unknown): T {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return defaults;
  return { ...defaults, ...(stored as Partial<T>) };
}

async function loadAll(): Promise<SettingsShape> {
  const result: SettingsShape = structuredClone(SETTINGS_DEFAULTS);

  try {
    const rows = await prisma.setting.findMany();
    for (const row of rows) {
      const key = row.key as SettingsKey;
      const schema = SETTINGS_SCHEMAS[key];
      if (!schema) continue;

      const parsed = schema.safeParse(mergeWithDefaults(SETTINGS_DEFAULTS[key], row.value));
      if (parsed.success) {
        // Assigned by key so TypeScript keeps the discriminated relation.
        Object.assign(result, { [key]: parsed.data });
      } else {
        logError(`settings:${key}`, new Error("مقدار ذخیره‌شده معتبر نبود؛ مقدار پیش‌فرض استفاده شد."));
      }
    }
  } catch (error) {
    // A settings read failure must not take the whole site down.
    logError("settings:load", error);
  }

  return result;
}

/** All settings for the current request, de-duplicated by React's cache. */
export const getAllSettings = cache(loadAll);

export async function getSettings<K extends SettingsKey>(key: K): Promise<SettingsShape[K]> {
  const all = await getAllSettings();
  return all[key];
}

/**
 * Carry over secrets the administrator did not retype.
 *
 * The admin form is handed masked secrets, so a value that is still the mask (or
 * blank) means "leave it alone". Without this, saving any group would overwrite a
 * real key, password or token with its own mask.
 */
export async function keepStoredSecrets<K extends SettingsKey>(
  key: K,
  incoming: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const secretFields = SECRET_SETTING_FIELDS[key];
  if (!secretFields) return incoming;

  const stored = (await getSettings(key)) as Record<string, unknown>;
  const masked = maskSettings(key, stored as SettingsShape[K]) as Record<string, unknown>;
  const next = { ...incoming };

  for (const field of secretFields) {
    const current = stored[field];
    if (typeof current !== "string" || current.length === 0) continue;

    const submitted = next[field];
    if (submitted === undefined || submitted === "" || submitted === masked[field]) {
      next[field] = current;
    }
  }

  return next;
}

/** Validates and persists one settings group. Returns the stored value. */
export async function saveSettings<K extends SettingsKey>(
  key: K,
  value: unknown,
): Promise<{ ok: true; data: SettingsShape[K] } | { ok: false; errors: string[] }> {
  const schema = SETTINGS_SCHEMAS[key];
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }

  await prisma.setting.upsert({
    where: { key },
    create: { key, value: parsed.data as object },
    update: { value: parsed.data as object },
  });

  return { ok: true, data: parsed.data as SettingsShape[K] };
}
