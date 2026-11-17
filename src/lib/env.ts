import { z } from "zod";

/** Public env (safe in the browser). */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

/** Server-only env. Never import from client components. */
const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function publicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export function serverEnv() {
  return serverSchema.parse(process.env);
}

/** Google OAuth + Google Ads settings. Server-only. */
const googleSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().min(1),
  GOOGLE_ADS_API_VERSION: z.string().regex(/^v\d+$/).optional(),
  GOOGLE_ADS_DAILY_OPERATION_LIMIT: z.coerce.number().int().positive().optional(),
  /** 32 random bytes, base64. Generate: openssl rand -base64 32 */
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  /** Previous key during rotation, so old tokens still decrypt. */
  TOKEN_ENCRYPTION_KEY_PREVIOUS: z.string().min(1).optional(),
});

export function googleEnv() {
  return googleSchema.parse(process.env);
}
