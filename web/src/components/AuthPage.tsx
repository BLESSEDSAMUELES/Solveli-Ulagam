"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Eye, EyeOff, Feather, Heart, Landmark, Loader2, MailCheck, ShieldCheck, Users } from "lucide-react";
import { FooterLine, LangToggle, Logo, Tagline } from "@/components/brand";
import { friendly, signInWithGoogle } from "@/lib/auth";
import { STEPS } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase/client";

// Messages for /signin?error=… set by the OAuth callback.
const CALLBACK_ERRORS: Record<string, string> = {
  oauth: "Google sign-in was cancelled or failed. Please try again.",
  provider: "Google sign-in isn’t enabled for this project yet.",
  expired: "That sign-in link has expired or was already used. Sign in again, or request a new link.",
  callback: "We couldn’t complete sign-in. Please try again.",
};

export default function AuthPage({ mode, error: initialError, next }: { mode: "signup" | "signin"; error?: string; next?: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"" | "email" | "google">("");
  const [error, setError] = useState(initialError ? CALLBACK_ERRORS[initialError] ?? CALLBACK_ERRORS.callback : "");
  const [sent, setSent] = useState(""); // email awaiting confirmation
  const signup = mode === "signup";

  // Stage 1 of sign-up (personal details) and sign-in, both through Supabase Auth. Passwords never touch our database.
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim(), password = String(f.get("password"));
    setError("");
    if (signup && password !== f.get("confirm")) return setError("The two passwords don’t match.");
    setBusy("email");
    const sb = supabase();
    try {
      if (signup) {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { full_name: String(f.get("name")).trim() }, emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` },
        });
        if (error) return setError(friendly(error));
        // With email confirmation on, Supabase answers for an existing account with a user that has no identities.
        if (data.user && !data.user.identities?.length) return setError(friendly({ message: "already registered" }));
        if (data.session) { router.push("/onboarding"); router.refresh(); return; }
        setSent(email); // confirmation required: stages 2–5 continue now and sync once the email is confirmed
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return setError(friendly(error));
        const { data: prof } = await sb.from("profiles").select("onboarded").eq("id", data.user.id).maybeSingle();
        router.push(next ?? (prof?.onboarded ? "/academy" : "/onboarding"));
        router.refresh();
      }
    } catch (err) {
      setError(friendly(err as Error));
    } finally {
      setBusy("");
    }
  }

  async function google() {
    setError("");
    setBusy("google");
    const { error } = await signInWithGoogle(next).catch((e: Error) => ({ error: e }));
    if (error) { setError(friendly(error)); setBusy(""); } // on success the browser is already on its way to Google
  }

  return (
    <main className="auth">
      <Image src="/bg/auth.webp" alt="" fill priority sizes="100vw" className="bg" />
      <div className="auth-shade" />

      <header className="topbar light">
        <div className="brand-row"><Logo /><Tagline /></div>
        <nav className="nav" aria-label="Main">
          <Link href="/">Home</Link><Link href="#">Explore</Link><Link href="#">Learn</Link>
          <Link href="#">World</Link><Link href="#">About</Link>
        </nav>
        <div className="actions">
          <LangToggle />
          <Link href="/" className="pill"><ArrowLeft size={18} /> Back to Home</Link>
        </div>
      </header>

      <aside className="auth-left">
        <blockquote>
          <p lang="ta">“கல்வி கரையில<br />கற்பவர் நாள் சில”</p>
          <p className="quote-en">Learning has no shore; a learner&apos;s days are few.</p>
          <cite>— Nālaṭiyār</cite>
        </blockquote>
        <ul className="auth-perks">
          <li><BookOpen strokeWidth={1.3} /> Authentic<br />Literary Sources</li>
          <li><Feather strokeWidth={1.3} /> All Ages<br />All Learners</li>
          <li><Users strokeWidth={1.3} /> Learn · Explore · Grow</li>
          <li><Landmark strokeWidth={1.3} /> Immerse in Tamil<br />History &amp; Culture</li>
        </ul>
      </aside>

      <section className="paper auth-card">
        <p className="eyebrow dark">Welcome to Solveli</p>
        <h1>{signup ? "Create Your Account" : "Welcome Back"}</h1>
        <p className="sub">
          {signup ? "Join a timeless journey through Tamil language, literature and culture." : "Continue your journey through Tamil literature."}
        </p>

        {sent ? (
          <div className="auth-sent" role="status">
            <MailCheck size={40} strokeWidth={1.4} />
            <p><b>Check your inbox.</b> We sent a confirmation link to <b>{sent}</b>. Open it to activate your account.</p>
            <p className="sub">Meanwhile, continue setting up your journey — your choices are saved to your account once you confirm.</p>
            <button className="btn teal" onClick={() => router.push("/onboarding")}>Continue to step 2 <ArrowRight size={20} /></button>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="auth-form">
              {error && <p className="auth-error" role="alert">{error}</p>}
              {signup && (
                <label>Full Name<input name="name" autoComplete="name" placeholder="Your name" required minLength={2} maxLength={80} /></label>
              )}
              <label>Email Address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
              <label>
                Password
                <span className="pw">
                  <input
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete={signup ? "new-password" : "current-password"}
                    placeholder={signup ? "Create a strong password" : "Your password"}
                    minLength={signup ? 8 : undefined}
                    required
                  />
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </span>
              </label>
              {signup && (
                <label>Confirm Password<input name="confirm" type={show ? "text" : "password"} autoComplete="new-password" placeholder="Type it again" minLength={8} required /></label>
              )}
              <button className="btn teal" disabled={!!busy}>
                {busy === "email" && <Loader2 size={20} className="spin" />}
                {signup ? "Create Account" : "Sign In"} {busy !== "email" && <ArrowRight size={20} />}
              </button>
            </form>

            <div className="or"><span>OR</span></div>
            <div className="sso">
              <button type="button" className="google" onClick={google} disabled={!!busy}>
                {busy === "google" ? <Loader2 size={18} className="spin" /> : <GoogleMark />} Continue with Google
              </button>
            </div>
          </>
        )}

        <p className="switch">
          {signup ? <>Already have an account? <Link href="/signin">Sign In</Link></> : <>New to Solveli? <Link href="/signup">Create Account</Link></>}
          {" · "}<Link href="/onboarding">Explore as Guest</Link>
        </p>

        <ul className="trust">
          <li><ShieldCheck strokeWidth={1.3} /> Safe &amp; Secure</li>
          <li><Users strokeWidth={1.3} /> For All Ages</li>
          <li><Feather strokeWidth={1.3} /> Free to Explore</li>
          <li><Heart strokeWidth={1.3} /> Built for Tamil Learners</li>
        </ul>
      </section>

      <aside className="auth-right">
        {signup && (
          <ol className="steps vertical">
            <li className="active"><i>1</i><span><b>Create Account</b>Your personal details</span></li>
            {STEPS.map((s, i) => (
              <li key={s.title}><i>{i + 2}</i><span><b>{s.title}</b>{s.sub}</span></li>
            ))}
          </ol>
        )}
        <div className="note-card">
          <p>“A richer tomorrow through Tamil.”</p>
          <cite>— SOLVELI</cite>
        </div>
      </aside>

      <FooterLine className="auth-footer" />
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
