// Knowledge Graph service — ported from the Tolkappiyam project (G:\Solveli\Tolkappiyam\backend):
//   ontology_mapper.py        → buildGraph(), findStartNodes(), getSubgraph()   (same tiers, BFS, Thinai rule, link filter)
//   sutra_evidence.py         → inferSutraEvidence()                            (same scoring, on Solveli's Tolkāppiyam text)
//   classifier.py / simplifier.py → classify(), simplify()                      (same prompts; only used when the word has no
//                                                                                 direct ontology match)
//   explanation_generator.py  → explain()                                      (same English prompt and 3-section format)
//   app.py /query             → knowledgeGraph()                                (same fallback chain: canonical → clean → theme
//                                                                                 → "Tolkappiyam")
// Isolated on purpose: nothing in the word search depends on it, and every failure here is caught by its API routes.
// Differences from the original, each deliberate:
//   · input is Solveli's already-normalised word, so thol.normalize() is not repeated;
//   · a direct ontology match skips the two LLM calls (same start node, ~2 s faster, no model cost);
//   · sutra evidence needs at least one real Tamil-term hit — the original "always return something" would attach an
//     unrelated sutra to every node, which Solveli's trust rules forbid;
//   · the explanation prompt carries the verified evidence and is told to cite nothing else.
import { ontologyAll, searchWord, sutras } from "@/lib/corpus";
import { groqChat, groqConfigured, groqModel } from "@/lib/groq";

export type Evidence = { source_section: string; sutra_reference: string; source_reference: string; extracted_sentence: string };
export type KgNode = {
  id: string; category: string; description: string; tamil_label: string; synonyms_tamil: string; synonyms_english: string;
  keywords: string; main_theme: string; domain: string; notes: string; evidence: Evidence; row_id: string;
  degree?: number; centrality?: number;
};
export type KgLink = { source: string; target: string; relation: string; evidence: Evidence; row_id: string };
export type KgGraph = {
  word: string; theme: string; canonical: string; mapping: "ontology" | "llm" | "none";
  nodes: KgNode[]; links: KgLink[];
  meta: { start_nodes: string[]; depth: number; fallback?: { from: string; to: string }; ms: number };
};
export type KgExplanation = {
  word: string; concept: string; conceptMeaning: string; literaryContext: string; culturalEthicalSignificance: string;
  ai: true; model: string; unverified: string[]; evidenceUsed: number;
};

// ---------- normalize (ontology_mapper.normalize) ----------
const clean = (v: unknown) => { const s = v == null ? "" : String(v).trim(); return s.toLowerCase() === "nan" ? "" : s; };
export const normalize = (text: unknown) => clean(text).replace(/[^\p{L}\p{N}_\u0B80-\u0BFF\s]/gu, "").trim().toLowerCase();
const EMPTY_EV: Evidence = { source_section: "", sutra_reference: "", source_reference: "", extracted_sentence: "" };

// ---------- sutra evidence (sutra_evidence.py) over Solveli's Tholkappiam.txt ----------
type SutraHit = { book: string; chapter: string; number: string; text: string; norm: string };
const BOOKS = ["Ezhuthathikaram", "Sollathikaram", "Porulathikaram"];
const normTa = (t: string) => clean(t).replace(/[^\u0B80-\u0BFF\s]/g, " ").replace(/\s+/g, " ").trim();
function sutraIndex(): SutraHit[] {
  const order: string[] = [];
  for (const s of sutras()) if (!order.includes(s.chapter)) order.push(s.chapter);
  // Chapters come in order, nine per athikāram (same rule the Grammar challenges use).
  return sutras().map((s) => ({ book: BOOKS[Math.min(2, Math.floor(order.indexOf(s.chapter) / 9))], chapter: s.chapter, number: s.number, text: s.lines.join(" "), norm: normTa(s.lines.join(" ")) }));
}
const desiredBook = (hint: string) => { const d = hint.toLowerCase(); return d.includes("ezhuthu") ? BOOKS[0] : d.includes("sol") ? BOOKS[1] : BOOKS[2]; };
const taTerms = (...values: string[]) => [...new Set(values.flatMap((v) => clean(v).split(/[,;|/]/)).map(normTa).filter((t) => [...t].length >= 2))];

