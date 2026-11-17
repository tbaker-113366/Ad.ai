import { describe, expect, it } from "vitest";
import { campaign, healthyData, profile } from "../fixtures";
import { invalidClicks } from "./16-invalid-clicks";

describe("16. invalid clicks", () => {
  it("does not trigger at a normal rate", () => {
    expect(invalidClicks.run(healthyData(), profile())).toEqual([]);
  });

  it("triggers at ≥15% invalid with enough volume, with no £ figure", () => {
    const [f] = invalidClicks.run(healthyData({ invalidClicks: { clicks: 800, invalidClicks: 200 } }), profile());
    expect(f).toMatchObject({ severity: "warning", wasteItems: [] });
    expect(f.explanation).toContain("200 clicks (20% of all clicks)");
  });

  it("does not trigger on tiny volumes", () => {
    expect(invalidClicks.run(healthyData({ invalidClicks: { clicks: 100, invalidClicks: 40 } }), profile())).toEqual([]);
  });

  it("points at partner/Display campaigns when present", () => {
    const data = healthyData({
      campaigns: [campaign({ targetContentNetwork: true })],
      invalidClicks: { clicks: 800, invalidClicks: 200 },
    });
    expect(invalidClicks.run(data, profile())[0].fix).toMatch(/Search Partners/);
  });
});
