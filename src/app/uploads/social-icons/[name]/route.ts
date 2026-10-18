import { readIconSvg } from "@/lib/svg-icon";

/**
 * Serve an administrator-uploaded footer icon.
 *
 * Uploads live outside `public/` because Next only serves files that existed at
 * build time, so they are streamed from here instead. The bytes were sanitised
 * on upload; the `sandbox` directive means that even visiting this URL directly
 * cannot run script on this origin.
 */

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const svg = await readIconSvg(name);

  if (!svg) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      // Names are random and never reused, so the bytes behind a URL never change.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
