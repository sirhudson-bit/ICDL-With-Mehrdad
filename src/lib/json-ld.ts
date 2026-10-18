/**
 * Safe JSON-LD serialisation.
 *
 * `JSON.stringify` alone is not safe inside a `<script>` element: the HTML
 * parser terminates the script at the first `</script>`, so a value containing
 * that sequence — or an HTML comment opener — could break out of the tag.
 * Escaping the three HTML-significant characters prevents that while remaining
 * valid JSON.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
