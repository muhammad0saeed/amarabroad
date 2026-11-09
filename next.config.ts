import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Stage 2 runs as a server app on Vercel. Public pages are still pre-rendered at build time
  // and refreshed when the admin saves a change; forms and /admin run on the server.
  // Keeps the Stage 1 addresses (/en/programs/...).
  trailingSlash: true,
  // Pages load the whole catalogue from the database while building; when the robots keep the database
  // busy, a page may need several retries. Give it 3 minutes instead of 1 before failing the deploy.
  staticPageGenerationTimeout: 180,
  // Lets a phone on the same Wi-Fi load the dev server (npm run dev:phone).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // Public pages send no cookies and are kept out of search engines while this is a private preview.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          // Basic protection: no framing of our pages by other sites, no content-type guessing,
          // no full addresses leaked to other sites, no camera/microphone/location access.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
