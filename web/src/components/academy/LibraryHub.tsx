"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight, BookMarked, Bookmark, BookOpen, Feather, FileText, Gamepad2, Landmark, Languages, Library, MessageSquareQuote, Scroll, Search, Type,
} from "lucide-react";
import { createStore } from "@/lib/store";
import { progress } from "@/lib/progress";
import { useT } from "@/lib/i18n";
import { WORLDS } from "@/lib/worlds";
import { CountUp } from "@/components/academy/ui";
import { ONBOARDING_ANIMATIONS } from "@/lib/onboarding-art";
import type { LibraryText } from "@/lib/corpus";

// Bookmarks are per browser, like guest progress, until accounts exist.
const shelf = createStore<{ saved: string[] }>("solveli.library", { saved: [] });

const TABS: { id: string; label: string; icon: typeof Library }[] = [
  { id: "literature", label: "All Collections", icon: Library }, { id: "poetry", label: "Poetry", icon: Feather },
  { id: "philosophy", label: "Philosophy", icon: Scroll }, { id: "history", label: "History", icon: Landmark },
  { id: "grammar", label: "Grammar", icon: BookOpen }, { id: "culture", label: "Art & Culture", icon: MessageSquareQuote },
  { id: "inscriptions", label: "Inscriptions", icon: FileText }, { id: "saved", label: "Saved", icon: BookMarked },
];
const UNAVAILABLE: Record<string, string> = {
  culture: "Art, music and cultural archives are not in Solveli's corpus yet — nothing here would be citable.",
  inscriptions: "Epigraphic sources (inscriptions) are not in the corpus yet. When they are, each will carry its reference like every verse.",
};
const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
const fmt = (n: number) => n.toLocaleString("en-IN");
const graphemes = new Intl.Segmenter("ta", { granularity: "grapheme" });
const initials = (s: string) => Array.from(graphemes.segment(s), (g) => g.segment).slice(0, 2).join(""); // whole letters, not code points

type Props = {
  texts: LibraryText[]; kinds: Record<string, string[]>; stats: Record<string, number>;
  counts: Record<string, string>; lessons: number; challenges: number;
  today: { number: number; lines: string[]; translation: string; chapter: string };
};

