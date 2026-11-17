/**
 * Read-only Search Console access: which queries the business's website
 * ranks for organically, and where. Used by the paid/organic overlap check.
 */
export const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const BASE = "https://www.googleapis.com/webmasters/v3";

type Fetch = typeof fetch;

export type ScSite = { siteUrl: string; permissionLevel: string };
export type OrganicQuery = { query: string; position: number; clicks: number; impressions: number };

export class SearchConsoleError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SearchConsoleError";
  }
}

async function call(fetchFn: Fetch, accessToken: string, path: string, body?: unknown) {
  const res = await fetchFn(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as { message?: string } | undefined)?.message ?? `Search Console error ${res.status}`;
    throw new SearchConsoleError(msg, res.status);
  }
  return json;
}

export async function listSites(accessToken: string, fetchFn: Fetch = fetch): Promise<ScSite[]> {
  const json = await call(fetchFn, accessToken, "/sites");
  return ((json.siteEntry as ScSite[] | undefined) ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser");
}

/** Normalise a website or Search Console property to a bare host, e.g. "acme.co.uk". */
export function hostOf(urlOrProperty: string): string | null {
  const v = urlOrProperty.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith("sc-domain:")) return v.slice("sc-domain:".length).replace(/^www\./, "") || null;
  try {
    return new URL(v.includes("://") ? v : `https://${v}`).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * Pick the Search Console property for the business's website. A domain
 * property (sc-domain:) beats a URL-prefix property for the same host. With
 * no website on file, use the only property if there's exactly one.
 */
export function pickSite(sites: ScSite[], website: string | null): ScSite | null {
  const host = website ? hostOf(website) : null;
  if (!host) return sites.length === 1 ? sites[0] : null;
  const matches = sites.filter((s) => {
    const h = hostOf(s.siteUrl);
    return h !== null && (h === host || host.endsWith(`.${h}`));
  });
  return matches.find((s) => s.siteUrl.startsWith("sc-domain:")) ?? matches[0] ?? null;
}

export async function queryOrganic(
  accessToken: string,
  siteUrl: string,
  from: string,
  to: string,
  fetchFn: Fetch = fetch,
): Promise<OrganicQuery[]> {
  const json = await call(fetchFn, accessToken, `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    startDate: from,
    endDate: to,
    dimensions: ["query"],
    type: "web",
    rowLimit: 25000,
  });
  return ((json.rows as Array<{ keys: string[]; clicks: number; impressions: number; position: number }>) ?? []).map((r) => ({
    query: String(r.keys?.[0] ?? "").toLowerCase().trim(),
    position: Number(r.position ?? 0),
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
  }));
}
