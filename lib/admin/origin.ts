import "server-only";

/**
 * The address the visitor is actually using ("http://localhost:3000", later the Vercel domain).
 * SITE_URL wins when set; otherwise the Host header. Never the server's bind address (0.0.0.0).
 */
export function siteOrigin(h: Headers): string {
  const fixed = process.env.SITE_URL?.replace(/\/$/, "");
  if (fixed) return fixed;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
