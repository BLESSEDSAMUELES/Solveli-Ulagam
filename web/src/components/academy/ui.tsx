"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n";
import { enterWorld, openSource, progress } from "@/lib/progress";
import { WORLDS } from "@/lib/worlds";
import { onEnterWorldClick } from "@/components/academy/WorldIntro";

type World = (typeof WORLDS)[number];

export function WorldCard({ world: w, name, evidence }: { world: World; name: string; evidence?: string }) {
  return (
    <Link href={`/academy/worlds/${w.id}`} onClick={onEnterWorldClick(w.id)} className="world-card" style={{ "--c": w.color } as React.CSSProperties}>
      <span className="world-img-wrap">
        <Image src={`/worlds/${w.id}.webp`} alt="" width={440} height={280} className="world-img" />
      </span>
      <span className="world-badge"><w.icon size={24} /></span>
      <b key={name} className="swap">{name}</b>
      <span className="world-sub">{w.sub}</span>
      <span className="world-foot">
        <small>{evidence}</small>
        <span className="go" aria-hidden="true"><ArrowRight size={16} /></span>
      </span>
    </Link>
  );
}

export function WorldGrid({ counts, delay = 450 }: { counts: Record<string, string>; delay?: number }) {
  const { t } = useT();
  return (
    <ul className="worlds">
      {WORLDS.map((w, i) => (
        <li key={w.id} className="a-in" style={{ "--d": `${delay + i * 90}ms` } as React.CSSProperties}>
          <WorldCard world={w} name={t(w.key)} evidence={counts[w.id]} />
        </li>
      ))}
    </ul>
  );
}

export function Panel({ eyebrow, title, sub, children, wide = false }: { eyebrow?: string; title: string; sub?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`panel paper ${wide ? "wide" : ""}`}>
      <header className="panel-head">
        {eyebrow && <p className="eyebrow dark">{eyebrow}</p>}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </header>
      {children}
    </section>
  );
}

export type VerseView = {
  id: string; text: string; textTa: string; period: string; number: string; lines: string[];
  english: string | null; url: string; highlight?: string; lineNo?: number; author?: string;
};

// An occurrence card: exact passage, work, period, reference and a link to the source (doc §12).
export function VerseCard({ v, word, full = false }: { v: VerseView; word?: string; full?: boolean }) {
  const opened = progress.use().sources.includes(v.id);
  const lines = full ? v.lines : v.lineNo ? v.lines.slice(Math.max(0, v.lineNo - 2), v.lineNo + 1) : v.lines.slice(0, 6);
  const internal = v.url.startsWith("/"); // kurals link to their own page
  const label = <>{opened ? "Source opened" : "Open source · +10 XP"} {!internal && <ExternalLink size={14} />}</>;
  return (
    <article className="verse reveal">
      <header>
        <b lang="ta">{v.textTa}</b> <span>{v.text} {v.number}</span>
        <small>{v.period}{v.author ? ` · ${v.author}` : ""}</small>
      </header>
      <blockquote lang="ta">
        {lines.map((l, i) => <p key={i}><ExploreLine line={l} ctx={v.id} word={word} /></p>)}
        {!full && !v.lineNo && v.lines.length > 6 && <p className="more">…</p>}
      </blockquote>
      {v.english && <p className={`verse-en ${full ? "full" : ""}`}>{v.english.split("\n").slice(0, full ? undefined : 5).join(" ").replace(/…+|\.{3,}/g, "").replace(/\s+/g, " ")}</p>}
      <footer>
        <span>{v.id}{v.lineNo ? ` · line ${v.lineNo}` : ""}</span>
        {!v.url ? <span>No source link</span> : internal
          ? <Link href={v.url} onClick={() => openSource(v.id, word)} className={opened ? "opened" : ""}>{label}</Link>
          : <a href={v.url} target="_blank" rel="noreferrer" onClick={() => openSource(v.id, word)} className={opened ? "opened" : ""}>{label}</a>}
      </footer>
    </article>
  );
}

// Records "entered a world" for progress (once per world per day). Renders nothing.
export function VisitWorld({ id, title }: { id: string; title: string }) {
  useEffect(() => enterWorld(id, title), [id, title]);
  return null;
}

// Animated number: counts up from 0 on mount (skipped under prefers-reduced-motion). Renders the final value on the server.
const fmtIN = (n: number) => n.toLocaleString("en-IN"); // stable default, so the effect does not restart on re-render
export function CountUp({ to, ms = 1100, format = fmtIN }: { to: number; ms?: number; format?: (n: number) => string }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node || !to || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      node.textContent = format(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, format]);
  return <span ref={el}>{format(to)}</span>;
}

// Reading Chamber: every Tamil word in a passage opens the word view with this passage as its context.
export function ExploreLine({ line, ctx, word }: { line: string; ctx: string; word?: string }) {
  return <>{line.split(/(\s+)/).map((w, i) => {
    const clean = w.replace(/[^஀-௿]/g, "");
    if (!clean) return w;
    const href = `/academy/search?q=${encodeURIComponent(clean)}&ctx=${encodeURIComponent(ctx)}`;
    return <Link key={i} className="explore" href={href} title="Explore this word">{word && w.includes(word) ? mark(w, word) : w}</Link>;
  })}</>;
}

function mark(line: string, word: string) {
  const i = line.indexOf(word);
  if (i < 0) return line;
  return <>{line.slice(0, i)}<mark>{word}</mark>{line.slice(i + word.length)}</>;
}