export default function LibraryHub({ texts, kinds, stats, counts, lessons, challenges, today }: Props) {
  const { t } = useT();
  const p = progress.use();
  const { saved } = shelf.use();
  const [tab, setTab] = useState("literature");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const layers = kinds[tab];
    return texts
      .filter((x) => (tab === "saved" ? saved.includes(x.slug) : tab === "literature" || layers?.includes(x.layer)))
      .filter((x) => !s || `${x.name} ${x.ta} ${x.description} ${x.layer} ${x.period}`.toLowerCase().includes(s));
  }, [texts, kinds, tab, q, saved]);
  const empty = tab !== "saved" && tab !== "literature" && !kinds[tab]?.length;
  const recent = [...p.log].reverse().filter((a) => a.kind === "source").slice(0, 3);
  const toggle = (slug: string) => shelf.set((s) => ({ saved: s.saved.includes(slug) ? s.saved.filter((x) => x !== slug) : [...s.saved, slug] }));

  const types = [
    { icon: BookOpen, label: "Texts & Books", sub: `${fmt(stats.texts)} works`, href: "#all-works" },
    { icon: Feather, label: "Poems & Verses", sub: `${fmt(stats.verses)} verses`, href: "/academy/worlds/sangam" },
    { icon: MessageSquareQuote, label: "Commentaries", sub: `${fmt(stats.commentaries)} kural uraigal`, href: "/academy/thirukkural/1" },
    { icon: Languages, label: "Translations", sub: `${fmt(stats.translations)} with English`, href: "/academy/library/kuruntokai" },
    { icon: Type, label: "Word Senses", sub: `${fmt(stats.senses)} IndoWordNet synsets`, href: "/academy/search" },
    { icon: Gamepad2, label: "Interactive", sub: `${lessons} lessons · ${challenges} challenges`, href: "/academy/lessons" },
  ];

  return (
    <div className="lessons-page library-page">
      <div className="lp-main">
        <header className="lp-head">
          <div className="a-in" style={d(100)}>
            <h1>{t("library")}</h1>
            <p className="lp-motto">Ancient wisdom. Timeless knowledge. Always with you.</p>
          </div>
          <Link href={`/academy/thirukkural/${today.number}`} className="lp-quote glass a-in" style={d(250)}>
            <p lang="ta">“{today.lines[0]}<br />{today.lines[1]}”</p>
            <cite>— Tirukkuṟaḷ {today.number}</cite>
          </Link>
        </header>

        <nav className="lp-tabs glass a-in" style={d(350)} aria-label="Library collections">
          {TABS.map((x) => {
            const n = x.id === "saved" ? saved.length : x.id === "literature" ? texts.length : texts.filter((y) => kinds[x.id]?.includes(y.layer)).length;
            return (
              <button key={x.id} className={tab === x.id ? "on" : ""} aria-pressed={tab === x.id} onClick={() => setTab(x.id)}>
                <x.icon size={18} /> {x.label} <small>{n}</small>
              </button>
            );
          })}
        </nav>

        {tab === "literature" && !q && (
          <>
            <section className="lib-banner glass a-in" style={d(420)}>
              <Image src="/challenges/scroll.webp" alt="" fill sizes="(min-width: 1080px) 60vw, 100vw" className="lib-banner-img" />
              <blockquote>“A library is a bridge between generations.” <cite>— Solveli</cite></blockquote>
              <p>Original texts, modern explanations and interactive learning — every line with its source.</p>
            </section>

            <section className="lp-section glass a-in" style={d(480)}>
              <header><div><h2>Featured Collections</h2><p>One collection per world of Tamil literature.</p></div>
                <Link href="/academy/worlds" className="link-btn">All worlds <ArrowRight size={16} /></Link></header>
              <ul className="paths lib-collections">
                {WORLDS.map((w, i) => (
                  <li key={w.id} className="lesson-card-wrap" style={d(i * 70)}>
                    <Link href={`/academy/worlds/${w.id}`} className="path" style={{ "--c": w.color } as React.CSSProperties}>
                      <Image src={`/worlds/${w.id}.webp`} alt="" fill sizes="220px" className="path-img" />
                      <span className="path-body">
                        <b><w.icon size={16} /> {t(w.key).replace(/ World$/, "").replace(/ உலகம்$/, "")}</b>
                        <small>{w.sub}</small>
                        <small>{counts[w.id]}</small>
                      </span>
                      <span className="path-go"><ArrowRight size={16} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="lp-section glass a-in" style={d(540)}>
              <header><div><h2>Browse by Type</h2><p>Counted from the data — nothing estimated.</p></div></header>
              <ul className="lib-types">
                {types.map((x) => (
                  <li key={x.label}><Link href={x.href}><x.icon size={26} strokeWidth={1.5} /><span><b>{x.label}</b><small>{x.sub}</small></span></Link></li>
                ))}
              </ul>
            </section>
          </>
        )}

        <section id="all-works" className="lp-section glass a-in" style={d(600)}>
          <header>
            <div><h2>{tab === "literature" ? "All Works" : TABS.find((x) => x.id === tab)!.label}</h2>
              <p>{list.length} work{list.length === 1 ? "" : "s"} · open one to read it line by line</p></div>
            <label className="lp-search"><Search size={16} aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search books, authors, periods…" aria-label="Search the library" />
            </label>
          </header>
          {empty ? (
            <div className="empty"><p>Not available yet</p><p className="sub">{UNAVAILABLE[tab]}</p></div>
          ) : !list.length ? (
            <div className="empty">
              <p>{tab === "saved" && !q ? "No saved works yet" : `Nothing matches “${q}”`}</p>
              <p className="sub">{tab === "saved" && !q ? "Tap the bookmark on any work to keep it here." : "Try a Tamil or English title, a period, or a layer like Sangam."}</p>
            </div>
          ) : (
            <ul className="lib-works">
              {list.map((x, i) => {
                const on = saved.includes(x.slug);
                return (
                  <li key={x.slug} className="lesson-card-wrap" style={d(i * 50)}>
                    <Link href={`/academy/library/${x.slug}`} className="lib-work">
                      <span className="lw-cover" lang="ta" style={{ "--c": WORLDS.find((w) => w.id === x.world)?.color } as React.CSSProperties}>{initials(x.ta)}</span>
                      <span className="lw-body">
                        <b>{x.name}</b>
                        <span lang="ta">{x.ta}</span>
                        <small>{x.layer} · {x.period}</small>
                        <small>{fmt(x.count)} {x.unit}</small>
                      </span>
                    </Link>
                    <button className={`lw-save ${on ? "on" : ""}`} onClick={() => toggle(x.slug)} aria-pressed={on} aria-label={on ? `Remove ${x.name} from saved` : `Save ${x.name}`}>
                      <Bookmark size={17} fill={on ? "currentColor" : "none"} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lp-section glass a-in" style={d(660)}>
          <header><div><h2>Sources & Credits</h2><p>Where every text in the library comes from.</p></div></header>
          <ul className="credits">
            <li><a href="https://github.com/indic-corpora/sentamizh-corpus" target="_blank" rel="noreferrer">Sentamizh Corpus</a> — annotated classical verses (Apache-2.0).</li>
            <li><a href="https://www.projectmadurai.org/" target="_blank" rel="noreferrer">Project Madurai</a> — source editions, including Tolkāppiyam.</li>
            <li><a href="https://sangamtranslationsbyvaidehi.com/" target="_blank" rel="noreferrer">Vaidehi Herbert</a> — Kuṟuntokai and Naṟṟiṇai translations.</li>
            <li><a href="https://www.cfilt.iitb.ac.in/indowordnet/" target="_blank" rel="noreferrer">IndoWordNet</a> (IIT Bombay) — Tamil senses and relations.</li>
            <li><a href="https://github.com/goru001/nlp-for-tanglish" target="_blank" rel="noreferrer">nlp-for-tanglish</a> (MIT, © 2020 Gaurav Arora) — Tanglish search vocabulary.</li>
            <li>Onboarding illustrations from <a href="https://lottiefiles.com/page/license" target="_blank" rel="noreferrer">LottieFiles</a> (Lottie Simple License) by{" "}
              {Object.values({ ...ONBOARDING_ANIMATIONS.role, ...ONBOARDING_ANIMATIONS.level }).map((x, i, all) => (
                <span key={x.src}><a href={x.url} target="_blank" rel="noreferrer">{x.author}</a>{i < all.length - 1 ? ", " : "."}</span>
              ))}</li>
          </ul>
        </section>
      </div>

      <aside className="lp-side">
        <section className="glass lib-today a-in" style={d(300)}>
          <header><h2>Kural of the Day</h2><small>{today.chapter}</small></header>
          <Link href={`/academy/thirukkural/${today.number}`} className="lib-today-body">
            <p lang="ta">{today.lines.join(" ")}</p>
            {today.translation && <p className="sub">{today.translation}</p>}
          </Link>
          <Link href={`/academy/thirukkural/${today.number}`} className="btn small enter-world">Read Kural {today.number} <ArrowRight size={16} /></Link>
        </section>

        <section className="glass journey a-in" style={d(420)}>
          <header><h2>Library Stats</h2></header>
          <ul className="lib-stats">
            <li><BookOpen size={22} /><b><CountUp to={stats.texts} /></b>Works</li>
            <li><Feather size={22} /><b><CountUp to={stats.verses} /></b>Verses & kurals</li>
            <li><Scroll size={22} /><b><CountUp to={stats.poets} /></b>Named poets</li>
            <li><Languages size={22} /><b><CountUp to={stats.translations} /></b>Translated</li>
          </ul>
        </section>

        <section className="glass suggestion a-in" style={d(520)}>
          <h2><BookMarked size={18} /> Continue Reading</h2>
          {recent.length ? (
            <ul className="lib-recent">{recent.map((a) => <li key={a.at}><Link href={a.href ?? "#"}>{a.label.replace("Opened source ", "")}<small>{new Date(a.at).toLocaleDateString()}</small></Link></li>)}</ul>
          ) : <p className="sub">Sources you open appear here. <Link href={`/academy/thirukkural/${today.number}`}>Start with today&apos;s kural →</Link></p>}
        </section>
      </aside>
    </div>
  );
}
