"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Award, Calendar, Check, Compass, Flame, Globe2, HelpCircle, Lock, Medal, Sparkles, Star, Trophy } from "lucide-react";
import { useT } from "@/lib/i18n";
import { PASS, progress, QUESTS, streakOf, XP, type Progress } from "@/lib/progress";
import { WORLDS } from "@/lib/worlds";

export type ChallengeCard = { id: string; world: string; kind: "daily" | "world" | "quiz"; title: string; summary: string; image: string; round: number; source: string; questions: number };

const KIND = { daily: "Daily", world: "World", quiz: "Quiz" } as const;
const TABS = [
  { id: "all", label: "All Challenges", icon: Trophy }, { id: "daily", label: "Daily", icon: Calendar },
  { id: "world", label: "World Challenges", icon: Globe2 }, { id: "quiz", label: "Quizzes", icon: HelpCircle },
  { id: "achievements", label: "Achievements", icon: Award },
];
// Quest path nodes, positioned on the banner artwork (% of its box).
const NODES: [number, number][] = [[33, 74], [47, 56], [61, 76], [74, 52], [88, 38]];

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

function status(p: Progress, id: string) {
  const c = p.challenges[id];
  if (c?.at !== undefined && c.total && c.at < c.total) return { key: "progress", label: `In progress · ${c.at}/${c.total}` };
  if (c?.done) return { key: "done", label: `Completed · best ${Math.round(c.best * 100)}%` };
  if (c?.plays) return { key: "tried", label: `Best ${Math.round(c.best * 100)}% · pass at ${PASS * 100}%` };
  return { key: "new", label: "New" };
}

