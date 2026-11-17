import { describe, expect, it } from "vitest";
import { campaignDailyMetricsQuery } from "./gaql";
import { chunk, syncWindow, toDailyMetricRecord, todayInTimeZone } from "./sync";

describe("todayInTimeZone / syncWindow", () => {
  // 23:30 UTC on 17 Nov is already 18 Nov in Sydney, still 17 Nov in London.
  const now = new Date("2026-11-17T23:30:00Z");

  it("uses the account's time zone", () => {
    expect(todayInTimeZone("Europe/London", now)).toBe("2026-11-17");
    expect(todayInTimeZone("Australia/Sydney", now)).toBe("2026-11-18");
  });

  it("covers 90 days initially and 7 nightly, inclusive", () => {
    expect(syncWindow("Europe/London", true, now)).toEqual({ from: "2026-08-20", to: "2026-11-17" });
    expect(syncWindow("Europe/London", false, now)).toEqual({ from: "2026-11-11", to: "2026-11-17" });
  });
});

describe("toDailyMetricRecord", () => {
  it("maps REST rows, keeping money in micros", () => {
    const rec = toDailyMetricRecord(
      {
        campaign: { id: "42", name: "Brand", advertisingChannelType: "SEARCH" },
        segments: { date: "2026-11-16" },
        metrics: { costMicros: "12340000", clicks: "7", impressions: "120", conversions: 1.5, conversionsValue: 99.99 },
      },
      { businessId: "b", adAccountId: "a" },
    );
    expect(rec).toEqual({
      business_id: "b",
      ad_account_id: "a",
      date: "2026-11-16",
      campaign_id: "42",
      campaign_name: "Brand",
      campaign_type: "SEARCH",
      cost_micros: 12_340_000,
      clicks: 7,
      impressions: 120,
      conversions: 1.5,
      conv_value_micros: 99_990_000,
    });
  });

  it("defaults missing metrics to zero", () => {
    const rec = toDailyMetricRecord({ campaign: { id: "1" }, segments: { date: "2026-11-16" } }, { businessId: "b", adAccountId: "a" });
    expect(rec).toMatchObject({ cost_micros: 0, clicks: 0, impressions: 0, conversions: 0, conv_value_micros: 0 });
  });
});

describe("campaignDailyMetricsQuery", () => {
  it("only accepts ISO dates (no GAQL injection)", () => {
    expect(campaignDailyMetricsQuery("2026-11-01", "2026-11-07")).toContain("BETWEEN '2026-11-01' AND '2026-11-07'");
    expect(() => campaignDailyMetricsQuery("2026-11-01' OR '1'='1", "2026-11-07")).toThrow();
    expect(() => campaignDailyMetricsQuery("2026-11-08", "2026-11-07")).toThrow();
  });
});

describe("chunk", () => {
  it("splits into batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
