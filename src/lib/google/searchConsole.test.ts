import { describe, expect, it, vi } from "vitest";
import { hostOf, listSites, pickSite, queryOrganic, SearchConsoleError } from "./searchConsole";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("hostOf", () => {
  it("normalises websites and properties", () => {
    expect(hostOf("https://www.Acme.co.uk/contact")).toBe("acme.co.uk");
    expect(hostOf("acme.co.uk")).toBe("acme.co.uk");
    expect(hostOf("sc-domain:acme.co.uk")).toBe("acme.co.uk");
    expect(hostOf("")).toBeNull();
  });
});

describe("pickSite", () => {
  const sites = [
    { siteUrl: "https://www.acme.co.uk/", permissionLevel: "siteOwner" },
    { siteUrl: "sc-domain:acme.co.uk", permissionLevel: "siteFullUser" },
    { siteUrl: "https://other.com/", permissionLevel: "siteOwner" },
  ];
  it("prefers the domain property matching the website", () => {
    expect(pickSite(sites, "https://acme.co.uk")?.siteUrl).toBe("sc-domain:acme.co.uk");
  });
  it("matches subdomains of a domain property", () => {
    expect(pickSite([sites[1]], "https://shop.acme.co.uk")?.siteUrl).toBe("sc-domain:acme.co.uk");
  });
  it("returns null when nothing matches", () => {
    expect(pickSite(sites, "https://nope.org")).toBeNull();
  });
  it("uses the only property when there's no website on file", () => {
    expect(pickSite([sites[2]], null)?.siteUrl).toBe("https://other.com/");
    expect(pickSite(sites, null)).toBeNull();
  });
});

describe("Search Console API calls", () => {
  it("lists verified sites only", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json(200, { siteEntry: [{ siteUrl: "a", permissionLevel: "siteOwner" }, { siteUrl: "b", permissionLevel: "siteUnverifiedUser" }] }),
    );
    expect((await listSites("tok", fetchFn)).map((s) => s.siteUrl)).toEqual(["a"]);
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });

  it("queries search analytics by query", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(200, { rows: [{ keys: ["Acme Plumbing"], clicks: 10, impressions: 100, position: 1.4 }] }));
    const rows = await queryOrganic("tok", "sc-domain:acme.co.uk", "2026-10-18", "2026-11-16", fetchFn);
    expect(rows).toEqual([{ query: "acme plumbing", clicks: 10, impressions: 100, position: 1.4 }]);
    expect(fetchFn.mock.calls[0][0]).toBe(
      "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aacme.co.uk/searchAnalytics/query",
    );
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toMatchObject({ dimensions: ["query"], startDate: "2026-10-18" });
  });

  it("raises a typed error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(403, { error: { message: "User does not have sufficient permission" } }));
    await expect(listSites("tok", fetchFn)).rejects.toBeInstanceOf(SearchConsoleError);
  });
});
