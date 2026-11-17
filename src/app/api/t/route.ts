import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, decodeHeader, parsePayload } from "@/lib/protection/ingest";
import { deviceFromUa, scoreClick, type ClickSignals } from "@/lib/protection/score";

/**
 * Public endpoint for the website snippet. Records paid ad clicks, scores
 * them, and updates them with time-on-page when the visitor leaves. Sent as
 * text/plain so browsers don't need a CORS preflight; reads no cookies.
 */
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  const body = (await request.text()).slice(0, 4000);
  const p = parsePayload(body);
  if (!p) return NextResponse.json({ ok: false }, { status: 400, headers: CORS });

  const admin = createAdminClient();
  const { data: site } = await admin
    .from("tracking_sites")
    .select("id, business_id, businesses!inner(country)")
    .eq("site_key", p.k)
    .maybeSingle();
  if (!site) return NextResponse.json({ ok: false }, { status: 404, headers: CORS });
  const businessCountry = ((site.businesses as unknown as { country: string } | null)?.country ?? "GB").toUpperCase();

  if (p.t === "update") {
    const { data: ev } = await admin
      .from("click_events")
      .select("id, user_agent, signals, country, timezone")
      .eq("id", p.id)
      .eq("site_id", site.id)
      .maybeSingle();
    if (!ev) return NextResponse.json({ ok: false }, { status: 404, headers: CORS });
    const sig = (ev.signals ?? {}) as ClickSignals & { sameIp?: number; sameDevice?: number };
    const scored = scoreClick({
      userAgent: ev.user_agent,
      signals: sig,
      ipCountry: ev.country,
      timezone: ev.timezone,
      businessCountry,
      sameIpClicks24h: sig.sameIp ?? 1,
      sameDeviceClicks24h: sig.sameDevice ?? 1,
      dwellMs: p.dwell,
      interacted: p.interacted,
    });
    await admin
      .from("click_events")
      .update({ dwell_ms: p.dwell, interacted: p.interacted, ...scored })
      .eq("id", ev.id);
    return NextResponse.json({ ok: true }, { headers: CORS });
  }

  const ip = clientIp(request.headers);
  const ua = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const country = request.headers.get("x-vercel-ip-country");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Paid clicks from the same IP / device in the last 24h (plus this one).
  const [ipCount, devCount] = await Promise.all([
    ip
      ? admin.from("click_events").select("id", { count: "exact", head: true }).eq("business_id", site.business_id).eq("ip", ip).gte("clicked_at", since)
      : Promise.resolve({ count: 0 }),
    p.dh
      ? admin.from("click_events").select("id", { count: "exact", head: true }).eq("business_id", site.business_id).eq("device_hash", p.dh).gte("clicked_at", since)
      : Promise.resolve({ count: 0 }),
  ]);
  const sameIp = (ipCount.count ?? 0) + 1;
  const sameDevice = (devCount.count ?? 0) + 1;

  const scored = scoreClick({
    userAgent: ua,
    signals: p.s,
    ipCountry: country,
    timezone: p.tz ?? null,
    businessCountry,
    sameIpClicks24h: sameIp,
    sameDeviceClicks24h: sameDevice,
  });

  const { data: row, error } = await admin
    .from("click_events")
    .insert({
      business_id: site.business_id,
      site_id: site.id,
      gclid: p.gclid ?? null,
      gbraid: p.gbraid ?? null,
      wbraid: p.wbraid ?? null,
      ip,
      country,
      region: decodeHeader(request.headers.get("x-vercel-ip-country-region")),
      city: decodeHeader(request.headers.get("x-vercel-ip-city")),
      user_agent: ua,
      device_hash: p.dh ?? null,
      device: deviceFromUa(ua),
      timezone: p.tz ?? null,
      page_path: p.path ?? null,
      signals: { ...p.s, sameIp, sameDevice },
      ...scored,
    })
    .select("id")
    .single();
  if (error || !row) return NextResponse.json({ ok: false }, { status: 500, headers: CORS });

  await admin.from("tracking_sites").update({ last_seen_at: new Date().toISOString() }).eq("id", site.id);
  return NextResponse.json({ ok: true, id: row.id }, { headers: CORS });
}
