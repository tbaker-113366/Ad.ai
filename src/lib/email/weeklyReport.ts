import { formatMoney } from "@/lib/money";

/** The weekly "things to improve" email. Pure (no I/O) so it's easy to test and preview. */
export type WeeklyReportInput = {
  businessName: string;
  accountName: string;
  currency: string;
  score: number;
  previousScore: number | null;
  wasteMicros: number;
  /** From comparing with last week's audit; null on the first report. */
  change: { resolved: number; added: number; stoppedWasteMicros: number; newWasteMicros: number } | null;
  fixes: Array<{ title: string; fix: string; wasteMicros: number | null }>;
  fakeClicks: { suspicious: number; costMicros: number } | null;
  auditUrl: string;
  settingsUrl: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (m: number, c: string) => formatMoney(m, c).replace(/\.00$/, "");

export function buildWeeklyReport(r: WeeklyReportInput) {
  const waste = r.wasteMicros > 0 ? money(r.wasteMicros, r.currency) : null;
  const subject = waste
    ? `${waste} a month to fix in ${r.accountName}: your Adiro week`
    : `${r.accountName} is in good shape: your Adiro week`;

  const scoreLine =
    r.previousScore === null
      ? `Score: ${r.score}/100`
      : `Score: ${r.score}/100 (${r.score >= r.previousScore ? "up" : "down"} ${Math.abs(r.score - r.previousScore)} from last week)`;
  const changeLines: string[] = [];
  if (r.change) {
    if (r.change.resolved) changeLines.push(`${r.change.resolved} problem${r.change.resolved === 1 ? "" : "s"} fixed`);
    if (r.change.stoppedWasteMicros > 0) changeLines.push(`${money(r.change.stoppedWasteMicros, r.currency)} a month of waste stopped`);
    if (r.change.added) changeLines.push(`${r.change.added} new problem${r.change.added === 1 ? "" : "s"}`);
    if (r.change.newWasteMicros > 0) changeLines.push(`${money(r.change.newWasteMicros, r.currency)} a month of new waste`);
  }
  const fixes = r.fixes.slice(0, 3);

  const text = [
    `${r.businessName}: your weekly Google Ads check`,
    "",
    waste ? `About ${waste} a month is being wasted in ${r.accountName}.` : `We didn't find obvious wasted spend in ${r.accountName} this week.`,
    scoreLine,
    ...(changeLines.length ? ["", "Since last week:", ...changeLines.map((l) => `- ${l}`)] : []),
    ...(fixes.length ? ["", "Things to improve this week:", ...fixes.map((f, i) => `${i + 1}. ${f.title}${f.wasteMicros ? ` (${money(f.wasteMicros, r.currency)}/month)` : ""}\n   ${f.fix}`)] : []),
    ...(r.fakeClicks && r.fakeClicks.suspicious > 0
      ? ["", `Fake clicks: ${r.fakeClicks.suspicious} suspicious paid click${r.fakeClicks.suspicious === 1 ? "" : "s"} in the last 7 days${r.fakeClicks.costMicros > 0 ? `, costing about ${money(r.fakeClicks.costMicros, r.currency)}` : ""}.`]
      : []),
    "",
    `See the full audit: ${r.auditUrl}`,
    "",
    `You get this because weekly reports are on for ${r.businessName}. Turn them off: ${r.settingsUrl}`,
  ].join("\n");

  const fixRows = fixes
    .map(
      (f, i) => `<tr><td style="padding:14px 0;border-top:1px solid #e5e5e5;vertical-align:top;width:32px;font:800 20px Arial,sans-serif;color:#11804f">${i + 1}</td>
<td style="padding:14px 0;border-top:1px solid #e5e5e5;font:15px/1.45 Arial,sans-serif;color:#171717"><strong>${esc(f.title)}</strong>${
        f.wasteMicros ? ` <span style="color:#c2410c;font-weight:700">${esc(money(f.wasteMicros, r.currency))}/mo</span>` : ""
      }<br><span style="color:#666666">${esc(f.fix)}</span></td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#fafafa">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:14px">
<tr><td style="padding:24px 28px 0"><img src="https://adiro.ai/brand/adiro-logo.png" alt="Adiro" width="100" height="25" style="display:block"></td></tr>
<tr><td style="padding:20px 28px 0;font:600 13px Arial,sans-serif;color:#666666;text-transform:uppercase;letter-spacing:1px">Your week · ${esc(r.accountName)}</td></tr>
<tr><td style="padding:8px 28px 0;font:800 26px/1.2 Arial,sans-serif;color:#171717">${
    waste ? `About <span style="color:#c2410c">${esc(waste)}</span> a month is being wasted` : "No obvious wasted spend this week"
  }</td></tr>
<tr><td style="padding:10px 28px 0;font:15px Arial,sans-serif;color:#666666">${esc(scoreLine)}</td></tr>
${
  changeLines.length
    ? `<tr><td style="padding:16px 28px 0"><table role="presentation" width="100%" style="background:#e7f8ef;border-radius:10px"><tr><td style="padding:12px 16px;font:14px/1.6 Arial,sans-serif;color:#0e5c3a"><strong>Since last week:</strong> ${esc(changeLines.join(" · "))}</td></tr></table></td></tr>`
    : ""
}
${
  fixes.length
    ? `<tr><td style="padding:22px 28px 0;font:800 18px Arial,sans-serif;color:#171717">Things to improve this week</td></tr>
<tr><td style="padding:6px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${fixRows}</table></td></tr>`
    : ""
}
${
  r.fakeClicks && r.fakeClicks.suspicious > 0
    ? `<tr><td style="padding:16px 28px 0"><table role="presentation" width="100%" style="background:#fff4ed;border-radius:10px"><tr><td style="padding:12px 16px;font:14px/1.5 Arial,sans-serif;color:#c2410c"><strong>Fake clicks:</strong> ${r.fakeClicks.suspicious} suspicious paid click${r.fakeClicks.suspicious === 1 ? "" : "s"} in the last 7 days${
        r.fakeClicks.costMicros > 0 ? `, costing about ${esc(money(r.fakeClicks.costMicros, r.currency))}` : ""
      }.</td></tr></table></td></tr>`
    : ""
}
<tr><td style="padding:24px 28px 28px"><a href="${esc(r.auditUrl)}" style="display:inline-block;background:#40c98a;color:#0b2a1c;font:700 15px Arial,sans-serif;text-decoration:none;padding:13px 22px;border-radius:8px">See the full audit</a></td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;font:12px/1.5 Arial,sans-serif;color:#a3a3a3">You get this because weekly reports are on for ${esc(r.businessName)}. <a href="${esc(r.settingsUrl)}" style="color:#666666">Turn them off</a>.</p>
</td></tr></table></body></html>`;

  return { subject, html, text };
}
