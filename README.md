# [ProductName] — AI Ads Autopilot

Connects to a business's Google Ads account, finds wasted spend in a free
instant audit, then runs the account on autopilot with owner approval and
reports results in plain English.

**Principle:** the AI suggests; deterministic rules decide and enforce limits.
No AI output is applied to a live account without passing the guardrails.

## Status

| Phase | Scope | Status |
| --- | --- | --- |
| 0. Foundations | Next.js, Supabase auth + RLS, businesses / members / business_profiles, job runner logging to `job_runs`, Sentry, CI | ✅ built |
| 1. Google connection | OAuth, encrypted tokens, account picker, `adsClient`, nightly sync | — |
| 2. Audit engine | 15 checks, scoring, waste estimate, findings UI | — |
| 3. Actions & guardrails | actions table, guardrails, negatives + budget, inbox, undo | — |
| 4. AI layer | search-term classifier, RSA copy, explanations | — |
| 5. Reports & alerts | weekly email, alert checks | — |
| 6. Billing & launch | Stripe, feature gates, marketing site, legal | — |

## Stack

Next.js (App Router, TypeScript, Tailwind) on Vercel · Supabase (Postgres,
Auth, RLS) · Inngest for background jobs · Sentry · Vitest.

## Layout

```
src/app/                 routes (marketing, login, onboarding, dashboard, api/inngest)
src/lib/config.ts        PRODUCT_NAME and product-wide constants
src/lib/money.ts         the one micros <-> currency helper
src/lib/jobs/            withJobRun(): logs every job to job_runs
src/lib/supabase/        user (RLS) and service-role clients
src/inngest/client.ts    Inngest client + event names
src/jobs/                background job definitions
supabase/migrations/     SQL migrations (RLS on every table)
supabase/tests/          RLS tests run against plain Postgres
```

## Local development

1. `npm install`
2. Create a Supabase project (EU/UK region), then apply the migrations:
   `supabase link --project-ref <ref> && supabase db push`
   (or paste `supabase/migrations/*.sql` into the SQL editor).
3. In Supabase → Authentication → Providers, enable **Google** and
   **Email**. Add `http://localhost:3000/auth/callback` to the redirect URLs.
4. `cp .env.example .env.local` and fill in the Supabase keys.
5. Run the app and the Inngest dev server side by side:
   ```
   npm run dev
   npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
   ```
6. Sign up → create a business → **Run test job** on the dashboard. A
   `system.healthcheck` row appears in `job_runs` (Phase 0 "done when").

## Tests

- `npm test` — unit tests (Vitest)
- `npm run test:db` — applies migrations to a throwaway Postgres database and
  runs the RLS tests. Needs a superuser connection via `PGHOST` / `PGUSER` /
  `PGPASSWORD`.
- `npm run lint`, `npm run typecheck`, `npm run build`

CI runs all of the above on every push and pull request.
