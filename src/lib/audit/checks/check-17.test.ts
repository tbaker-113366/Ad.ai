import { describe, expect, it } from "vitest";
import { unitsToMicros as m } from "@/lib/money";
import { healthyData, profile, term } from "../fixtures";
import { paidOrganicOverlap } from "./17-paid-organic-overlap";
import type { AuditData } from "../types";

const organic = (queries: Array<{ query: string; position: number; impressions?: number }>): AuditData["organic"] => ({
  status: "ok",
  siteUrl: "sc-domain:acme.co.uk",
  queries: queries.map((q) => ({ clicks: 50, impressions: 500, ...q })),
});

const overlapData = (competition: { absoluteTopShare: number | null; rankLostShare: number | null }, position = 1.5) =>
  healthyData({
    searchTerms: [term({ term: "emergency plumber leeds", adGroupId: "ag1", keywordCriterionId: "k1", costMicros: m(120) })],
    keywordCompetition: { "ag1~k1": competition },
    organic: organic([{ query: "Emergency Plumber Leeds", position }]),
  });

describe("17. paid / organic overlap", () => {
  it("does not trigger on a healthy account (no competition data for the overlap)", () => {
    expect(paidOrganicOverlap.run(healthyData(), profile())).toEqual([]);
  });

  it("flags paid searches ranking top 3 organically with little competition", () => {
    const [f] = paidOrganicOverlap.run(overlapData({ absoluteTopShare: 0.95, rankLostShare: 0.02 }), profile());
    expect(f).toMatchObject({ severity: "opportunity", wasteItems: [] });
    expect(f.evidence.rows).toEqual([
      { term: "emergency plumber leeds", campaign: "Search - Services", position: 1.5, absTop: 0.95, cost: m(120) },
    ]);
    expect(f.fix).toMatch(/pause these keywords for 2 weeks/);
  });

  it("does not flag when competitors are bidding, and says to keep bidding", () => {
    const data = overlapData({ absoluteTopShare: 0.5, rankLostShare: 0.3 });
    expect(paidOrganicOverlap.run(data, profile())).toEqual([]);

    const mixed: AuditData = {
      ...data,
      searchTerms: [...data.searchTerms, term({ term: "boiler service", keywordCriterionId: "k2", costMicros: m(50) })],
      keywordCompetition: { ...data.keywordCompetition, "ag1~k2": { absoluteTopShare: 0.9, rankLostShare: 0 } },
      organic: organic([{ query: "emergency plumber leeds", position: 1.5 }, { query: "boiler service", position: 2 }]),
    };
    const [f] = paidOrganicOverlap.run(mixed, profile());
    expect(f.evidence.rows.map((r) => r.term)).toEqual(["boiler service"]);
    expect(f.evidence.notes?.[1]).toMatch(/keep bidding/);
  });

  it("does not flag when the organic ranking is below the top 3", () => {
    expect(paidOrganicOverlap.run(overlapData({ absoluteTopShare: 0.95, rankLostShare: 0 }, 4.2), profile())).toEqual([]);
  });

  it("does nothing without Search Console data", () => {
    const data = { ...overlapData({ absoluteTopShare: 0.95, rankLostShare: 0 }), organic: { status: "no_site" as const, siteUrl: null, queries: [] as [] } };
    expect(paidOrganicOverlap.run(data, profile())).toEqual([]);
  });

  it("mentions brand searches", () => {
    const data = healthyData({
      searchTerms: [term({ term: "acme plumbing", adGroupId: "ag2", keywordCriterionId: "k9", costMicros: m(60) })],
      keywordCompetition: { "ag2~k9": { absoluteTopShare: 0.99, rankLostShare: 0 } },
    });
    expect(paidOrganicOverlap.run(data, profile())[0].explanation).toContain("your own brand name");
  });
});
