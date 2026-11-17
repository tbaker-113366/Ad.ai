import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { OnboardingShell } from "@/components/onboarding/Shell";
import { buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SearchConsoleStep({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, business } = await getCurrentBusiness();
  if (!user) redirect("/login?next=/onboarding/search-console");
  if (!business) redirect("/onboarding/business");
  const { error } = await searchParams;

  return (
    <OnboardingShell step={4} eyebrow="Step 4 of 4 · Optional" title="Connect Search Console" error={error} wide
      intro="Are you paying for clicks you'd get for free? Search Console shows us where you already rank, so we can tell.">
      <div className="rounded-[var(--radius-card)] bg-ink p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">The kind of thing we find</p>
        <p className="mt-3 font-semibold">&ldquo;hartley plumbing henley&rdquo;</p>
        <p className="mt-1 text-sm text-white/70">You&apos;re the top free result, and paying for an ad above it. Worth testing a pause.</p>
      </div>
      <a href="/api/google/connect?kind=search_console&next=/onboarding/finish" className={buttonClass("primary", "lg", "mt-5 w-full")}>Connect Search Console</a>
      <p className="mt-3 text-center text-sm text-muted-foreground">Read only, like Google Ads. We see searches and rankings, nothing else.</p>
      <div className="mt-6 flex items-center justify-between">
        <Link href="/onboarding/accounts" className="font-semibold">Back</Link>
        <Link href="/onboarding/finish" className="text-sm font-semibold text-link underline underline-offset-4">Skip for now and start my audit</Link>
      </div>
    </OnboardingShell>
  );
}
