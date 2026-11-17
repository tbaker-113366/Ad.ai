import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { INDUSTRIES, TRAVEL_OPTIONS } from "@/lib/business/onboarding";
import { microsToUnits } from "@/lib/money";
import { OnboardingShell } from "@/components/onboarding/Shell";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { saveBusinessStep } from "../actions";

export const dynamic = "force-dynamic";

export default async function BusinessStep({ searchParams }: { searchParams: Promise<{ website?: string; error?: string }> }) {
  const { user, business } = await getCurrentBusiness();
  if (!user) redirect("/login?next=/onboarding/business");
  const { website, error } = await searchParams;

  let p: { base_location: string | null; travel_radius_miles: number | null; customer_value_micros: number | null } | null = null;
  if (business) {
    const supabase = await createClient();
    const { data } = await supabase.from("business_profiles").select("base_location, travel_radius_miles, customer_value_micros").eq("business_id", business.id).single();
    p = data;
  }
  const site = (business?.website ?? website ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <OnboardingShell step={1} title="About your business" intro="This tells us which clicks could become customers, and which never will." error={error}>
      <form action={saveBusinessStep}>
        <Card className="flex flex-col gap-5 p-6">
          <Field label="Business name" htmlFor="name">
            <input id="name" name="name" required maxLength={200} defaultValue={business?.name ?? ""} autoComplete="organization" className={inputClass} />
          </Field>
          <Field label="Website" htmlFor="website">
            <input id="website" name="website" required inputMode="url" defaultValue={site} placeholder="yourbusiness.co.uk" className={inputClass} />
          </Field>
          <Field label="What do you do?" htmlFor="industry">
            <select id="industry" name="industry" defaultValue={business?.industry ?? ""} className={inputClass}>
              <option value="">Choose one</option>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Where are you based?" hint="Postcode or town" htmlFor="base_location">
              <input id="base_location" name="base_location" maxLength={100} defaultValue={p?.base_location ?? ""} autoComplete="postal-code" className={inputClass} />
            </Field>
            <Field label="How far do you travel?" htmlFor="travel">
              <select id="travel" name="travel_radius_miles" defaultValue={p?.travel_radius_miles?.toString() ?? ""} className={inputClass}>
                <option value="">Choose one</option>
                {TRAVEL_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="What's a new customer worth to you, roughly?" hint="An average first job is fine. We use it to tell good clicks from wasted ones." htmlFor="customer_value">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
              <input id="customer_value" name="customer_value" inputMode="decimal" defaultValue={p?.customer_value_micros ? String(microsToUnits(p.customer_value_micros)) : ""} placeholder="280" className={`${inputClass} pl-8`} />
            </div>
          </Field>
        </Card>
        <div className="mt-6 flex justify-end">
          <Button size="lg">Continue</Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
