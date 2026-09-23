import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

// GET /auth/callback — where Google OAuth and the email-confirmation link return to.
// Exchanges the one-time code for a session cookie; the profile row already exists (created by the auth.users trigger),
// so this only decides where to go: unfinished onboarding → /onboarding, otherwise → the Academy (or ?next=).
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : null);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const fail = (reason: string) => NextResponse.redirect(new URL(`/signin?error=${reason}`, url.origin));

  // Provider-side errors (user cancelled Google consent, provider disabled…) arrive as query params.
  if (url.searchParams.get("error")) return fail(url.searchParams.get("error_code") === "provider_disabled" ? "provider" : "oauth");

  const supabase = await supabaseServer();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type }) : { error: new Error("missing code") };
  if (error) {
    console.error("[auth/callback]", error.message);
    return fail(/expired|invalid/i.test(error.message) ? "expired" : "callback");
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile, error: pErr } = await supabase.from("profiles").select("onboarded").eq("id", user!.id).maybeSingle();
  if (pErr) console.error("[auth/callback] profile", pErr.message);
  const dest = next ?? (profile?.onboarded ? "/academy" : "/onboarding");
  return NextResponse.redirect(new URL(dest, url.origin));
}
