import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import type { DiscoveredAccount } from "@/lib/ads/discovery";
import { formatCustomerId, formatDateTime } from "@/lib/format";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import { AppHeader } from "@/components/app/AppHeader";
import { connectAccounts, disconnectGoogle, rediscover, removeAccount } from "./actions";

export const dynamic = "force-dynamic";
// Inline background work (when the job queue is unavailable) may need this long.
export const maxDuration = 300;

type Connection = {
  id: string;
  google_user_email: string;
  status: "active" | "revoked" | "disconnected" | "error";
  discovery_status: "pending" | "ready" | "failed";
  discovered_accounts: DiscoveredAccount[];
};

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, business, role } = await getCurrentBusiness();
  if (!user) redirect("/login?next=/accounts");
  if (!business) redirect("/onboarding/business");
  const canEdit = role === "owner" || role === "admin";
  const { error } = await searchParams;

  const supabase = await createClient();
  const [{ data: connections }, { data: accounts }] = await Promise.all([
    supabase
      .from("google_connections")
      .select("id, google_user_email, status, discovery_status, discovered_accounts")
      .neq("status", "disconnected")
      .order("created_at"),
    supabase
      .from("ad_accounts")
      .select("id, customer_id, descriptive_name, currency, status, last_synced_at, is_test_account, google_connection_id")
      .eq("status", "active")
      .order("descriptive_name"),
  ]);

  const conns = (connections ?? []) as Connection[];
  const connected = new Set((accounts ?? []).map((a) => a.customer_id));
  const discovering = conns.some((c) => c.status === "active" && c.discovery_status === "pending");

  return (
    <>
    <AppHeader businessName={business.name} />
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      {discovering && <AutoRefresh seconds={3} />}
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-[32px] font-extrabold tracking-[-0.03em]">Google Ads accounts</h1>
          {(accounts ?? []).length === 0 && <p className="text-sm text-muted-foreground">Step 3 of 3: connect to get your free audit</p>}
        </div>
        {canEdit && (
          <a
            href="/api/google/connect?kind=ads&next=/accounts"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Connect Google Ads
          </a>
        )}
      </header>

      {error && <p className="rounded-md border border-destructive-border bg-destructive-bg p-3 text-sm text-destructive">{error}</p>}
      <ReconnectBanner emails={conns.filter((c) => c.status === "revoked").map((c) => c.google_user_email)} />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Connected accounts</h2>
        {(accounts ?? []).length === 0 && <p className="text-sm text-muted-foreground">No accounts connected yet.</p>}
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(accounts ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">
                  {a.descriptive_name ?? "Unnamed account"}
                  {a.is_test_account && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">test</span>}
                </p>
                <p className="text-muted-foreground">
                  {formatCustomerId(a.customer_id)} · {a.currency} · last synced {formatDateTime(a.last_synced_at)}
                </p>
              </div>
              {canEdit && (
                <form action={removeAccount}>
                  <input type="hidden" name="adAccountId" value={a.id} />
                  <button className="text-muted-foreground underline">Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      {conns.map((c) => {
        const available = c.discovered_accounts.filter((a) => !connected.has(a.customerId));
        return (
          <section key={c.id} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">{c.google_user_email}</h2>
              {canEdit && (
                <form action={disconnectGoogle}>
                  <input type="hidden" name="connectionId" value={c.id} />
                  <button className="text-sm text-muted-foreground underline">Disconnect Google</button>
                </form>
              )}
            </div>

            {c.status === "active" && c.discovery_status === "pending" && (
              <p className="text-sm text-muted-foreground">Finding the Google Ads accounts you can access…</p>
            )}

            {c.status === "active" && c.discovery_status === "failed" && (
              <div className="text-sm text-muted-foreground">
                <p>We couldn&apos;t list your accounts this time.</p>
                {canEdit && (
                  <form action={rediscover} className="mt-2">
                    <input type="hidden" name="connectionId" value={c.id} />
                    <button className="underline">Try again</button>
                  </form>
                )}
              </div>
            )}

            {c.status === "active" && c.discovery_status === "ready" && available.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {c.discovered_accounts.length === 0
                  ? "This Google login doesn't have access to any Google Ads accounts."
                  : "All accounts from this login are connected."}
              </p>
            )}

            {c.status === "active" && c.discovery_status === "ready" && available.length > 0 && canEdit && (
              <form action={connectAccounts} className="flex flex-col gap-3">
                <input type="hidden" name="connectionId" value={c.id} />
                <p className="text-sm text-muted-foreground">Choose the accounts to connect:</p>
                {available.map((a) => (
                  <label key={a.customerId} className="flex items-start gap-3 text-sm">
                    <input type="checkbox" name="customerId" value={a.customerId} className="mt-1" />
                    <span>
                      <span className="font-medium">{a.descriptiveName ?? "Unnamed account"}</span>
                      {a.isTestAccount && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">test</span>}
                      <span className="block text-muted-foreground">
                        {formatCustomerId(a.customerId)} · {a.currency}
                        {a.viaManagerName && ` · via ${a.viaManagerName}`}
                      </span>
                    </span>
                  </label>
                ))}
                <div>
                  <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
                    Connect selected accounts
                  </button>
                </div>
              </form>
            )}
          </section>
        );
      })}
    </main>
    </>
  );
}
