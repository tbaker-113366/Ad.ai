import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { microsToUnits } from "@/lib/money";
import { INDUSTRIES, TRAVEL_OPTIONS } from "@/lib/business/onboarding";
import { AppHeader } from "@/components/app/AppHeader";
import { ChoiceRow } from "@/components/onboarding/Shell";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import { THRESHOLDS } from "@/config/thresholds";
import { saveProfile } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { user, business, role } = await getCurrentBusiness();
  if (!user) redirect("/login?next=/settings/profile");
  if (!business) redirect("/onboarding/business");
  const { error, saved } = await searchParams;
  const canEdit = role === "owner" || role === "admin";

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("business_profiles")
    .select("base_location, travel_radius_miles, customer_value_micros, who_runs_ads, lead_types, spend_band, target_cpa_micros, brand_terms, irrelevant_terms, weekly_email")
    .eq("business_id", business.id)
    .single();
  const money = (v: number | null | undefined) => (v ? String(microsToUnits(v)) : "");
  const leads = new Set<string>(p?.lead_types ?? []);
  const derived = p?.customer_value_micros ? Math.round(microsToUnits(p.customer_value_micros) * THRESHOLDS.audit.targetShareOfCustomerValue) : null;

  return (
    <>
      <AppHeader businessName={business.name} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Settings</p>
        <h1 className="mt-1 text-[32px] font-extrabold tracking-[-0.03em]">Your business</h1>
        <p className="mt-1 text-muted-foreground">These answers decide what counts as wasted spend for you.</p>
        <div className="mt-5 flex flex-col gap-3">
          {error && <Notice tone="error">{error}</Notice>}
          {saved && <Notice tone="saved">Saved. Your next audit will use these answers.</Notice>}
        </div>

        <form action={saveProfile} className="mt-6 flex flex-col gap-6">
          <fieldset disabled={!canEdit} className="contents">
            <Card className="flex flex-col gap-5 p-6">
              <h2 className="text-lg font-bold">About your business</h2>
              <Field label="Business name" htmlFor="name"><input id="name" name="name" required defaultValue={business.name} className={inputClass} /></Field>
              <Field label="Website" htmlFor="website"><input id="website" name="website" required defaultValue={(business.website ?? "").replace(/^https?:\/\//, "")} className={inputClass} /></Field>
              <Field label="What do you do?" htmlFor="industry">
                <select id="industry" name="industry" defaultValue={business.industry ?? ""} className={inputClass}>
                  <option value="">Choose one</option>
                  {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                </select>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Where are you based?" hint="Postcode or town" htmlFor="base_location"><input id="base_location" name="base_location" defaultValue={p?.base_location ?? ""} className={inputClass} /></Field>
                <Field label="How far do you travel?" htmlFor="travel">
                  <select id="travel" name="travel_radius_miles" defaultValue={p?.travel_radius_miles?.toString() ?? ""} className={inputClass}>
                    <option value="">Choose one</option>
                    {TRAVEL_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="What's a new customer worth to you, roughly? (£)" htmlFor="customer_value"><input id="customer_value" name="customer_value" inputMode="decimal" defaultValue={money(p?.customer_value_micros)} className={inputClass} /></Field>
            </Card>

            <Card className="flex flex-col gap-6 p-6">
              <h2 className="text-lg font-bold">Your ads</h2>
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2 text-sm font-semibold">Who runs your Google Ads?</legend>
                <ChoiceRow type="radio" name="who_runs_ads" value="self" label="I do it myself" defaultChecked={p?.who_runs_ads === "self"} />
                <ChoiceRow type="radio" name="who_runs_ads" value="agency" label="An agency or freelancer" defaultChecked={p?.who_runs_ads === "agency"} />
                <ChoiceRow type="radio" name="who_runs_ads" value="both" label="A bit of both" defaultChecked={p?.who_runs_ads === "both"} />
              </fieldset>
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2 text-sm font-semibold">What counts as a lead?</legend>
                <ChoiceRow type="checkbox" name="lead_types" value="calls" label="Phone calls" defaultChecked={leads.has("calls")} />
                <ChoiceRow type="checkbox" name="lead_types" value="forms" label="Contact forms or emails" defaultChecked={leads.has("forms")} />
                <ChoiceRow type="checkbox" name="lead_types" value="bookings" label="Online bookings" defaultChecked={leads.has("bookings")} />
                <ChoiceRow type="checkbox" name="lead_types" value="sales" label="Sales on my website" defaultChecked={leads.has("sales")} />
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Monthly Google Ads spend</legend>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <ChoiceRow type="radio" name="spend_band" value="under_500" label="Under £500" defaultChecked={p?.spend_band === "under_500"} />
                  <ChoiceRow type="radio" name="spend_band" value="500_1500" label="£500 – £1,500" defaultChecked={p?.spend_band === "500_1500"} />
                  <ChoiceRow type="radio" name="spend_band" value="1500_5000" label="£1,500 – £5,000" defaultChecked={p?.spend_band === "1500_5000"} />
                  <ChoiceRow type="radio" name="spend_band" value="over_5000" label="Over £5,000" defaultChecked={p?.spend_band === "over_5000"} />
                </div>
              </fieldset>
            </Card>

            <Card className="flex flex-col gap-3 p-6">
              <h2 className="text-lg font-bold">Emails</h2>
              <label className="flex items-start gap-3 text-[15px]">
                <input type="checkbox" name="weekly_email" defaultChecked={p?.weekly_email ?? true} className="mt-1 size-4 accent-[var(--saved)]" />
                <span>Send owners and admins a weekly email every Monday with the score, what changed and the things to improve.</span>
              </label>
            </Card>

            <Card className="flex flex-col gap-5 p-6">
              <div>
                <h2 className="text-lg font-bold">Fine-tuning (optional)</h2>
                <p className="mt-1 text-sm text-muted-foreground">Leave these blank and we&apos;ll work them out for you.</p>
              </div>
              <Field label="Most you'd pay for one lead (£)" hint={derived ? `Blank = £${derived}, a third of what a customer is worth.` : "Blank = worked out from what a customer is worth."} htmlFor="target_cpa">
                <input id="target_cpa" name="target_cpa" inputMode="decimal" defaultValue={money(p?.target_cpa_micros)} className={inputClass} />
              </Field>
              <Field label="Your business and brand names" hint="We never treat searches for these as waste. Separate with commas." htmlFor="brand_terms">
                <input id="brand_terms" name="brand_terms" defaultValue={(p?.brand_terms ?? []).join(", ")} className={inputClass} />
              </Field>
              <Field label="Words that mean a search isn't for you" hint="e.g. commercial, wholesale" htmlFor="irrelevant_terms">
                <input id="irrelevant_terms" name="irrelevant_terms" defaultValue={(p?.irrelevant_terms ?? []).join(", ")} className={inputClass} />
              </Field>
            </Card>
          </fieldset>
          {canEdit ? <div><Button size="lg">Save changes</Button></div> : <p className="text-sm text-muted-foreground">Only owners and admins can change this.</p>}
        </form>
      </main>
    </>
  );
}
