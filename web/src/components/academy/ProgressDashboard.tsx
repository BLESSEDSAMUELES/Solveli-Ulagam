"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  Activity as ActivityIcon, ArrowRight, Award, BookOpen, Check, Compass, Flame, Gauge, Library, Lock, Medal, Sparkles, Target, Trophy, Type,
} from "lucide-react";
import { CountUp } from "@/components/academy/ui";
import { CharacterAvatar } from "@/components/academy/Character";
import { companionId } from "@/lib/characters";
import { useT } from "@/lib/i18n";
import { names, profile } from "@/lib/profile";
import { levelOf, progress, QUESTS, streakOf, XP, type Activity, type Progress } from "@/lib/progress";
import { WORLDS } from "@/lib/worlds";
import { achievement } from "@/lib/achievements";

type Item = { id: string; world: string; title: string; image?: string };
type Cite = { lines: string[]; cite: string; href: string } | undefined;
const TABS = [
  { id: "overview", label: "Overview", icon: Gauge }, { id: "worlds", label: "World Progress", icon: Compass },
  { id: "skills", label: "Skill Development", icon: Target }, { id: "achievements", label: "Achievements", icon: Award },
  { id: "timeline", label: "Learning Timeline", icon: ActivityIcon },
] as const;
const MASTERY = ["discovered", "learning", "familiar", "mastered"] as const;
const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function ProgressDashboard({ lessons, challenges, quote, wisdom }: { lessons: Item[]; challenges: Item[]; quote: Cite; wisdom: Cite }) {
  const { t } = useT();
  const p = progress.use();
  const me = names(profile.use());
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  const lvl = levelOf(p.xp);
  const streak = streakOf(p.days);
  const lessonsDone = lessons.filter((l) => p.lessons.includes(l.id)).length;
  const chDone = challenges.filter((c) => p.challenges[c.id]?.done).length;
  const worlds = WORLDS.map((w) => {
    const ls = lessons.filter((l) => l.world === w.id), cs = challenges.filter((c) => c.world === w.id);
    const ld = ls.filter((l) => p.lessons.includes(l.id)).length, cd = cs.filter((c) => p.challenges[c.id]?.done).length;
    const touched = ld + cd > 0 || !!p.worlds?.[w.id] || ls.some((l) => p.steps[l.id]) || cs.some((c) => p.challenges[c.id]?.plays);
    return { w, ls, cs, ld, cd, touched, pct: pct(ld + cd, ls.length + cs.length) };
  });
  const explored = worlds.filter((x) => x.touched).length;
  const overall = pct(lessonsDone + chDone, lessons.length + challenges.length);
  const words = Object.entries(p.words);
  const beyond = words.filter(([, m]) => m !== "discovered").length;
  const skills = [
    { icon: Type, label: "Vocabulary", value: `${words.length} words`, pct: pct(beyond, words.length), note: `${beyond} beyond “discovered”`, c: "#2f6b45" },
    { icon: Library, label: "Reading sources", value: `${p.sources.length} opened`, pct: Math.min(100, p.sources.length * 5), note: "20 sources fills the bar", c: "#1f5b86" },
    { icon: Check, label: "Answer accuracy", value: `${p.correct}/${p.answered}`, pct: pct(p.correct, p.answered), note: p.answered ? "correct contextual answers" : "no answers yet", c: "#a8641f" },
    { icon: BookOpen, label: "Lessons", value: `${lessonsDone}/${lessons.length}`, pct: pct(lessonsDone, lessons.length), note: "lessons completed", c: "#5a3f73" },
    { icon: Trophy, label: "Challenges", value: `${chDone}/${challenges.length}`, pct: pct(chDone, challenges.length), note: `passed at ${60}%`, c: "#9b2f2f" },
  ];
  const achievements = [
    ...QUESTS.map((q) => ({ id: q.id, title: q.title, done: p.quests.includes(q.id), note: `+${XP.completeQuest} XP` })),
    { id: "streak-7", title: achievement("streak-7").title, done: streak >= 7, note: `${streak}/7 days` },
    { id: "perfect", title: achievement("perfect").title, done: Object.values(p.challenges).some((c) => c.perfect), note: `+${XP.perfectChallenge} XP` },
    { id: "all-worlds", title: achievement("all-worlds").title, done: explored === 5, note: `${explored}/5 worlds` },
    { id: "mastered", title: achievement("mastered").title, done: words.some(([, m]) => m === "mastered"), note: "Discovered → Mastered" },
  ];
  const milestones = [...p.log].reverse().filter((a) => a.kind === "quest" || a.kind === "lesson" || a.kind === "challenge").slice(0, 4);

  // Next milestone: the world you are furthest into, and its next unfinished lesson (or first lesson overall).
  const focus = [...worlds].filter((x) => x.ld < x.ls.length).sort((a, b) => b.pct - a.pct)[0];
  const nextLesson = focus?.ls.find((l) => !p.lessons.includes(l.id));

  return (
    <div className="lessons-page progress-page">
      <div className="lp-main">
        <header className="lp-head">
          <div className="a-in" style={d(100)}>
            <h1>My {t("progress")}</h1>
            <p className="lp-motto">A step today, a wiser tomorrow.</p>
          </div>
          {quote && (
            <Link href={quote.href} className="lp-quote glass a-in" style={d(250)}>
              <p lang="ta">“{quote.lines[0]}<br />{quote.lines[1]}”</p>
              <cite>— {quote.cite}</cite>
            </Link>
          )}
        </header>

        <section className="glass pg-profile a-in" style={d(320)}>
          <CharacterAvatar id={companionId(me.companion)} size={72} className="big" glyph={me.companion === "Valavan" ? "வ" : "யா"} />
          <span className="pg-who"><b>{me.role}</b><small>{me.level} · Guide: {me.guide}</small><small className="pg-guest">Guest progress · saved in this browser</small></span>
          <span className="pg-level">
            <span><b>Level {lvl}</b><small>{p.xp % 200} / 200 XP</small></span>
            <span className="bar thick"><i style={{ width: `${((p.xp % 200) / 200) * 100}%` }} /></span>
          </span>
          <ul className="pg-kpis">
            <li><Flame size={26} className="flame" /><b><CountUp to={streak} /></b>Day streak</li>
            <li><BookOpen size={26} /><b><CountUp to={lessonsDone} /></b>Lessons completed</li>
            <li><Compass size={26} /><b><CountUp to={explored} /></b>Worlds explored</li>
            <li><Sparkles size={26} /><b><CountUp to={p.xp} /></b>Total XP</li>
          </ul>
        </section>

        <nav className="lp-tabs glass a-in" style={d(380)} aria-label="Progress views">
          {TABS.map((x) => <button key={x.id} className={tab === x.id ? "on" : ""} aria-pressed={tab === x.id} onClick={() => setTab(x.id)}><x.icon size={18} /> {x.label}</button>)}
        </nav>

        <div key={tab} className="swap">
          {(tab === "overview" || tab === "worlds") && (
            <section className="lp-section glass">
              <header><div><h2>World Progress</h2><p>Lessons and challenges completed in each world.</p></div>
                {tab === "overview" && <button className="link-btn" onClick={() => setTab("worlds")}>View all <ArrowRight size={16} /></button>}</header>
              <ul className="pg-worlds">
                {worlds.map(({ w, ls, cs, ld, cd, pct: n }, i) => (
                  <li key={w.id} className="lesson-card-wrap" style={d(i * 70)}>
                    <Link href={`/academy/worlds/${w.id}`} className="lesson-card pg-world" style={{ "--c": w.color } as React.CSSProperties}>
                      <span className="lc-img"><Image src={`/worlds/${w.id}.webp`} alt="" width={360} height={200} /></span>
                      <b>{t(w.key).replace(/ World$/, "").replace(/ உலகம்$/, "")}</b>
                      <span className="lc-sum">{w.sub}</span>
                      <span className="pg-bar"><span className="bar"><i style={{ width: `${n}%`, background: w.color }} /></span><small>{n}%</small></span>
                      <span className="lc-sum">{ld} / {ls.length} lessons · {cd} / {cs.length} challenges</span>
                      {tab === "worlds" && (
                        <span className="pg-items">
                          {ls.map((l) => <small key={l.id} className={p.lessons.includes(l.id) ? "done" : ""}>{p.lessons.includes(l.id) ? "✓" : "○"} {l.title}</small>)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(tab === "overview" || tab === "skills") && (
            <section className="lp-section glass">
              <header><div><h2>Skill Development</h2><p>Measured from what you have actually done.</p></div></header>
              <ul className="pg-skills">
                {skills.map((s, i) => (
                  <li key={s.label} className="lesson-card-wrap" style={d(i * 60)}>
                    <s.icon size={26} strokeWidth={1.5} style={{ color: s.c }} />
                    <span><b>{s.label}</b><small>{s.value} · {s.note}</small>
                      <span className="pg-bar"><span className="bar"><i style={{ width: `${s.pct}%`, background: s.c }} /></span><small>{s.pct}%</small></span></span>
                  </li>
                ))}
              </ul>
              {tab === "skills" && (
                <>
                  <h3 className="pg-h3">My words <small>{MASTERY.join(" → ")}</small></h3>
                  {words.length ? (
                    <ul className="word-chips">{words.map(([w, m]) => <li key={w}><Link href={`/academy/search?q=${encodeURIComponent(w)}`} lang="ta">{w}</Link> <small>{m}</small></li>)}</ul>
                  ) : <p className="empty-line">No words yet. <Link href="/academy/search">Search a word to begin →</Link></p>}
                </>
              )}
            </section>
          )}

          {(tab === "overview" || tab === "timeline") && <Heatmap p={p} full={tab === "timeline"} streak={streak} lessons={lessonsDone} />}

          {tab === "timeline" && (
            <section className="lp-section glass">
              <header><div><h2>Learning Timeline</h2><p>Every recorded step, newest first.</p></div></header>
              {p.log.length ? (
                <ol className="pg-timeline">
                  {[...p.log].reverse().map((a) => <TimelineItem key={a.at + a.label} a={a} />)}
                </ol>
              ) : <div className="empty"><p>Nothing recorded yet</p><p className="sub">Discover a word, open a source or finish a lesson — each step appears here with its date.</p></div>}
            </section>
          )}

          {tab === "achievements" && (
            <section className="lp-section glass">
              <header><div><h2>Achievements</h2><p>Earned from real learning actions — never bought.</p></div></header>
              <ul className="achievements">
                {achievements.map((a, i) => (
                  <li key={a.id} className={`reveal ${a.done ? "done" : ""}`} style={d(i * 60)}>
                    <span className="ach-icon">{a.done ? <Medal size={22} /> : <Lock size={18} />}</span>
                    <span><b>{a.title}</b><small>{a.done ? "Earned" : "Not yet"} · {a.note}</small></span>
                  </li>
                ))}
              </ul>
              <h3 className="pg-h3">How XP works</h3>
              <ul className="xp-table">
                <li>Discover a new word <b>+{XP.discoverWord}</b></li>
                <li>Open a source reference <b>+{XP.readOccurrence}</b></li>
                <li>Correct contextual answer <b>+{XP.correctAnswer}</b></li>
                <li>Complete a quest <b>+{XP.completeQuest}</b></li>
                <li>Complete a lesson <b>+{XP.completeLesson}</b></li>
              </ul>
            </section>
          )}
        </div>
      </div>

      <aside className="lp-side">
        <section className="glass journey a-in" style={d(300)}>
          <header><h2>Overall Completion</h2></header>
          <div className="ring-row">
            <svg viewBox="0 0 120 120" className="ring" role="img" aria-label={`${overall}% complete`}>
              <circle cx="60" cy="60" r="50" className="ring-track" />
              {overall > 0 && <circle cx="60" cy="60" r="50" className="ring-fill" style={{ strokeDasharray: `${(overall / 100) * 314} 314` }} />}
              <text x="60" y="66" textAnchor="middle">{overall}%</text>
            </svg>
            <p><b>{lessonsDone + chDone} / {lessons.length + challenges.length}</b>Lessons & challenges completed</p>
          </div>
          {wisdom && (
            <Link href={wisdom.href} className="pg-wisdom"><p lang="ta">“{wisdom.lines.join(" ")}”</p><cite>— {wisdom.cite}</cite></Link>
          )}
        </section>

        <section className="glass suggestion a-in" style={d(420)}>
          <header className="pg-side-head"><h2><Award size={18} /> Recent Achievements</h2><button className="link-btn" onClick={() => setTab("timeline")}>View all <ArrowRight size={14} /></button></header>
          {milestones.length ? (
            <ul className="pg-recent">{milestones.map((a) => <TimelineItem key={a.at + a.label} a={a} />)}</ul>
          ) : <p className="sub">Your first quest, lesson or challenge will appear here.</p>}
        </section>

        <section className="glass mission a-in" style={d(520)}>
          <h2>Next Milestone</h2>
          {nextLesson && focus ? (
            <>
              {nextLesson.image && <Image src={nextLesson.image} alt="" width={520} height={260} className="mission-img" />}
              <b>{nextLesson.title}</b>
              <small>{focus.ld} / {focus.ls.length} lessons in {t(focus.w.key)}</small>
              <span className="mission-bar"><span className="bar"><i style={{ width: `${pct(focus.ld, focus.ls.length)}%` }} /></span><small>{focus.ld} / {focus.ls.length}</small></span>
              <Link href={`/academy/lessons/${nextLesson.id}`} className="btn small enter-world">Continue Learning <ArrowRight size={16} /></Link>
            </>
          ) : (
            <><b>Every lesson complete</b><small>Keep your streak with a challenge.</small><Link href="/academy/challenges" className="btn small enter-world">Challenges <ArrowRight size={16} /></Link></>
          )}
        </section>
      </aside>
    </div>
  );
}

const KIND_ICON: Record<Activity["kind"], typeof Award> = { word: Type, source: Library, lesson: BookOpen, challenge: Trophy, quest: Medal, world: Compass };
function TimelineItem({ a }: { a: Activity }) {
  const Icon = KIND_ICON[a.kind];
  const body = <><span className={`tl-icon k-${a.kind}`}><Icon size={16} /></span><span className="tl-text"><b lang={/[஀-௿]/.test(a.label) ? "ta" : undefined}>{a.label}</b><small>{day(a.at)}</small></span></>;
  return <li>{a.href ? <Link href={a.href}>{body}</Link> : <span>{body}</span>}</li>;
}

// Activity heatmap: the last 18 weeks (or 26 on the timeline tab), shaded by how many steps were logged that day.
const noop = () => () => {};
function Heatmap({ p, full, streak, lessons }: { p: Progress; full: boolean; streak: number; lessons: number }) {
  // Dates and month names depend on the viewer's timezone and locale, so the grid renders after hydration only.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const weeks = full ? 26 : 18;
  const per = new Map<string, number>();
  for (const dd of p.days) per.set(dd, Math.max(1, per.get(dd) ?? 0));
  for (const a of p.log) { const k = new Date(a.at).toLocaleDateString("en-CA"); per.set(k, (per.get(k) ?? 0) + 1); }
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - end.getDay() - (weeks - 1) * 7); // Sunday, `weeks` weeks ago
  const cols: { key: string; n: number; future: boolean }[][] = [];
  const months: { col: number; label: string }[] = [];
  for (let c = 0; c < weeks; c++) {
    const col = [];
    for (let r = 0; r < 7; r++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + c * 7 + r);
      const key = dt.toLocaleDateString("en-CA");
      if (r === 0 && (c === 0 || dt.getDate() <= 7)) months.push({ col: c, label: dt.toLocaleDateString(undefined, { month: "short" }) });
      col.push({ key, n: per.get(key) ?? 0, future: dt > end });
    }
    cols.push(col);
  }
  const active = [...per.keys()].length;
  return (
    <section className="lp-section glass">
      <header><div><h2>Learning Activity</h2><p>Your consistency builds mastery.</p></div></header>
      <div className="pg-activity">
        {!mounted ? <div className="heat-wrap heat-loading" aria-busy="true" /> : <div className="heat-wrap">
          <div className="heat-months" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 18px))` }}>{months.map((m) => <span key={m.col} style={{ gridColumn: m.col + 1 }}>{m.label}</span>)}</div>
          <div className="heat" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 18px))` }} role="img" aria-label={`${active} active days in the last ${weeks} weeks`}>
            {cols.map((col, c) => col.map((cell, r) => (
              <i key={cell.key} title={cell.future ? undefined : `${cell.key}: ${cell.n} step${cell.n === 1 ? "" : "s"}`} className={cell.future ? "future" : `l${Math.min(4, cell.n)}`}
                style={{ gridColumn: c + 1, gridRow: r + 1, "--d": `${c * 18}ms` } as React.CSSProperties} />
            )))}
          </div>
          <p className="heat-legend">Less <i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" /> More</p>
        </div>}
        <ul className="pg-nums">
          <li><b><CountUp to={streak} /></b>Day streak</li>
          <li><b><CountUp to={active} /></b>Active days</li>
          <li><b><CountUp to={lessons} /></b>Lessons</li>
        </ul>
      </div>
    </section>
  );
}
