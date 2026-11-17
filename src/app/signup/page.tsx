import Link from "next/link";
import { AuthLayout, GoogleButtonContent, OrDivider } from "@/components/auth/AuthLayout";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { MIN_PASSWORD } from "@/lib/auth/forms";
import { signInWithGoogle, signUpWithPassword } from "../login/actions";

export const dynamic = "force-dynamic";

type Search = { next?: string; website?: string; error?: string; email?: string; confirm?: string };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { next = "/start", website, error, email, confirm } = await searchParams;
  const site = website?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const loginHref = `/login?${new URLSearchParams({ next, ...(website ? { website } : {}) })}`;

  if (confirm) {
    return (
      <AuthLayout title="Check your email" intro={`We've sent a link to ${confirm}. Click it to confirm your email and carry on.`} topRight={<Link href={loginHref} className="font-semibold text-link underline underline-offset-4">Sign in</Link>}>
        <Notice tone="info">Can&apos;t see it? Check your spam folder. The link works once and expires after an hour.</Notice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Get your free audit"
      intro="Create an account so we can save your results. No card needed."
      site={site}
      error={error}
      topRight={<>Have an account? <Link href={loginHref} className="font-semibold text-link underline underline-offset-4">Sign in</Link></>}
    >
      <form action={signUpWithPassword} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        {website && <input type="hidden" name="website" value={website} />}
        <Field label="Work email" htmlFor="email">
          <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email ?? ""} placeholder="you@yourbusiness.co.uk" className={inputClass} />
        </Field>
        <Field label="Password" hint={`At least ${MIN_PASSWORD} characters.`} htmlFor="password">
          <input id="password" name="password" type="password" required minLength={MIN_PASSWORD} maxLength={72} autoComplete="new-password" className={inputClass} />
        </Field>
        <Button size="lg" className="w-full">Create account</Button>
      </form>
      <OrDivider label="or" />
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        {website && <input type="hidden" name="website" value={website} />}
        <Button variant="outline" className="w-full"><GoogleButtonContent /></Button>
      </form>
      <p className="text-xs text-muted-foreground">
        By creating an account you agree to our <Link href="/terms" className="text-link underline">terms</Link> and <Link href="/privacy" className="text-link underline">privacy policy</Link>. Signing in doesn&apos;t give us access to your ads. We ask for that separately, later.
      </p>
    </AuthLayout>
  );
}
