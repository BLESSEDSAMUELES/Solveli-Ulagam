"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Award, BookOpen, Flame, Lightbulb, Lock, Search, Sparkles, Star } from "lucide-react";
import { useT } from "@/lib/i18n";
import { progress, QUESTS, streakOf } from "@/lib/progress";
import { WORLDS } from "@/lib/worlds";

export type LessonCard = { id: string; world: string; title: string; summary: string; level: string; image: string; source: string; steps: number };

const TIPS = [
  "Read the verse aloud before the translation. Tamil lives in its sound.",
  "Open the source link: every line here comes from a real edition.",
  "Pick one word from a verse and search it — see where else it lives.",
  "Revisit a finished lesson a day later; recall beats rereading.",
];

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export default function LessonsHub({ lessons, quote }: { lessons: LessonCard[]; quote?: { line: string; cite: string } }) {
  const { t } = useT();
  const p = progress.use();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [tip, setTip] = useState(0);

  const pct = (l: LessonCard) => (p.lessons.includes(l.id) ? 100 : Math.round(((p.steps[l.id] ?? 0) / l.steps) * 100));
  const world = (id: string) => WORLDS.find((w) => w.id === id)!;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lessons.filter((l) => (tab === "all" || l.world === tab) && (!needle || `${l.title} ${l.summary} ${l.source}`.toLowerCase().includes(needle)));
  }, [lessons, tab, q]);

  // "All" features the first lesson of each world; a world tab or a search shows everything that matches.
  const featured = tab === "all" && !q && !showAll
    ? WORLDS.map((w) => filtered.find((l) => l.world === w.id)).filter((l): l is LessonCard => !!l).slice(0, 3)
    : filtered;

  const started = lessons.filter((l) => (p.steps[l.id] ?? 0) > 0 || p.lessons.includes(l.id)).sort((a, b) => pct(a) - pct(b));
  const done = p.lessons.length;
  const overall = Math.round((done / lessons.length) * 100);
  const suggestion = lessons.find((l) => !p.lessons.includes(l.id) && !(p.steps[l.id] > 0)) ?? lessons.find((l) => !p.lessons.includes(l.id));

  return (
    <div className="lessons-page">
      <div className="lp-main">
        <header className="lp-head">
          <div className="a-in" style={d(100)}>
            <h1>{t("lessons")}</h1>
            <p className="lp-motto">Learn. Reflect. Explore. Live Tamil.</p>
          </div>
          <blockquote className="lp-quote glass a-in" style={d(250)}>
            <p lang="ta">“கேடில் விழுச்செல்வம் கல்வி யொருவற்கு<br />மாடல்ல மற்றை யவை.”</p>
            <cite>— Tirukkuṟaḷ 400</cite>
          </blockquote>
        </header>

        <nav className="lp-tabs glass a-in" style={d(350)} aria-label="Filter lessons">
          {[{ id: "all", label: "All Lessons", icon: BookOpen }, ...WORLDS.map((w) => ({ id: w.id, label: w.id[0].toUpperCase() + w.id.slice(1), icon: w.icon }))].map((x) => {
            const n = x.id === "all" ? lessons.length : lessons.filter((l) => l.world === x.id).length;
            return (
              <button key={x.id} className={tab === x.id ? "on" : ""} onClick={() => { setTab(x.id); setShowAll(false); }} aria-pressed={tab === x.id}>
                <x.icon size={18} /> {x.label} <small>{n}</small>
              </button>
            );
          })}
        </nav>

        <section className="lp-section glass a-in" style={d(450)}>
          <header>
            <div><h2>{tab === "all" && !q ? "Featured Lessons" : `${featured.length} lesson${featured.length === 1 ? "" : "s"}`}</h2>
              <p>{tab === "all" ? "Begin your journey with these handpicked lessons." : world(tab).about}</p></div>
            <div className="lp-tools">
              <label className="lp-search">
                <Search size={16} aria-hidden="true" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons, topics…" aria-label="Search lessons" />
              </label>
              {tab === "all" && !q && <button className="link-btn" onClick={() => setShowAll(!showAll)}>{showAll ? "Show featured" : "View all"} <ArrowRight size={16} /></button>}
            </div>
          </header>
          {featured.length ? (
            <ul className="lesson-grid">
              {featured.map((l, i) => {
                const w = world(l.world);
                const pc = pct(l);
                return (
                  <li key={l.id} className="lesson-card-wrap" style={d(i * 70)}>
                    <Link href={`/academy/lessons/${l.id}`} className="lesson-card" style={{ "--c": w.color } as React.CSSProperties}>
                      <span className="lc-img"><Image src={l.image} alt="" width={480} height={300} /></span>
                      <span className="world-badge"><w.icon size={22} /></span>
                      <b>{l.title}</b>
                      <span className="lc-sum">{l.summary}</span>
                      {pc > 0 && <span className="bar"><i style={{ width: `${pc}%` }} /></span>}
                      <span className="lc-meta">
                        <span><BookOpen size={14} /> {l.steps} min</span><span>{l.level}</span>
                        {pc === 100 && <span className="done-tag">Completed</span>}
                        <span className="go"><ArrowRight size={16} /></span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty">
              <p>{tab === "thirukkural" ? "Tirukkuṟaḷ lessons arrive with its corpus." : "No lessons match that search."}</p>
              <p className="sub">{tab === "thirukkural" ? "Solveli only teaches from text it can cite." : "Try another word or clear the filter."}</p>
            </div>
          )}
        </section>

        <section className="lp-section a-in" style={d(550)}>
          <header><div><h2 className="on-art">Lesson Paths</h2><p className="on-art">Structured journeys through each world.</p></div></header>
          <ul className="paths">
            {WORLDS.map((w, i) => {
              const ls = lessons.filter((l) => l.world === w.id);
              const n = ls.filter((l) => p.lessons.includes(l.id)).length;
              return (
                <li key={w.id} className="reveal" style={d(i * 60)}>
                  <button className={`path ${ls.length ? "" : "locked"}`} style={{ "--c": w.color } as React.CSSProperties}
                    onClick={() => { setTab(w.id); setShowAll(false); document.querySelector(".lp-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    disabled={!ls.length} aria-label={`${w.id} path: ${n} of ${ls.length} lessons complete`}>
                    <Image src={`/worlds/${w.id}.webp`} alt="" fill sizes="220px" className="path-img" />
                    <span className="path-body">
                      <b>{t(w.key).replace(/ World$/, "")} Path</b>
                      <small>{w.sub}</small>
                      {ls.length ? <><small>{n} / {ls.length} lessons</small><span className="bar"><i style={{ width: `${(n / ls.length) * 100}%` }} /></span></>
                        : <small className="lock"><Lock size={12} /> Corpus coming soon</small>}
                    </span>
                    {ls.length > 0 && <span className="path-go"><ArrowRight size={16} /></span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="lp-section glass a-in" style={d(650)}>
          <header><div><h2>Continue Learning</h2><p>Pick up where you left off.</p></div></header>
          {started.length ? (
            <ul className="recent">
              {started.map((l) => {
                const pc = pct(l);
                return (
                  <li key={l.id} className="reveal">
                    <Image src={l.image} alt="" width={120} height={75} className="recent-img" />
                    <span className="recent-text"><b>{l.title}</b><small>{l.source}</small></span>
                    <span className="recent-bar"><span className="bar"><i style={{ width: `${pc}%` }} /></span><small>{pc}%</small></span>
                    <Link href={`/academy/lessons/${l.id}`} className="btn outline small">{pc === 100 ? "Review" : "Continue"} <ArrowRight size={16} /></Link>
                  </li>
                );
              })}
            </ul>
          ) : <p className="empty-line">Start any lesson — your place is saved here automatically.</p>}
        </section>
      </div>

      <aside className="lp-side">
        <section className="glass journey a-in" style={d(300)}>
          <header><h2>Your Learning Journey</h2><Link href="/academy/progress">Details <ArrowRight size={14} /></Link></header>
          <div className="ring-row">
            <svg viewBox="0 0 120 120" className="ring" role="img" aria-label={`${overall}% of lessons complete`}>
              <circle cx="60" cy="60" r="50" className="ring-track" />
              <circle cx="60" cy="60" r="50" className="ring-fill" style={{ strokeDasharray: `${(overall / 100) * 314} 314` }} />
              <text x="60" y="66" textAnchor="middle">{overall}%</text>
            </svg>
            <p><b>Overall Progress</b>{done} / {lessons.length} lessons</p>
          </div>
          <ul className="jstats">
            <li><Flame size={22} /><b>{streakOf(p.days)}</b>Day streak</li>
            <li><Star size={22} /><b>{done}</b>Lessons completed</li>
            <li><Award size={22} /><b>{p.quests.length}/{QUESTS.length}</b>Quests done</li>
          </ul>
        </section>

        {quote && (
          <Link href={`/academy/search?q=${encodeURIComponent("கேளிர்")}`} className="side-quote a-in" style={d(420)}>
            <p lang="ta">“{quote.line}”</p>
            <cite>— {quote.cite}</cite>
          </Link>
        )}

        {suggestion && (
          <section className="glass suggestion a-in" style={d(520)}>
            <h2><Sparkles size={18} /> Today&apos;s Suggestion</h2>
            <Link href={`/academy/lessons/${suggestion.id}`} className="sugg">
              <Image src={suggestion.image} alt="" width={120} height={90} className="sugg-img" />
              <span><b>{suggestion.title}</b><small>{suggestion.summary}</small><small>{suggestion.steps} min · {suggestion.level}</small></span>
              <span className="go" style={{ "--c": world(suggestion.world).color } as React.CSSProperties}><ArrowRight size={16} /></span>
            </Link>
          </section>
        )}

        <section className="glass tip a-in" style={d(620)}>
          <span className="tip-icon"><Lightbulb size={20} /></span>
          <span><b>Learning Tip</b><span key={tip} className="swap">{TIPS[tip]}</span></span>
          <button className="link-btn" onClick={() => setTip((tip + 1) % TIPS.length)}>Next tip</button>
        </section>
      </aside>
    </div>
  );
}
