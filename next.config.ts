import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Stage 2 runs as a server app on Vercel. Public pages are still pre-rendered at build time
  // and refreshed when the admin saves a change; forms and /admin run on the server.
  // Keeps the Stage 1 addresses (/en/programs/...).
  trailingSlash: true,
  // Lets a phone on the same Wi-Fi load the dev server (npm run dev:phone).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // Public pages send no cookies and are kept out of search engines while this is a private preview.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default withNextIntl(nextConfig);
