import { z } from "zod";

/** Email + password auth: validation and plain-English errors. */

export const MIN_PASSWORD = 8;

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters for your password`)
  .max(72, "Use 72 characters or fewer for your password");

export const signUpSchema = z.object({ email: emailSchema, password: passwordSchema });
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password") });

/** Only same-site relative paths. */
export function safeNext(next: unknown, fallback = "/start"): string {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}

/** Turn Supabase auth errors into something an owner can act on. */
export function friendlyAuthError(message: string | undefined | null): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Try again, or reset your password.";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already exists"))
    return "There's already an account with that email. Sign in instead.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. We've sent you a link — check your inbox.";
  if (m.includes("password") && (m.includes("weak") || m.includes("at least") || m.includes("characters")))
    return `Choose a stronger password: at least ${MIN_PASSWORD} characters, not a common one.`;
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("error sending") || m.includes("smtp") || m.includes("sending confirmation") || m.includes("sending recovery"))
    return "We couldn't send you an email just now. Please try again in a few minutes.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "New sign-ups are paused right now.";
  if (m.includes("same password") || m.includes("different from the old"))
    return "Choose a password you haven't used before.";
  return "Something went wrong. Please try again.";
}
