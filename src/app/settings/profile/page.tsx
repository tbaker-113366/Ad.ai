import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { microsToUnits } from "@/lib/money";
import { saveProfile } from "./actions";

export const dynamic = "force-dynamic";

const input = "rounded-md border border-slate-300 px-3 py-2";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string; error?: string; saved?: string }>;
}) {
  const { user, business, role } = await getCurrentBusiness();
  if (!user) redirect("/login?next=/settings/profile");
  if (!business) redirect("/onboarding");
  const { onboarding, error, saved } = await searchParams;
  const canEdit = role === "owner" || role === "admin";

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("business_profiles")
    .select("offering, locations_served, target_cpa_micros, monthly_budget_micros, brand_terms, irrelevant_terms")
    .eq("business_id", business.id)
    .single();
  const money = (v: number | null | undefined) => (v ? String(microsToUnits(v)) : "");
  const brand = p?.brand_terms?.length ? p.brand_terms.join(", ") : business.name.toLowerCase();

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-12">
      {!onboarding && (
        <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← Dashboard
        </Link>
      )}
      <div>
        {onboarding && <p className="text-sm font-medium text-slate-500">Step 2 of 3</p>}
        <h1 className="text-2xl font-semibold">{onboarding ? "Three quick questions" : "Business profile"}</h1>
        <p className="mt-1 text-slate-600">
          This helps us judge what counts as wasted spend for you. You can skip it and change it later.
        </p>
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">Saved.</p>}

      <form action={saveProfile} className="flex flex-col gap-5">
        {onboarding && <input type="hidden" name="onboarding" value="1" />}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">1. What do you sell?</span>
          <textarea name="offering" rows={2} defaultValue={p?.offering ?? ""} placeholder="e.g. Emergency plumbing and boiler repairs" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">2. Where are your customers?</span>
          <input name="locations_served" defaultValue={(p?.locations_served ?? []).join(", ")} placeholder="e.g. Leeds, Bradford, Wakefield" className={input} />
        </label>
        <fieldset className="flex flex-col gap-3 text-sm">
          <legend className="font-medium">3. What&apos;s a good result for you? ({business.currency})</legend>
          <label className="flex flex-col gap-1">
            Most you&apos;d happily pay for one lead or sale
            <input name="target_cpa" inputMode="decimal" defaultValue={money(p?.target_cpa_micros)} placeholder="e.g. 35" className={input} />
          </label>
          <label className="flex flex-col gap-1">
            or your monthly ad budget
            <input name="monthly_budget" inputMode="decimal" defaultValue={money(p?.monthly_budget_micros)} placeholder="e.g. 1500" className={input} />
          </label>
        </fieldset>

        <details className="text-sm" open={!onboarding}>
          <summary className="cursor-pointer text-slate-600 underline">More (optional)</summary>
          <div className="mt-3 flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              Your business and brand names (we never block these)
              <input name="brand_terms" defaultValue={brand} className={input} />
            </label>
            <label className="flex flex-col gap-1">
              Words that mean a search isn&apos;t for you
              <input name="irrelevant_terms" defaultValue={(p?.irrelevant_terms ?? []).join(", ")} placeholder="e.g. commercial, wholesale" className={input} />
            </label>
          </div>
        </details>

        {canEdit ? (
          <div className="flex items-center gap-4">
            <button className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
              {onboarding ? "Continue" : "Save"}
            </button>
            {onboarding && (
              <Link href="/accounts" className="text-sm text-slate-600 underline">
                Skip for now
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Only owners and admins can change this.</p>
        )}
      </form>
    </main>
  );
}
