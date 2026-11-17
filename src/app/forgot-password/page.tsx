import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { sendPasswordReset } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { error, sent } = await searchParams;
  return (
    <AuthLayout
      title="Reset your password"
      intro="Enter your email and we'll send you a link to choose a new password."
      error={error}
      topRight={<Link href="/login" className="font-semibold text-link underline underline-offset-4">Back to sign in</Link>}
    >
      {sent ? (
        <Notice tone="saved">If there&apos;s an account for {sent}, a reset link is on its way. It expires after an hour.</Notice>
      ) : (
        <form action={sendPasswordReset} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="email">
            <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
          </Field>
          <Button size="lg" className="w-full">Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}
