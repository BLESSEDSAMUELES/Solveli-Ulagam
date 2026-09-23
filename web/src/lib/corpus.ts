// Server-only data access over the local datasets in G:\Solveli. Each export mirrors an endpoint in the
// master document §23 (noted per function), so this file is the one place to swap for FastAPI calls later.
import fs from "node:fs";
import path from "node:path";
import { GUIDES } from "@/lib/onboarding";
import { GUIDE_META, type GuideMeta } from "@/lib/guides";

const DATA = process.env.SOLVELI_DATA_DIR ?? path.join(process.cwd(), "..");
const file = (...p: string[]) => path.join(DATA, ...p);

type RawVerse = {
  verse_id: string; source_text: string; layer: string; period: string; verse_number: string;
  poem_lines: string[]; english: string | null; source_url: string; thinai: string | null; cultural_context: string | null;
};

export type Verse = {
  id: string; text: string; textTa: string; layer: string; period: string; number: string;
  lines: string[]; english: string | null; url: string; thinai: string | null;
  attribution?: string; // "Poet: …" / "Section: …" as recorded in the corpus
};

type TextMeta = { name_ta: string; layer: string; count: number; period: string; description: string };

// ---------- Tirukkuṟaḷ (datasets/thirukkural.json, extracted from datasets/Thirukkural.pdf) ----------

export type Kural = {
  number: number;
  book: { ta: string; en: string };
  section: string;
  chapter: { number: number; en: string; ta: string };
  lines: string[];
  translation: string;
  explanation: string;
  commentary: { kalaignar: string; mu_va: string; solomon_pappaiah: string };
};
export const KURAL_PERIOD = "c. 300–600 CE (dating contested)";

const kg = globalThis as unknown as { __kural?: { kurals: Kural[]; byNumber: Map<number, Kural>; missing: number[] } };
export function thirukkural() {
  if (!kg.__kural) {
    // Parsed once per server process from the pre-extracted JSON — never the PDF at request time.
    const raw = JSON.parse(fs.readFileSync(file("datasets", "thirukkural.json"), "utf8"));
    const kurals: Kural[] = raw.kurals;
    kg.__kural = { kurals, byNumber: new Map(kurals.map((k) => [k.number, k])), missing: raw.missing_in_source ?? [] };
  }
  return kg.__kural;
}
export const kural = (n: number) => thirukkural().byNumber.get(n);

const g = globalThis as unknown as { __solveli?: { verses: Verse[]; texts: Record<string, TextMeta> } };

function corpus() {
  if (!g.__solveli) {
    const raw = JSON.parse(fs.readFileSync(file("sentamizh-corpus", "sentamizh_corpus.json"), "utf8"));
    const texts: Record<string, TextMeta> = raw.metadata.summary_by_text;
    const verses: Verse[] = (raw.verses as RawVerse[]).map((v) => ({
      id: v.verse_id, text: v.source_text, textTa: texts[v.source_text]?.name_ta ?? v.source_text, layer: v.layer,
      period: v.period, number: v.verse_number, lines: v.poem_lines ?? [], english: v.english || null, url: v.source_url || "", thinai: v.thinai || null,
      attribution: v.cultural_context || undefined,
    }));
    // The Tirukkuṟaḷ joins the corpus as the didactic layer, so worlds, word search and the library see it too.
    const tk = thirukkural();
    texts.Tirukkural = { name_ta: "திருக்குறள்", layer: "Didactic", count: tk.kurals.length, period: KURAL_PERIOD,
      description: "Thiruvalluvar's 1330 couplets on virtue, wealth and love (1300 present in the provided PDF)" };
    for (const k of tk.kurals) {
      verses.push({ id: `KURAL-${k.number}`, text: "Tirukkural", textTa: "திருக்குறள்", layer: "Didactic", period: KURAL_PERIOD,
        number: String(k.number), lines: k.lines, english: k.translation || null, url: `/academy/thirukkural/${k.number}`, thinai: null });
    }
    g.__solveli = { verses, texts };
  }
  return g.__solveli;
}

// ---------- worlds (GET /api/regions/{id}/summary) ----------

export const WORLD_LAYERS: Record<string, string[]> = {
  thirukkural: ["Didactic"], sangam: ["Sangam"], bhakti: ["Bhakti", "Spiritual"], grammar: [], history: ["Epic"],
};

export function worldTexts(id: string) {
  const { texts } = corpus();
  return Object.entries(texts)
    .filter(([, t]) => WORLD_LAYERS[id]?.includes(t.layer))
    .map(([name, t]) => ({ name, ...t }));
}

export function worldCounts(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of Object.keys(WORLD_LAYERS)) {
    const n = worldTexts(id).reduce((s, t) => s + t.count, 0);
    out[id] = n ? `${n.toLocaleString("en-IN")} ${id === "thirukkural" ? "kurals" : "verses"}` : "";
  }
  out.grammar = `${sutras().length.toLocaleString("en-IN")} sūtras`;
  return out;
}

// Evenly spaced, deterministic sample across every text in the world, preferring verses with English.
export function worldSamples(id: string, perText = 3): Verse[] {
  const { verses } = corpus();
  return worldTexts(id).flatMap((t) => {
    const pool = verses.filter((v) => v.text === t.name);
    const withEn = pool.filter((v) => v.english);
    const src = withEn.length >= perText ? withEn : pool;
    const step = Math.max(1, Math.floor(src.length / perText));
    return Array.from({ length: Math.min(perText, src.length) }, (_, i) => src[i * step]);
  });
}

// ---------- Tolkāppiyam sūtras (Grammar World) ----------

export type Sutra = { chapter: string; number: string; lines: string[] };

