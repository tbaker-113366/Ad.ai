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
| 1. Google connection | OAuth, encrypted tokens, account picker, `adsClient`, nightly sync | ✅ built (needs a test-account run) |
| 2. Audit engine | 15 checks, scoring, waste estimate, findings UI | ✅ built (needs a test-account run) |
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
src/lib/ads/             adsClient (all Google Ads API calls), GAQL, discovery, sync, quota
src/lib/google/          OAuth + stored connections (token decrypt happens only in jobs)
src/lib/crypto/          AES-256-GCM refresh-token encryption
src/lib/audit/            audit engine: load.ts (GAQL), checks/ (one file per check), index.ts (score + waste)
src/config/thresholds.ts every tunable number, in one owner-editable file
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
5. For Google Ads (Phase 1), also fill in:
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: a Google Cloud OAuth client
     (Web application) with redirect URI
     `http://localhost:3000/api/google/callback`. The Google Ads API must be
     enabled on that Cloud project.
   - `GOOGLE_ADS_DEVELOPER_TOKEN`: from your Google Ads manager account.
   - `TOKEN_ENCRYPTION_KEY`: `openssl rand -base64 32`. Losing it means every
     user must reconnect; changing it needs `TOKEN_ENCRYPTION_KEY_PREVIOUS`.
   - Develop against a Google Ads **test account** only.
6. Run the app and the Inngest dev server side by side:
   ```
   npm run dev
   npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
   ```
7. Sign up → create a business → **Run test job** on the dashboard. A
   `system.healthcheck` row appears in `job_runs` (Phase 0 "done when").
8. **Manage accounts → Connect Google Ads**, pick the test account, and the
   last 90 days sync into `daily_metrics` (Phase 1 "done when"). Revoking
   access at myaccount.google.com/permissions makes the next sync show the
   "Reconnect your Google Ads account" banner.

## Product focus

v1 is about **finding and cutting wasted ad spend**. Automation (autopilot
actions, budget pacing, ad testing) comes after. A public sample audit on
made-up data is at `/audit/sample`.

## How the audit works

1. Connecting an account queues `audit.run`. The user watches live progress
   at `/audits/<id>`.
2. `lib/audit/load.ts` runs ~17 GAQL queries in parallel over the last 30
   complete days (90 for low-volume accounts).
3. Each of the 17 checks in `lib/audit/checks/` is a pure function
   `run(data, profile) → findings`, tested with fixture data for both the
   trigger and no-trigger cases.
4. Score starts at 100 (critical −20, warning −5, opportunity −3). Monthly
   waste is the sum of flagged costs scaled to 30 days, counting each cost
   once (a search term flagged by three checks is counted once) and never
   more than was spent.
5. Findings show the evidence rows behind every number, plain-English fixes,
   and paste-ready negative keyword lists.

## Waste watch

- Every Monday 06:00 UK time, `audit.weekly` re-audits each active account.
- Each audit is compared with the previous one: problems fixed, new
  problems, waste stopped and new waste (per £ item, counted once).
- New waste of at least £50/month and 5% of spend raises an in-app alert
  (email delivery arrives with Phase 5).
- Check 16 reports Google's own invalid-click figures.

## Paid vs organic (check 17)

The Google consent screen also asks for read-only Search Console access. The
audit matches paid search terms against the queries the website ranks for
organically (via the business's website on its profile). A search is flagged
when it ranks in the top 3 for free, spends real money, and there's little
sign of competitors (the ad is first ≥80% of the time and outranked ≤10%).
The advice is a 2-week pause test, not a blanket stop, and no £ waste is
claimed. Auction Insights (competitor names) isn't in the public API, so
competition is inferred from impression share.

## How the Google connection works

1. `/api/google/connect` → Google consent (`adwords` scope, offline access,
   CSRF state cookie).
2. `/api/google/callback` exchanges the code, encrypts the refresh token
   (bound to the business id) and stores it in `google_connections`. Users
   can never read that column, even through the API.
3. `google.discover_accounts` job lists every account the login can reach,
   including clients of manager accounts, for the picker at `/accounts`.
4. Picking accounts creates `ad_accounts` rows and queues `ads.sync`, which
   pulls 90 days of campaign metrics. A nightly job (02:15 UK time) re-pulls
   the last 7 days for every active account.
5. Every job logs Google Ads API operations to `job_runs`; jobs stop at 90%
   of the daily limit. Revoked access marks the connection `revoked` and the
   app shows a reconnect banner.

## Tests

- `npm test` — unit tests (Vitest)
- `npm run test:db` — applies migrations to a throwaway Postgres database and
  runs the RLS tests. Needs a superuser connection via `PGHOST` / `PGUSER` /
  `PGPASSWORD`.
- `npm run lint`, `npm run typecheck`, `npm run build`

CI runs all of the above on every push and pull request.
