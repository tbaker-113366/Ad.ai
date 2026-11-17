import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/start";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/start";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  const failed = next === "/reset-password"
    ? `/forgot-password?error=${encodeURIComponent("That reset link has expired. Send yourself a new one.")}`
    : `/login?error=${encodeURIComponent("That link has expired or was already used. Sign in with your email and password.")}`;
  return NextResponse.redirect(`${origin}${failed}`);
}