let sutraCache: Sutra[] | undefined;
export function sutras(): Sutra[] {
  if (sutraCache) return sutraCache;
  const lines = fs.readFileSync(file("Tholkappiam.txt"), "utf8").split(/\r?\n/);
  const out: Sutra[] = [];
  let chapter = "";
  let block: string[] = [];
  // Body starts after the table of contents; chapter headings look like "1.1. நூல் மரபு".
  for (const line of lines.slice(70)) {
    const h = line.match(/^\s*\d\.\s?\d\.\s+(.+)$/);
    if (h) { chapter = h[1].trim(); block = []; continue; }
    if (!line.trim()) { block = []; continue; }
    const end = line.match(/^(.*?)\s+(\d+)\s*$/);
    if (end && chapter) {
      out.push({ chapter, number: end[2], lines: [...block, end[1]] });
      block = [];
    } else block.push(line.trim());
  }
  return (sutraCache = out);
}

// ---------- IndoWordNet (the verified default vocabulary) ----------

type Synset = { id: number; lemmas: string[]; gloss: string; example: string; pos: string };
const iwn = globalThis as unknown as { __iwn?: { byLemma: Map<string, Synset[]>; byId: Map<number, Synset>; hyper: Map<number, number[]>; hypo: Map<number, number[]> } };

function wordnet() {
  if (!iwn.__iwn) {
    const byLemma = new Map<string, Synset[]>();
    const byId = new Map<number, Synset>();
    for (const row of fs.readFileSync(file("iwn_data", "synsets", "all.tamil"), "utf8").split("\n")) {
      const [id, lemmas, gloss, pos] = row.split("\t");
      if (!pos) continue;
      const i = gloss.indexOf(':"');
      const s: Synset = {
        id: +id, pos: pos.trim(), lemmas: lemmas.split(",").filter(Boolean).map((l) => l.replace(/_/g, " ")),
        gloss: i < 0 ? gloss : gloss.slice(0, i), example: i < 0 ? "" : gloss.slice(i + 2).replace(/"\s*$/, ""),
      };
      byId.set(s.id, s);
      for (const l of s.lemmas) byLemma.set(l, [...(byLemma.get(l) ?? []), s]);
    }
    const rel = (name: string) => {
      const m = new Map<number, number[]>();
      for (const row of fs.readFileSync(file("iwn_data", "synset_relations", name), "utf8").split("\n")) {
        const [a, b] = row.split("\t");
        if (b) m.set(+a, b.split(",").filter(Boolean).map(Number));
      }
      return m;
    };
    iwn.__iwn = { byLemma, byId, hyper: rel("hypernymy.noun"), hypo: rel("hyponymy.noun") };
  }
  return iwn.__iwn;
}

// ---------- normalisation: inflected Tamil → vocabulary lemma, English → Tamil (Solveli ontology) ----------

type OntoEntry = { en: string; desc: string; source: string };
const lx = globalThis as unknown as { __lex?: { lemmas: Set<string>; english: Map<string, string[]>; onto: Map<string, OntoEntry> } };
function lexicon() {
  if (!lx.__lex) {
    const lemmas = new Set([...wordnet().byLemma.keys()].filter((l) => !l.includes(" ")));
    const english = new Map<string, string[]>();
    const onto = new Map<string, OntoEntry>();
    for (const r of ontologyAll()) {
      const ta = r.Tamil_Label;
      if (!ta || ta.includes(" ")) continue;
      lemmas.add(ta);
      if (!onto.has(ta)) onto.set(ta, { en: r.Synonyms_English || r.English_Label, desc: r.Description, source: `Solveli ontology · ${r.Source_Text}` });
      const words = `${r.English_Label} ${r.Synonyms_English} ${r.Keywords}`.toLowerCase().match(/[a-z]{3,}/g) ?? [];
      for (const w of words) english.set(w, [...new Set([...(english.get(w) ?? []), ta])]);
    }
    lx.__lex = { lemmas, english, onto };
  }
  return lx.__lex;
}

/** Tamil words the Solveli ontology maps an English word to ("love" → அன்பு, அகம், …). Exact labels first. */
export function englishToTamil(word: string): string[] {
  const { english, onto } = lexicon();
  const w = word.toLowerCase().trim();
  const exact = (ta: string) => Number(onto.get(ta)?.en.toLowerCase() === w);
  return [...(english.get(w) ?? [])].sort((a, b) => exact(b) - exact(a));
}

/**
 * Resolve an inflected token to a verified vocabulary lemma: அன்புடன் → அன்பு, பேசினான் → பேசு, மரத்தை → மரம்.
 * ponytail: longest-prefix + restored-final heuristic, not a morphological analyser; swap one in when available.
 */
export function lemmatize(token: string): string | undefined {
  const { lemmas } = lexicon();
  const t = token.normalize("NFC").replace(/[^஀-௿]/g, "");
  if (!t) return undefined;
  if (lemmas.has(t)) return t;
  const cps = [...t];
  for (let n = cps.length - 1; n >= 2; n--) {
    const p = cps.slice(0, n).join("");
    const rest = cps.slice(n).join("");
    if (/^[க-ஹ]்$/.test(rest)) continue; // அவன் is not அவ+ம் — a lone final consonant is no suffix
    if (/^[ஃஜஷஸஹ]/.test(rest)) break; // செல்ஃபி is not செல் + suffix — ஃ/Grantha never start an inflection
    for (const c of [p, p + "ு", p + "ம்", p + "ல்", p + "ள்"]) {
      const len = [...c].length;
      if (len >= 3 && len / cps.length >= 0.45 && lemmas.has(c)) return c;
    }
  }
  return undefined;
}

export const tamilTokens = (s: string) => s.normalize("NFC").match(/[஀-௿]+/g) ?? [];

const oc = new Map<string, number>();
function occurrenceCount(w: string) {
  if (!oc.has(w)) oc.set(w, corpus().verses.reduce((n, v) => n + (v.lines.some((l) => l.includes(w)) ? 1 : 0), 0));
  return oc.get(w)!;
}

export type Candidate = { token: string; lemma?: string; senses: number; occurrences: number };
/** Sentence search: split into Tamil tokens, resolve each to a lemma, and count the verified data behind it. */
export function analyzeSentence(text: string): Candidate[] {
  const wn = wordnet();
  const seen = new Set<string>();
  return tamilTokens(text).filter((t) => !seen.has(t) && seen.add(t)).map((token) => {
    const lemma = lemmatize(token);
    return { token, lemma, senses: lemma ? (wn.byLemma.get(lemma)?.length ?? 0) : 0, occurrences: occurrenceCount(lemma ?? token) };
  });
}

let suggestCache: string[] | undefined;
/** Starter words: ontology concepts that have both IndoWordNet senses and the most corpus occurrences. */
export function suggestedWords(n = 6): string[] {
  suggestCache ??= [...lexicon().onto.keys()].filter((w) => wordnet().byLemma.has(w))
    .map((w) => [w, occurrenceCount(w)] as const).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
  return suggestCache.slice(0, n);
}

/** Is this word in the verified vocabulary or corpus? Groq is only ever asked when this is false. */
export function isKnownWord(raw: string) {
  const w = raw.normalize("NFC").trim();
  return !!lemmatize(w) || ([...w].length > 1 && occurrenceCount(w) > 0);
}

// ---------- word search (GET /api/words/{word}/senses + /related) ----------

export type Occurrence = Verse & { line: string; lineNo: number; author?: string; reference: string };
export type Sense = { id: number; pos: string; gloss: string; example: string; synonyms: string[]; broader: string[]; narrower: string[] };
export type WordContext = { verse: Occurrence; meaning: string | null; meaningSource: string | null; sense?: Sense; auto: boolean };
export type SearchResult =
  | { kind: "tanglish" | "empty"; query: string }
  | {
      kind: "result"; query: string; from?: string; // from = the inflected form the user searched or clicked
      meaning?: OntoEntry; // Solveli ontology entry, when there is one
      senses: Sense[];
      occurrences: Occurrence[];
      total: number;
      byLayer: { layer: string; period: string; count: number }[];
      layer?: string; // occurrences filtered to this layer (period)
      context?: WordContext;
    };

const authorOf = (v: Verse) => v.text === "Tirukkural" ? "Thiruvalluvar (traditional attribution)"
  // "Poet: X; …" or, in the Sangam anthologies, a bare poet name before the first ";"
  : (v.attribution?.match(/^Poet:\s*([^;]+)/)?.[1] ?? v.attribution?.split(";")[0].match(/^[஀-௿ .]{3,40}$/)?.[0])?.trim();
const asOccurrence = (v: Verse, n: number): Occurrence =>
  ({ ...v, line: v.lines[n] ?? "", lineNo: n + 1, author: authorOf(v), reference: `${v.text} ${v.number}, line ${n + 1}` });

/** Rank senses by how many context words (lemmatised) appear in each sense's lemmas, relations, gloss and example. */
function rankSenses(senses: Sense[], contextText: string, word: string): Sense[] {
  const ctx = [...new Set(tamilTokens(contextText).map((t) => lemmatize(t) ?? t))].filter((t) => t !== word);
  if (!ctx.length) return senses;
  const score = (s: Sense) => ctx.filter((c) => [...s.synonyms, ...s.broader, ...s.narrower].includes(c) || s.gloss.includes(c) || s.example.includes(c)).length;
  return senses.map((s, i) => ({ s, i, n: score(s) })).sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.s);
}

