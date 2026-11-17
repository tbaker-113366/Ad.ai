import { describe, expect, it } from "vitest";
import { summarise, type ClickRow } from "./summary";

const row = (o: Partial<ClickRow>): ClickRow => ({ ip: "1.1.1.1", suspicious: false, reasons: [], clicked_at: "2026-11-17T10:00:00Z", country: "GB", city: "Reading", device: "mobile", score: 0, ...o });

describe("summarise", () => {
  it("counts suspicious clicks, costs them and ranks IPs and reasons", () => {
    const rows = [
      row({}),
      row({ ip: "9.9.9.9", suspicious: true, reasons: ["Same IP address clicked your ads 3 times in 24 hours", "Left within 2 seconds without scrolling or tapping"], clicked_at: "2026-11-17T11:00:00Z" }),
      row({ ip: "9.9.9.9", suspicious: true, reasons: ["Same IP address clicked your ads 4 times in 24 hours"], clicked_at: "2026-11-17T12:00:00Z" }),
      row({ ip: "8.8.8.8", suspicious: true, reasons: ["Automated browser (a bot, not a person)"], city: null, country: "US" }),
    ];
    const s = summarise(rows, 2_500_000);
    expect(s).toMatchObject({ paidClicks: 4, suspiciousClicks: 3, suspiciousShare: 0.75, suspiciousCostMicros: 7_500_000 });
    expect(s.topIps.map((x) => [x.ip, x.suspicious, x.place])).toEqual([["9.9.9.9", 2, "Reading, GB"], ["8.8.8.8", 1, "US"]]);
    expect(s.topIps[0].lastSeen).toBe("2026-11-17T12:00:00Z");
    expect(s.topReasons[0]).toEqual({ reason: "Same IP clicking repeatedly", clicks: 2 });
  });

  it("handles no data", () => {
    expect(summarise([], 1_000_000)).toMatchObject({ paidClicks: 0, suspiciousShare: 0, suspiciousCostMicros: 0, topIps: [] });
  });
});
