"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { friendlyAuthError, safeNext, signInSchema, signUpSchema, emailSchema, passwordSchema } from "@/lib/auth/forms";

/** Keep where-to-go-next and the website the visitor typed across redirects. */
function back(path: string, fd: FormData, extra: Record<string, string>) {
  const q = new URLSearchParams();
  const next = fd.get("next");
  const website = fd.get("website");
  if (typeof next === "string" && next) q.set("next", next);
  if (typeof website === "string" && website) q.set("website", website);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `${path}?${q.toString()}`;
}

const callbackUrl = (next: string) => `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`;

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next) } });
  if (error) redirect(back("/login", formData, { error: "Google sign-in isn't available right now. Use your email and password." }));
  redirect(data.url);
}

export async function signUpWithPassword(formData: FormData) {
  const parsed = signUpSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect(back("/signup", formData, { error: parsed.error.issues[0].message, email: String(formData.get("email") ?? "") }));
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: callbackUrl(next) },
  });
  if (error) {
    // The real reason goes to the server logs (never the password or email).
    console.error("auth.signUp failed", { status: error.status, code: error.code, message: error.message });
    redirect(back("/signup", formData, { error: friendlyAuthError(error.message), email: parsed.data.email }));
  }
  // Supabase returns a fake user with no identities for an existing email
  // (so it can't be used to discover accounts). Treat it as "check your inbox".
  if (data.session) redirect(next);
  redirect(back("/signup", formData, { confirm: parsed.data.email }));
}

export async function signInWithPassword(formData: FormData) {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect(back("/login", formData, { error: parsed.error.issues[0].message, email: String(formData.get("email") ?? "") }));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    console.error("auth.signIn failed", { status: error.status, code: error.code, message: error.message });
    redirect(back("/login", formData, { error: friendlyAuthError(error.message), email: parsed.data.email }));
  }
  redirect(safeNext(formData.get("next")));
}

export async function sendPasswordReset(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) redirect(`/forgot-password?error=${encodeURIComponent(email.error.issues[0].message)}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: callbackUrl("/reset-password") });
  // Same message whether or not the account exists, so this can't be used to check emails.
  if (error && /rate limit|too many|security purposes/i.test(error.message)) {
    redirect(`/forgot-password?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
  }
  redirect(`/forgot-password?sent=${encodeURIComponent(email.data)}`);
}

export async function updatePassword(formData: FormData) {
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) redirect(`/reset-password?error=${encodeURIComponent(password.error.issues[0].message)}`);
  if (formData.get("password") !== formData.get("confirm")) redirect(`/reset-password?error=${encodeURIComponent("The two passwords don't match")}`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/forgot-password?error=${encodeURIComponent("That reset link has expired. Send yourself a new one.")}`);
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect(`/reset-password?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
  redirect("/start?reset=1");
}