export function searchWord(raw: string, opts: { layer?: string; ctx?: string; sentence?: string } = {}): SearchResult {
  let query = raw.normalize("NFC").trim();
  if (!query) return { kind: "empty", query };
  if (/[a-z]/i.test(query) && !/[஀-௿]/.test(query)) return { kind: "tanglish", query };
  let from: string | undefined;
  const lemma = lemmatize(query);
  if (lemma && lemma !== query) { from = query; query = lemma; }

  const wn = wordnet();
  const first = (ids: number[] = []) => [...new Set(ids.map((i) => wn.byId.get(i)?.lemmas[0]).filter((x): x is string => !!x && x !== query))].slice(0, 6);
  let senses: Sense[] = (wn.byLemma.get(query) ?? []).map((s) => ({
    id: s.id, pos: s.pos, gloss: s.gloss, example: s.example,
    synonyms: s.lemmas.filter((l) => l !== query).slice(0, 8),
    broader: first(wn.hyper.get(s.id)), narrower: first(wn.hypo.get(s.id)),
  }));

  // ponytail: substring match over verse lines (அன்பு also finds அன்புடன்); sandhi-split forms are missed until a stemmer exists.
  const hits: Occurrence[] = [];
  const layers = new Map<string, { layer: string; period: string; count: number }>();
  for (const v of corpus().verses) {
    const n = v.lines.findIndex((l) => l.includes(query));
    if (n < 0) continue;
    const k = layers.get(v.layer) ?? { layer: v.layer, period: v.period, count: 0 };
    k.count++;
    layers.set(v.layer, k);
    if (!opts.layer || v.layer === opts.layer) hits.push(asOccurrence(v, n));
  }
  const meaning = lexicon().onto.get(query);
  if (!senses.length && !layers.size && !meaning) return { kind: "empty", query: from ?? query };

  // Contextual meaning comes only from the clicked passage's own verified translation/explanation — never a generic definition.
  let context: WordContext | undefined;
  // Clicked passage first; otherwise the first retrieved occurrence that carries a verified translation.
  const cv = opts.ctx ? verseById(opts.ctx) : hits.find((h) => h.english);
  if (cv) {
    const n = Math.max(0, cv.lines.findIndex((l) => l.includes(from ?? query) || l.includes(query)));
    const k = cv.id.startsWith("KURAL-") ? kural(Number(cv.number)) : undefined;
    const text = k ? [k.translation, k.explanation].filter(Boolean).join(" — ") : cv.english;
    if (opts.ctx) senses = rankSenses(senses, cv.lines.join(" "), query);
    context = {
      verse: asOccurrence(cv, n), meaning: text || null, sense: opts.ctx ? senses[0] : undefined, auto: !opts.ctx,
      meaningSource: k ? "Tirukkuṟaḷ translation & explanation · datasets/Thirukkural.pdf" : cv.english ? "English translation recorded in the Sentamizh corpus" : null,
    };
  }
  if (opts.sentence && !opts.ctx) senses = rankSenses(senses, opts.sentence, query);

  // Spread the shown occurrences across texts instead of listing one text's first hits.
  const byText = new Map<string, Occurrence[]>();
  for (const h of hits) byText.set(h.text, [...(byText.get(h.text) ?? []), h]);
  const shown: Occurrence[] = [];
  for (let i = 0; shown.length < 12 && i < 12; i++) for (const list of byText.values()) if (list[i] && shown.length < 12) shown.push(list[i]);

  return { kind: "result", query, from, meaning, senses, occurrences: shown, total: hits.length, layer: opts.layer, context,
    byLayer: [...layers.values()].sort((a, b) => b.count - a.count) };
}

