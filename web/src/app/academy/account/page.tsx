import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Flame, Sparkles, Trophy, Type } from "lucide-react";
import { Panel } from "@/components/academy/ui";
import AccountForm from "@/components/academy/AccountForm";
import { guideMeta } from "@/lib/guides";
import { COMPANIONS, LEVELS, ROLES } from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";

// My Account — server-validated (the proxy also guards it). Everything shown comes from Supabase for this user.
export default async function Account() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/signin?next=/academy/account");

  const [profile, stats, lessons, challenges, words, streak] = await Promise.all([
    sb.from("profiles").select("full_name, avatar_url, provider, role, tamil_level, companion, guide_id, lang, onboarded, created_at").eq("id", user.id).maybeSingle(),
    sb.from("user_stats").select("xp, diamonds, correct, answered").eq("user_id", user.id).maybeSingle(),
    sb.from("user_lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", user.id).not("completed_at", "is", null),
    sb.from("user_challenge_progress").select("challenge_id", { count: "exact", head: true }).eq("user_id", user.id).eq("completed", true),
    sb.from("user_words").select("word", { count: "exact", head: true }).eq("user_id", user.id),
    sb.rpc("current_streak"),
  ]);
  const p = profile.data;
  if (!p) {
    console.error("[account]", profile.error?.message);
    return (
      <Panel eyebrow="My account" title="Account unavailable">
        <div className="empty"><p>We couldn’t load your profile.</p><p className="sub">Please try again in a moment. If this keeps happening, the database may not be set up yet.</p></div>
      </Panel>
    );
  }
  const xp = stats.data?.xp ?? 0;
  const name = p.full_name || user.email?.split("@")[0] || "Learner";
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [p.provider];

  return (
    <Panel eyebrow="My account" title={name} sub={user.email}>
      <div className="account">
        <section className="account-card">
          {p.avatar_url
            // eslint-disable-next-line @next/next/no-img-element -- remote avatar host varies
            ? <img src={p.avatar_url} alt="" width={88} height={88} className="avatar photo account-avatar" referrerPolicy="no-referrer" />
            : <span className="avatar account-avatar">{name.slice(0, 1).toUpperCase()}</span>}
          <dl className="wc-meta">
            <dt>Signed in with</dt><dd>{providers.map((x) => (x === "google" ? "Google" : x === "email" ? "Email & password" : x)).join(" · ")}</dd>
            <dt>Member since</dt><dd>{new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</dd>
            <dt>Role</dt><dd>{ROLES.find((r) => r.id === p.role)?.title}</dd>
            <dt>Tamil level</dt><dd>{LEVELS.find((l) => l.id === p.tamil_level)?.title}</dd>
            <dt>Companion</dt><dd>{COMPANIONS.find((c) => c.id === p.companion)?.name}</dd>
            <dt>Guide</dt><dd><Link href={`/academy/guides?g=${p.guide_id}`}>{guideMeta(p.guide_id)?.name ?? p.guide_id}</Link></dd>
            <dt>Onboarding</dt><dd>{p.onboarded ? "Complete" : <Link href="/onboarding">Finish setting up →</Link>}</dd>
          </dl>
          <p className="fine">Change role, level, companion or guide in <Link href="/onboarding">Edit preferences</Link>.</p>
        </section>

        <section>
          <ul className="jstats four account-stats">
            <li><Sparkles size={22} /><b>{xp}</b>XP · Level {Math.floor(xp / 200) + 1}</li>
            <li><Flame size={22} /><b>{typeof streak.data === "number" ? streak.data : 0}</b>Day streak</li>
            <li><BookOpen size={22} /><b>{lessons.count ?? 0}</b>Lessons done</li>
            <li><Trophy size={22} /><b>{challenges.count ?? 0}</b>Challenges passed</li>
            <li><Type size={22} /><b>{words.count ?? 0}</b>Words discovered</li>
          </ul>
          <p className="fine"><Link href="/academy/progress">Full progress dashboard →</Link></p>
          <AccountForm id={user.id} name={p.full_name ?? ""} />
        </section>
      </div>
    </Panel>
  );
}
