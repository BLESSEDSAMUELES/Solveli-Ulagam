"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, RotateCcw } from "lucide-react";
import { completeLesson, openSource, progress, reachStep, XP } from "@/lib/progress";
import { WORLDS } from "@/lib/worlds";
import { ExploreLine } from "@/components/academy/ui";

type Step = { ta: string; en: string; note: string; verse?: { id: string; text: string; textTa: string; number: string; lines: string[]; english: string | null; url: string } };
type Lesson = { id: string; world: string; title: string; summary: string; level: string; image: string; source: string; steps: Step[] };

export default function LessonPlayer({ lesson: l, next }: { lesson: Lesson; next?: { id: string; title: string } }) {
  const p = progress.use();
  const [i, setI] = useState(0);
  const w = WORLDS.find((x) => x.id === l.world)!;
  const n = l.steps.length;
  const saved = p.steps[l.id] ?? 0;
  const complete = p.lessons.includes(l.id);
  const onLast = i === n - 1;

  // Record how far the learner has read, so the hub can offer "continue".
  useEffect(() => { reachStep(l.id, i + 1); }, [l.id, i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (e.key === "ArrowRight") setI((x) => Math.min(n - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [n]);

  const s = l.steps[i];
  return (
    <div className="lesson-player">
      <section className="glass lp-card">
        <header className="player-head">
          <Link href="/academy/lessons" className="btn outline small"><ArrowLeft size={16} /> All lessons</Link>
          <span className="chip" style={{ "--c": w.color } as React.CSSProperties}><w.icon size={16} /> {w.id[0].toUpperCase() + w.id.slice(1)} · {l.level}</span>
        </header>
        <div className="player-title">
          <Image src={l.image} alt="" width={160} height={100} className="player-img" />
          <div>
            <h1>{l.title}</h1>
            <p>{l.summary}</p>
            <small>{l.source}</small>
          </div>
        </div>

        <div className="player-progress" aria-label={`Step ${i + 1} of ${n}`}>
          <ol>{l.steps.map((_, k) => (
            <li key={k}><button className={k === i ? "on" : k < Math.max(saved, i + 1) ? "seen" : ""} onClick={() => setI(k)} aria-label={`Go to step ${k + 1}`} /></li>
          ))}</ol>
          <small>Step {i + 1} of {n}</small>
        </div>

        {i === 0 && saved > 1 && !complete && (
          <button className="resume" onClick={() => setI(Math.min(saved - 1, n - 1))}><RotateCcw size={16} /> Resume at step {Math.min(saved, n)}</button>
        )}

        <article key={i} className="step swap">
          <p className="step-ta" lang="ta">{s.ta}</p>
          <p className="step-en">{s.en}</p>
          {s.note && <p className="step-note">{s.note}</p>}
          {s.verse && (
            <div className="verse">
              <header><b lang="ta">{s.verse.textTa}</b> <span>{s.verse.text} {s.verse.number}</span></header>
              <blockquote lang="ta">{s.verse.lines.slice(0, 8).map((line, k) => <p key={k}><ExploreLine line={line} ctx={s.verse!.id} /></p>)}</blockquote>
              {s.verse.english && <p className="verse-en full">{s.verse.english.replace(/…+|\.{3,}/g, "").replace(/\s+/g, " ")}</p>}
              <footer>
                <span>{s.verse.id}</span>
                <a href={s.verse.url} target="_blank" rel="noreferrer" onClick={() => openSource(s.verse!.id)}>
                  {p.sources.includes(s.verse.id) ? "Source opened" : `Open source · +${XP.readOccurrence} XP`} <ExternalLink size={14} />
                </a>
              </footer>
            </div>
          )}
        </article>

        <nav className="step-nav">
          <button className="btn outline" onClick={() => setI(i - 1)} disabled={i === 0}><ArrowLeft size={20} /> Previous</button>
          {!onLast && <button className="btn teal" onClick={() => setI(i + 1)}>Next <ArrowRight size={20} /></button>}
          {onLast && !complete && <button className="btn teal" onClick={() => completeLesson(l.id)}>Complete lesson · +{XP.completeLesson} XP <Check size={20} /></button>}
          {onLast && complete && (next
            ? <Link href={`/academy/lessons/${next.id}`} className="btn teal">Next: {next.title} <ArrowRight size={20} /></Link>
            : <Link href="/academy/challenges" className="btn teal">Try a challenge <ArrowRight size={20} /></Link>)}
        </nav>
        {onLast && complete && <p className="done-note"><Check size={16} /> Lesson complete — hearts refilled.</p>}
      </section>
    </div>
  );
}
