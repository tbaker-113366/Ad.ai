import { describe, expect, it } from "vitest";
import { runAudit } from "./index";
import { sampleAudit } from "./sample";

describe("sample audit", () => {
  it("produces a believable report", () => {
    const { data, profile } = sampleAudit();
    const r = runAudit(data, profile);
    expect(r.findings.length).toBeGreaterThanOrEqual(8);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(70);
    expect(r.estMonthlyWasteMicros).toBeGreaterThan(0);
    expect(r.estMonthlyWasteMicros).toBeLessThan(data.totals.costMicros);
  });
});
