import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Field, inputClass } from "@/components/ui";
import { MIN_PASSWORD } from "@/lib/auth/forms";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "../login/actions";

export const dynamic = "force-dynamic";

/** Reached from the reset email (the callback signs the user in first). */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/forgot-password?error=${encodeURIComponent("That reset link has expired. Send yourself a new one.")}`);
  const { error } = await searchParams;

  return (
    <AuthLayout title="Choose a new password" intro={`For ${user.email}.`} error={error}>
      <form action={updatePassword} className="flex flex-col gap-4">
        <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`} htmlFor="password">
          <input id="password" name="password" type="password" required minLength={MIN_PASSWORD} maxLength={72} autoComplete="new-password" className={inputClass} />
        </Field>
        <Field label="Type it again" htmlFor="confirm">
          <input id="confirm" name="confirm" type="password" required minLength={MIN_PASSWORD} maxLength={72} autoComplete="new-password" className={inputClass} />
        </Field>
        <Button size="lg" className="w-full">Save new password</Button>
      </form>
    </AuthLayout>
  );
}