function inferSutraEvidence(index: SutraHit[], o: { tamil: string; synTa: string; keywords: string; domain: string }): Evidence | undefined {
  const terms = taTerms(o.tamil, o.synTa, o.keywords);
  if (!terms.length) return undefined;
  const book = desiredBook(o.domain);
  let best: SutraHit | undefined, bestScore = -1, bestHits = 0;
  for (const h of index) {
    let score = h.book === book ? 3 : 0, hits = 0;
    for (const t of terms) if (h.norm.includes(t)) { score += 6; hits++; }
    if (score > bestScore) { best = h; bestScore = score; bestHits = hits; }
  }
  if (!best || !bestHits) return undefined; // no Tamil term occurs in any sutra → no evidence (never a guess)
  return {
    source_section: `${best.book} – ${best.chapter}`,
    sutra_reference: `Tolkāppiyam – ${best.book} – ${best.chapter} – Sutra ${best.number}`,
    source_reference: `Tolkāppiyam – ${best.book}`,
    extracted_sentence: best.text,
  };
}

// ---------- graph build (module scope in ontology_mapper.py) ----------
type Graph = { adj: Map<string, KgLink[]>; meta: Map<string, KgNode>; alias: Map<string, Set<string>>; normIds: Map<string, string[]> };
const G = globalThis as unknown as { __kg?: Graph };

function rowEvidence(r: Record<string, string>): Evidence {
  const domain = clean(r.Domain) || clean(r["Main Theme"]) || clean(r.Category);
  const d = normalize(domain);
  const inferred = !d ? "" : d.includes("ezhuthu") ? "Ezhuthathikaram" : d.includes("sol") ? "Sollathikaram"
    : ["porul", "akam", "puram", "thinai", "culture", "ethics"].some((k) => d.includes(k)) ? "Porulathikaram" : "";
  return {
    source_section: clean(r.Source_Section) || inferred || domain,
    sutra_reference: clean(r.Sutra_Reference) || clean(r["Sutra Reference"]) || clean(r.Sutra),
    source_reference: clean(r.Source_Reference) || clean(r.Source_Text),
    extracted_sentence: clean(r.Extracted_Sentence) || clean(r["Extracted Sentence"]),
  };
}
const evScore = (e: Evidence) => (["source_section", "sutra_reference", "source_reference", "extracted_sentence"] as const).filter((k) => clean(e[k])).length;

