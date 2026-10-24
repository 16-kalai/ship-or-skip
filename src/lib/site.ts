import { headers } from "next/headers";

// The site's public origin, for links people share. NEXT_PUBLIC_SITE_URL wins (set it in
// production); otherwise it's taken from the request.
export async function siteOrigin() {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL;
  if (fixed) return fixed.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
