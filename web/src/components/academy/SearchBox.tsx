"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { character } from "@/lib/characters";
import { BookOpen, Compass, FileText, Hash, Library, Loader2, MessagesSquare, Scroll, Search, Trophy, Type, Users } from "lucide-react";

type Hit = { kind: string; group: string; title: string; subtitle: string; href: string; snippet: string; meta?: string };
const ICON: Record<string, typeof Search> = {
  kural: Scroll, chapter: Hash, verse: FileText, word: Type, lesson: BookOpen, challenge: Trophy, world: Compass, guide: Users, library: Library, community: MessagesSquare, page: Library,
};

// Highlight every query term inside a string (case-insensitive for Latin, exact for Tamil).
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const ts = terms.filter((t) => t.length > 0).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!ts.length || !text) return <>{text}</>;
  const re = new RegExp(`(${ts.join("|")})`, "gi");
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>;
}

export default function SearchBox({ placeholder, big = false, initial = "" }: { placeholder: string; big?: boolean; initial?: string }) {
  const router = useRouter();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Hit[]>([]);
  const [terms, setTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState("");
  const [tanglish, setTanglish] = useState<{ input: string; tamil: string[] }[]>([]);

  // Debounced fetch; an AbortController drops responses for stale keystrokes.
  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=9`, { signal: ctl.signal });
        const data = await r.json();
        setHits(data.hits); setTerms(data.terms); setTanglish(data.tanglish ?? []); setActive(-1); setSearched(query);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setHits([]);
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener("pointerdown", close);
    return () => removeEventListener("pointerdown", close);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }
  function submit() {
    const query = q.trim();
    if (!query) return;
    if (active >= 0 && hits[active]) return go(hits[active].href);
    go(`/academy/search?q=${encodeURIComponent(query)}`);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(hits.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === "Escape") { setOpen(false); setActive(-1); }
  }

  const query = q.trim();
  const show = open && query.length > 0;
  return (
    <div ref={box} className={`searchbox ${big ? "big" : ""} ${show ? "open" : ""}`}>
      <form className={`search ${big ? "big" : "small"}`} role="search" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {loading ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder={placeholder} aria-label="Search Solveli" role="combobox" aria-expanded={show} aria-controls={`${id}-list`}
          aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} aria-autocomplete="list" autoComplete="off" spellCheck={false}
        />
        {big && <button className="btn teal small">Search</button>}
      </form>
      {show && (
        <div className="suggest-pop" id={`${id}-list`} role="listbox">
          {loading && searched !== query && !hits.length && <p className="sp-state">Searching…</p>}
          {searched === query && tanglish.length > 0 && (
            <p className="sp-tanglish">
              <span>Tanglish</span>
              {tanglish.map((m) => <b key={m.input}>{m.input} → <span lang="ta">{m.tamil.slice(0, 2).join(" / ")}</span></b>)}
            </p>
          )}
          {!loading && searched === query && !hits.length && <p className="sp-state">No results for “{query}”. Try a Tamil word, Tanglish (anbu, kalvi), a kural number, or an English keyword.</p>}
          {hits.map((h, i) => {
            const Icon = ICON[h.kind] ?? Search;
            const header = i === 0 || hits[i - 1].group !== h.group ? h.group : null;
            return (
              <div key={`${h.href}-${i}`}>
                {header && <p className="sp-group">{header}</p>}
                <button type="button" id={`${id}-${i}`} role="option" aria-selected={active === i} className={`sp-item ${active === i ? "on" : ""}`}
                  onMouseEnter={() => setActive(i)} onClick={() => go(h.href)}>
                  <span className="sp-icon">{(() => { const c = h.kind === "guide" ? character(new URLSearchParams(h.href.split("?")[1] ?? "").get("g") ?? "") : undefined; return c ? <Image src={c.face} alt="" width={28} height={28} className="sp-face" /> : <Icon size={16} />; })()}</span>
                  <span className="sp-text">
                    <b><Highlight text={h.title} terms={terms} /></b>
                    <small><Highlight text={h.snippet || h.subtitle} terms={terms} /></small>
                  </span>
                  {h.meta && <span className="sp-meta">{h.meta}</span>}
                </button>
              </div>
            );
          })}
          {hits.length > 0 && (
            <button type="button" className="sp-all" onClick={() => go(`/academy/search?q=${encodeURIComponent(query)}`)}>
              See all results for “{query}” <kbd>Enter</kbd>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
