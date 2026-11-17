import { describe, expect, it } from "vitest";
import { parseBusinessStep, parseQuestionsStep } from "./onboarding";

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) (Array.isArray(v) ? v : [v]).forEach((x) => f.append(k, x));
  return f;
};

describe("onboarding step 1", () => {
  it("parses the business step", () => {
    const r = parseBusinessStep(fd({ name: " Hartley Plumbing ", website: "hartleyplumbing.co.uk", industry: "Plumbing and heating", base_location: "RG9 1AA", travel_radius_miles: "15", customer_value: "£280" }));
    expect(r.success && r.data).toEqual({
      name: "Hartley Plumbing",
      website: "https://hartleyplumbing.co.uk",
      industry: "Plumbing and heating",
      base_location: "RG9 1AA",
      travel_radius_miles: 15,
      customer_value_micros: 280_000_000,
    });
  });

  it("requires a name and a real-looking website", () => {
    expect(parseBusinessStep(fd({ name: "", website: "x.co.uk" })).success).toBe(false);
    expect(parseBusinessStep(fd({ name: "A", website: "not a website" })).success).toBe(false);
    expect(parseBusinessStep(fd({ name: "A", website: "localhost" })).success).toBe(false);
  });

  it("lets optional answers be blank", () => {
    const r = parseBusinessStep(fd({ name: "A", website: "a.com" }));
    expect(r.success && r.data).toMatchObject({ industry: null, travel_radius_miles: null, customer_value_micros: null });
  });
});

describe("onboarding step 2", () => {
  it("parses the three questions", () => {
    const r = parseQuestionsStep(fd({ who_runs_ads: "self", lead_types: ["calls", "forms"], spend_band: "500_1500" }));
    expect(r.success && r.data).toEqual({ who_runs_ads: "self", lead_types: ["calls", "forms"], spend_band: "500_1500" });
  });

  it("explains what's missing", () => {
    const r = parseQuestionsStep(fd({ who_runs_ads: "self", spend_band: "500_1500" }));
    expect(!r.success && r.error.issues[0].message).toBe("Pick at least one thing that counts as a lead");
    expect(parseQuestionsStep(fd({ who_runs_ads: "robot", lead_types: ["calls"], spend_band: "500_1500" })).success).toBe(false);
  });
});
