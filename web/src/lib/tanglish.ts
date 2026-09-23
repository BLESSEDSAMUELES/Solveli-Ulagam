// Tanglish (Tamil typed in Latin letters) → Tamil, for the global search.
//
// Built on goru001/nlp-for-tanglish (MIT, © 2020 Gaurav Arora): its SentencePiece vocabulary (trained on Tamil
// Wikipedia transliterated with indictrans) recognises and segments Tanglish input, and neighbours precomputed from
// its ULMFiT embeddings expand a word with related Tanglish words. See datasets/tanglish/build_tanglish.py.
//
// Matching works the other way round from a transliterator: every Tamil word Solveli indexes is romanised with the
// same conventions the repo's corpus uses (anbu, ulagam, tamil), then both sides are reduced to a phonetic key that
// absorbs common spelling variation (th/t, zh/l, b/p, aa/a, doubled letters…). That way a query only ever resolves to
// Tamil words that actually exist in the indexed content.
//
// The module is self-contained: `createTanglish` takes the Tamil vocabulary and returns an engine. If the repo data is
// missing, the engine still works from romanisation + phonetic keys alone (the fallback).
import fs from "node:fs";
import path from "node:path";

// ---------- Tamil → Latin (indictrans-like conventions seen in the repo's vocabulary) ----------

const VOWELS: Record<string, string> = { "அ": "a", "ஆ": "aa", "இ": "i", "ஈ": "ee", "உ": "u", "ஊ": "oo", "எ": "e", "ஏ": "e", "ஐ": "ai", "ஒ": "o", "ஓ": "o", "ஔ": "au" };
const SIGNS: Record<string, string> = { "ா": "aa", "ி": "i", "ீ": "ee", "ு": "u", "ூ": "oo", "ெ": "e", "ே": "e", "ை": "ai", "ொ": "o", "ோ": "o", "ௌ": "au" };
const CONS: Record<string, string> = {
  "க": "k", "ங": "ng", "ச": "ch", "ஞ": "nj", "ட": "t", "ண": "n", "த": "th", "ந": "n", "ப": "p", "ம": "m", "ய": "y", "ர": "r",
  "ல": "l", "வ": "v", "ழ": "zh", "ள": "l", "ற": "r", "ன": "n", "ஜ": "j", "ஷ": "sh", "ஸ": "s", "ஹ": "h",
};
const NASAL = new Set(["ங", "ஞ", "ண", "ந", "ம", "ன"]);
const VOICED: Record<string, string> = { k: "g", ch: "j", t: "d", th: "dh", p: "b" };
const PULLI = "்";

export function romanize(tamil: string): string {
  const chars = [...tamil.normalize("NFC")];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (VOWELS[c]) { out += VOWELS[c]; continue; }
    if (c === "ஃ") { out += "h"; continue; }
    const base = CONS[c];
    if (!base) { out += /\s/.test(c) ? " " : ""; continue; }
    const next = chars[i + 1];
    const prev = chars[i - 1], prev2 = chars[i - 2];
    let cons = base;
    // Voicing: after a nasal+pulli (anbu, pandam) or between vowels (ulagam, kaadhal).
    const afterNasal = prev === PULLI && NASAL.has(prev2);
    const afterVowel = i > 0 && (SIGNS[prev] !== undefined || VOWELS[prev] !== undefined || (CONS[prev] !== undefined && prev !== PULLI));
    if (VOICED[base] && (afterNasal || (afterVowel && next !== PULLI && !(prev === PULLI)))) cons = VOICED[base];
    if (c === "ற" && prev === PULLI && prev2 === "ற") cons = "r"; // ற்ற → "tr"/"rr" both reduce later
    if (next === PULLI) { out += cons; i++; continue; }
    if (next && SIGNS[next] !== undefined) { out += cons + SIGNS[next]; i++; continue; }
    out += cons + "a";
  }
  return out;
}

// ---------- phonetic key shared by queries and romanised Tamil ----------

export function phonetic(latin: string): string {
  let s = latin.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  s = s
    .replace(/zh/g, "l").replace(/sh/g, "s").replace(/ch/g, "s").replace(/j/g, "s").replace(/z/g, "l")
    .replace(/[tdh]h/g, "t").replace(/[dt]/g, "t")
    .replace(/(kh|gh|g|q|c(?!h))/g, "k")
    .replace(/(bh|ph|b|f)/g, "p")
    .replace(/w/g, "v")
    .replace(/x/g, "ks")
    .replace(/ng|nj|ny/g, "n")
    .replace(/aa|ah/g, "a").replace(/ee|ii|ie/g, "i").replace(/oo|uu|ou/g, "u").replace(/ae|ay/g, "e")
    .replace(/h/g, "")
    .replace(/(.)\1+/g, "$1");
  return s;
}

// ---------- engine ----------

export type TanglishMatch = { input: string; tamil: { word: string; score: number; via: string }[]; related: string[] };
export interface TanglishEngine {
  available: boolean; // true when the nlp-for-tanglish data loaded; false = romanisation-only fallback
  isTanglish(token: string): boolean;
  resolve(token: string, limit?: number): TanglishMatch;
}

