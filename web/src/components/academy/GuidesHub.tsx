"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, Feather, Landmark, Library, Quote, Scroll, Search, Sparkles, Trophy, Users } from "lucide-react";
import { GUIDE_CATEGORIES } from "@/lib/guides";
import { profile } from "@/lib/profile";
import { ExploreLine } from "@/components/academy/ui";
import type { GuideProfile } from "@/lib/corpus";
import { character } from "@/lib/characters";

const ICON: Record<string, typeof Users> = { sangam: Feather, philosophers: Scroll, bhakti: Sparkles, grammarians: BookOpen, epic: Landmark, modern: Library };
const DETAIL_TABS = ["Overview", "Works", "Key Teachings", "Related Lessons"] as const;
const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export default function GuidesHub({ guides, initial, quote }: { guides: GuideProfile[]; initial?: string; quote?: { lines: string[]; cite: string; href: string } }) {
  const me = profile.use();
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<"era" | "name">("era");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(guides.find((g) => g.id === initial)?.id ?? me.guide ?? guides[0].id);
  const [tab, setTab] = useState<(typeof DETAIL_TABS)[number]>("Overview");
  const detail = useRef<HTMLElement>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return guides
      .filter((g) => cat === "all" || g.category === cat)
      .filter((g) => !t || `${g.name} ${g.ta} ${g.tags.join(" ")} ${g.era} ${g.works.map((w) => `${w.title} ${w.ta ?? ""}`).join(" ")}`.toLowerCase().includes(t))
      .sort((a, b) => (sort === "era" ? a.order - b.order : a.name.localeCompare(b.name)));
  }, [guides, cat, sort, q]);
  const g = guides.find((x) => x.id === sel) ?? guides[0];

  function open(id: string) {
    setSel(id);
    setTab("Overview");
    history.replaceState(null, "", `/academy/guides?g=${id}`); // shareable, and what global search links to
    if (matchMedia("(max-width: 1080px)").matches) detail.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="lessons-page guides-page">
      <div className="lp-main">
        <header className="lp-head">
          <div className="a-in" style={d(100)}>
            <h1>Guides</h1>
            <p className="lp-motto">Meet the minds behind a timeless civilisation.</p>
          </div>
          {quote && (
            <Link href={quote.href} className="lp-quote glass a-in" style={d(250)}>
              <p lang="ta">“{quote.lines[0]}<br />{quote.lines[1]}”</p>
              <cite>— {quote.cite}</cite>
            </Link>
          )}
        </header>

        <nav className="lp-tabs glass a-in" style={d(350)} aria-label="Guide categories">
          <button className={cat === "all" ? "on" : ""} aria-pressed={cat === "all"} onClick={() => setCat("all")}><Users size={18} /> All Guides <small>{guides.length}</small></button>
          {GUIDE_CATEGORIES.map((c) => {
            const Icon = ICON[c.id];
            const n = guides.filter((x) => x.category === c.id).length;
            return n ? (
              <button key={c.id} className={cat === c.id ? "on" : ""} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                <Icon size={18} /> {c.label} <small>{n}</small>
              </button>
            ) : null;
          })}
        </nav>

        <section className="lp-section glass a-in" style={d(450)}>
          <header>
            <div><h2>Our Guides</h2><p>Learn from the minds who shaped Tamil thought — every line shown is cited.</p></div>
            <div className="gd-tools">
              <label className="lp-search"><Search size={16} aria-hidden="true" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guides, works, tags…" aria-label="Search guides" />
              </label>
              <label className="gd-sort">Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value as "era" | "name")}><option value="era">Era</option><option value="name">Name</option></select>
              </label>
            </div>
          </header>
          {list.length === 0 ? (
            <div className="empty"><p>No guide matches “{q}”.</p><button className="btn outline small" onClick={() => { setQ(""); setCat("all"); }}>Show all guides</button></div>
          ) : (
            <ul className="guide-grid">
              {list.map((x, i) => (
                <li key={x.id} className="lesson-card-wrap" style={d(i * 60)}>
                  <button className={`guide-card ${x.id === g.id ? "on" : ""}`} onClick={() => open(x.id)} aria-pressed={x.id === g.id}>
                    <span className="lc-img"><CardArt guide={x} /></span>
                    <b>{x.name}</b>
                    <span className="gc-ta" lang="ta">{x.ta}</span>
                    <small>{x.era}</small>
                    <span className="gc-tags">{x.tags.join(" · ")}</span>
                    {x.teachings[0] && <span className="gc-line" lang="ta">“{x.teachings[0].lines[0]}”</span>}
                    <span className="btn small gc-go">View Guide <ArrowRight size={15} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="lp-side">
        <section ref={detail} className="glass guide-detail a-in" style={d(300)} aria-live="polite">
          <div key={g.id} className="gd-swap">
            <div className={`gd-hero ${character(g.id) ? "has-portrait" : ""}`}>
              {character(g.id)
                ? <Image src={character(g.id)!.portrait} alt={character(g.id)!.alt} fill sizes="340px" className="gd-img portrait-crop" style={{ objectPosition: character(g.id)!.bust }} />
                : <><Image src={g.image} alt="" fill sizes="340px" className="gd-img" /><span className="gc-glyph big" lang="ta">{g.glyph}</span></>}
              <div className="gd-hero-copy">
                <h2>{g.name}</h2>
                <p lang="ta">{g.ta}</p>
                <p>{g.era}</p>
                <ul className="gd-tags">{g.tags.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            </div>
            <nav className="lp-tabs mini" role="tablist" aria-label={`${g.name} details`}>
              {DETAIL_TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}
            </nav>
            <div key={tab} className="gd-body swap" role="tabpanel">
              {tab === "Overview" && (
                <>
                  <p>{g.bio}</p>
                  {g.teachings[0] && <Teaching t={g.teachings[0]} />}
                  {g.note && <p className="fine">{g.note}</p>}
                </>
              )}
              {tab === "Works" && (g.works.length
                ? <ul className="gd-list">{g.works.map((w) => <li key={w.title}><Link href={w.href}><b>{w.title}</b>{w.ta && <span lang="ta"> · {w.ta}</span>}<small>{w.count}</small></Link></li>)}</ul>
                : <p className="sub">{g.note ?? "No works in the corpus yet."}</p>)}
              {tab === "Key Teachings" && (g.teachings.length ? g.teachings.map((t) => <Teaching key={t.cite} t={t} />) : <p className="sub">No verified lines yet.</p>)}
              {tab === "Related Lessons" && (g.lessons.length || g.challenges.length ? (
                <ul className="gd-list">
                  {g.lessons.map((l) => <li key={l.id}><Link href={`/academy/lessons/${l.id}`}><BookOpen size={15} /> <b>{l.title}</b></Link></li>)}
                  {g.challenges.map((c) => <li key={c.id}><Link href={`/academy/challenges/${c.id}`}><Trophy size={15} /> <b>{c.title}</b><small>Challenge</small></Link></li>)}
                </ul>
              ) : <p className="sub">No lessons for this guide&apos;s world yet.</p>)}
            </div>
            <ul className="jstats four">{g.stats.map((s) => <li key={s.label}><b>{s.value}</b>{s.label}</li>)}</ul>
            <Link href={`/academy/worlds/${g.world}`} className="btn small enter-world">Start learning with {g.name.split(" ")[0]} <ArrowRight size={16} /></Link>
            <button className="btn outline small gd-pick" disabled={me.guide === g.id} onClick={() => profile.set((p) => ({ ...p, guide: g.id }))}>
              {me.guide === g.id ? <>Your guide <Check size={15} /></> : "Walk with this guide"}
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

// Guide card art: the guide's portrait (head and shoulders) when artwork exists, else their world scene + glyph.
function CardArt({ guide: g }: { guide: GuideProfile }) {
  const c = character(g.id);
  return c
    ? <Image src={c.portrait} alt={c.alt} width={420} height={240} sizes="(max-width: 640px) 50vw, 240px" className="portrait-crop" style={{ objectPosition: c.bust }} />
    : <><Image src={g.image} alt="" width={420} height={240} sizes="(max-width: 640px) 50vw, 240px" /><span className="gc-glyph" lang="ta">{g.glyph}</span></>;
}

function Teaching({ t }: { t: GuideProfile["teachings"][number] }) {
  const ctx = t.href?.match(/\/verse\/(.+)$/)?.[1] ?? (t.href?.match(/\/thirukkural\/(\d+)/) ? `KURAL-${t.href.split("/").pop()}` : undefined);
  return (
    <figure className="gd-teach">
      <Quote size={18} aria-hidden="true" />
      <blockquote lang="ta">{t.lines.map((l, i) => <p key={i}>{ctx ? <ExploreLine line={l} ctx={ctx} /> : l}</p>)}</blockquote>
      <figcaption>— {t.href ? <Link href={t.href}>{t.cite}</Link> : t.cite}</figcaption>
    </figure>
  );
}
