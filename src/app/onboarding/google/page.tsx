import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Eye, Info, Shield, X } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business/current";
import { OnboardingShell } from "@/components/onboarding/Shell";
import { Card, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const CAN = ["Searches that showed your ads", "Clicks, costs and calls", "Times, areas and devices", "Your campaign settings"];
const CANT = ["Change budgets or bids", "Pause, edit or create ads", "Spend any of your money", "See your payment details"];

export default async function GoogleStep({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, business } = await getCurrentBusiness();
  if (!user) redirect("/login?next=/onboarding/google");
  if (!business) redirect("/onboarding/business");
  const { error } = await searchParams;

  return (
    <OnboardingShell step={3} title="Connect Google Ads" intro="We only read your account. We can look, not touch." error={error} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="flex items-center gap-2 font-semibold"><span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-saved"><Eye className="size-4" aria-hidden /></span>What we can see</p>
          <ul className="mt-4 flex flex-col gap-2 text-sm">{CAN.map((c) => <li key={c} className="flex gap-2"><Check className="size-4 shrink-0 text-saved" aria-hidden />{c}</li>)}</ul>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-2 font-semibold"><span className="flex size-8 items-center justify-center rounded-lg bg-waste-bg text-waste"><Shield className="size-4" aria-hidden /></span>What we can&apos;t do</p>
          <ul className="mt-4 flex flex-col gap-2 text-sm">{CANT.map((c) => <li key={c} className="flex gap-2"><X className="size-4 shrink-0 text-muted-foreground" aria-hidden />{c}</li>)}</ul>
        </Card>
      </div>
      <a href="/api/google/connect?kind=ads&next=/onboarding/accounts" className={buttonClass("primary", "lg", "mt-5 w-full")}>Connect Google Ads</a>
      <p className="mt-3 text-center text-sm text-muted-foreground">Google will ask you to allow read access. You can remove it any time.</p>
      <div className="mt-6 flex gap-3 rounded-lg border border-info-border bg-info-bg p-4 text-sm text-ink">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <p><span className="font-semibold">Does an agency run your account?</span> Sign in with the Google account they gave you access with. If you don&apos;t have one, ask them to add your email to the account first.</p>
      </div>
      <Link href="/onboarding/questions" className="mt-6 inline-block font-semibold">Back</Link>
    </OnboardingShell>
  );
}
