import { describe, expect, it } from "vitest";
import { unitsToMicros as m } from "@/lib/money";
import { compareAudits, shouldAlertNewWaste, type AuditSnapshot } from "./compare";

const snap = (findings: AuditSnapshot["findings"], windowDays = 30, totalSpendMicros = m(1000)): AuditSnapshot => ({
  windowDays,
  totalSpendMicros,
  findings,
});

describe("compareAudits", () => {
  it("finds resolved and new checks, stopped and new waste", () => {
    const prev = snap([
      { checkKey: "wasted_search_terms", title: "W", wasteItems: [{ key: "term:a", costMicros: m(40) }, { key: "term:b", costMicros: m(20) }] },
      { checkKey: "weak_ads", title: "Ads", wasteItems: [] },
    ]);
    const curr = snap([
      { checkKey: "wasted_search_terms", title: "W", wasteItems: [{ key: "term:b", costMicros: m(25) }, { key: "term:c", costMicros: m(10) }] },
      { checkKey: "device_waste", title: "Devices", wasteItems: [{ key: "device:DESKTOP", costMicros: m(60) }] },
    ]);
    expect(compareAudits(prev, curr)).toEqual({
      resolvedChecks: ["weak_ads"],
      newChecks: [{ checkKey: "device_waste", title: "Devices" }],
      stoppedWasteMicros: m(40),
      newWasteMicros: m(70),
    });
  });

  it("counts an item flagged by several checks once and scales to a month", () => {
    const prev = snap(
      [
        { checkKey: "wasted_search_terms", title: "", wasteItems: [{ key: "term:x", costMicros: m(90) }] },
        { checkKey: "irrelevant_search_terms", title: "", wasteItems: [{ key: "term:x", costMicros: m(90) }] },
      ],
      90,
    );
    expect(compareAudits(prev, snap([])).stoppedWasteMicros).toBe(m(30));
  });
});

describe("shouldAlertNewWaste", () => {
  const c = (newWasteMicros: number) => ({ resolvedChecks: [], newChecks: [], stoppedWasteMicros: 0, newWasteMicros });
  it("needs at least £50 and 5% of monthly spend", () => {
    expect(shouldAlertNewWaste(c(m(60)), { totalSpendMicros: m(1000), windowDays: 30 })).toBe(true);
    expect(shouldAlertNewWaste(c(m(40)), { totalSpendMicros: m(500), windowDays: 30 })).toBe(false);
    expect(shouldAlertNewWaste(c(m(60)), { totalSpendMicros: m(5000), windowDays: 30 })).toBe(false);
  });
});
