/** Turns click events into the numbers the Fake clicks page shows. Pure; tested. */
export type ClickRow = {
  ip: string | null;
  suspicious: boolean;
  reasons: string[];
  clicked_at: string;
  country: string | null;
  city: string | null;
  device: string | null;
  score: number;
};

export type ProtectionSummary = {
  paidClicks: number;
  suspiciousClicks: number;
  suspiciousShare: number;
  /** Estimated cost of suspicious clicks (micros) at the account's average cost per click. */
  suspiciousCostMicros: number;
  topIps: Array<{ ip: string; clicks: number; suspicious: number; lastSeen: string; place: string | null }>;
  topReasons: Array<{ reason: string; clicks: number }>;
};

/** Group "Same IP clicked 4 times…" style reasons under one heading. */
export function reasonKey(r: string): string {
  if (r.startsWith("Same IP address")) return "Same IP clicking repeatedly";
  if (r.startsWith("Same device")) return "Same device clicking repeatedly";
  if (r.startsWith("Clicked from")) return "Clicks from outside your country";
  if (r.startsWith("Device clock")) return "Location doesn't match the device (VPN)";
  return r;
}

export function summarise(rows: ClickRow[], avgCpcMicros: number): ProtectionSummary {
  const suspicious = rows.filter((r) => r.suspicious);
  const byIp = new Map<string, ProtectionSummary["topIps"][number]>();
  for (const r of rows) {
    if (!r.ip) continue;
    const cur = byIp.get(r.ip) ?? { ip: r.ip, clicks: 0, suspicious: 0, lastSeen: r.clicked_at, place: null };
    cur.clicks++;
    if (r.suspicious) cur.suspicious++;
    if (r.clicked_at > cur.lastSeen) cur.lastSeen = r.clicked_at;
    cur.place = cur.place ?? ([r.city, r.country].filter(Boolean).join(", ") || null);
    byIp.set(r.ip, cur);
  }
  const reasons = new Map<string, number>();
  for (const r of suspicious) for (const k of new Set(r.reasons.map(reasonKey))) reasons.set(k, (reasons.get(k) ?? 0) + 1);

  return {
    paidClicks: rows.length,
    suspiciousClicks: suspicious.length,
    suspiciousShare: rows.length ? suspicious.length / rows.length : 0,
    suspiciousCostMicros: Math.round(suspicious.length * avgCpcMicros),
    topIps: [...byIp.values()].filter((x) => x.suspicious > 0).sort((a, b) => b.suspicious - a.suspicious || b.clicks - a.clicks).slice(0, 10),
    topReasons: [...reasons.entries()].map(([reason, clicks]) => ({ reason, clicks })).sort((a, b) => b.clicks - a.clicks),
  };
}
