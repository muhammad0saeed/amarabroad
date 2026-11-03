import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Stage 1 is a fully static site: `npm run build` writes plain HTML to /out.
  output: "export",
  // /programs/ → /programs/index.html, which Apache/cPanel (Hostever) serves without rewrites.
  trailingSlash: true,
  // The image optimizer needs a server; images are pre-sized WebP files instead.
  images: { unoptimized: true },
  // Lets a phone on the same Wi-Fi load the dev server (npm run dev:phone).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default withNextIntl(nextConfig);