// ---------- challenges & lessons ----------

export const THINAI: Record<string, { en: string; ta: string; landscape: string; mood: string }> = {
  Kurinji: { en: "Kuṟiñci", ta: "குறிஞ்சி", landscape: "Mountain", mood: "Union, joy, secret love" },
  Mullai: { en: "Mullai", ta: "முல்லை", landscape: "Forest", mood: "Waiting, patience, hope" },
  Marutham: { en: "Marutam", ta: "மருதம்", landscape: "Farmland", mood: "Conflict, infidelity" },
  Neytal: { en: "Neytal", ta: "நெய்தல்", landscape: "Seashore", mood: "Longing, sorrow" },
  Palai: { en: "Pālai", ta: "பாலை", landscape: "Desert", mood: "Separation, hardship" },
};

// Annotated Kuṟuntokai/Naṟṟiṇai verses with an English translation: the challenge asks for the verse's thiṇai.
export function challengeVerses(perThinai = 6): Verse[] {
  const pool = corpus().verses.filter((v) => v.english && v.thinai && THINAI[v.thinai] && (v.text === "Kuruntokai" || v.text === "Natrinai"));
  return Object.keys(THINAI).flatMap((t) => {
    const list = pool.filter((v) => v.thinai === t);
    const step = Math.max(1, Math.floor(list.length / perThinai));
    return Array.from({ length: Math.min(perThinai, list.length) }, (_, i) => list[i * step]);
  });
}

export function thinaiExamples(): Record<string, Verse | undefined> {
  const pool = corpus().verses.filter((v) => v.english && v.text === "Kuruntokai");
  return Object.fromEntries(Object.keys(THINAI).map((t) => [t, pool.find((v) => v.thinai === t)]));
}

function csv(name: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = fs.readFileSync(file("datasets", name), "utf8").replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some(Boolean));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export function ontology(parent: string) {
  return csv("Ontology.csv").filter((r) => r.Parent_Concept === parent);
}

export function libraryTexts() {
  const { texts } = corpus();
  return Object.entries(texts).map(([name, t]) => ({ name, ...t }));
}

export function verseById(id: string) {
  return corpus().verses.find((v) => v.id === id);
}

// ---------- lesson catalog (GET /api/lessons) ----------
// Every step is either a concept from the Solveli ontology / Tolkāppiyam or a real verse with its source.

export type LessonStep = {
  ta: string; en: string; note: string;
  verse?: { id: string; text: string; textTa: string; number: string; lines: string[]; english: string | null; url: string };
};
export type LessonDef = {
  id: string; world: string; title: string; summary: string; level: "Beginner" | "Intermediate";
  image: string; source: string; steps: LessonStep[];
};

const asVerse = (v?: Verse) => v && { id: v.id, text: v.text, textTa: v.textTa, number: v.number, lines: v.lines, english: v.english, url: v.url };
const verseStep = (v: Verse): LessonStep => ({ ta: v.textTa, en: `${v.text} ${v.number}`, note: v.period, verse: asVerse(v) });
const kuralStep = (n: number): LessonStep | undefined => {
  const k = kural(n);
  return k && { ta: `குறள் ${n} · ${k.chapter.ta}`, en: `Kural ${n} — ${k.chapter.en}`, note: k.explanation,
    verse: { id: `KURAL-${n}`, text: "Tirukkural", textTa: "திருக்குறள்", number: String(n), lines: k.lines, english: k.translation, url: `/academy/thirukkural/${n}` } };
};
const kuralSteps = (ns: number[]) => ns.map(kuralStep).filter((s): s is LessonStep => !!s);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

