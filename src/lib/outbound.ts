/** Returns an internal /out?u=... redirect URL for any external link */
export function getOutboundUrl(externalUrl: string): string {
  let cleaned = (externalUrl || "").trim();
  if (!cleaned) return "#";
  if (!/^https?:\/\//i.test(cleaned)) cleaned = `https://${cleaned}`;
  return `/out?u=${encodeURIComponent(cleaned)}`;
}
