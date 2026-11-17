import { THRESHOLDS } from "@/config/thresholds";

/** Browser details the snippet sends. All optional: bots often send little. */
export type ClickSignals = {
  wd?: boolean; // navigator.webdriver
  sw?: number; // screen width
  sh?: number;
  dpr?: number;
  lang?: string[];
  cores?: number;
  mem?: number;
  touch?: number;
  pl?: number; // plugin count
};

export type ClickInput = {
  userAgent: string | null;
  signals: ClickSignals;
  ipCountry: string | null; // ISO country from the IP
  timezone: string | null; // from the browser
  businessCountry: string; // e.g. GB
  /** Paid clicks from the same IP / device in the last 24h, including this one. */
  sameIpClicks24h: number;
  sameDeviceClicks24h: number;
  /** Filled in when the visitor leaves the page. */
  dwellMs?: number | null;
  interacted?: boolean;
};

export type ClickScore = { score: number; suspicious: boolean; reasons: string[] };

const BOT_UA = /(bot|crawler|spider|crawl|slurp|headless|phantomjs|selenium|puppeteer|playwright|python-requests|curl\/|wget|httpclient|go-http-client|java\/)/i;

/** Time-zone prefixes a real visitor from these countries would have. */
const COUNTRY_TZ: Record<string, string[]> = {
  GB: ["Europe/London"],
  IE: ["Europe/Dublin"],
  US: ["America/", "Pacific/Honolulu"],
  CA: ["America/"],
  AU: ["Australia/"],
  NZ: ["Pacific/Auckland", "Pacific/Chatham"],
  FR: ["Europe/Paris"],
  DE: ["Europe/Berlin", "Europe/Busingen"],
  ES: ["Europe/Madrid", "Atlantic/Canary", "Africa/Ceuta"],
  NL: ["Europe/Amsterdam"],
  IN: ["Asia/Kolkata", "Asia/Calcutta"],
};

const COUNTRY_NAME: Record<string, string> = { GB: "the UK", US: "the USA", IE: "Ireland", IN: "India", FR: "France", DE: "Germany", NL: "the Netherlands", ES: "Spain", CA: "Canada", AU: "Australia" };
const countryName = (c: string) => COUNTRY_NAME[c] ?? c;

/**
 * Explainable scoring for one paid click. Each rule adds weight and a plain
 * reason an owner can read; the click is suspicious at or above the threshold.
 */
export function scoreClick(c: ClickInput): ClickScore {
  const w = THRESHOLDS.clickProtection.weights;
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  if (c.signals.wd) add(w.automatedBrowser, "Automated browser (a bot, not a person)");
  else if (c.userAgent && BOT_UA.test(c.userAgent)) add(w.botUserAgent, "Identifies itself as a bot or script");

  if (!c.signals.sw || !c.signals.sh || c.signals.sw < 200 || c.signals.sh < 200) {
    add(w.noBrowserDetails, "Missing the details every normal browser sends");
  }

  if (c.sameIpClicks24h >= 5) add(w.repeatIp5, `Same IP address clicked your ads ${c.sameIpClicks24h} times in 24 hours`);
  else if (c.sameIpClicks24h >= 3) add(w.repeatIp3, `Same IP address clicked your ads ${c.sameIpClicks24h} times in 24 hours`);

  if (c.sameDeviceClicks24h >= 3) add(w.repeatDevice3, `Same device clicked your ads ${c.sameDeviceClicks24h} times in 24 hours`);

  if (c.dwellMs !== undefined && c.dwellMs !== null && c.dwellMs < THRESHOLDS.clickProtection.instantBounceMs && !c.interacted) {
    add(w.instantBounce, "Left within 2 seconds without scrolling or tapping");
  }

  if (c.ipCountry && c.ipCountry !== c.businessCountry) {
    add(w.outsideCountry, `Clicked from ${countryName(c.ipCountry)}, outside ${countryName(c.businessCountry)}`);
  }

  const expected = c.ipCountry ? COUNTRY_TZ[c.ipCountry] : undefined;
  if (expected && c.timezone && !expected.some((p) => c.timezone!.startsWith(p))) {
    add(w.timezoneMismatch, `Device clock is set to ${c.timezone} but the IP is in ${countryName(c.ipCountry!)} (often a VPN)`);
  }

  score = Math.min(100, score);
  return { score, suspicious: score >= THRESHOLDS.clickProtection.suspiciousAt, reasons };
}

/** Rough device class from the user agent (for display). */
export function deviceFromUa(ua: string | null): "mobile" | "desktop" | "tablet" | "bot" | "unknown" {
  if (!ua) return "unknown";
  if (BOT_UA.test(ua)) return "bot";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}
