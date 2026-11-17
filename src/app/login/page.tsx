import Link from "next/link";
import { AuthLayout, GoogleButtonContent, OrDivider } from "@/components/auth/AuthLayout";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { PRODUCT_NAME } from "@/lib/config";
import { signInWithGoogle, signInWithPassword } from "./actions";

export const dynamic = "force-dynamic";

type Search = { next?: string; website?: string; error?: string; email?: string; reset?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { next = "/start", website, error, email, reset } = await searchParams;
  const signupHref = `/signup?${new URLSearchParams({ next, ...(website ? { website } : {}) })}`;

  return (
    <AuthLayout
      title={`Sign in to ${PRODUCT_NAME}`}
      intro="Welcome back."
      error={error}
      notice={reset ? <Notice tone="saved">Password updated. Sign in with your new password.</Notice> : undefined}
      topRight={<>New here? <Link href={signupHref} className="font-semibold text-link underline underline-offset-4">Create an account</Link></>}
    >
      <form action={signInWithPassword} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        {website && <input type="hidden" name="website" value={website} />}
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email ?? ""} className={inputClass} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-sm font-semibold text-ink">Password</label>
            <Link href="/forgot-password" className="text-sm text-link underline underline-offset-4">Forgot password?</Link>
          </div>
          <input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} />
        </div>
        <Button size="lg" variant="dark" className="w-full">Sign in</Button>
      </form>
      <OrDivider label="or" />
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button variant="outline" className="w-full"><GoogleButtonContent /></Button>
      </form>
    </AuthLayout>
  );
}
