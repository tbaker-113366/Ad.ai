import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { ChoiceRow, OnboardingShell } from "@/components/onboarding/Shell";
import { Button } from "@/components/ui";
import { saveQuestionsStep } from "../actions";

export const dynamic = "force-dynamic";

export default async function QuestionsStep({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, business } = await getCurrentBusiness();
  if (!user) redirect("/login?next=/onboarding/questions");
  if (!business) redirect("/onboarding/business");
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: p } = await supabase.from("business_profiles").select("who_runs_ads, lead_types, spend_band").eq("business_id", business.id).single();
  const leads = new Set<string>(p?.lead_types ?? []);

  return (
    <OnboardingShell step={2} title="Three quick questions" intro="Just tap. These help us explain things the right way for you." error={error}>
      <form action={saveQuestionsStep} className="flex flex-col gap-8">
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-3 font-semibold">1. Who runs your Google Ads?</legend>
          <ChoiceRow type="radio" name="who_runs_ads" value="self" label="I do it myself" defaultChecked={p?.who_runs_ads === "self"} />
          <ChoiceRow type="radio" name="who_runs_ads" value="agency" label="An agency or freelancer" defaultChecked={p?.who_runs_ads === "agency"} />
          <ChoiceRow type="radio" name="who_runs_ads" value="both" label="A bit of both" defaultChecked={p?.who_runs_ads === "both"} />
        </fieldset>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="font-semibold">2. What counts as a lead for you?</legend>
          <p className="mb-3 text-sm text-muted-foreground">Pick all that apply.</p>
          <ChoiceRow type="checkbox" name="lead_types" value="calls" label="Phone calls" defaultChecked={leads.has("calls")} />
          <ChoiceRow type="checkbox" name="lead_types" value="forms" label="Contact forms or emails" defaultChecked={leads.has("forms")} />
          <ChoiceRow type="checkbox" name="lead_types" value="bookings" label="Online bookings" defaultChecked={leads.has("bookings")} />
          <ChoiceRow type="checkbox" name="lead_types" value="sales" label="Sales on my website" defaultChecked={leads.has("sales")} />
        </fieldset>
        <fieldset>
          <legend className="mb-3 font-semibold">3. Roughly how much do you spend on Google Ads a month?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ChoiceRow type="radio" name="spend_band" value="under_500" label="Under £500" defaultChecked={p?.spend_band === "under_500"} />
            <ChoiceRow type="radio" name="spend_band" value="500_1500" label="£500 – £1,500" defaultChecked={p?.spend_band === "500_1500"} />
            <ChoiceRow type="radio" name="spend_band" value="1500_5000" label="£1,500 – £5,000" defaultChecked={p?.spend_band === "1500_5000"} />
            <ChoiceRow type="radio" name="spend_band" value="over_5000" label="Over £5,000" defaultChecked={p?.spend_band === "over_5000"} />
          </div>
        </fieldset>
        <div className="flex items-center justify-between">
          <Link href="/onboarding/business" className="font-semibold text-ink">Back</Link>
          <Button size="lg">Continue</Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