let lessonCache: LessonDef[] | undefined;
export function lessonCatalog(): LessonDef[] {
  if (lessonCache) return lessonCache;
  const concept = (r: Record<string, string>): LessonStep => ({ ta: r.Tamil_Label, en: r.Synonyms_English || r.English_Label, note: r.Description });
  const ex = thinaiExamples();
  const seen = new Set<string>();
  const chapters = sutras().filter((s) => !seen.has(s.chapter) && seen.add(s.chapter)); // first sūtra of each chapter
  const books = [["எழுத்ததிகாரம்", "Eḻuttatikāram — the book of letters"], ["சொல்லதிகாரம்", "Collatikāram — the book of words"], ["பொருளதிகாரம்", "Poruḷatikāram — the book of subject matter"]];

  lessonCache = [
    { id: "muppal", world: "thirukkural", title: "The Three Books — Muppāl", level: "Beginner", image: "/worlds/thirukkural.webp",
      summary: "Virtue, wealth and love: the opening couplet of each book.", source: "Tirukkuṟaḷ · datasets/Thirukkural.pdf",
      steps: kuralSteps([1, 381, 1081]) },
    { id: "kural-god", world: "thirukkural", title: "Praise of God — Chapter 1", level: "Beginner", image: "/lessons/temple.webp",
      summary: "The ten couplets that open the Tirukkuṟaḷ, with translation and commentary.", source: "Tirukkuṟaḷ, அதிகாரம் 1",
      steps: kuralSteps(range(1, 10)) },
    { id: "kural-learning", world: "thirukkural", title: "Learning — Chapter 40", level: "Intermediate", image: "/lessons/books.webp",
      summary: "கல்வி: why learning is the wealth that never perishes.", source: "Tirukkuṟaḷ, அதிகாரம் 40",
      steps: kuralSteps(range(391, 400)) },
    { id: "five-thinai", world: "sangam", title: "The Five Thiṇai", level: "Beginner", image: "/lessons/kurinji.webp",
      summary: "Every feeling has a landscape: mountain, forest, farmland, seashore, desert.", source: "Tolkāppiyam, Poruḷatikāram · Sentamizh corpus",
      steps: Object.entries(THINAI).map(([k, t]) => ({ ta: t.ta, en: `${t.en} — ${t.landscape}`, note: t.mood, verse: asVerse(ex[k]) })) },
    { id: "akam-puram", world: "sangam", title: "Akam and Puram", level: "Beginner", image: "/worlds/sangam.webp",
      summary: "Inner life and public life: the two halves of Sangam poetry.", source: "Solveli ontology (Poruḷ)",
      steps: [...ontology("Porul"), ...ontology("Puram").filter((r) => ["Veeram", "Kodai", "Pukazh"].includes(r.English_Label))].map(concept) },
    { id: "akam-voices", world: "sangam", title: "Voices of Akam", level: "Intermediate", image: "/lessons/coast.webp",
      summary: "Who speaks in a love poem? Meet the heroine, the hero and the confidante.", source: "Solveli ontology (Akam)",
      steps: ontology("Akam").filter((r) => ["Thalaivan", "Thalaivi", "Thozhi", "Sevili", "Kalavu", "Karpu"].includes(r.English_Label)).map(concept) },
    { id: "kuruntokai-reading", world: "sangam", title: "Reading Kuṟuntokai", level: "Intermediate", image: "/lessons/temple.webp",
      summary: "Five short love poems, one from each landscape, with translations.", source: "Kuṟuntokai · tr. Vaidehi Herbert",
      steps: Object.values(ex).filter((v): v is Verse => !!v).map(verseStep) },
    { id: "ezhuthu", world: "grammar", title: "Letters — Eḻuttu", level: "Beginner", image: "/lessons/books.webp",
      summary: "Vowels, consonants and their combinations, as Tolkāppiyam begins.", source: "Tolkāppiyam, Eḻuttatikāram · Solveli ontology",
      steps: [...ontology("Ezhuthu"), ...ontology("Uyir"), ...ontology("Mei")].map(concept) },
    { id: "sol", world: "grammar", title: "Words — Col", level: "Beginner", image: "/worlds/grammar.webp",
      summary: "Nouns, verbs, particles: how Tamil sorts its words.", source: "Tolkāppiyam, Collatikāram · Solveli ontology",
      steps: ontology("Sol").map(concept) },
    { id: "three-books", world: "grammar", title: "The Three Books", level: "Intermediate", image: "/lessons/desk.webp",
      summary: "Tolkāppiyam's structure — and the first sūtra of each book.", source: "Tolkāppiyam · Project Madurai",
      steps: books.map(([ta, en], i) => {
        const s = chapters[i * 9];
        return { ta, en, note: s ? `${s.chapter} · sūtra ${s.number}: ${s.lines.join(" ")}` : "" };
      }) },
    { id: "bhakti-hymns", world: "bhakti", title: "Hymns of Devotion", level: "Intermediate", image: "/lessons/deity.webp",
      summary: "Tēvāram, Divya Prabandham and Tirumantiram in their own words.", source: "Sentamizh corpus · Project Madurai",
      steps: worldSamples("bhakti", 2).map(verseStep) },
    { id: "twin-epics", world: "history", title: "The Twin Epics", level: "Intermediate", image: "/lessons/harbor.webp",
      summary: "Cities, courts and trade in Cilappatikāram and Maṇimēkalai.", source: "Sentamizh corpus · Project Madurai",
      steps: worldSamples("history", 3).map(verseStep) },
  ].filter((l) => l.steps.length > 0) as LessonDef[];
  return lessonCache;
}

// ---------- world map data ----------

export function mapData() {
  const counts = worldCounts();
  const lessons = lessonCatalog();
  const thinaiCounts: Record<string, number> = {};
  for (const v of corpus().verses) if (v.thinai) thinaiCounts[v.thinai] = (thinaiCounts[v.thinai] ?? 0) + 1;
  const firstLine = (id: string) => verseById(id)?.lines[0];
  const quote: Record<string, { line: string; cite: string }> = {
    thirukkural: { line: kural(1)?.lines.join(" ") ?? "", cite: "Tirukkuṟaḷ 1" },
    sangam: { line: firstLine("PURN-192") ?? "", cite: "Puṟanāṉūṟu 192 (as in the corpus edition)" },
    grammar: { line: "எல்லாச் சொல்லும் பொருள் குறித்தனவே", cite: "Tolkāppiyam, Peyariyal 1" },
  };
  for (const id of ["bhakti", "history"]) {
    const v = worldSamples(id, 1)[0];
    if (v) quote[id] = { line: v.lines[0], cite: `${v.text} ${v.number}` };
  }
  const worlds = Object.fromEntries(Object.keys(WORLD_LAYERS).map((id) => [id, {
    evidence: counts[id],
    texts: id === "grammar" ? ["Tolkāppiyam"] : worldTexts(id).map((t) => t.name),
    lessons: lessons.filter((l) => l.world === id).length,
    quote: quote[id],
  }]));
  return { worlds, thinaiCounts };
}

// ---------- challenge catalog (GET /api/challenges) ----------
// Every question is generated from the datasets: the correct answer is the dataset's own label.

