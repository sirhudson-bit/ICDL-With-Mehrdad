import sanitizeHtml from "sanitize-html";

/**
 * Rich text sanitisation.
 *
 * Administrators author lesson content through a rich text editor, so the HTML
 * is stored as-is. It is sanitised before being rendered into the page as a
 * defence-in-depth measure against stored XSS — a compromised admin session or
 * an unsafe import must not be able to inject script into a learner's browser.
 */

const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "span",
  "div",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "mark",
  "small",
  "sub",
  "sup",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "a",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
];

export function sanitizeRichText(html: string): string {
  if (!html) return "";

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      "*": ["dir", "lang", "class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    transformTags: {
      // Links leaving the page should open safely.
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const isExternal = /^https?:\/\//i.test(href);

        return {
          tagName,
          attribs: isExternal
            ? { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" }
            : attribs,
        };
      },
      // Images always load lazily and never drag layout around.
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: "lazy", decoding: "async" },
      }),
    },
    // Drop the contents of these entirely rather than escaping them.
    nonTextTags: ["style", "script", "textarea", "option", "noscript", "iframe", "object", "embed"],
  });
}

/** Plain text extraction for meta descriptions and previews. */
export function richTextToPlain(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
