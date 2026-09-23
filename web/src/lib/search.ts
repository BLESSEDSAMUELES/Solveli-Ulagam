// Global search over everything Solveli can show: Tirukkuṟaḷ (from datasets/Thirukkural.pdf via thirukkural.json),
// corpus verses, IndoWordNet words, and the app's own worlds, lessons, challenges, guides and pages.
// The index is built once per server process; each query is a linear scan over pre-normalised text (~12k docs).
import { challengeCatalog, englishToTamil, lemmatize, lessonCatalog, libraryCatalog, thirukkural, versesAll, wordnetLemmas } from "@/lib/corpus";
import { PROMPTS, TOPICS } from "@/lib/community";
import { GUIDE_META } from "@/lib/guides";
import { GUIDES } from "@/lib/onboarding";
import { WORLDS } from "@/lib/worlds";
import { createTanglish, type TanglishEngine, type TanglishMatch } from "@/lib/tanglish";

export type Kind = "kural" | "chapter" | "verse" | "word" | "lesson" | "challenge" | "world" | "guide" | "library" | "community" | "page";
export const KIND_LABEL: Record<Kind, string> = {
  kural: "Tirukkuṟaḷ", chapter: "Kural chapters", verse: "Verses", word: "Words", lesson: "Lessons",
  challenge: "Challenges", world: "Worlds", guide: "Guides", library: "Library", community: "Community", page: "Pages",
};

type Field = { text: string; norm: string; w: number };
type Doc = { kind: Kind; title: string; subtitle: string; href: string; fields: Field[]; boost: number; meta?: string };
export type Hit = { kind: Kind; title: string; subtitle: string; href: string; snippet: string; meta?: string; score: number };

