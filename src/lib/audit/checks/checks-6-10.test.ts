import { describe, expect, it } from "vitest";
import { unitsToMicros as m } from "@/lib/money";
import { campaign, healthyData, profile } from "../fixtures";
import { searchPartnersDisplay } from "./06-search-partners-display";
import { locationSettings } from "./07-location-settings";
import { scheduleWaste } from "./08-schedule-waste";
import { deviceWaste } from "./09-device-waste";
import { budgetLimitedWinners } from "./10-budget-limited-winners";
import type { ScheduleBucket } from "../types";

describe("6. search partners / display on search", () => {
  it("does not trigger on a healthy account", () => {
    expect(searchPartnersDisplay.run(healthyData(), profile())).toEqual([]);
  });

  const withPartners = (partnerCost: number, partnerConv: number) =>
    healthyData({
      campaigns: [campaign({ targetSearchNetwork: true })],
      networkStats: [
        { campaignId: "c1", network: "SEARCH", costMicros: m(900), conversions: 36 }, // £25 per lead
        { campaignId: "c1", network: "SEARCH_PARTNERS", costMicros: m(partnerCost), conversions: partnerConv },
      ],
    });

  it("flags partners with a worse CPA; waste is cost above target CPA", () => {
    const [f] = searchPartnersDisplay.run(withPartners(100, 2), profile()); // £50 per lead; target £30
    expect(f.wasteItems).toEqual([{ key: "network:c1:SEARCH_PARTNERS", costMicros: m(40) }]);
  });

  it("uses Google Search CPA when there is no target", () => {
    const [f] = searchPartnersDisplay.run(withPartners(100, 2), profile({ targetCpaMicros: null }));
    expect(f.wasteItems[0].costMicros).toBe(m(50)); // 100 - 2 × 25
  });

  it("does not trigger when partners do as well or better, or spend is tiny", () => {
    expect(searchPartnersDisplay.run(withPartners(100, 5), profile())).toEqual([]);
    expect(searchPartnersDisplay.run(withPartners(15, 0), profile())).toEqual([]);
  });
});

describe("7. location settings", () => {
  it("does not trigger on a healthy account", () => {
    expect(locationSettings.run(healthyData(), profile())).toEqual([]);
  });

  it('flags "presence or interest" targeting', () => {
    const data = healthyData({ campaigns: [campaign({ positiveGeoTargetType: "PRESENCE_OR_INTEREST" })] });
    const [f] = locationSettings.run(data, profile());
    expect(f.wasteItems).toEqual([]);
    expect(f.evidence.rows[0].setting).toBe("Presence or interest");
  });

  it("counts spend from outside the targeted area as waste", () => {
    const data = healthyData({
      locations: [
        ...healthyData().locations,
        { campaignId: "c1", targetingLocation: false, countryCriterionId: "2372", costMicros: m(60), conversions: 0 },
      ],
    });
    const [f] = locationSettings.run(data, profile());
    expect(f.wasteItems).toEqual([{ key: "geo:c1", costMicros: m(60) }]);
  });

  it("ignores small outside-area spend", () => {
    const data = healthyData({
      locations: [{ campaignId: "c1", targetingLocation: false, countryCriterionId: null, costMicros: m(10), conversions: 0 }],
    });
    expect(locationSettings.run(data, profile())).toEqual([]);
  });
});

describe("8. schedule waste", () => {
  it("does not trigger on an even schedule", () => {
    expect(scheduleWaste.run(healthyData(), profile())).toEqual([]);
  });

  it("flags a day with ≥10% of spend at ≥2× the average CPA", () => {
    // Weekdays: £100 and 5 leads each; Sunday: £300 and 1 lead.
    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const schedule: ScheduleBucket[] = [
      ...days.map((d) => ({ dayOfWeek: d, hour: 10, costMicros: m(100), conversions: 5 })),
      { dayOfWeek: "SUNDAY", hour: 10, costMicros: m(300), conversions: 1 },
    ];
    const [f] = scheduleWaste.run(healthyData({ schedule }), profile());
    // Avg CPA = 900 / 31 = £29.03; Sunday waste = 300 - 29.03 = £270.97.
    expect(f.evidence.rows.map((r) => r.when)).toEqual(["Sunday"]);
    expect(f.wasteItems[0].key).toBe("schedule");
    expect(f.wasteItems[0].costMicros).toBe(Math.round(m(300) - m(900) / 31));
  });

  it("does not trigger without conversions (no average to compare to)", () => {
    const schedule = [{ dayOfWeek: "MONDAY", hour: 1, costMicros: m(100), conversions: 0 }];
    expect(scheduleWaste.run(healthyData({ schedule }), profile())).toEqual([]);
  });
});

describe("9. device waste", () => {
  it("does not trigger on a healthy account", () => {
    expect(deviceWaste.run(healthyData(), profile())).toEqual([]);
  });

  it("flags a device with ≥2× the average CPA and meaningful spend", () => {
    const devices = [
      { device: "MOBILE", costMicros: m(800), clicks: 400, conversions: 40 },
      { device: "DESKTOP", costMicros: m(400), clicks: 100, conversions: 4 }, // £100 per lead vs £27.27 avg
    ];
    const [f] = deviceWaste.run(healthyData({ devices }), profile());
    expect(f.title).toContain("Desktop");
    expect(f.wasteItems).toEqual([{ key: "device:DESKTOP", costMicros: Math.round(m(400) - 4 * (m(1200) / 44)) }]);
  });

  it("ignores devices with tiny spend", () => {
    const devices = [
      { device: "MOBILE", costMicros: m(1000), clicks: 400, conversions: 40 },
      { device: "TABLET", costMicros: m(40), clicks: 10, conversions: 0 },
    ];
    expect(deviceWaste.run(healthyData({ devices }), profile())).toEqual([]);
  });
});

describe("10. budget-limited winners", () => {
  it("does not trigger on a healthy account", () => {
    expect(budgetLimitedWinners.run(healthyData(), profile())).toEqual([]);
  });

  it("flags limited campaigns with CPA under target and estimates missed leads", () => {
    const data = healthyData({ campaigns: [campaign({ searchBudgetLostImpressionShare: 0.5 })] }); // £25 CPA, 40 leads
    const [f] = budgetLimitedWinners.run(data, profile());
    expect(f).toMatchObject({ severity: "opportunity", wasteItems: [] });
    expect(f.evidence.rows[0].missedLeads).toBe(40);
    expect(f.recommendedActions).toEqual([{ type: "budget.adjust", payload: { campaignId: "c1", direction: "increase" } }]);
  });

  it("does not flag limited campaigns above target", () => {
    const data = healthyData({ campaigns: [campaign({ searchBudgetLostImpressionShare: 0.5, conversions: 20 })] }); // £50 CPA
    expect(budgetLimitedWinners.run(data, profile())).toEqual([]);
  });

  it("recognises Google's budget-constrained status", () => {
    const data = healthyData({ campaigns: [campaign({ primaryStatusReasons: ["BUDGET_CONSTRAINED"] })] });
    expect(budgetLimitedWinners.run(data, profile())).toHaveLength(1);
  });
});
