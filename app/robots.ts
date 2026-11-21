import type { MetadataRoute } from "next";

// Private preview: every page already says "noindex", but crawlers still downloaded thousands of program pages,
// and each first download rebuilds a page (Vercel's free plan allows 200,000 rebuilds a month; used up on
// 22 Nov 2026). Until launch, crawlers are asked to stay away. At launch: allow "/" and keep "/admin/" blocked.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
