import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import type { DiscoveredAccount } from "@/lib/ads/discovery";
import { formatCustomerId } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { OnboardingShell } from "@/components/onboarding/Shell";
import { Badge, Button, Card, Notice, buttonClass } from "@/components/ui";
import { connectAccounts, rediscover } from "@/app/accounts/actions";

export const dynamic = "force-dynamic";
// Inline background work (when the job queue is unavailable) may need this long.
export const maxDuration = 300;

export default async function AccountsStep({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, business } = await getCurrentBusiness();
  if (!user) redirect("/login?next=/onboarding/accounts");
  if (!business) redirect("/onboarding/business");
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: conns } = await supabase
    .from("google_connections")
    .select("id, google_user_email, status, discovery_status, discovered_accounts, scopes, updated_at")
    .eq("status", "active")
    .contains("scopes", ["https://www.googleapis.com/auth/adwords"])
    .order("updated_at", { ascending: false })
    .limit(1);
  const conn = conns?.[0] as
    | { id: string; google_user_email: string; discovery_status: string; discovered_accounts: DiscoveredAccount[]; updated_at: string }
    | undefined;
  if (!conn) redirect("/onboarding/google");

  const accounts = conn.discovered_accounts ?? [];
  // Finding accounts takes seconds; after 90s assume it stalled and offer a retry.
  const stalled = conn.discovery_status === "pending" && Date.now() - Date.parse(conn.updated_at) > 90_000;
  if (stalled) conn.discovery_status = "failed";
  const pending = conn.discovery_status === "pending";

  return (
    <OnboardingShell step={3} title={pending ? "Finding your accounts…" : "Which accounts should we check?"} error={error} wide
      intro={pending ? "This takes a few seconds." : "Your free audit can cover all of them. You can change this later."}>
      {pending && <AutoRefresh seconds={2} />}
      {!pending && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-saved-border bg-saved-bg px-4 py-3 text-sm text-saved">
          <CheckCircle2 className="size-4" aria-hidden />
          <p><span className="font-semibold">Google Ads connected, read only.</span> We found {accounts.length} account{accounts.length === 1 ? "" : "s"} you can see.</p>
        </div>
      )}

      {conn.discovery_status === "failed" && (
        <form action={rediscover} className="flex flex-col gap-3">
          <Notice tone="error">We couldn&apos;t list your accounts this time.</Notice>
          <input type="hidden" name="connectionId" value={conn.id} />
          <Button variant="outline">Try again</Button>
        </form>
      )}

      {!pending && conn.discovery_status === "ready" && accounts.length === 0 && (
        <Notice tone="warning">
          {conn.google_user_email} doesn&apos;t have access to any Google Ads accounts.{" "}
          <a href="/api/google/connect?kind=ads&next=/onboarding/accounts" className="font-semibold underline">Try a different Google login</a>.
        </Notice>
      )}

      {conn.discovery_status === "ready" && accounts.length > 0 && (
        <form action={connectAccounts}>
          <input type="hidden" name="connectionId" value={conn.id} />
          <input type="hidden" name="onboarding" value="1" />
          <Card className="divide-y divide-border px-5">
            {accounts.map((a) => {
              const active = (a.spend30Micros ?? 0) > 0;
              return (
                <label key={a.customerId} className="flex cursor-pointer items-start gap-3 py-4">
                  <input type="checkbox" name="customerId" value={a.customerId} defaultChecked={active} className="mt-1 size-4 accent-[var(--saved)]" />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{a.descriptiveName ?? "Unnamed account"}</span>
                      {a.isTestAccount ? <Badge tone="info">Test</Badge> : active ? <Badge tone="saved">Active</Badge> : <Badge>No recent spend</Badge>}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {formatCustomerId(a.customerId)}
                      {a.spend30Micros !== undefined && a.spend30Micros !== null && ` · ${formatMoney(a.spend30Micros, a.currency).replace(/\.00$/, "")} in the last 30 days`}
                      {a.viaManagerName && ` · via ${a.viaManagerName}`}
                    </span>
                  </span>
                </label>
              );
            })}
          </Card>
          <div className="mt-6 flex items-center justify-between">
            <Link href="/onboarding/google" className="font-semibold">Back</Link>
            <Button size="lg">Continue</Button>
          </div>
        </form>
      )}
      {pending && <p className="text-sm text-muted-foreground">Signed in as {conn.google_user_email}.</p>}
      {!pending && accounts.length === 0 && conn.discovery_status !== "failed" && (
        <Link href="/onboarding/google" className={buttonClass("ghost", "md", "mt-6")}>Back</Link>
      )}
    </OnboardingShell>
  );
}
