"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Heart, RotateCcw, Sparkles, X } from "lucide-react";
import { answer, challengeFinish, challengeStep, openSource, PASS, progress, XP } from "@/lib/progress";
import { WORLDS } from "@/lib/worlds";

type Q = {
  id: string; prompt: string;
  passage?: { lines: string[]; english?: string | null; cite: string; href: string };
  options: { key: string; label: string; sub?: string; ta?: boolean }[];
  answer: string; explain: string;
};
type Challenge = { id: string; world: string; kind: string; title: string; summary: string; image: string; round: number; source: string; pool: Q[] };

// Small seeded shuffle so the daily challenge is the same set for everyone on a given day.
function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
function pick(pool: Q[], n: number, rand: () => number) {
  return [...pool].map((q) => [rand(), q] as const).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, q]) => q);
}

export default function ChallengePlayer({ challenge: c, next }: { challenge: Challenge; next: { id: string; title: string } }) {
  const p = progress.use();
  const saved = p.challenges[c.id];
  const w = WORLDS.find((x) => x.id === c.world)!;
  const [round, setRound] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const resumable = saved?.qs && saved.at !== undefined && saved.total && saved.at < saved.total;

  function start(resume = false) {
    if (resume && saved?.qs) {
      const byId = new Map(c.pool.map((q) => [q.id, q]));
      const qs = saved.qs.map((id) => byId.get(id)).filter((q): q is Q => !!q);
      if (qs.length === saved.total) { setRound(qs); setI(saved.at!); setRight(saved.right ?? 0); setPicked(null); return; }
    }
    const today = new Date();
    const rand = c.kind === "daily" ? seeded(today.getFullYear() * 1000 + today.getMonth() * 40 + today.getDate()) : Math.random;
    const qs = pick(c.pool, c.round, rand);
    setRound(qs); setI(0); setRight(0); setPicked(null);
    challengeStep(c.id, 0, 0, qs.length, qs.map((q) => q.id));
  }

  function choose(key: string) {
    if (picked || p.hearts === 0) return;
    const ok = key === round[i].answer;
    setPicked(key);
    answer(ok);
    const r = right + (ok ? 1 : 0);
    setRight(r);
    challengeStep(c.id, i + 1, r, round.length, round.map((q) => q.id));
    if (i + 1 === round.length) challengeFinish(c.id, r, round.length);
  }

  const head = (
    <header className="player-head">
      <Link href="/academy/challenges" className="btn outline small"><ArrowLeft size={16} /> All challenges</Link>
      <span className="chip" style={{ "--c": w.color } as React.CSSProperties}><w.icon size={16} /> {w.id[0].toUpperCase() + w.id.slice(1)} · {c.kind}</span>
    </header>
  );

  if (!round.length) {
    return (
      <div className="lesson-player">
        <section className="glass lp-card">
          {head}
          <div className="player-title">
            <Image src={c.image} alt="" width={160} height={100} className="player-img" />
            <div><h1>{c.title}</h1><p>{c.summary}</p><small>{c.source}</small></div>
          </div>
          <ul className="rules">
            <li><Check size={18} /> {c.round} questions{c.kind === "daily" ? " — the same set for everyone today" : ", drawn from " + c.pool.length}</li>
            <li><Sparkles size={18} /> +{XP.correctAnswer} XP per correct answer · +{XP.perfectChallenge} XP for your first perfect round</li>
            <li><Heart size={18} /> A wrong answer costs one heart · score {PASS * 100}% to complete</li>
          </ul>
          {saved?.plays ? <p className="sub left">Best so far: {Math.round(saved.best * 100)}% · played {saved.plays} time{saved.plays === 1 ? "" : "s"}</p> : null}
          <div className="row-btns">
            {resumable && <button className="btn teal" onClick={() => start(true)}>Continue · {saved.at}/{saved.total} <ArrowRight size={20} /></button>}
            <button className={`btn ${resumable ? "outline" : "teal"}`} onClick={() => start()} disabled={p.hearts === 0}>{resumable ? "Start over" : "Start Challenge"} <ArrowRight size={20} /></button>
          </div>
          {p.hearts === 0 && <p className="sub left">Out of hearts. <Link href="/academy/lessons">Complete a lesson</Link> to refill them.</p>}
        </section>
      </div>
    );
  }

  if (i >= round.length) {
    const passed = right / round.length >= PASS;
    return (
      <div className="lesson-player">
        <section className="glass lp-card result-card">
          {head}
          <p className="score">{right} / {round.length}</p>
          <p className="result-line">{right === round.length ? "Perfect round!" : passed ? "Challenge completed." : `Score ${PASS * 100}% to complete — every answer shows its source.`}</p>
          <div className="row-btns center">
            <button className="btn teal" onClick={() => start()} disabled={p.hearts === 0}><RotateCcw size={18} /> Play again</button>
            <Link href={`/academy/challenges/${next.id}`} className="btn outline">Next: {next.title} <ArrowRight size={18} /></Link>
          </div>
        </section>
      </div>
    );
  }

  const q = round[i];
  return (
    <div className="lesson-player">
      <section className="glass lp-card">
        {head}
        <div className="quiz-top">
          <span>{c.title} · Question {i + 1} of {round.length}</span>
          <span className="hearts" aria-label={`${p.hearts} hearts`}>{Array.from({ length: 5 }, (_, k) => <Heart key={k} size={18} className={k < p.hearts ? "full" : ""} />)}</span>
        </div>
        <div className="player-progress"><ol>{round.map((_, k) => <li key={k}><span className={`seg ${k < i ? "seen" : k === i ? "on" : ""}`} /></li>)}</ol></div>

        <article key={q.id} className="question swap">
          <p className="ask">{q.prompt}</p>
          {q.passage && (
            <div className="verse">
              <header><span>{q.passage.cite}</span></header>
              <blockquote lang="ta">{q.passage.lines.map((l, k) => <p key={k}>{l}</p>)}</blockquote>
              {q.passage.english && <p className="verse-en">{q.passage.english.replace(/…+|\.{3,}/g, "").replace(/\s+/g, " ")}</p>}
            </div>
          )}
          <div className="options">
            {q.options.map((o) => {
              const state = !picked ? "" : o.key === q.answer ? "right" : o.key === picked ? "wrong" : "dim";
              return (
                <button key={o.key} className={`option ${state}`} onClick={() => choose(o.key)} disabled={!!picked}>
                  <b lang={o.ta ? "ta" : undefined}>{o.label}</b>{o.sub && <small>{o.sub}</small>}
                  {state === "right" && <Check size={18} />}{state === "wrong" && <X size={18} />}
                </button>
              );
            })}
          </div>
          {picked && (
            <div className={`feedback ${picked === q.answer ? "ok" : "no"}`}>
              <p><b>{picked === q.answer ? `Correct · +${XP.correctAnswer} XP` : "Not quite"}</b> — {q.explain}</p>
              <div>
                {q.passage && (q.passage.href.startsWith("/")
                  ? <Link href={q.passage.href} className="btn outline small" onClick={() => openSource(q.passage!.cite)}>Source</Link>
                  : <a href={q.passage.href} target="_blank" rel="noreferrer" className="btn outline small" onClick={() => openSource(q.passage!.cite)}>Source <ExternalLink size={14} /></a>)}
                <button className="btn teal small" onClick={() => { setI(i + 1); setPicked(null); }}>{i + 1 === round.length ? "See results" : "Next"} <ArrowRight size={18} /></button>
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
