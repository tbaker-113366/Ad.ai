import { inngest, EVENTS } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJobRun } from "@/lib/jobs/jobRun";
import { supabaseJobRunStore } from "@/lib/jobs/supabaseJobRunStore";
import { adsClientFactory, markConnectionRevoked } from "@/lib/google/connections";
import { assertQuotaAvailable } from "@/lib/ads/quota";
import { QuotaExceededError, ReconnectRequiredError } from "@/lib/ads/errors";
import { loadAuditData } from "@/lib/audit/load";
import { runAudit } from "@/lib/audit";
import type { AuditProfile, WasteItem } from "@/lib/audit/types";
import { compareAudits, shouldAlertNewWaste, type AuditSnapshot } from "@/lib/audit/compare";
import { formatMoney } from "@/lib/money";
import { accessTokenProvider } from "@/lib/google/connections";
import { listSites, pickSite, queryOrganic, SEARCH_CONSOLE_SCOPE } from "@/lib/google/searchConsole";
import type { AuditData } from "@/lib/audit/types";

import { AUDIT_STEPS } from "./auditSteps";
import { targetCpaFromProfile } from "@/lib/audit/target";
import { checkedCounts, scoreIfFixed, whatsWorking } from "@/lib/audit/presentation";

/** Runs the 15-check audit for one ad account and stores the findings. */
export const runAuditJob = inngest.createFunction(
  {
    id: "audit-run",
    retries: 1,
    triggers: [{ event: EVENTS.auditRequested }],
    concurrency: [{ key: "event.data.auditId", limit: 1 }, { limit: 10 }],
  },
  async ({ event, step }) => {
    const { auditId } = event.data as { auditId: string };

    return step.run("audit", async () => {
      const admin = createAdminClient();
      const setStep = (i: number) => admin.from("audits").update({ progress_step: AUDIT_STEPS[i] }).eq("id", auditId);

      const { data: row, error } = await admin
        .from("audits")
        .select(
          "id, status, business_id, ad_account_id, " +
            "ad_accounts!inner(id, customer_id, login_customer_id, currency, time_zone, status, " +
            "google_connections!inner(id, business_id, refresh_token_encrypted, status, scopes)), " +
            "businesses!inner(website)",
        )
        .eq("id", auditId)
        .single();
      if (error || !row) throw new Error(`Audit ${auditId} not found`);
      const audit = row as unknown as {
        id: string;
        status: string;
        business_id: string;
        ad_account_id: string;
        ad_accounts: {
          customer_id: string;
          login_customer_id: string | null;
          currency: string;
          time_zone: string;
          status: string;
          google_connections: {
            id: string;
            business_id: string;
            refresh_token_encrypted: string;
            status: string;
            scopes: string[] | null;
          };
        };
        businesses: { website: string | null };
      };
      if (audit.status === "succeeded") return { skipped: "already done" };
      const account = audit.ad_accounts;
      const conn = account.google_connections;

      const fail = async (message: string) =>
        admin
          .from("audits")
          .update({ status: "failed", error: message, finished_at: new Date().toISOString(), progress_step: null })
          .eq("id", auditId);

      if (conn.status !== "active") {
        await fail("We've lost access to this Google Ads account. Please reconnect it and try again.");
        return { failed: "connection inactive" };
      }

      await admin
        .from("audits")
        .update({ status: "running", started_at: new Date().toISOString(), progress_step: AUDIT_STEPS[0], error: null })
        .eq("id", auditId);

      return withJobRun(
        supabaseJobRunStore(admin),
        { jobName: "audit.run", businessId: audit.business_id, adAccountId: audit.ad_account_id },
        async (ctx) => {
          try {
            await assertQuotaAvailable(admin, 20);
            const { data: p } = await admin
              .from("business_profiles")
              .select("target_cpa_micros, monthly_budget_micros, irrelevant_terms, brand_terms, customer_value_micros")
              .eq("business_id", audit.business_id)
              .single();
            const profile: AuditProfile = {
              targetCpaMicros: targetCpaFromProfile(p),
              monthlyBudgetMicros: p?.monthly_budget_micros ? Number(p.monthly_budget_micros) : null,
              irrelevantTerms: p?.irrelevant_terms ?? [],
              brandTerms: p?.brand_terms ?? [],
            };

            await setStep(1);
            const getToken = accessTokenProvider(conn);
            const client = adsClientFactory(conn, (n) => ctx.addApiOperations(n), getToken)(account.login_customer_id);
            // Search Console may have been granted by this login or another one in the business.
            let scToken: (() => Promise<string>) | null = (conn.scopes ?? []).includes(SEARCH_CONSOLE_SCOPE) ? getToken : null;
            if (!scToken) {
              const { data: other } = await admin
                .from("google_connections")
                .select("id, business_id, refresh_token_encrypted")
                .eq("business_id", audit.business_id)
                .eq("status", "active")
                .contains("scopes", [SEARCH_CONSOLE_SCOPE])
                .limit(1)
                .maybeSingle();
              if (other) scToken = accessTokenProvider(other);
            }
            const fetchOrganic = scToken
              ? async (from: string, to: string): Promise<AuditData["organic"]> => {
                  const token = await scToken!();
                  const site = pickSite(await listSites(token), audit.businesses.website);
                  if (!site) return { status: "no_site", siteUrl: null, queries: [] };
                  return { status: "ok", siteUrl: site.siteUrl, queries: await queryOrganic(token, site.siteUrl, from, to) };
                }
              : undefined;
            const data = await loadAuditData({
              client,
              customerId: account.customer_id,
              currency: account.currency,
              timeZone: account.time_zone,
              fetchOrganic,
            });

            await setStep(2);
            const result = runAudit(data, profile);

            await setStep(3);
            if (result.findings.length > 0) {
              const { error: insertError } = await admin.from("audit_findings").upsert(
                result.findings.map((f) => ({
                  business_id: audit.business_id,
                  audit_id: auditId,
                  check_key: f.checkKey,
                  severity: f.severity,
                  rank: f.rank,
                  title: f.title,
                  explanation: f.explanation,
                  fix: f.fix,
                  est_monthly_waste_micros: f.estMonthlyWasteMicros,
                  evidence: f.evidence,
                  recommended_actions: f.recommendedActions,
                  blocks_autopilot: Boolean(f.blocksAutopilot),
                  waste_items: f.wasteItems,
                })),
                { onConflict: "audit_id,check_key" },
              );
              if (insertError) throw new Error(`Saving findings failed: ${insertError.message}`);
            }

            await admin
              .from("audits")
              .update({
                status: "succeeded",
                finished_at: new Date().toISOString(),
                progress_step: null,
                score: result.score,
                est_monthly_waste_micros: result.estMonthlyWasteMicros,
                currency: data.currency,
                window_from: data.from,
                window_to: data.to,
                window_days: data.windowDays,
                total_spend_micros: data.totals.costMicros,
                blocks_autopilot: result.blocksAutopilot,
                skipped_checks: result.skippedChecks,
                organic_status: data.organic.status,
                searches_checked: checkedCounts(data).searches,
                campaigns_checked: checkedCounts(data).campaigns,
                score_if_fixed: scoreIfFixed(result.score, result.findings),
                whats_working: whatsWorking(data, profile),
                organic_site: data.organic.siteUrl,
              })
              .eq("id", auditId);

            // Waste watch: compare with the previous completed audit of this account.
            const { data: prev } = await admin
              .from("audits")
              .select("id, window_days, total_spend_micros, audit_findings(check_key, title, waste_items)")
              .eq("ad_account_id", audit.ad_account_id)
              .eq("status", "succeeded")
              .neq("id", auditId)
              .order("finished_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (prev) {
              const prevSnap: AuditSnapshot = {
                windowDays: prev.window_days,
                totalSpendMicros: Number(prev.total_spend_micros ?? 0),
                findings: (prev.audit_findings ?? []).map(
                  (f: { check_key: string; title: string; waste_items: WasteItem[] }) => ({
                    checkKey: f.check_key,
                    title: f.title,
                    wasteItems: f.waste_items ?? [],
                  }),
                ),
              };
              const currSnap: AuditSnapshot = {
                windowDays: data.windowDays,
                totalSpendMicros: data.totals.costMicros,
                findings: result.findings.map((f) => ({ checkKey: f.checkKey, title: f.title, wasteItems: f.wasteItems })),
              };
              const cmp = compareAudits(prevSnap, currSnap);
              await admin
                .from("audits")
                .update({
                  previous_audit_id: prev.id,
                  resolved_count: cmp.resolvedChecks.length,
                  new_count: cmp.newChecks.length,
                  stopped_waste_micros: cmp.stoppedWasteMicros,
                  new_waste_micros: cmp.newWasteMicros,
                })
                .eq("id", auditId);

              if (shouldAlertNewWaste(cmp, currSnap)) {
                await admin.from("alerts").insert({
                  business_id: audit.business_id,
                  ad_account_id: audit.ad_account_id,
                  audit_id: auditId,
                  type: "new_waste",
                  severity: "warning",
                  message: `New wasted spend found: about ${formatMoney(cmp.newWasteMicros, data.currency)} a month${
                    cmp.newChecks.length ? ` (${cmp.newChecks.map((c) => c.title.toLowerCase()).join("; ")})` : ""
                  }.`,
                  link: `/audits/${auditId}`,
                });
              }
              ctx.setMetadata("comparison", cmp);
            }

            ctx.setMetadata("score", result.score);
            ctx.setMetadata("findings", result.findings.length);
            ctx.setMetadata("skippedChecks", result.skippedChecks);
            return { score: result.score, findings: result.findings.length };
          } catch (err) {
            if (err instanceof ReconnectRequiredError) {
              await markConnectionRevoked(admin, conn.id, err.message);
              await fail("We've lost access to this Google Ads account. Please reconnect it and try again.");
            } else if (err instanceof QuotaExceededError) {
              await fail("We're very busy right now. Please try again in a few hours.");
            } else {
              await fail("Something went wrong while checking your account. Please try again.");
            }
            throw err;
          }
        },
      ).catch((err) => {
        if (err instanceof ReconnectRequiredError || err instanceof QuotaExceededError) return { failed: err.name };
        throw err;
      });
    });
  },
);
