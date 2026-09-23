"use client";

import { createStore } from "@/lib/store";
import { achievement } from "@/lib/achievements";

// XP values from the master document §20. Stored per browser until POST /api/progress exists.
export const XP = { discoverWord: 20, readOccurrence: 10, correctAnswer: 15, completeQuest: 50, completeLesson: 75, perfectChallenge: 100 } as const;
export const PASS = 0.6; // share of a round needed to mark a challenge completed
export const MAX_HEARTS = 5;

export type Mastery = "discovered" | "learning" | "familiar" | "mastered";

export type Progress = {
  xp: number;
  diamonds: number;
  hearts: number;
  words: Record<string, Mastery>;
  sources: string[]; // verse ids whose source was opened
  correct: number;
  answered: number;
  lessons: string[];
  quests: string[];
  steps: Record<string, number>; // lesson id -> steps reached (for "continue where you left off")
  days: string[]; // local dates with any learning activity, for the day streak
  challenges: Record<string, ChallengeState>;
  worlds: Record<string, string>; // world id -> last visit (ISO)
  log: Activity[]; // newest last, capped — the dated record behind Recent Activity and the timeline
};

export type Activity = { at: string; kind: "word" | "source" | "lesson" | "challenge" | "quest" | "world"; label: string; href?: string };

// `at`/`right` describe an unfinished round so "Current Mission" can offer to continue it.
export type ChallengeState = { best: number; plays: number; done: boolean; perfect: boolean; at?: number; right?: number; total?: number; qs?: string[] };

const EMPTY: Progress = { xp: 0, diamonds: 0, hearts: MAX_HEARTS, words: {}, sources: [], correct: 0, answered: 0, lessons: [], quests: [], steps: {}, days: [], challenges: {}, worlds: {}, log: [] };

export const progress = createStore<Progress>("solveli.progress", EMPTY);

export const QUESTS = [
  { id: "discover-3", title: achievement("discover-3").title, goal: 3, count: (p: Progress) => Object.keys(p.words).length, href: "/academy/search" },
  { id: "challenge-1", title: achievement("challenge-1").title, goal: 1, count: (p: Progress) => p.correct, href: "/academy/challenges" },
  { id: "sources-3", title: achievement("sources-3").title, goal: 3, count: (p: Progress) => p.sources.length, href: "/academy/worlds/sangam" },
];

export const levelOf = (xp: number) => Math.floor(xp / 200) + 1;

// Award quests whose goal is now met (+50 XP, +5 diamonds, once each).
function settle(p: Progress): Progress {
  for (const q of QUESTS) {
    if (!p.quests.includes(q.id) && q.count(p) >= q.goal) {
      p = { ...p, xp: p.xp + XP.completeQuest, diamonds: p.diamonds + 5, quests: [...p.quests, q.id], log: logged(p.log, { kind: "quest", label: `Quest complete: ${q.title}` }) };
    }
  }
  return p;
}

const logged = (log: Activity[] = [], a: Omit<Activity, "at">) => [...log, { ...a, at: new Date().toISOString() }].slice(-80);

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

// Every learning action also marks today as active.
const update = (fn: (p: Progress) => Progress, a?: Omit<Activity, "at">) => progress.set((p) => {
  const changed = fn(p);
  const next = settle(a && changed !== p ? { ...changed, log: logged(changed.log, a) } : changed);
  const d = today();
  return next === p || next.days.includes(d) ? next : { ...next, days: [...next.days, d].slice(-60) };
});

// Consecutive active days ending today (or yesterday, so the streak survives until tonight).
export function streakOf(days: string[]) {
  const set = new Set(days);
  const day = new Date();
  if (!set.has(today())) day.setDate(day.getDate() - 1);
  let n = 0;
  while (set.has(day.toLocaleDateString("en-CA"))) { n++; day.setDate(day.getDate() - 1); }
  return n;
}

// Entering a world: logged once per day per world, so the timeline is not flooded by navigation.
export function enterWorld(id: string, title: string) {
  const d = today();
  update((p) => (p.worlds[id]?.startsWith(d) ? p : { ...p, worlds: { ...p.worlds, [id]: new Date().toISOString() } }),
    { kind: "world", label: `Entered ${title}`, href: `/academy/worlds/${id}` });
}

export function reachStep(id: string, step: number) {
  update((p) => ((p.steps[id] ?? 0) >= step ? p : { ...p, steps: { ...p.steps, [id]: step } }));
}

export function discoverWord(word: string) {
  update((p) => (p.words[word] ? p : { ...p, xp: p.xp + XP.discoverWord, words: { ...p.words, [word]: "discovered" } }),
    { kind: "word", label: `Discovered ${word}`, href: `/academy/search?q=${encodeURIComponent(word)}` });
}

export function openSource(verseId: string, word?: string) {
  update((p) => {
    if (p.sources.includes(verseId)) return p;
    const words = word && p.words[word] === "discovered" ? { ...p.words, [word]: "learning" as Mastery } : p.words;
    return { ...p, xp: p.xp + XP.readOccurrence, sources: [...p.sources, verseId], words };
  }, { kind: "source", label: `Opened source ${verseId}`, href: verseId.startsWith("KURAL-") ? `/academy/thirukkural/${verseId.slice(6)}` : `/academy/verse/${verseId}` });
}

// Hearts only apply to challenge mistakes (doc §20); reading and exploring stay free.
export function answer(correct: boolean) {
  update((p) => correct
    ? { ...p, xp: p.xp + XP.correctAnswer, correct: p.correct + 1, answered: p.answered + 1 }
    : { ...p, hearts: Math.max(0, p.hearts - 1), answered: p.answered + 1 });
}

export function challengeStep(id: string, at: number, right: number, total: number, qs: string[]) {
  progress.set((p) => {
    const c = p.challenges[id] ?? { best: 0, plays: 0, done: false, perfect: false };
    return { ...p, challenges: { ...p.challenges, [id]: { ...c, at, right, total, qs } } };
  });
}

export function challengeFinish(id: string, right: number, total: number) {
  update((p) => {
    const c = p.challenges[id] ?? { best: 0, plays: 0, done: false, perfect: false };
    const perfect = right === total;
    const bonus = perfect && !c.perfect ? XP.perfectChallenge : 0;
    const next: ChallengeState = { best: Math.max(c.best, right / total), plays: c.plays + 1, done: c.done || right / total >= PASS, perfect: c.perfect || perfect };
    return { ...p, xp: p.xp + bonus, diamonds: p.diamonds + (bonus ? 5 : 0), challenges: { ...p.challenges, [id]: next } };
  }, { kind: "challenge", label: `Challenge ${id}: ${right}/${total}`, href: `/academy/challenges/${id}` });
}

export function refillHearts() {
  progress.set((p) => ({ ...p, hearts: MAX_HEARTS }));
}

export function completeLesson(id: string) {
  // Reviewing a lesson also refills hearts, so challenges are never locked for long.
  update((p) => (p.lessons.includes(id) ? p : { ...p, xp: p.xp + XP.completeLesson, diamonds: p.diamonds + 2, hearts: MAX_HEARTS, lessons: [...p.lessons, id] }),
    { kind: "lesson", label: `Completed lesson ${id}`, href: `/academy/lessons/${id}` });
}

export function resetProgress() {
  progress.set(EMPTY);
}