function graph(): Graph {
  if (G.__kg) return G.__kg;
  const index = sutraIndex();
  const adj = new Map<string, KgLink[]>(), meta = new Map<string, KgNode>(), alias = new Map<string, Set<string>>();
  const push = (id: string, e: KgLink) => adj.set(id, [...(adj.get(id) ?? []), e]);
  const blank = (id: string, category: string, evidence: Evidence): KgNode => ({ id, category, description: "", tamil_label: "", synonyms_tamil: "",
    synonyms_english: "", keywords: "", main_theme: "", domain: "", notes: "", evidence, row_id: "" });

  for (const r of ontologyAll()) {
    const eng = clean(r.English_Label);
    if (!eng) continue;
    const rowId = clean(r.ID), parent = clean(r.Parent_Concept), relation = clean(r.Relation_Type) || "related_to";
    const category = clean(r.Category) || "Concept";
    const evidence = rowEvidence(r);
    if (!evidence.sutra_reference || !evidence.extracted_sentence) {
      const domainHint = clean(r.Domain) || clean(r["Main Theme"]) || clean(r.Category);
      const inf = inferSutraEvidence(index, { tamil: r.Tamil_Label, synTa: r.Synonyms_Tamil, keywords: r.Keywords, domain: domainHint });
      if (inf) {
        for (const k of Object.keys(inf) as (keyof Evidence)[]) if (inf[k] && !evidence[k]) evidence[k] = inf[k];
        if (!clean(evidence.source_section) || normalize(evidence.source_section) === normalize(domainHint)) evidence.source_section = inf.source_section;
        if (!clean(evidence.source_reference) || normalize(evidence.source_reference) === "tolkappiyam") evidence.source_reference = inf.source_reference;
      }
    }
    const node: KgNode = { id: eng, category, description: clean(r.Description), tamil_label: clean(r.Tamil_Label), synonyms_tamil: clean(r.Synonyms_Tamil),
      synonyms_english: clean(r.Synonyms_English), keywords: clean(r.Keywords), main_theme: clean(r["Main Theme"]), domain: clean(r.Domain),
      notes: clean(r.Notes), evidence, row_id: rowId };
    const had = meta.get(eng);
    if (!had) meta.set(eng, node);
    else { // merge without clobbering richer metadata
      if ((!had.category || had.category === "Concept") && node.category) had.category = node.category;
      if (!had.description && node.description) had.description = node.description;
      for (const k of ["tamil_label", "synonyms_tamil", "synonyms_english", "keywords", "main_theme", "domain", "notes"] as const) if (!had[k] && node[k]) had[k] = node[k];
      if (evScore(node.evidence) > evScore(had.evidence)) { had.evidence = node.evidence; if (rowId) had.row_id = rowId; }
    }
    for (const field of [eng, r.Tamil_Label, r.Synonyms_Tamil, r.Synonyms_English, r.Keywords]) {
      for (const part of clean(field).split(/[,;|/]/)) {
        const a = normalize(part);
        if (a) alias.set(a, (alias.get(a) ?? new Set()).add(eng));
      }
    }
    if (parent) {
      if (!meta.has(parent)) meta.set(parent, blank(parent, category, { ...EMPTY_EV })); // concepts that only appear as parents
      push(parent, { source: parent, target: eng, relation, evidence, row_id: rowId });
      push(eng, { source: eng, target: parent, relation: `reverse_${relation}`, evidence, row_id: rowId }); // bidirectional traversal
    }
  }
  const normIds = new Map<string, string[]>();
  for (const id of meta.keys()) normIds.set(normalize(id), [...(normIds.get(normalize(id)) ?? []), id]);
  return (G.__kg = { adj, meta, alias, normIds });
}

// ---------- find start node (find_start_nodes) ----------
const STOP_CONCEPTS = new Set(["thinai", "akam", "puram", "porul", "ezhuthu", "sol", "grammar", "ethics", "culture", "concept"]);

export function findStartNodes(query: string, max = 1): string[] {
  const { meta, alias, normIds } = graph();
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(/\s+/).filter((w) => [...w].length > 1);
  const rank = (cands: Iterable<string>) => [...new Set(cands)].filter(Boolean).map((id) => {
    const n = normalize(id);
    const pos = words.indexOf(n);
    return { id, k: [n === q ? 0 : 1, !STOP_CONCEPTS.has(q) && STOP_CONCEPTS.has(n) ? 1 : 0, pos < 0 ? 999 : pos, -[...n].length] as const, n };
  }).sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.k[3] - b.k[3] || a.n.localeCompare(b.n)).slice(0, max).map((x) => x.id);
  const exact = (w: string) => [...(normIds.get(w) ?? []), ...(alias.get(w) ?? [])];
  const labels = [...meta.keys()];

  let c = exact(q); if (c.length) return rank(c);                                                       // 1) full query
  for (const w of words) { if (STOP_CONCEPTS.has(w)) continue; c = exact(w); if (c.length) return rank(c); } // 2) tokens, non-generic
  for (const w of words) { c = exact(w); if (c.length) return rank(c); }                                  // 3) tokens incl. generic
  c = labels.filter((l) => normalize(l).includes(q)); if (c.length) return rank(c);                      // 4) substring, full query
  for (const w of words) { if (STOP_CONCEPTS.has(w) || [...w].length <= 2) continue; c = labels.filter((l) => normalize(l).includes(w)); if (c.length) return rank(c); } // 5)
  for (const w of words) { if ([...w].length <= 2) continue; c = labels.filter((l) => normalize(l).includes(w)); if (c.length) return rank(c); }                          // 6)
  return [];
}

