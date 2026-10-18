import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sanitizeHtml from "sanitize-html";

/**
 * Uploaded footer icons.
 *
 * Administrators supply these as SVG files, so the bytes are attacker-influenced
 * even though the administrator is trusted: a stolen admin session must not be
 * able to plant script that runs on the site's own origin. Three layers guard
 * that:
 *
 * 1. The markup is reduced to a drawing-only subset — no script, no style, no
 *    event handlers and no reference that leaves the file itself.
 * 2. It is only ever referenced through `<img src>`, where browsers do not run
 *    scripts, and it is served with a `sandbox` CSP (see next.config.ts) so a
 *    direct visit to the file is inert too.
 * 3. The file name is generated here and never taken from the upload.
 */

/** Largest icon accepted, in bytes. */
export const MAX_ICON_BYTES = 64 * 1024;

/** Public path these icons are served from. */
export const ICON_URL_PREFIX = "/uploads/social-icons/";

/**
 * Uploads live outside `public/`, and are served by the route handler at
 * `src/app/uploads/social-icons/[name]/route.ts`.
 *
 * Next compiles a manifest of `public/` at build time, so a file written there
 * at runtime is not served in production at all — it 404s. Keeping the bytes in
 * a private folder and streaming them through a route handler works the same in
 * development and in production, and lets the response carry the sandbox CSP.
 */
const ICON_DIR = path.join(process.cwd(), "var", "uploads", "social-icons");

/** Only names this module generates: 16 hex characters plus the suffix. */
const MANAGED_NAME = /^[0-9a-f]{16}\.svg$/;

const ALLOWED_TAGS = [
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "rect",
  "line",
  "polyline",
  "polygon",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "symbol",
  "use",
  "title",
  "desc",
];

/**
 * Attribute names keep their case: the file is served as `image/svg+xml` and
 * parsed as XML, where `viewbox` is not `viewBox` and the icon would collapse.
 */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  "*": [
    "id",
    "class",
    "fill",
    "fill-rule",
    "clip-rule",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "opacity",
    "transform",
    "viewBox",
    "width",
    "height",
    "xmlns",
    "xmlns:xlink",
    "preserveAspectRatio",
    "role",
    "aria-hidden",
    "aria-label",
    "focusable",
  ],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  rect: ["x", "y", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polyline: ["points"],
  polygon: ["points"],
  path: ["d"],
  use: ["href", "xlink:href", "x", "y"],
  stop: ["offset", "stop-color", "stop-opacity"],
  linearGradient: ["x1", "y1", "x2", "y2", "gradientUnits", "gradientTransform"],
  radialGradient: ["cx", "cy", "r", "fx", "fy", "gradientUnits", "gradientTransform"],
  clipPath: ["clipPathUnits"],
  mask: ["maskUnits", "maskContentUnits"],
};

export type IconResult = { ok: true; svg: string } | { ok: false; reason: string };

type SvgAttributes = Record<string, string>;

/** Keeps every reference inside the file: `#id` only, never a remote fetch. */
function filterReferences(tagName: string, attribs: SvgAttributes) {
  const safe: SvgAttributes = {};

  for (const [name, value] of Object.entries(attribs)) {
    const raw = String(value ?? "");

    // Same-document references only: `href="#gradient"`.
    if (name === "href" || name === "xlink:href") {
      if (raw.trim().startsWith("#")) safe[name] = raw;
      continue;
    }

    // Same-document paint servers only: `fill="url(#gradient)"`.
    if (/url\(/i.test(raw) && !/^url\(\s*#/i.test(raw.trim())) continue;

    safe[name] = raw;
  }

  return { tagName, attribs: safe };
}

/** `transformTags` takes a per-tag map, so every allowed tag gets the same filter. */
const TRANSFORM_TAGS: Record<string, typeof filterReferences> = Object.fromEntries(
  ALLOWED_TAGS.map((tag) => [tag, filterReferences]),
);

/**
 * Validate and sanitise an uploaded SVG.
 *
 * Returns the drawing-only markup, or a Persian reason the administrator can act
 * on. Everything rejected here is rejected before it ever touches the disk.
 */
export function prepareIconSvg(source: string): IconResult {
  if (!source.trim()) {
    return { ok: false, reason: "فایل خالی است." };
  }

  if (Buffer.byteLength(source, "utf8") > MAX_ICON_BYTES) {
    return { ok: false, reason: "حجم فایل باید کمتر از ۶۴ کیلوبایت باشد." };
  }

  // Entity declarations are the classic XML attack surface and no icon needs them.
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
    return { ok: false, reason: "این فایل ساختار XML مجاز ندارد." };
  }

  const svg = sanitizeHtml(source, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // References are handled per attribute below; nothing may point off-file.
    allowedSchemes: [],
    allowedSchemesAppliedToAttributes: [],
    allowProtocolRelative: false,
    parser: { lowerCaseAttributeNames: false, lowerCaseTags: false },
    transformTags: TRANSFORM_TAGS,
    // Drop the contents of these rather than escaping them into the document.
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "foreignObject", "object", "embed"],
  }).trim();

  if (!/^<svg[\s>]/i.test(svg)) {
    return { ok: false, reason: "فایل یک تصویر SVG معتبر نیست." };
  }

  // Sanitising already removed these; this only asserts that it did.
  if (/<script|on[a-z]+\s*=/i.test(svg)) {
    return { ok: false, reason: "این فایل کد اجرایی دارد و پذیرفته نمی‌شود." };
  }

  return { ok: true, svg };
}

/** True for paths this module owns, so deletions can never escape the folder. */
export function isManagedIconUrl(url: string): boolean {
  return url.startsWith(ICON_URL_PREFIX) && MANAGED_NAME.test(url.slice(ICON_URL_PREFIX.length));
}

/** Read a stored icon by file name. Returns null for anything unrecognised. */
export async function readIconSvg(name: string): Promise<string | null> {
  if (!MANAGED_NAME.test(name)) return null;

  try {
    return await readFile(path.join(ICON_DIR, name), "utf8");
  } catch {
    return null;
  }
}

/** Persist a prepared icon and return its public path. */
export async function saveIconSvg(svg: string): Promise<string> {
  await mkdir(ICON_DIR, { recursive: true });

  const name = `${randomBytes(8).toString("hex")}.svg`;
  await writeFile(path.join(ICON_DIR, name), svg, { encoding: "utf8", flag: "wx" });

  return `${ICON_URL_PREFIX}${name}`;
}

/** Remove a previously stored icon. Anything else is ignored. */
export async function deleteIconSvg(url: string): Promise<void> {
  if (!isManagedIconUrl(url)) return;

  try {
    await unlink(path.join(ICON_DIR, url.slice(ICON_URL_PREFIX.length)));
  } catch {
    // Already gone, or never written — nothing to do.
  }
}

/**
 * Drop every stored icon the saved settings no longer point at.
 *
 * The upload control deletes a file as soon as it is removed, but the setting
 * that references it is only written on save — so a save is the moment the two
 * can be reconciled. This keeps the folder from filling with orphans, and stops
 * a settings row from pointing at a file that is no longer there.
 */
export async function pruneIconSvg(keep: Iterable<string>): Promise<void> {
  const wanted = new Set(keep);

  let names: string[];
  try {
    names = await readdir(ICON_DIR);
  } catch {
    // Nothing has been uploaded yet.
    return;
  }

  await Promise.all(
    names
      .filter((name) => MANAGED_NAME.test(name))
      .map(async (name) => {
        const url = `${ICON_URL_PREFIX}${name}`;
        if (!wanted.has(url)) await deleteIconSvg(url);
      }),
  );
}
