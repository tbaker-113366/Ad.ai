import Link from "next/link";
import { Globe } from "lucide-react";
import { Logo } from "@/components/brand";
import { PRODUCT_NAME } from "@/lib/config";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { signInWithEmail, signInWithGoogle } from "./actions";

export const dynamic = "force-dynamic";

const NEXT_STEPS = [
  ["Tell us about your business", "Where you work and what a customer is worth."],
  ["Answer three quick questions", "Tap to answer. No typing."],
  ["Connect Google Ads", "Read-only. We can look, not touch."],
  ["Connect Search Console", "So we can spot ads on searches you already win for free."],
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; sent?: string; website?: string }>;
}) {
  const { next = "/start", error, sent, website } = await searchParams;
  const site = website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_440px]">
      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Logo height={26} />
          <p className="text-sm text-muted-foreground">Have an account? <Link href="/login?next=/dashboard" className="font-semibold text-link underline underline-offset-4">Sign in</Link></p>
        </header>
        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-4 py-12">
          <h1 className="text-[32px] font-extrabold tracking-[-0.03em]">{site ? "Get your free audit" : `Sign in to ${PRODUCT_NAME}`}</h1>
          <p className="mt-2 text-muted-foreground">{site ? "Create an account so we can save your results. No card needed." : "Welcome back."}</p>

          {site && (
            <div className="mt-6 flex items-center justify-between gap-3 rounded-lg bg-muted px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2"><Globe className="size-4 text-muted-foreground" aria-hidden />Auditing <span className="font-semibold">{site}</span></span>
              <Link href="/" className="text-link underline underline-offset-4">Change</Link>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-5">
            {error && <Notice tone="error">{error}</Notice>}
            {sent && <Notice tone="saved">Check your email for a sign-in link.</Notice>}
            <form action={signInWithGoogle}>
              <input type="hidden" name="next" value={next} />
              <Button variant="outline" className="w-full font-semibold">
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>
                Continue with Google
              </Button>
            </form>
            <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use your email<span className="h-px flex-1 bg-border" /></div>
            <form action={signInWithEmail} className="flex flex-col gap-3">
              <input type="hidden" name="next" value={next} />
              <Field label="Work email" htmlFor="email">
                <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@yourbusiness.co.uk" className={inputClass} />
              </Field>
              <Button variant="dark" className="w-full">Email me a sign-in link</Button>
            </form>
            <p className="text-xs text-muted-foreground">
              By continuing you agree to our <Link href="/terms" className="text-link underline">terms</Link> and <Link href="/privacy" className="text-link underline">privacy policy</Link>. Signing in with Google doesn&apos;t give us access to your ads. We ask for that separately, later.
            </p>
          </div>
        </main>
      </div>
      <aside className="hidden bg-ink px-10 py-24 text-white lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">What happens next</p>
        <ol className="mt-6 flex flex-col gap-6">
          {NEXT_STEPS.map(([t, b], i) => (
            <li key={t} className="flex gap-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs font-bold">{i + 1}</span>
              <div><p className="font-semibold">{t}</p><p className="mt-1 text-sm text-white/60">{b}</p></div>
            </li>
          ))}
        </ol>
        <p className="mt-10 border-t border-white/10 pt-6 text-sm text-white/60">Your audit is ready about a minute after you connect.</p>
      </aside>
    </div>
  );
}