// ---------- BFS subgraph (get_subgraph) ----------
export function getSubgraph(query: string, depth = 2): { nodes: KgNode[]; links: KgLink[]; start: string[] } {
  const { adj, meta } = graph();
  const start = findStartNodes(query, 1);
  if (!start.length) return { nodes: [], links: [], start };
  const visited = new Set<string>();
  const queue: [string, number][] = start.map((n) => [n, 0]);
  while (queue.length) {
    const [cur, level] = queue.shift()!;
    if (visited.has(cur) || level > depth) continue;
    visited.add(cur);
    if (level >= depth) continue;
    for (const e of adj.get(cur) ?? []) {
      // For Thinai-children queries (e.g. Kurinji), avoid pulling in sibling landscapes.
      if (cur === "Thinai" && e.relation === "has_thinai" && !start.includes("Thinai") && !start.includes(e.target)) continue;
      if (!visited.has(e.target)) queue.push([e.target, level + 1]);
    }
  }
  const nodes = [...visited].map((id) => ({ ...(meta.get(id) ?? { id, category: "Concept", description: "", tamil_label: "", synonyms_tamil: "", synonyms_english: "", keywords: "", main_theme: "", domain: "", notes: "", evidence: { ...EMPTY_EV }, row_id: "" }) }));
  const links: KgLink[] = [];
  const seen = new Set<string>();
  for (const id of visited) for (const e of adj.get(id) ?? []) {
    if (!visited.has(e.source) || !visited.has(e.target) || e.relation.startsWith("reverse_")) continue;
    const key = `${e.source}\u0000${e.target}\u0000${e.relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(e);
  }
  // Degree centrality DC(v) = deg(v)/(|V|-1) — the weightage the original README describes (shown in the node inspector).
  for (const n of nodes) {
    n.degree = links.filter((l) => l.source === n.id || l.target === n.id).length;
    n.centrality = nodes.length > 1 ? +(n.degree / (nodes.length - 1)).toFixed(3) : 0;
  }
  return { nodes, links, start };
}

// ---------- LLM steps (classifier.py, simplifier.py) — verbatim prompts ----------
const classify = (query: string) => groqChat({ user: `
You are an expert classical Tamil scholar and Tolkāppiyam domain specialist.

Your task is to identify the PRIMARY thematic domain of the given user query
based on the conceptual framework of Tolkāppiyam.

Allowed themes (choose ONLY ONE):
- Ezhuthu (Phonology)
- Sol (Morphology)
- Porul (Semantics / Meaning)
- Akam (Inner life, love, emotions)
- Puram (Outer life, war, society)
- Thinai (Landscape-based poetic classification)
- Ethics (Aram, moral philosophy)
- Culture (Tamil cultural practices and values)



User Query:
"""${query}"""


Instructions:
- Focus on the USER'S INTENT, not surface keywords
- Handle modern Tamil, classical Tamil, English, or mixed language
- If multiple themes seem relevant, choose the MOST dominant one
- Do NOT explain your answer
- Do NOT add extra words, punctuation, or formatting

Output format:
Return ONLY the theme name (exact spelling from the list above).
` }).then((t) => t.replace(/\s*\([\s\S]*$/, "").replace(/[^\p{L} ]/gu, "").trim().split(/\s+/)[0] ?? "");

const simplify = (query: string, theme: string) => groqChat({ user: `
You are an expert in Tolkāppiyam ontology and classical Tamil literary theory.

Task:
Rewrite the given user query into a simplified, canonical form that aligns
strictly with Tolkāppiyam concepts.

Theme:
${theme}

User Query:
"""${query}"""

Guidelines:
- Remove ambiguity and conversational language
- Map modern or informal expressions to classical conceptual terms
- Ensure the output clearly reflects the given theme
- Keep the output concise (one short phrase or sentence)
- Use standard Tolkāppiyam terminology where applicable
- Do NOT explain the transformation
- Do NOT add extra commentary or formatting

Output Format:
Return ONLY the canonical query text.
` }).then((t) => t.replace(/^["'“]|["'”]$/g, "").trim().slice(0, 120));

// ---------- /query pipeline (app.py) ----------
const cache = (globalThis as unknown as { __kgCache?: Map<string, Promise<KgGraph>> }).__kgCache ??= new Map();
const DEPTH = 2;

export function knowledgeGraph(word: string): Promise<KgGraph> {
  const w = word.normalize("NFC").trim();
  const hit = cache.get(w);
  if (hit) return hit;
  const p = build(w).catch((e) => { cache.delete(w); throw e; }); // failures are not cached
  cache.set(w, p);
  return p;
}

async function build(w: string): Promise<KgGraph> {
  const t0 = performance.now();
  const done = (theme: string, canonical: string, mapping: KgGraph["mapping"], g: ReturnType<typeof getSubgraph>, fallback?: { from: string; to: string }): KgGraph => ({
    word: w, theme, canonical, mapping, nodes: g.nodes, links: g.links,
    meta: { start_nodes: g.start, depth: DEPTH, ...(fallback ? { fallback } : {}), ms: Math.round(performance.now() - t0) },
  });

  // Direct ontology match (Tamil label / synonym / keyword / English id): the start node the LLM route would reach anyway.
  const direct = getSubgraph(w, DEPTH);
  if (direct.nodes.length) {
    const n = direct.nodes.find((x) => x.id === direct.start[0]);
    return done(n?.main_theme || n?.category || "", direct.start[0], "ontology", direct);
  }
  // Original route: classify → simplify → subgraph(canonical) → fallbacks.
  let theme = "", canonical = "";
  if (groqConfigured()) {
    theme = await classify(w);
    canonical = (await simplify(w, theme)) || w;
  }
  let g = canonical ? getSubgraph(canonical, DEPTH) : { nodes: [], links: [], start: [] };
  let fallback: { from: string; to: string } | undefined;
  if (!g.nodes.length && theme) { g = getSubgraph(theme, Math.min(2, DEPTH)); if (g.nodes.length) fallback = { from: "canonical", to: "theme" }; }
  if (!g.nodes.length) { g = getSubgraph("Tolkappiyam", 2); if (g.nodes.length) fallback = { from: theme ? "theme" : "word", to: "Tolkappiyam" }; }
  return done(theme, canonical || w, groqConfigured() ? "llm" : "none", g, fallback);
}

// ---------- explanation (explanation_generator.py, English branch) ----------
const H = { concept: /^\s*\**\s*Concept Meaning\s*\**\s*:?\s*\**\s*$/i, literary: /^\s*\**\s*Literary Context\s*\**\s*:?\s*\**\s*$/i, cultural: /^\s*\**\s*Cultural\s*\/\s*Ethical Significance\s*\**\s*:?\s*\**\s*$/i };

/** Split the model's reply into the three sections, like splitStructuredBlocks() in research.js. Inline "Heading: text" is accepted too. */
export function splitSections(raw: string) {
  const out = { concept: "", literary: "", cultural: "" };
  let cur: keyof typeof out | null = null;
  for (const line of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const inline = line.match(/^\s*\**\s*(Concept Meaning|Literary Context|Cultural\s*\/\s*Ethical Significance)\s*\**\s*:\s*\**\s*(.+)$/i);
    const key = (Object.keys(H) as (keyof typeof H)[]).find((k) => H[k].test(line));
    if (key) { cur = key; continue; }
    if (inline) {
      cur = /concept/i.test(inline[1]) ? "concept" : /literary/i.test(inline[1]) ? "literary" : "cultural";
      out[cur] += inline[2] + "\n";
      continue;
    }
    if (/^\s*English Explanation\s*:?\s*$/i.test(line)) continue;
    if (cur) out[cur] += line + "\n";
  }
  const tidy = (s: string) => s.replace(/\*\*/g, "").trim();
  return { concept: tidy(out.concept), literary: tidy(out.literary), cultural: tidy(out.cultural) };
}

const exCache = (globalThis as unknown as { __kgExplain?: Map<string, Promise<KgExplanation>> }).__kgExplain ??= new Map();

export function explain(word: string): Promise<KgExplanation> {
  const w = word.normalize("NFC").trim();
  const hit = exCache.get(w);
  if (hit) return hit;
  const p = knowledgeGraph(w).then(buildExplanation).catch((e) => { exCache.delete(w); throw e; });
  exCache.set(w, p);
  return p;
}

async function buildExplanation(g: KgGraph): Promise<KgExplanation> {
  if (!groqConfigured()) throw new Error("AI assistance is not configured.");
  const concept = g.meta.fallback ? g.word : g.canonical;
  // A fallback graph (theme or the Tolkāppiyam root) is not about this word, so it contributes neither concepts nor evidence.
  const related = g.meta.fallback ? "(no matching ontology concepts)" : g.nodes.map((n) => n.id).slice(0, 20).join(", ");

  // Verified material Solveli holds for this concept: ontology descriptions, matched Tolkāppiyam sutras, corpus distribution.
  const focus = g.meta.fallback ? [] : g.nodes.slice(0, 12);
  const evidence: string[] = [];
  for (const n of focus) {
    if (n.description) evidence.push(`- Ontology: ${n.id}${n.tamil_label ? ` (${n.tamil_label})` : ""} — ${n.description}`);
    if (n.evidence.sutra_reference && n.evidence.extracted_sentence) evidence.push(`- ${n.evidence.sutra_reference}: "${n.evidence.extracted_sentence}"`);
  }
  const s = searchWord(g.word);
  if (s.kind === "result" && s.byLayer.length) {
    evidence.push(`- Solveli corpus: "${s.query}" occurs in ${s.byLayer.reduce((a, l) => a + l.count, 0)} verses — ${s.byLayer.map((l) => `${l.layer} (${l.period}): ${l.count}`).join("; ")}.`);
  }

  const prompt = `
You are a senior scholar of Classical Tamil literature specializing in Tolkāppiyam.

Your task is to generate a STRICTLY ACADEMIC explanation in English ONLY.

Concept:
${concept}${concept !== g.word ? `\n(Searched Tamil word: ${g.word})` : ""}

Related Concepts from Ontology:
${related}

CRITICAL INSTRUCTIONS (MUST FOLLOW):
- Output ONLY in English.
- Do NOT add extra headings beyond the format below.
- Do NOT use bullet points.
- Do NOT hallucinate modern interpretations.
- Base explanation only on classical Tamil literary theory.

FORMAT (FOLLOW EXACTLY):

English Explanation:

Concept Meaning:
<paragraph>

Literary Context:
<paragraph>

Cultural / Ethical Significance:
<paragraph if relevant>

VERIFIED EVIDENCE (the only sources you may cite):
${evidence.length ? evidence.join("\n") : "- None available for this concept."}

EVIDENCE RULES (MUST FOLLOW):
- Do NOT quote any verse, sutra or kural, and do NOT name a work, author, chapter, kural number or sutra number, unless it appears in VERIFIED EVIDENCE above.
- If the evidence does not support a literary claim, write "Evidence for this is not available in the Solveli corpus." instead of inventing one.
- Present interpretations as interpretations, not as historical fact.
`;
  const raw = await groqChat({ user: prompt, temperature: 0.2, timeoutMs: 25000 });
  const sec = splitSections(raw);
  if (!sec.concept && !sec.literary && !sec.cultural) throw new Error("malformed explanation");

  // Flag any numbered reference the model produced that is not in the evidence it was given.
  const allowed = evidence.join(" ");
  const refs = [...raw.matchAll(/\b(?:kural|kuṟaḷ|sutra|sūtra|nūrpā|noorpa|verse|poem|song)\s*(?:no\.?\s*)?\d+/gi)].map((m) => m[0]);
  const unverified = [...new Set(refs.filter((r) => !allowed.toLowerCase().includes(r.toLowerCase())))];

  return {
    word: g.word, concept, conceptMeaning: sec.concept, literaryContext: sec.literary, culturalEthicalSignificance: sec.cultural,
    ai: true, model: groqModel(), unverified, evidenceUsed: evidence.length,
  };
}