export type Question = {
  id: string;
  prompt: string;
  passage?: { lines: string[]; english?: string | null; cite: string; href: string };
  options: { key: string; label: string; sub?: string; ta?: boolean }[];
  answer: string;
  explain: string;
};
export type ChallengeDef = {
  id: string; world: string; kind: "daily" | "world" | "quiz"; title: string; summary: string; image: string;
  round: number; source: string; pool: Question[];
};

// Evenly spaced, deterministic picks, and a stable per-question rotation of option order.
function spread<T>(list: T[], n: number): T[] {
  const step = Math.max(1, Math.floor(list.length / n));
  return Array.from({ length: Math.min(n, list.length) }, (_, i) => list[i * step]);
}
function rotate<T>(list: T[], by: number): T[] {
  return list.map((_, i) => list[(i + by) % list.length]);
}
const verseHref = (v: Verse) => (v.url.startsWith("/") ? v.url : `/academy/verse/${v.id}`);

export function ontologyAll() {
  return csv("Ontology.csv");
}

let challengeCache: ChallengeDef[] | undefined;
export function challengeCatalog(): ChallengeDef[] {
  if (challengeCache) return challengeCache;
  const { kurals } = thirukkural();
  const { verses, texts } = corpus();
  const books = [["அறத்துப்பால்", "Virtue"], ["பொருட்பால்", "Wealth"], ["காமத்துப்பால்", "Love"]];
  const textQuiz = (id: string, names: string[], subs: Record<string, string>, perText: number) =>
    names.flatMap((name) => spread(verses.filter((v) => v.text === name && v.lines.length >= 2), perText)).map((v, i): Question => ({
      id: `${id}-${v.id}`, prompt: "Which work is this passage from?",
      passage: { lines: v.lines.slice(0, 4), english: v.english, cite: v.id, href: verseHref(v) },
      options: rotate(names.map((n) => ({ key: n, label: texts[n]?.name_ta ?? n, sub: `${n}${subs[n] ? ` · ${subs[n]}` : ""}`, ta: true })), i % names.length),
      answer: v.text,
      explain: `${v.text} ${v.number} — ${texts[v.text]?.description ?? ""} (${v.period}).`,
    }));

  // Tolkāppiyam sūtras with their book: chapters come in order, nine per athikāram.
  const chapterOrder: string[] = [];
  for (const s of sutras()) if (!chapterOrder.includes(s.chapter)) chapterOrder.push(s.chapter);
  const athikaram = [["எழுத்ததிகாரம்", "Letters"], ["சொல்லதிகாரம்", "Words"], ["பொருளதிகாரம்", "Subject matter"]];
  const label = (x: Record<string, string>) => x.Synonyms_English || x.English_Label;
  const grammarTerms = ontologyAll().filter((r) => r.Category === "Grammar" && r.Tamil_Label && label(r));

  const all: ChallengeDef[] = [
    { id: "kural-quest", world: "thirukkural", kind: "daily", title: "Kural Quest", image: "/challenges/kural.webp", round: 10,
      summary: "Complete the couplet: pick the second line that belongs to the first.", source: "Tirukkuṟaḷ · datasets/Thirukkural.pdf",
      pool: spread(kurals, 80).map((k, i): Question => {
        const at = kurals.indexOf(k);
        const others = [137, 411, 733].map((o) => kurals[(at + o) % kurals.length]);
        return {
          id: `kq-${k.number}`, prompt: "Which line completes this kural?",
          passage: { lines: [k.lines[0], "…"], cite: `Kural ${k.number}`, href: `/academy/thirukkural/${k.number}` },
          options: rotate([k, ...others].map((x) => ({ key: String(x.number), label: x.lines[1], ta: true })), i % 4),
          answer: String(k.number),
          explain: `Kural ${k.number} (${k.chapter.en || k.chapter.ta}): ${k.translation}`,
        };
      }) },
    { id: "kural-books", world: "thirukkural", kind: "quiz", title: "Three Books", image: "/challenges/scroll.webp", round: 10,
      summary: "Virtue, wealth or love? Place each couplet in its book.", source: "Tirukkuṟaḷ · datasets/Thirukkural.pdf",
      pool: spread(kurals, 90).map((k): Question => ({
        id: `kb-${k.number}`, prompt: "Which book (பால்) is this kural from?",
        passage: { lines: k.lines, english: k.translation, cite: `Kural ${k.number}`, href: `/academy/thirukkural/${k.number}` },
        options: books.map(([ta, en]) => ({ key: en, label: ta, sub: en, ta: true })),
        answer: k.book.en,
        explain: `Kural ${k.number} is in ${k.book.en} (${k.book.ta}), chapter ${k.chapter.number}: ${k.chapter.en || k.chapter.ta}.`,
      })) },
    { id: "sangam-thinai", world: "sangam", kind: "world", title: "Name the Landscape", image: "/challenges/harbor.webp", round: 5,
      summary: "Read a real Sangam verse and choose its thiṇai.", source: "Kuṟuntokai & Naṟṟiṇai · Sentamizh corpus",
      pool: challengeVerses().map((v, i): Question => ({
        id: `th-${v.id}`, prompt: "Which thiṇai does this verse belong to?",
        passage: { lines: v.lines.slice(0, 6), english: v.english, cite: `${v.text} ${v.number}`, href: verseHref(v) },
        options: rotate(Object.entries(THINAI).map(([k, t]) => ({ key: k, label: t.ta, sub: `${t.en} · ${t.landscape}`, ta: true })), i % 5),
        answer: v.thinai!,
        explain: `The corpus tags this verse ${THINAI[v.thinai!].en}: the ${THINAI[v.thinai!].landscape.toLowerCase()} landscape of ${THINAI[v.thinai!].mood.toLowerCase()} (Tolkāppiyam, Poruḷatikāram).`,
      })) },
    { id: "sangam-anthology", world: "sangam", kind: "quiz", title: "Sangam Explorer", image: "/challenges/city.webp", round: 5,
      summary: "Four anthologies, one passage: which one is it from?", source: "Sentamizh corpus",
      pool: textQuiz("sa", ["Akananuru", "Kuruntokai", "Natrinai", "Purananuru"], {}, 10) },
    { id: "bhakti-voices", world: "bhakti", kind: "world", title: "Voices of Bhakti", image: "/challenges/temple.webp", round: 5,
      summary: "Śaiva or Vaiṣṇava? Tell the hymn traditions apart.", source: "Sentamizh corpus · Project Madurai",
      pool: textQuiz("bv", ["Thevaram", "Divya Prabandham", "Thirumanthiram"], { Thevaram: "Śaiva hymns", "Divya Prabandham": "Vaiṣṇava hymns", Thirumanthiram: "Śaiva Siddhānta" }, 12) },
    { id: "grammar-terms", world: "grammar", kind: "quiz", title: "Grammar Master", image: "/challenges/desk.webp", round: 5,
      summary: "Match each Tolkāppiyam term to its meaning.", source: "Solveli ontology",
      pool: grammarTerms.map((r, i): Question => {
        const others = [5, 11, 17].map((o) => grammarTerms[(i + o) % grammarTerms.length]).filter((x) => label(x) !== label(r));
        return {
          id: `gt-${r.ID}`, prompt: `What does “${r.Tamil_Label}” mean?`,
          options: rotate([r, ...others].map((x) => ({ key: x.ID, label: label(x) })), i % (others.length + 1)),
          answer: r.ID, explain: `${r.Tamil_Label} (${r.English_Label}): ${r.Description}.`,
        };
      }) },
    { id: "grammar-books", world: "grammar", kind: "world", title: "Three Athikārams", image: "/challenges/books.webp", round: 5,
      summary: "Letters, words or subject matter? Place the sūtra in its book.", source: "Tolkāppiyam · Project Madurai",
      pool: spread(sutras().filter((s) => s.lines.join(" ").length > 25), 45).map((s, i): Question => {
        const b = Math.min(2, Math.floor(chapterOrder.indexOf(s.chapter) / 9));
        return {
          id: `gb-${i}`, prompt: "Which book of Tolkāppiyam is this sūtra from?",
          passage: { lines: s.lines, cite: `${s.chapter} · sūtra ${s.number}`, href: "/academy/worlds/grammar" },
          options: athikaram.map(([ta, en], k) => ({ key: String(k), label: ta, sub: en, ta: true })),
          answer: String(b), explain: `${s.chapter}, sūtra ${s.number}, is in ${athikaram[b][0]} (${athikaram[b][1]}).`,
        };
      }) },
    { id: "twin-epics", world: "history", kind: "world", title: "Twin Epics", image: "/challenges/ships.webp", round: 5,
      summary: "Cilappatikāram or Maṇimēkalai? Recognise the epic.", source: "Sentamizh corpus · Project Madurai",
      pool: textQuiz("te", ["Silappatikaram", "Manimekalai"], {}, 10) },
  ];
  return (challengeCache = all.filter((c) => c.pool.length >= c.round));
}