type RepoData = { pieces: string[]; words: string[]; neighbours: Record<string, [string, number][]> };

function loadRepoData(): RepoData | null {
  const file = path.join(process.env.SOLVELI_DATA_DIR ?? path.join(process.cwd(), ".."), "datasets", "tanglish", "tanglish.json");
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Build an engine over the Tamil words (with frequencies) that the app actually indexes. */
export function createTanglish(tamilFreq: Map<string, number>, english: Set<string>): TanglishEngine {
  const repo = loadRepoData();
  const pieces = new Set(repo?.pieces.map((p) => p.replace(/^▁/, "")) ?? []);
  const repoWords = new Set(repo?.words ?? []);

  // phonetic key → Tamil words, bucketed by first letter for fuzzy lookups
  const byKey = new Map<string, { word: string; freq: number }[]>();
  const buckets = new Map<string, string[]>();
  for (const [word, freq] of tamilFreq) {
    const key = phonetic(romanize(word));
    if (key.length < 2) continue;
    if (!byKey.has(key)) { byKey.set(key, []); const b = key[0]; if (!buckets.has(b)) buckets.set(b, []); buckets.get(b)!.push(key); }
    byKey.get(key)!.push({ word, freq });
  }
  for (const list of byKey.values()) list.sort((a, b) => b.freq - a.freq);
  const keysSorted = [...byKey.keys()].sort();

  // How much of a token the SentencePiece vocabulary covers (greedy longest match) — a Tanglish-ness signal.
  function coverage(token: string) {
    if (!pieces.size) return 0;
    let i = 0, covered = 0;
    while (i < token.length) {
      let j = token.length;
      while (j > i + 1 && !pieces.has(token.slice(i, j))) j--;
      if (pieces.has(token.slice(i, j)) && j - i >= 2) covered += j - i;
      i = j;
    }
    return covered / token.length;
  }

  function isTanglish(token: string) {
    const t = token.toLowerCase();
    if (!/^[a-z]{2,}$/.test(t)) return false;
    if (repoWords.has(t)) return true; // a whole Tanglish word in the repo's vocabulary
    // A word from Solveli's English text counts only if it is also a frequent Tamil word ("thirukkural").
    if (english.has(t)) return (byKey.get(phonetic(t)) ?? []).some((w) => w.freq >= 5);
    return coverage(t) >= 0.6 || byKey.has(phonetic(t));
  }

  function lookup(key: string, via: string, weight: number, out: Map<string, { word: string; score: number; via: string }>) {
    const add = (word: string, score: number) => {
      const prev = out.get(word);
      if (!prev || prev.score < score) out.set(word, { word, score, via });
    };
    for (const w of byKey.get(key) ?? []) add(w.word, weight * (1 + Math.log1p(w.freq) / 10));
    // prefix: "kalv" → kalvi, kalviyil…
    let lo = 0, hi = keysSorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (keysSorted[mid] < key) lo = mid + 1; else hi = mid; }
    for (let k = lo, n = 0; k < keysSorted.length && keysSorted[k].startsWith(key) && n < 40; k++, n++) {
      if (keysSorted[k] === key) continue;
      for (const w of byKey.get(keysSorted[k])!.slice(0, 2)) add(w.word, weight * 0.7 * (key.length / keysSorted[k].length) * (1 + Math.log1p(w.freq) / 10));
    }
    // fuzzy: one edit for short words, two for long ones (spelling variation)
    const max = key.length >= 7 ? 2 : key.length >= 4 ? 1 : 0;
    if (max) for (const k of buckets.get(key[0]) ?? []) {
      if (Math.abs(k.length - key.length) > max) continue;
      const dist = editDistance(key, k, max);
      if (dist && dist <= max) for (const w of byKey.get(k)!.slice(0, 2)) add(w.word, weight * (0.55 - 0.1 * dist) * (1 + Math.log1p(w.freq) / 10));
    }
  }

  function resolve(token: string, limit = 6): TanglishMatch {
    const t = token.toLowerCase().replace(/[^a-z]/g, "");
    const out = new Map<string, { word: string; score: number; via: string }>();
    if (t.length < 2) return { input: token, tamil: [], related: [] };
    lookup(phonetic(t), t, 1, out);
    // related Tanglish words from the language model's embedding space, at a lower weight
    const related = (repo?.neighbours[t] ?? []).filter(([, sim]) => sim >= 0.7).slice(0, 3).map(([w]) => w);
    for (const r of related) lookup(phonetic(r), r, 0.35, out);
    // Prefer the candidate whose romanisation is closest to what was typed (tamil → தமிழ், not தம்மில்).
    const light = (x: string) => x.replace(/h/g, "").replace(/(.)+/g, "$1");
    for (const c of out.values()) c.score /= 1 + 0.12 * editDistance(light(t), light(romanize(c.word)), 6);
    const tamil = [...out.values()].sort((a, b) => b.score - a.score).slice(0, limit);
    return { input: token, tamil, related };
  }

  return { available: !!repo, isTanglish, resolve };
}
