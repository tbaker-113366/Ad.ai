import { describe, expect, it } from "vitest";
import { formatPlanPrice, PLANS } from "./plans";

describe("plans", () => {
  it("has the agreed prices", () => {
    expect(PLANS.map((p) => [p.id, formatPlanPrice(p.pricePence), p.accounts])).toEqual([
      ["monitor", "£69", 1],
      ["agency", "£99", 3],
      ["super_agency", "£150", null],
    ]);
  });
});