// ---------- raw access for the search index ----------
export const versesAll = () => corpus().verses;
export const wordnetLemmas = () => [...wordnet().byLemma.keys()];

// ---------- guides (GET /api/guides) ----------

export type GuideProfile = GuideMeta & {
  works: { title: string; ta?: string; count: string; href: string }[];
  teachings: { lines: string[]; cite: string; href?: string }[];
  stats: { label: string; value: string }[];
  lessons: { id: string; title: string }[];
  challenges: { id: string; title: string }[];
  note?: string;
};

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
const fmt = (n: number) => n.toLocaleString("en-IN");

let guideCache: GuideProfile[] | undefined;
export function guideProfiles(): GuideProfile[] {
  if (guideCache) return guideCache;
  const { verses, texts } = corpus();
  const lessons = lessonCatalog();
  const challenges = challengeCatalog();
  const onboarding = new Map(GUIDES.map((g) => [g.id, g]));
  const kuralTeach = (n: number) => { const k = kural(n); return k && { lines: k.lines, cite: `Tirukkuṟaḷ ${n}`, href: `/academy/thirukkural/${n}` }; };

  guideCache = GUIDE_META.map((m): GuideProfile => {
    const works: GuideProfile["works"] = [];
    let teachings: GuideProfile["teachings"] = [];
    let note: string | undefined;
    const byPoet = m.poet ? verses.filter((v) => m.poet!.some((p) => v.attribution?.includes(p))) : [];
    if (byPoet.length) {
      const perText = new Map<string, Verse[]>();
      for (const v of byPoet) perText.set(v.text, [...(perText.get(v.text) ?? []), v]);
      for (const [name, vs] of perText) works.push({ title: name, ta: texts[name]?.name_ta, count: `${fmt(vs.length)} attributed verses`, href: `/academy/library/${slug(name)}?guide=${m.id}` });
      teachings = spread(byPoet, 3).map((v) => ({ lines: v.lines.slice(0, 2), cite: `${v.text} ${v.number}`, href: `/academy/verse/${v.id}` }));
    }
    if (m.id === "thiruvalluvar") {
      works.push({ title: "Tirukkural", ta: "திருக்குறள்", count: `${fmt(thirukkural().kurals.length)} kurals in the provided PDF`, href: "/academy/library/tirukkural" });
      teachings = [1, 391, 72].map(kuralTeach).filter((t): t is NonNullable<typeof t> => !!t);
    }
    if (m.id === "tolkappiyar") {
      works.push({ title: "Tolkappiyam", ta: "தொல்காப்பியம்", count: `${fmt(sutras().length)} sūtras`, href: "/academy/library/tolkappiyam" });
      const seen = new Set<string>();
      const firsts = sutras().filter((s) => !seen.has(s.chapter) && seen.add(s.chapter));
      teachings = [0, 9, 18].map((i) => firsts[i]).filter(Boolean).map((s) => ({ lines: s.lines, cite: `Tolkāppiyam · ${s.chapter} ${s.number}`, href: "/academy/library/tolkappiyam" }));
    }
    for (const [id, name] of [["ilango", "Silappatikaram"], ["sattanar", "Manimekalai"]] as const) {
      if (m.id !== id) continue;
      const vs = verses.filter((v) => v.text === name);
      works.push({ title: name, ta: texts[name]?.name_ta, count: `${fmt(vs.length)} verses in the corpus`, href: `/academy/library/${slug(name)}` });
      teachings = spread(vs, 2).map((v) => ({ lines: v.lines.slice(0, 2), cite: `${v.text} ${v.number}`, href: `/academy/verse/${v.id}` }));
      note = "Authorship is traditional; the corpus does not attribute these verses to a poet.";
    }
    if (m.id === "uvsa") {
      for (const name of ["Silappatikaram", "Manimekalai", "Purananuru"]) works.push({ title: name, ta: texts[name]?.name_ta, count: "edition recovered from manuscripts", href: `/academy/library/${slug(name)}` });
      note = "The works listed are editions he published, not his own compositions.";
    }
    if (m.id === "kambar") note = "Kamparāmāyaṇam is not in Solveli's corpus yet, so there is nothing to cite.";
    const ob = onboarding.get(m.id);
    if (ob?.line && !teachings.length) teachings = [{ lines: [ob.line], cite: ob.cite }]; // traditional line, not in the corpus

    const ls = lessons.filter((l) => l.world === m.world).map((l) => ({ id: l.id, title: l.title }));
    const cs = challenges.filter((c) => c.world === m.world).map((c) => ({ id: c.id, title: c.title }));
    const verseCount = m.id === "thiruvalluvar" ? thirukkural().kurals.length : m.id === "tolkappiyar" ? sutras().length
      : byPoet.length || works.reduce((n, w) => n + (parseInt(w.count.replace(/,/g, "")) || 0), 0);
    return {
      ...m, works, teachings, lessons: ls, challenges: cs, note,
      stats: [
        { label: m.id === "thiruvalluvar" ? "Kurals" : m.id === "tolkappiyar" ? "Sūtras" : "Verses", value: verseCount ? fmt(verseCount) : "—" },
        { label: "Lessons", value: String(ls.length) },
        { label: "Challenges", value: String(cs.length) },
        { label: "Works", value: String(works.length) },
      ],
    };
  });
  return guideCache;
}

