import { describe, expect, it } from "vitest";
import { runAudit } from "./index";
import { sampleAudit } from "./sample";

describe("sample audit", () => {
  it("produces a believable report", () => {
    const { data, profile } = sampleAudit();
    const r = runAudit(data, profile);
    // Believable, not alarmist: a handful of problems, a mid-range score,
    // and waste well under a third of spend.
    expect(r.findings.length).toBeGreaterThanOrEqual(5);
    expect(r.findings.length).toBeLessThanOrEqual(9);
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(r.score).toBeLessThan(80);
    expect(r.estMonthlyWasteMicros).toBeGreaterThan(0);
    expect(r.estMonthlyWasteMicros).toBeLessThan(data.totals.costMicros / 3);
  });
});