// Lower-case Latin, strip Latin diacritics (Kuṟaḷ → kural), keep Tamil as NFC. Punctuation becomes space.
export function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC").toLowerCase()
    .replace(/[“”"'’‘.,;:!?()[\]{}<>—–\-/\\|…·]/g, " ").replace(/\s+/g, " ").trim();
}
const f = (text: string, w: number): Field => ({ text, norm: norm(text), w });

// Bump when the indexed content changes shape: a running dev server then rebuilds instead of serving the cached index.
const INDEX_VERSION = 2;
const g = globalThis as unknown as { __searchIndex?: { v?: number; docs: Doc[]; lemmas: string[]; tanglish: TanglishEngine } };
const TAMIL_WORD = /[\u0B80-\u0BFF]+/g;

function index() {
  if (g.__searchIndex?.v === INDEX_VERSION) return g.__searchIndex;
  const docs: Doc[] = [];
  const { kurals } = thirukkural();
  for (const k of kurals) {
    docs.push({
      kind: "kural", title: `Kural ${k.number}`, subtitle: `${k.chapter.en || k.chapter.ta} · ${k.chapter.ta} · ${k.book.en}`,
      href: `/academy/thirukkural/${k.number}`, boost: 1.2, meta: `அதிகாரம் ${k.chapter.number}`,
      fields: [f(k.lines.join(" "), 5), f(k.translation, 3), f(k.explanation, 2.5), f(`${k.chapter.en} ${k.chapter.ta}`, 2),
        f(`${k.commentary.kalaignar} ${k.commentary.mu_va} ${k.commentary.solomon_pappaiah}`, 1)],
    });
  }
  const chapters = new Map<number, (typeof kurals)[number]>();
  for (const k of kurals) if (!chapters.has(k.chapter.number)) chapters.set(k.chapter.number, k);
  for (const k of chapters.values()) {
    docs.push({
      kind: "chapter", title: `${k.chapter.en || k.chapter.ta}`, subtitle: `அதிகாரம் ${k.chapter.number} · ${k.chapter.ta} · ${k.book.en} (${k.book.ta})`,
      href: `/academy/thirukkural/${k.number}`, boost: 1.6, meta: `Chapter ${k.chapter.number}`,
      fields: [f(`${k.chapter.en} ${k.chapter.ta}`, 6), f(`${k.book.en} ${k.book.ta} ${k.section}`, 2)],
    });
  }
  for (const v of versesAll()) {
    if (v.id.startsWith("KURAL-")) continue; // kurals already indexed with their commentary
    docs.push({
      kind: "verse", title: `${v.text} ${v.number}`, subtitle: `${v.textTa} · ${v.period}`, href: `/academy/verse/${v.id}`, boost: 1,
      fields: [f(v.lines.join(" "), 4), f(v.english ?? "", 2.5), f(`${v.text} ${v.textTa}`, 1.5)],
    });
  }
  for (const w of WORLDS) {
    docs.push({ kind: "world", title: `${w.id[0].toUpperCase()}${w.id.slice(1)} World`, subtitle: w.sub, href: `/academy/worlds/${w.id}`, boost: 3,
      fields: [f(`${w.id} world`, 6), f(w.sub, 3), f(w.about, 2)] });
  }
  for (const l of lessonCatalog()) {
    docs.push({ kind: "lesson", title: l.title, subtitle: `${l.world} · ${l.level} · ${l.steps.length} steps`, href: `/academy/lessons/${l.id}`, boost: 2.5,
      fields: [f(l.title, 6), f(l.summary, 3), f(l.steps.map((s) => `${s.ta} ${s.en}`).join(" "), 1.5), f(l.source, 1)] });
  }
  for (const c of challengeCatalog()) {
    docs.push({ kind: "challenge", title: c.title, subtitle: `${c.world} · ${c.kind} · ${c.round} questions`, href: `/academy/challenges/${c.id}`, boost: 2.5,
      fields: [f(`${c.title} challenge quiz`, 6), f(c.summary, 3), f(c.source, 1)] });
  }
  const lines = new Map(GUIDES.map((x) => [x.id, `${x.role} ${x.line} ${x.cite}`]));
  for (const gd of GUIDE_META) {
    docs.push({ kind: "guide", title: `${gd.name} · ${gd.ta}`, subtitle: `${gd.era} · ${gd.tags.join(" · ")}`, href: `/academy/guides?g=${gd.id}`, boost: 2.5,
      fields: [f(`${gd.name} ${gd.ta}`, 6), f(gd.tags.join(" "), 3), f(`${lines.get(gd.id) ?? ""} ${gd.bio}`, 1.5)] });
  }
  for (const pr of PROMPTS) {
    docs.push({ kind: "community", title: pr.title, subtitle: `Community · ${TOPICS.find((t) => t.id === pr.topic)?.label}`, href: `/academy/community?post=${pr.id}`, boost: 1.6,
      fields: [f(pr.title, 5), f(pr.tags.join(" "), 3), f(pr.body, 1.5)] });
  }
  const pages: [string, string, string][] = [
    ["Home", "/academy", "academy home welcome"], ["Worlds map", "/academy/worlds", "worlds map tamilakam regions explore"],
    ["Lessons", "/academy/lessons", "lessons learn paths"], ["Challenges", "/academy/challenges", "challenges quiz daily achievements heritage quest"],
    ["Guides", "/academy/guides", "guides thiruvalluvar avvaiyar"], ["Progress", "/academy/progress", "progress xp streak quests mastery words"],
    ["Library", "/academy/library", "library sources texts credits books collections"], ["Community", "/academy/community", "community discussions posts study groups questions"],
  ];
  for (const [title, href, words] of pages) docs.push({ kind: "page", title, subtitle: "Academy", href, boost: 2, fields: [f(title, 6), f(words, 3)] });
  for (const t of libraryCatalog()) {
    docs.push({ kind: "library", title: `${t.name} · ${t.ta}`, subtitle: `Library · ${t.layer} · ${t.count.toLocaleString("en-IN")} ${t.unit}`, href: `/academy/library/${t.slug}`, boost: 1.8,
      fields: [f(`${t.name} ${t.ta}`, 5), f(`${t.description} ${t.layer} ${t.period}`, 2)] });
  }
  // Vocabulary for the Tanglish layer: every Tamil word the index can return, and the English words it contains.
  const lemmas = wordnetLemmas();
  const tamilFreq = new Map<string, number>();
  const englishFreq = new Map<string, number>();
  for (const d of docs) for (const fl of d.fields) {
    for (const w of fl.text.match(TAMIL_WORD) ?? []) tamilFreq.set(w, (tamilFreq.get(w) ?? 0) + 1);
    for (const w of fl.norm.match(/[a-z]{3,}/g) ?? []) englishFreq.set(w, (englishFreq.get(w) ?? 0) + 1);
  }
  for (const l of lemmas) for (const w of l.match(TAMIL_WORD) ?? []) tamilFreq.set(w, (tamilFreq.get(w) ?? 0) + 1);
  const english = new Set([...englishFreq].filter(([, n]) => n >= 3).map(([w]) => w));
  return (g.__searchIndex = { v: INDEX_VERSION, docs, lemmas, tanglish: createTanglish(tamilFreq, english) });
}

// Tamil words never begin with ள ற ன ழ ண ங, a vowel sign or a pulli: such candidates are index fragments, not words.
const BAD_START = /^[ளறனழணஙா-்]/;
const plausible = (m: TanglishMatch): TanglishMatch => ({ ...m, tamil: m.tamil.filter((c) => !BAD_START.test(c.word)) });

// Dropped from multi-word English queries (kept inside "quoted phrases").
const STOP = new Set(["a", "an", "the", "of", "and", "or", "in", "on", "to", "is", "are", "for", "with", "by", "what", "who", "about"]);

export type ParsedQuery = { raw: string; terms: string[]; phrase: string | null; kural?: number; chapter?: number };

export function parse(raw: string): ParsedQuery {
  const q = raw.normalize("NFC").trim().slice(0, 120);
  const kuralN = q.match(/^(?:kural|kuṟaḷ|kural no\.?|குறள்)?\s*#?\s*(\d{1,4})$/i);
  const chapterN = q.match(/^(?:chapter|ch\.?|adhikaram|athikaram|அதிகாரம்)\s*(\d{1,3})$/i);
  const quoted = q.match(/^["“](.+)["”]$/);
  const phrase = quoted ? norm(quoted[1]) : null;
  return {
    raw: q, phrase,
    terms: phrase ? phrase.split(" ") : (() => {
      const all = norm(q).split(" ").filter(Boolean);
      const kept = all.filter((t) => !STOP.has(t));
      return kept.length ? kept : all;
    })(),
    kural: kuralN ? Number(kuralN[1]) : undefined,
    chapter: chapterN ? Number(chapterN[1]) : undefined,
  };
}

function snippet(text: string, terms: string[]) {
  const n = norm(text);
  const at = terms.map((t) => n.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  // map the normalised offset back approximately by proportion (normalisation only removes characters)
  const start = Math.max(0, Math.floor((at / Math.max(1, n.length)) * text.length) - 50);
  const out = text.slice(start, start + 170).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + out + (start + 170 < text.length ? "…" : "");
}

export type SearchResult = { query: ParsedQuery; hits: Hit[]; total: number; partial: boolean; ms: number; tanglish: TanglishMatch[]; highlight: string[] };

export function search(raw: string, opts: { limit?: number; perKind?: number } = {}): SearchResult {
  const t0 = performance.now();
  const { docs, lemmas, tanglish } = index();
  const q = parse(raw);
  const limit = opts.limit ?? 40;
  const perKind = opts.perKind ?? 12;
  const empty = { query: q, hits: [] as Hit[], total: 0, partial: false, ms: 0, tanglish: [], highlight: [] };
  if (!q.terms.length && !q.kural && !q.chapter) return empty;

  // Each term can be satisfied by itself or — for Tanglish input — by the Tamil words it resolves to.
  const matches: TanglishMatch[] = [];
  const alts = q.terms.map((t) => {
    const list: { s: string; w: number }[] = [{ s: t, w: 1 }];
    if (!q.phrase && tanglish.isTanglish(t)) {
      const m = plausible(tanglish.resolve(t, 5));
      if (m.tamil.length) {
        matches.push(m);
        const top = m.tamil[0].score;
        for (const c of m.tamil) if (c.score >= top * 0.45) list.push({ s: norm(c.word), w: 0.95 * (c.score / top) });
      }
    }
    return list;
  });
  const highlight = [...new Set(alts.flat().map((a) => a.s))];

  const hits: Hit[] = [];
  // Exact-number lookups come first.
  if (q.kural) {
    const d = docs.find((x) => x.kind === "kural" && x.href.endsWith(`/${q.kural}`));
    if (d) hits.push({ ...d, snippet: d.fields[0].text, score: 1e6 });
    else if (q.kural >= 1 && q.kural <= 1330)
      hits.push({ kind: "kural", title: `Kural ${q.kural}`, subtitle: "Not in the provided PDF", href: `/academy/thirukkural/${q.kural}`, snippet: "", score: 1e6 });
  }
  if (q.chapter) {
    const d = docs.find((x) => x.kind === "chapter" && x.meta === `Chapter ${q.chapter}`);
    if (d) hits.push({ ...d, snippet: d.subtitle, score: 1e6 });
  }

  let partial = false;
  if (q.terms.length && !(q.kural && /^\d+$/.test(q.raw))) {
    const some: Hit[] = []; // docs matching only some terms — used when nothing matches them all
    for (const d of docs) {
      let score = 0;
      let matched = 0;
      let best: Field | undefined;
      let bestTerm = q.terms[0];
      if (q.phrase) {
        for (const fl of d.fields) if (fl.norm.includes(q.phrase)) { score += fl.w * 3; best ??= fl; }
        matched = score ? q.terms.length : 0;
      } else {
        // each term may match partially inside a word; weight by field and word-start hits
        for (const termAlts of alts) {
          let tScore = 0;
          for (const { s: t, w } of termAlts) {
            let aScore = 0;
            for (const fl of d.fields) {
              const i = fl.norm.indexOf(t);
              if (i < 0) continue;
              const wordStart = i === 0 || fl.norm[i - 1] === " ";
              const wholeWord = wordStart && (fl.norm[i + t.length] === undefined || fl.norm[i + t.length] === " ");
              aScore += fl.w * (wholeWord ? 2 : wordStart ? 1.5 : 1);
              if (!best) { best = fl; bestTerm = t; }
            }
            tScore = Math.max(tScore, aScore * w);
          }
          if (tScore) { matched++; score += tScore; }
        }
        const joined = q.terms.join(" ");
        if (q.terms.length > 1) for (const fl of d.fields) if (fl.norm.includes(joined)) score += fl.w * 2; // phrase bonus
      }
      if (!score) continue;
      const hit: Hit = { kind: d.kind, title: d.title, subtitle: d.subtitle, href: d.href, meta: d.meta, snippet: best ? snippet(best.text, [bestTerm, ...highlight]) : "", score: score * d.boost };
      if (matched === q.terms.length) hits.push(hit);
      else some.push({ ...hit, score: hit.score * matched });
    }
    if (!hits.length && some.length) { hits.push(...some); partial = true; }

    // Word suggestions: IndoWordNet lemmas by Tamil prefix, or the Tamil words a Tanglish term resolved to.
    const first = q.terms[0];
    if (q.terms.length === 1 && /[\u0B80-\u0BFF]/.test(first)) {
      const words = lemmas.filter((l) => l.startsWith(first)).sort((a, b) => a.length - b.length).slice(0, 6);
      for (const w of words) hits.push({ kind: "word", title: w, subtitle: "Senses & occurrences", href: `/academy/search?q=${encodeURIComponent(w)}`, snippet: "", score: w === first ? 5e5 : 50 - w.length });
    }
    // Normalised words: an inflected form (அன்புடன் → அன்பு), every word of a Tamil sentence, English via the ontology.
    const tamilTerms = q.phrase ? [] : q.terms.filter((t) => /[஀-௿]/.test(t));
    const sentence = tamilTerms.length > 1;
    tamilTerms.forEach((t, i) => {
      const l = lemmatize(t);
      if (!l || (!sentence && l === t)) return;
      hits.push({ kind: "word", title: l, subtitle: l === t ? "Word in your sentence" : `Normalised from ${t}`, meta: sentence ? "Sentence" : "Normalised", snippet: "",
        href: sentence ? `/academy/search?q=${encodeURIComponent(q.raw)}&w=${encodeURIComponent(l)}` : `/academy/search?q=${encodeURIComponent(l)}`, score: 4.5e5 - i });
    });
    if (q.terms.length === 1 && /^[a-z]+$/.test(first) && !matches.length) {
      englishToTamil(first).slice(0, 4).forEach((w, i) => hits.push({ kind: "word", title: w, subtitle: `English “${first}” · Solveli ontology`, meta: "English", snippet: "",
        href: `/academy/search?q=${encodeURIComponent(w)}`, score: 4.4e5 - i }));
    }
    for (const m of matches) {
      m.tamil.forEach((c, i) => hits.push({
        kind: "word", title: c.word, subtitle: c.via === m.input.toLowerCase() ? `Tanglish “${m.input}”` : `Tanglish “${m.input}” · related “${c.via}”`,
        href: `/academy/search?q=${encodeURIComponent(c.word)}`, snippet: "", meta: "Tanglish", score: 4e5 - i,
      }));
    }
  }

  hits.sort((a, b) => b.score - a.score);
  const total = hits.length;
  const taken: Hit[] = [];
  const count = new Map<Kind, number>();
  for (const h of hits) {
    const n = count.get(h.kind) ?? 0;
    if (n >= perKind) continue;
    count.set(h.kind, n + 1);
    taken.push(h);
    if (taken.length >= limit) break;
  }
  return { query: q, hits: taken, total, partial, ms: Math.round(performance.now() - t0), tanglish: matches, highlight };
}

/** Resolve a single Tanglish word to its best Tamil match (for the word view on the results page). */
export function tanglishWord(raw: string) {
  const { tanglish } = index();
  const t = raw.trim().toLowerCase();
  return /^[a-z]{2,}$/.test(t) && tanglish.isTanglish(t) ? plausible(tanglish.resolve(t, 5)) : undefined;
}