// ---------- library (GET /api/library) ----------

export const LIBRARY_KINDS: Record<string, string[]> = {
  literature: [], // all
  poetry: ["Sangam", "Bhakti"],
  philosophy: ["Didactic", "Spiritual"],
  history: ["Epic"],
  grammar: ["Grammar"],
  culture: [],
  inscriptions: [],
};

export type LibraryText = { slug: string; name: string; ta: string; layer: string; period: string; description: string; count: number; unit: string; world: string };

export function libraryCatalog(): LibraryText[] {
  const worldOf = (layer: string) => Object.entries(WORLD_LAYERS).find(([, ls]) => ls.includes(layer))?.[0] ?? "grammar";
  const list = libraryTexts().map((t) => ({
    slug: slug(t.name), name: t.name, ta: t.name_ta, layer: t.layer, period: t.period, description: t.description,
    count: t.count, unit: t.layer === "Didactic" ? "kurals" : "verses", world: worldOf(t.layer),
  }));
  list.push({ slug: "tolkappiyam", name: "Tolkappiyam", ta: "தொல்காப்பியம்", layer: "Grammar", period: "dating contested",
    description: "The oldest extant Tamil grammar: letters, words and poetic subject matter.", count: sutras().length, unit: "sūtras", world: "grammar" });
  return list;
}

let statsCache: Record<string, number> | undefined;
/** Counted, never estimated: what the Library can actually show. */
export function libraryStats() {
  if (statsCache) return statsCache;
  const { verses } = corpus();
  const poets = new Set(verses.map(authorOf).filter(Boolean));
  const k = thirukkural().kurals;
  return (statsCache = {
    texts: libraryCatalog().length, verses: verses.length, sutras: sutras().length, poets: poets.size,
    translations: verses.filter((v) => v.english).length,
    commentaries: k.reduce((n, x) => n + Object.values(x.commentary).filter(Boolean).length, 0),
    senses: wordnet().byId.size,
  });
}

/** Deterministic "kural of the day" (same for everyone on a given date). */
export function kuralOfDay(date = new Date()) {
  const { kurals } = thirukkural();
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5);
  return kurals[(day * 37) % kurals.length];
}

export type LibraryEntry ={ id: string; title: string; lines: string[]; sub?: string; href: string };

/** One text's contents, paginated; optionally only the verses a guide's name is attributed to. */
export function libraryText(textSlug: string, page = 1, perPage = 24, guide?: string) {
  const meta = libraryCatalog().find((t) => t.slug === textSlug);
  if (!meta) return undefined;
  let entries: LibraryEntry[];
  if (meta.slug === "tolkappiyam") {
    entries = sutras().map((s, i) => ({ id: `tol-${i}`, title: `${s.chapter} · ${s.number}`, lines: s.lines, href: "/academy/worlds/grammar" }));
  } else {
    const g = guide ? GUIDE_META.find((x) => x.id === guide) : undefined;
    entries = corpus().verses
      .filter((v) => v.text === meta.name && (!g?.poet || g.poet.some((p) => v.attribution?.includes(p))))
      .map((v) => ({
        id: v.id, title: `${v.text} ${v.number}`, lines: v.lines.slice(0, 4), sub: v.english ? v.english.split("\n")[0] : v.attribution?.replace(/^(Poet|Section|Title|Kaathai \(chapter\)): /, ""),
        href: v.url.startsWith("/") ? v.url : `/academy/verse/${v.id}`,
      }));
  }
  const pages = Math.max(1, Math.ceil(entries.length / perPage));
  const p = Math.min(Math.max(1, page), pages);
  return { meta, total: entries.length, page: p, pages, entries: entries.slice((p - 1) * perPage, p * perPage) };
}
