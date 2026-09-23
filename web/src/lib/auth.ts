"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { configured, supabase } from "@/lib/supabase/client";
import { lang, profile, type Profile } from "@/lib/profile";
import { progress, QUESTS, resetProgress, type Activity, type ChallengeState, type Mastery, type Progress } from "@/lib/progress";

// ---------------------------------------------------------------------------------------------------------------
// Auth state for the UI (header, account, community). The Supabase session itself lives in cookies; this mirrors it.
// ---------------------------------------------------------------------------------------------------------------

export type Account = { id: string; email: string; name: string; avatar: string | null; provider: string; createdAt: string };
export type AuthState = { status: "loading" | "guest" | "user"; account?: Account; sync: "idle" | "saving" | "error" };

let state: AuthState = { status: "loading", sync: "idle" };
const listeners = new Set<() => void>();
const setState = (s: Partial<AuthState>) => { state = { ...state, ...s }; listeners.forEach((l) => l()); };
const SERVER: AuthState = { status: "loading", sync: "idle" };
export const useAuth = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => state, () => SERVER);

const accountOf = (u: User, full_name?: string | null, avatar_url?: string | null): Account => ({
  id: u.id, email: u.email ?? "",
  name: full_name || (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || (u.email ?? "").split("@")[0],
  avatar: avatar_url || (u.user_metadata?.avatar_url as string) || (u.user_metadata?.picture as string) || null,
  provider: (u.app_metadata?.provider as string) ?? "email", createdAt: u.created_at,
});

// User-facing messages only; raw backend errors go to the console.
export function friendly(err: { message?: string; code?: string } | null | undefined, fallback = "Something went wrong. Please try again.") {
  const m = err?.message ?? "";
  console.error("[supabase]", err);
  if (/invalid login credentials/i.test(m)) return "That email and password don't match. Check them and try again.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first — we sent you a link when you signed up.";
  if (/already registered|already exists/i.test(m)) return "An account with this email already exists. Sign in instead.";
  if (/password should be|weak password/i.test(m)) return "Choose a stronger password: at least 8 characters.";
  if (/rate limit|too many/i.test(m)) return "Too many attempts. Please wait a minute and try again.";
  if (/provider is not enabled|unsupported provider/i.test(m)) return "Google sign-in isn't enabled for this project yet.";
  if (/jwt expired|session.*(expired|missing)/i.test(m)) return "Your session expired. Please sign in again.";
  if (/row-level security|permission denied|42501/i.test(m + (err?.code ?? ""))) return "You don't have permission to do that.";
  if (/failed to fetch|network|fetch failed/i.test(m)) return "Can't reach the Solveli server. Check your connection and try again.";
  return fallback;
}

export async function signOut() {
  await supabase().auth.signOut().catch((e) => console.error("[auth] signOut", e));
  // SIGNED_OUT (below) clears the local copies; also clear here in case the event never fires (offline).
  stopSync(true);
  setState({ status: "guest", account: undefined });
}

export async function signInWithGoogle(next?: string) {
  // A disabled provider makes Supabase's /authorize answer with a raw JSON error page, so check the public settings first.
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } });
    if (r.ok && !(await r.json()).external?.google) return { error: { message: "provider is not enabled" } };
  } catch { /* offline: let signInWithOAuth report it */ }
  const redirectTo = `${location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return supabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
}

/** Called when onboarding finishes: marks the profile complete (or remembers it until the user can sign in). */
export async function markOnboarded() {
  try { localStorage.setItem(ONBOARDED, "1"); } catch {}
  if (!uid) return;
  const p = profile.get();
  const { error } = await supabase().from("profiles").update({ ...profileRow(p), lang: lang.get().lang, onboarded: true }).eq("id", uid);
  if (error) { setState({ sync: "error" }); friendly(error); }
}

// ---------------------------------------------------------------------------------------------------------------
// Sync: the local stores stay the UI's source of truth; when signed in they are loaded from and written to Supabase.
// ---------------------------------------------------------------------------------------------------------------

const ONBOARDED = "solveli.onboarded";
const LEVEL: Record<Mastery, number> = { discovered: 0, learning: 1, familiar: 2, mastered: 3 };
let uid: string | undefined;
let synced: Progress | undefined; // last state known to be in the database
let unsub: (() => void)[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

const profileRow = (p: Profile) => ({ role: p.role, tamil_level: p.level, companion: p.companion, guide_id: p.guide });

async function startSync(user: User) {
  if (uid === user.id) return;
  stopSync(false);
  uid = user.id;
  const sb = supabase();
  setState({ status: "user", account: accountOf(user) });

  // Profile: an onboarded account wins; otherwise this device's onboarding answers become the account's.
  const { data: row, error } = await sb.from("profiles")
    .select("full_name, avatar_url, provider, role, tamil_level, companion, guide_id, lang, onboarded").eq("id", user.id).maybeSingle();
  if (error || !row) {
    setState({ sync: "error" });
    friendly(error ?? { message: "profile missing" });
  } else {
    setState({ account: accountOf(user, row.full_name, row.avatar_url) });
    let doneHere = false;
    try { doneHere = localStorage.getItem(ONBOARDED) === "1"; } catch {}
    if (row.onboarded) {
      profile.set({ role: row.role, level: row.tamil_level, companion: row.companion, guide: row.guide_id });
      lang.set({ lang: row.lang });
    } else if (doneHere) {
      await sb.from("profiles").update({ ...profileRow(profile.get()), lang: lang.get().lang, onboarded: true }).eq("id", user.id);
    }
  }

  // Progress: load, merge this device's guest progress in once, write the difference back.
  const remote = await loadProgress(user.id).catch((e) => { friendly(e); setState({ sync: "error" }); return undefined; });
  if (uid !== user.id || !remote) return;
  const merged = merge(remote, progress.get());
  synced = remote;
  progress.set(merged);
  await flush();

  unsub.push(progress.subscribe(schedule));
  unsub.push(profile.subscribe(() => uid && sb.from("profiles").update(profileRow(profile.get())).eq("id", uid).then(({ error }) => error && friendly(error))));
  unsub.push(lang.subscribe(() => uid && sb.from("profiles").update({ lang: lang.get().lang }).eq("id", uid).then(({ error }) => error && friendly(error))));
}

function stopSync(clearLocal: boolean) {
  unsub.forEach((u) => u());
  unsub = [];
  clearTimeout(timer);
  uid = undefined;
  synced = undefined;
  if (clearLocal) {
    // Signed-out devices must not keep the last user's progress or choices.
    resetProgress();
    profile.set({ role: "student", level: "new", companion: "yaazhini", guide: "thiruvalluvar" });
    try { localStorage.removeItem(ONBOARDED); } catch {}
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(flush, 700); // coalesce bursts (e.g. XP + word + quest from one action)
}

async function loadProgress(id: string): Promise<Progress> {
  const sb = supabase();
  const [stats, lessons, challenges, words, sources, days, log, ach, worlds] = await Promise.all([
    sb.from("user_stats").select("xp, diamonds, hearts, correct, answered").eq("user_id", id).maybeSingle(),
    sb.from("user_lesson_progress").select("lesson_id, steps_reached, completed_at").eq("user_id", id),
    sb.from("user_challenge_progress").select("challenge_id, best_score, plays, completed, perfect, round_state").eq("user_id", id),
    sb.from("user_words").select("word, mastery").eq("user_id", id),
    sb.from("user_sources").select("verse_id").eq("user_id", id),
    sb.from("user_active_days").select("day").eq("user_id", id).order("day", { ascending: false }).limit(60),
    sb.from("user_activity").select("kind, label, href, at").eq("user_id", id).order("at", { ascending: false }).limit(80),
    sb.from("user_achievements").select("achievement_id, unlocked_at").eq("user_id", id),
    sb.from("user_world_visits").select("world_id, last_visited_at").eq("user_id", id),
  ]);
  const err = [stats, lessons, challenges, words, sources, days, log, ach, worlds].find((r) => r.error)?.error;
  if (err) throw err;
  const s = stats.data ?? { xp: 0, diamonds: 0, hearts: 5, correct: 0, answered: 0 };
  return {
    ...s,
    words: Object.fromEntries((words.data ?? []).map((w) => [w.word, w.mastery as Mastery])),
    sources: (sources.data ?? []).map((x) => x.verse_id),
    lessons: (lessons.data ?? []).filter((l) => l.completed_at).map((l) => l.lesson_id),
    steps: Object.fromEntries((lessons.data ?? []).map((l) => [l.lesson_id, l.steps_reached])),
    challenges: Object.fromEntries((challenges.data ?? []).map((c) => [c.challenge_id, {
      best: Number(c.best_score), plays: c.plays, done: c.completed, perfect: c.perfect, ...(c.round_state ?? {}),
    } satisfies ChallengeState])),
    days: (days.data ?? []).map((x) => x.day).reverse(),
    log: (log.data ?? []).map((a) => ({ kind: a.kind, label: a.label, href: a.href ?? undefined, at: new Date(a.at).toISOString() }) as Activity).reverse(),
    quests: (ach.data ?? []).filter((a) => a.unlocked_at && QUESTS.some((q) => q.id === a.achievement_id)).map((a) => a.achievement_id),
    worlds: Object.fromEntries((worlds.data ?? []).map((w) => [w.world_id, new Date(w.last_visited_at).toISOString()])),
  };
}

// Guest progress from this device joins the account: never lose either side, never double-count (max, not sum).
function merge(r: Progress, l: Progress): Progress {
  const words = { ...r.words };
  for (const [w, m] of Object.entries(l.words ?? {})) if (!words[w] || LEVEL[m] > LEVEL[words[w]]) words[w] = m;
  const challenges = { ...r.challenges };
  for (const [id, c] of Object.entries(l.challenges ?? {})) {
    const x = challenges[id];
    challenges[id] = x ? { ...c, ...x, best: Math.max(x.best, c.best), plays: Math.max(x.plays, c.plays), done: x.done || c.done, perfect: x.perfect || c.perfect } : c;
  }
  const steps = { ...r.steps };
  for (const [id, n] of Object.entries(l.steps ?? {})) steps[id] = Math.max(n, steps[id] ?? 0);
  const worlds = { ...r.worlds };
  for (const [id, at] of Object.entries(l.worlds ?? {})) if (!worlds[id] || at > worlds[id]) worlds[id] = at;
  const key = (a: Activity) => a.at + a.label;
  const log = [...new Map([...r.log, ...(l.log ?? [])].map((a) => [key(a), a])).values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-80);
  const correct = Math.max(r.correct, l.correct);
  return {
    xp: Math.max(r.xp, l.xp), diamonds: Math.max(r.diamonds, l.diamonds), hearts: r.hearts, correct, answered: Math.max(r.answered, l.answered, correct),
    words, sources: [...new Set([...r.sources, ...(l.sources ?? [])])], lessons: [...new Set([...r.lessons, ...(l.lessons ?? [])])],
    quests: [...new Set([...r.quests, ...(l.quests ?? [])])], steps, challenges, worlds, log,
    days: [...new Set([...r.days, ...(l.days ?? [])])].sort().slice(-60),
  };
}

// Write only what changed since the last successful sync. Every write is an upsert, so retries are harmless.
async function flush() {
  const id = uid, prev = synced, next = progress.get();
  if (!id || !prev || prev === next) return;
  const sb = supabase();
  const now = new Date().toISOString();
  const up = (table: string, rows: object[], onConflict: string, ignoreDuplicates = false) =>
    rows.length ? sb.from(table).upsert(rows.map((r) => ({ user_id: id, ...r })), { onConflict, ignoreDuplicates }) : null;
  const newly = <T,>(a: T[], b: T[]) => a.filter((x) => !b.includes(x));

  const lessonIds = [...new Set([...Object.keys(next.steps), ...next.lessons])].filter((l) => next.steps[l] !== prev.steps[l] || (next.lessons.includes(l) && !prev.lessons.includes(l)));
  const writes = [
    ["xp", "diamonds", "hearts", "correct", "answered"].some((k) => next[k as keyof Progress] !== prev[k as keyof Progress])
      ? sb.from("user_stats").upsert({ user_id: id, xp: next.xp, diamonds: next.diamonds, hearts: next.hearts, correct: next.correct, answered: Math.max(next.answered, next.correct) }, { onConflict: "user_id" })
      : null,
    up("user_words", Object.entries(next.words).filter(([w, m]) => prev.words[w] !== m).map(([word, mastery]) => ({ word, mastery, updated_at: now })), "user_id,word"),
    up("user_sources", newly(next.sources, prev.sources).map((verse_id) => ({ verse_id })), "user_id,verse_id", true),
    // Two batches, because a batch upsert must send the same columns for every row.
    up("user_lesson_progress", lessonIds.filter((l) => !(next.lessons.includes(l) && !prev.lessons.includes(l))).map((lesson_id) => ({ lesson_id, steps_reached: next.steps[lesson_id] ?? 0, updated_at: now })), "user_id,lesson_id"),
    up("user_lesson_progress", lessonIds.filter((l) => next.lessons.includes(l) && !prev.lessons.includes(l)).map((lesson_id) => ({ lesson_id, steps_reached: next.steps[lesson_id] ?? 0, completed_at: now, updated_at: now })), "user_id,lesson_id"),
    up("user_challenge_progress", Object.entries(next.challenges).filter(([c, v]) => JSON.stringify(v) !== JSON.stringify(prev.challenges[c])).map(([challenge_id, c]) => ({
      challenge_id, best_score: Math.min(1, Math.max(0, c.best)), plays: c.plays, completed: c.done, perfect: c.perfect,
      round_state: c.at !== undefined && c.total && c.at < c.total ? { at: c.at, right: c.right, total: c.total, qs: c.qs } : null, updated_at: now,
    })), "user_id,challenge_id"),
    up("user_active_days", newly(next.days, prev.days).map((day) => ({ day })), "user_id,day", true),
    up("user_activity", next.log.filter((a) => !prev.log.some((b) => b.at === a.at && b.label === a.label)).map(({ kind, label, href, at }) => ({ kind, label: label.slice(0, 200), href: href ?? null, at })), "user_id,at,label", true),
    up("user_achievements", newly(next.quests, prev.quests).map((achievement_id) => ({ achievement_id, progress: QUESTS.find((q) => q.id === achievement_id)?.goal ?? 1, unlocked_at: now })), "user_id,achievement_id"),
    up("user_world_visits", Object.entries(next.worlds ?? {}).filter(([w, at]) => prev.worlds?.[w] !== at).map(([world_id, at]) => ({ world_id, last_visited_at: at })), "user_id,world_id"),
  ].filter(Boolean);
  if (!writes.length) { synced = next; return; }

  setState({ sync: "saving" });
  const results = await Promise.all(writes);
  const failed = results.find((r) => r?.error)?.error;
  if (failed) {
    friendly(failed);
    setState({ sync: "error" }); // `synced` is left as it was, so the next change retries these rows
    return;
  }
  if (uid === id) synced = next;
  setState({ sync: "idle" });
}

// ---------------------------------------------------------------------------------------------------------------
// Boot: follow the Supabase session (cookie-backed; persists across refreshes, refreshed automatically).
// ---------------------------------------------------------------------------------------------------------------

let booted = false;
export function bootAuth() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  if (!configured()) return setState({ status: "guest" });
  supabase().auth.onAuthStateChange((event, session) => {
    // Supabase warns against awaiting other calls inside this callback; defer the work.
    setTimeout(() => {
      if (session?.user) void startSync(session.user);
      else {
        if (event === "SIGNED_OUT" && uid) stopSync(true);
        setState({ status: "guest", account: undefined });
      }
    }, 0);
  });
}
