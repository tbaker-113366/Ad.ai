import { describe, expect, it } from "vitest";
import { parseProfileForm } from "./profileForm";

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};

describe("parseProfileForm", () => {
  it("parses money to micros and lists to lowercase unique arrays", () => {
    const r = parseProfileForm(
      form({ offering: " Plumbing ", locations_served: "Leeds, Bradford\nLeeds", target_cpa: "£35.50", monthly_budget: "1,500", brand_terms: "Acme", irrelevant_terms: "" }),
    );
    expect(r.success && r.data).toEqual({
      offering: "Plumbing",
      locations_served: ["leeds", "bradford"],
      target_cpa_micros: 35_500_000,
      monthly_budget_micros: 1_500_000_000,
      brand_terms: ["acme"],
      irrelevant_terms: [],
    });
  });

  it("allows everything to be skipped", () => {
    const r = parseProfileForm(form({}));
    expect(r.success && r.data).toMatchObject({ offering: null, target_cpa_micros: null, monthly_budget_micros: null });
  });

  it("rejects nonsense amounts", () => {
    expect(parseProfileForm(form({ target_cpa: "abc" })).success).toBe(false);
    expect(parseProfileForm(form({ target_cpa: "-5" })).success).toBe(false);
    expect(parseProfileForm(form({ monthly_budget: "0" })).success).toBe(false);
  });
});
