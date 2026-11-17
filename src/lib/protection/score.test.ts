import { describe, expect, it } from "vitest";
import { deviceFromUa, scoreClick, type ClickInput } from "./score";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const human = (o: Partial<ClickInput> = {}): ClickInput => ({
  userAgent: CHROME,
  signals: { wd: false, sw: 1920, sh: 1080, dpr: 1, lang: ["en-GB"], cores: 8, mem: 8, touch: 0, pl: 5 },
  ipCountry: "GB",
  timezone: "Europe/London",
  businessCountry: "GB",
  sameIpClicks24h: 1,
  sameDeviceClicks24h: 1,
  dwellMs: 45_000,
  interacted: true,
  ...o,
});

describe("scoreClick", () => {
  it("passes a normal local visitor", () => {
    expect(scoreClick(human())).toEqual({ score: 0, suspicious: false, reasons: [] });
  });

  it("flags automated browsers and bot user agents", () => {
    expect(scoreClick(human({ signals: { ...human().signals, wd: true } }))).toMatchObject({ suspicious: true, score: 80 });
    expect(scoreClick(human({ userAgent: "Mozilla/5.0 HeadlessChrome/140.0" })).reasons[0]).toMatch(/bot or script/);
  });

  it("flags repeat clicks from one IP, more strongly at 5+", () => {
    const three = scoreClick(human({ sameIpClicks24h: 3 }));
    expect(three).toMatchObject({ score: 45, suspicious: false });
    expect(three.reasons[0]).toBe("Same IP address clicked your ads 3 times in 24 hours");
    expect(scoreClick(human({ sameIpClicks24h: 5 }))).toMatchObject({ score: 65, suspicious: true });
  });

  it("repeat clicks plus an instant bounce is suspicious", () => {
    const r = scoreClick(human({ sameIpClicks24h: 3, dwellMs: 900, interacted: false }));
    expect(r).toMatchObject({ score: 70, suspicious: true });
  });

  it("a short visit with interaction is not a bounce", () => {
    expect(scoreClick(human({ dwellMs: 900, interacted: true })).score).toBe(0);
  });

  it("notes clicks from abroad and VPN-style time-zone mismatches without condemning them alone", () => {
    const abroad = scoreClick(human({ ipCountry: "IN", timezone: "Asia/Kolkata" }));
    expect(abroad).toMatchObject({ score: 25, suspicious: false });
    expect(abroad.reasons[0]).toBe("Clicked from India, outside the UK");
    const vpn = scoreClick(human({ ipCountry: "GB", timezone: "America/New_York" }));
    expect(vpn.reasons[0]).toMatch(/America\/New_York but the IP is in the UK/);
  });

  it("flags requests missing normal browser details", () => {
    expect(scoreClick(human({ signals: {} })).reasons).toContain("Missing the details every normal browser sends");
  });

  it("caps at 100", () => {
    const r = scoreClick(human({ signals: { wd: true }, sameIpClicks24h: 9, sameDeviceClicks24h: 9, ipCountry: "US", timezone: "Asia/Tokyo" }));
    expect(r.score).toBe(100);
  });
});

describe("deviceFromUa", () => {
  it("classifies devices", () => {
    expect(deviceFromUa(CHROME)).toBe("desktop");
    expect(deviceFromUa("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
    expect(deviceFromUa("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe("tablet");
    expect(deviceFromUa("Googlebot/2.1")).toBe("bot");
    expect(deviceFromUa(null)).toBe("unknown");
  });
});