export default function ChallengesHub({ challenges, quote }: { challenges: ChallengeCard[]; quote?: { lines: string[]; cite: string; href: string } }) {
  const { t } = useT();
  const p = progress.use();
  const [tab, setTab] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const world = (id: string) => WORLDS.find((w) => w.id === id)!;

  const worldDone = (id: string) => challenges.some((c) => c.world === id && p.challenges[c.id]?.done);
  const doneCount = challenges.filter((c) => p.challenges[c.id]?.done).length;
  const pct = Math.round((doneCount / challenges.length) * 100);
  const worldsDone = WORLDS.filter((w) => worldDone(w.id)).length;
  const perfects = challenges.filter((c) => p.challenges[c.id]?.perfect).length;

  const list = tab === "all" ? challenges : challenges.filter((c) => c.kind === tab);
  const featured = tab === "all" && !showAll ? WORLDS.map((w) => challenges.find((c) => c.world === w.id)).filter((c): c is ChallengeCard => !!c).slice(0, 4) : list;
  const mission = challenges.find((c) => status(p, c.id).key === "progress") ?? challenges.find((c) => !p.challenges[c.id]?.done) ?? challenges[0];
  const ms = p.challenges[mission.id];

  // The heritage path unlocks world by world; every challenge stays playable from the list below.
  const firstOpen = WORLDS.findIndex((w) => !worldDone(w.id));

  const achievements = [
    ...QUESTS.map((q) => ({ id: q.id, title: q.title, done: p.quests.includes(q.id), note: `+${XP.completeQuest} XP` })),
    { id: "perfect", title: "Perfect round in any challenge", done: perfects > 0, note: `+${XP.perfectChallenge} XP` },
    { id: "heritage", title: "Complete a challenge in all five worlds", done: worldsDone === 5, note: `${worldsDone}/5 worlds` },
  ];

  return (
    <div className="lessons-page challenges-page">
      <div className="lp-main">
        <header className="lp-head">
          <div className="a-in" style={d(100)}>
            <h1>{t("challenges")}</h1>
            <p className="lp-motto">Test your knowledge. Explore deeper. Earn rewards.</p>
          </div>
          {quote && (
            <Link href={quote.href} className="lp-quote glass a-in" style={d(250)}>
              <p lang="ta">“{quote.lines[0]}<br />{quote.lines[1]}”</p>
              <cite>— {quote.cite}</cite>
            </Link>
          )}
        </header>

        <nav className="lp-tabs glass a-in" style={d(350)} aria-label="Filter challenges">
          {TABS.map((x) => (
            <button key={x.id} className={tab === x.id ? "on" : ""} onClick={() => { setTab(x.id); setShowAll(false); }} aria-pressed={tab === x.id}>
              <x.icon size={18} /> {x.label}
              {x.id !== "all" && x.id !== "achievements" && <small>{challenges.filter((c) => c.kind === x.id).length}</small>}
            </button>
          ))}
        </nav>

        {tab === "all" && (
          <section className="heritage glass a-in" style={d(420)}>
            <Image src="/challenges/banner.webp" alt="" fill sizes="(min-width: 1080px) 60vw, 100vw" className="heritage-img" />
            <div className="heritage-copy">
              <h2>Tamil Heritage Quest</h2>
              <p>Complete a challenge in every world to finish the quest.</p>
              <Link href="/academy/progress" className="btn small dark">View Journey <ArrowRight size={16} /></Link>
            </div>
            <svg className="heritage-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={NODES.map(([x, y]) => `${x},${y}`).join(" ")} />
            </svg>
            {WORLDS.map((w, i) => {
              const done = worldDone(w.id);
              const locked = !done && firstOpen !== -1 && i > firstOpen;
              const first = challenges.find((c) => c.world === w.id);
              const [x, y] = NODES[i];
              const inner = (
                <>
                  <span className="node-num">{done ? <Check size={18} /> : locked ? <Lock size={15} /> : i + 1}</span>
                  <span className="node-label"><b>{t(w.key).replace(/ World$/, "").replace(/ உலகம்$/, "")}</b><small>{w.sub.split(" · ").slice(0, 2).join(" · ")}</small></span>
                </>
              );
              const cls = `node ${done ? "done" : locked ? "locked" : i === firstOpen ? "current" : ""}`;
              const style = { left: `${x}%`, top: `${y}%`, "--c": w.color, ...d(600 + i * 120) } as React.CSSProperties;
              return locked || !first
                ? <span key={w.id} className={cls} style={style} aria-label={`${w.id}: locked until the previous world is complete`}>{inner}</span>
                : <Link key={w.id} href={`/academy/challenges/${first.id}`} className={cls} style={style}>{inner}</Link>;
            })}
          </section>
        )}

        {tab === "achievements" ? (
          <section className="lp-section glass a-in" style={d(450)}>
            <header><div><h2>Achievements</h2><p>Earned from real learning actions — never bought.</p></div></header>
            <ul className="achievements">
              {achievements.map((a) => (
                <li key={a.id} className={`reveal ${a.done ? "done" : ""}`}>
                  <span className="ach-icon">{a.done ? <Medal size={22} /> : <Lock size={18} />}</span>
                  <span><b>{a.title}</b><small>{a.done ? "Earned" : "Not yet"} · {a.note}</small></span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="lp-section glass a-in" style={d(480)}>
            <header>
              <div><h2>{tab === "all" ? "Featured Challenges" : TABS.find((x) => x.id === tab)!.label}</h2>
                <p>{tab === "all" ? "One from each world to begin with." : `${list.length} challenge${list.length === 1 ? "" : "s"}`}</p></div>
              {tab === "all" && <button className="link-btn" onClick={() => setShowAll(!showAll)}>{showAll ? "Show featured" : "View all"} <ArrowRight size={16} /></button>}
            </header>
            <ul className="lesson-grid challenge-grid">
              {featured.map((c, i) => {
                const w = world(c.world);
                const st = status(p, c.id);
                return (
                  <li key={c.id} className="lesson-card-wrap" style={d(i * 80)}>
                    <Link href={`/academy/challenges/${c.id}`} className={`lesson-card challenge-card st-${st.key}`} style={{ "--c": w.color } as React.CSSProperties}>
                      <span className="lc-img"><Image src={c.image} alt="" width={520} height={300} /></span>
                      <span className="kind-tag">{KIND[c.kind]}</span>
                      <b>{c.title}</b>
                      <span className="lc-sum">{c.summary}</span>
                      <span className="lc-meta">
                        <span><HelpCircle size={14} /> {c.round} questions</span>
                        <span className="xp"><Sparkles size={14} /> +{c.round * XP.correctAnswer} XP</span>
                      </span>
                      <span className={`status-chip ${st.key}`}>{st.key === "done" && <Check size={13} />}{st.label}</span>
                      <span className="btn teal small start">{st.key === "progress" ? "Continue" : st.key === "done" ? "Play again" : "Start Challenge"} <ArrowRight size={16} /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="lp-section a-in" style={d(580)}>
          <header><div><h2 className="on-art">Challenge Categories</h2><p className="on-art">Every world, its own kinds of questions.</p></div></header>
          <ul className="paths categories">
            {WORLDS.map((w, i) => {
              const cs = challenges.filter((c) => c.world === w.id);
              const n = cs.filter((c) => p.challenges[c.id]?.done).length;
              return (
                <li key={w.id} className="reveal" style={d(i * 60)}>
                  <Link href={cs[0] ? `/academy/challenges/${cs[0].id}` : "#"} className="path" style={{ "--c": w.color } as React.CSSProperties}>
                    <Image src={`/worlds/${w.id}.webp`} alt="" fill sizes="220px" className="path-img" />
                    <span className="path-body">
                      <b><w.icon size={16} /> {t(w.key).replace(/ World$/, "")}</b>
                      <small>{w.sub}</small>
                      <small>{n} / {cs.length} challenges · {cs.reduce((s, c) => s + c.questions, 0)} questions</small>
                      <span className="bar"><i style={{ width: `${cs.length ? (n / cs.length) * 100 : 0}%` }} /></span>
                    </span>
                    <span className="path-go"><ArrowRight size={16} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <aside className="lp-side">
        <section className="glass journey a-in" style={d(300)}>
          <header><h2>Your Challenge Journey</h2><Link href="/academy/progress">Details <ArrowRight size={14} /></Link></header>
          <div className="ring-row">
            <svg viewBox="0 0 120 120" className="ring" role="img" aria-label={`${pct}% of challenges completed`}>
              <circle cx="60" cy="60" r="50" className="ring-track" />
              <circle cx="60" cy="60" r="50" className="ring-fill" style={{ strokeDasharray: `${(pct / 100) * 314} 314` }} />
              <text x="60" y="66" textAnchor="middle">{pct}%</text>
            </svg>
            <p><b>{doneCount} / {challenges.length} Challenges</b>Completed</p>
          </div>
          <ul className="jstats">
            <li><Flame size={22} /><b>{streakOf(p.days)}</b>Day streak</li>
            <li><Star size={22} /><b>{p.quests.length + perfects}</b>Badges</li>
            <li><Compass size={22} /><b>{worldsDone}/5</b>Worlds done</li>
          </ul>
        </section>

        <section className="glass mission a-in" style={d(420)}>
          <h2>Current Mission</h2>
          <Image src={mission.image} alt="" width={520} height={260} className="mission-img" />
          <b>{mission.title}</b>
          <small>{mission.summary}</small>
          {ms?.at !== undefined && ms.total ? (
            <span className="mission-bar"><span className="bar"><i style={{ width: `${(ms.at / ms.total) * 100}%` }} /></span><small>{ms.at} / {ms.total}</small></span>
          ) : null}
          <Link href={`/academy/challenges/${mission.id}`} className="btn small enter-world">{ms?.at !== undefined && ms.total && ms.at < ms.total ? "Continue Challenge" : "Start Challenge"} <ArrowRight size={16} /></Link>
        </section>

        <section className="glass suggestion a-in" style={d(520)}>
          <h2><Award size={18} /> Achievements</h2>
          <ul className="ach-mini">
            {achievements.slice(0, 4).map((a) => (
              <li key={a.id} className={a.done ? "done" : ""}>{a.done ? <Check size={15} /> : <Lock size={13} />} {a.title}</li>
            ))}
          </ul>
          <button className="link-btn" onClick={() => setTab("achievements")}>All achievements <ArrowRight size={14} /></button>
        </section>
      </aside>
    </div>
  );
}
