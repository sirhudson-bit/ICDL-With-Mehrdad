import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // nodemailer is a Node library that must stay outside the server bundle.
  serverExternalPackages: ["nodemailer"],
  images: {
    // Administrators may reference media by absolute URL from the content builder.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
    ],
    formats: ["image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Ignored by browsers over plain HTTP, so it is safe to always send.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          /*
           * Deliberately narrow: these four directives cannot break this app and
           * each closes a class of attack — plugin embeds, `<base>` hijacking,
           * clickjacking and forms posting off-site. A `script-src` policy is
           * what would mitigate XSS outright, but it needs a per-request nonce
           * for Next's inline bootstrap scripts, so it is not set here.
           */
          {
            key: "Content-Security-Policy",
            value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
          },
        ],
      },
      {
        /*
         * Uploaded SVG, served by `src/app/uploads/social-icons/[name]/route.ts`.
         * This rule comes after the global one because the later `Content-Security-Policy`
         * wins, and `sandbox` must be the policy that applies here: it means a direct
         * visit to an uploaded file cannot run script on this origin, even if the
         * sanitiser were ever bypassed.
         */
        source: "/uploads/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
