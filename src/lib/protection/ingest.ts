import { z } from "zod";

/** What the snippet sends. Kept small and strictly validated (it's public). */
const id = z.string().trim().min(1).max(200);
const signals = z
  .object({
    wd: z.boolean().optional(),
    sw: z.number().int().min(0).max(20000).optional(),
    sh: z.number().int().min(0).max(20000).optional(),
    dpr: z.number().min(0).max(10).optional(),
    lang: z.array(z.string().max(20)).max(5).optional(),
    cores: z.number().int().min(0).max(1024).optional(),
    mem: z.number().min(0).max(1024).optional(),
    touch: z.number().int().min(0).max(100).optional(),
    pl: z.number().int().min(0).max(1000).optional(),
  })
  .strip()
  .default({});

export const clickPayload = z
  .object({
    t: z.literal("click"),
    k: z.string().regex(/^[a-f0-9]{24}$/),
    gclid: id.optional().nullable(),
    gbraid: id.optional().nullable(),
    wbraid: id.optional().nullable(),
    path: z.string().max(500).optional().nullable(),
    tz: z.string().max(64).optional().nullable(),
    dh: z.string().regex(/^[a-f0-9]{1,16}$/).optional().nullable(),
    s: signals,
  })
  .refine((p) => p.gclid || p.gbraid || p.wbraid, { message: "not a paid click" });

export const updatePayload = z.object({
  t: z.literal("update"),
  k: z.string().regex(/^[a-f0-9]{24}$/),
  id: z.uuid(),
  dwell: z.number().int().min(0).max(24 * 3600 * 1000),
  interacted: z.boolean(),
});

export function parsePayload(body: string) {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const t = (json as { t?: string } | null)?.t;
  const r = t === "update" ? updatePayload.safeParse(json) : clickPayload.safeParse(json);
  return r.success ? r.data : null;
}

/** First address in x-forwarded-for (the visitor), as set by Vercel. */
export function clientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = xff || headers.get("x-real-ip") || null;
  return ip && /^[0-9a-f:.]{3,45}$/i.test(ip) ? ip : null;
}

export const decodeHeader = (v: string | null) => {
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, 100);
  } catch {
    return v.slice(0, 100);
  }
};
