import { describe, expect, it } from "vitest";
import { buildWeeklyReport, type WeeklyReportInput } from "./weeklyReport";

const base: WeeklyReportInput = {
  businessName: "Hartley Plumbing",
  accountName: "Hartley Main",
  currency: "GBP",
  score: 72,
  previousScore: 64,
  wasteMicros: 285_000_000,
  change: { resolved: 2, added: 1, stoppedWasteMicros: 120_000_000, newWasteMicros: 38_000_000 },
  fixes: [
    { title: "Your ads are showing for searches that aren't for you", fix: "Add \"jobs\" as a negative keyword.", wasteMicros: 221_000_000 },
    { title: "Ads are missing extra information", fix: "Add sitelinks.", wasteMicros: null },
  ],
  fakeClicks: { suspicious: 6, costMicros: 15_000_000 },
  auditUrl: "https://adiro.ai/audits/abc",
  settingsUrl: "https://adiro.ai/settings/profile",
};

describe("buildWeeklyReport", () => {
  it("leads with the £ figure and lists what changed and what to fix", () => {
    const r = buildWeeklyReport(base);
    expect(r.subject).toBe("£285 a month to fix in Hartley Main: your Adiro week");
    expect(r.text).toContain("Score: 72/100 (up 8 from last week)");
    expect(r.text).toContain("- 2 problems fixed");
    expect(r.text).toContain("- £120 a month of waste stopped");
    expect(r.text).toContain("1. Your ads are showing for searches that aren't for you (£221/month)");
    expect(r.text).toContain("Fake clicks: 6 suspicious paid clicks in the last 7 days, costing about £15.");
    expect(r.html).toContain("https://adiro.ai/audits/abc");
    expect(r.html).toContain("Turn them off");
  });

  it("escapes text so finding wording can't break the HTML", () => {
    const r = buildWeeklyReport({ ...base, fixes: [{ title: "<script>x</script>", fix: "a & b", wasteMicros: null }] });
    expect(r.html).not.toContain("<script>x");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).toContain("a &amp; b");
  });

  it("handles a clean first week", () => {
    const r = buildWeeklyReport({ ...base, wasteMicros: 0, previousScore: null, change: null, fixes: [], fakeClicks: null });
    expect(r.subject).toBe("Hartley Main is in good shape: your Adiro week");
    expect(r.text).toContain("Score: 72/100");
    expect(r.text).not.toContain("Since last week");
    expect(r.html).not.toContain("Things to improve");
  });
});
