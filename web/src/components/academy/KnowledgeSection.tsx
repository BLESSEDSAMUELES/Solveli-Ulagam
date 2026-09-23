"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState } from "react";
import { Bot, Loader2, Share2 } from "lucide-react";
import type { KgExplanation, KgGraph } from "@/lib/knowledge-graph";

// The D3 graph is its own chunk, loaded only when a word view shows it.
const KnowledgeGraphView = dynamic(() => import("@/components/academy/KnowledgeGraph"), {
  ssr: false, loading: () => <p className="kg-state"><Loader2 size={16} className="spin" /> Loading the graph…</p>,
});

// A rendering failure inside the graph must never take the search page with it.
class GraphBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.error("[knowledge-graph] render", e); }
  render() { return this.state.failed ? <p className="kg-state err">Knowledge Graph temporarily unavailable.</p> : this.props.children; }
}

// sanitizeGraph() from graph.js: keep endpoints as ids, add placeholder nodes for dangling links, drop invalid links —
// so malformed data can never crash the renderer. Also fills the fields this UI reads.
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
function sanitizeGraph(raw: unknown): KgGraph {
  const g = (raw && typeof raw === "object" ? raw : {}) as Partial<KgGraph>;
  const blank = (id: string) => ({ id, category: "Concept", description: "", tamil_label: "", synonyms_tamil: "", synonyms_english: "", keywords: "",
    main_theme: "", domain: "", notes: "", evidence: { source_section: "", sutra_reference: "", source_reference: "", extracted_sentence: "" }, row_id: "" });
  const byId = new Map<string, KgGraph["nodes"][number]>();
  for (const n of Array.isArray(g.nodes) ? g.nodes : []) {
    const id = str((n as { id?: unknown })?.id);
    if (!id || byId.has(id)) continue;
    byId.set(id, { ...blank(id), ...n, id, evidence: { ...blank(id).evidence, ...((n as { evidence?: object })?.evidence ?? {}) } });
  }
  const links: KgGraph["links"] = [];
  for (const l of Array.isArray(g.links) ? g.links : []) {
    const source = str(l?.source), target = str(l?.target);
    if (!source || !target) continue;
    for (const id of [source, target]) if (!byId.has(id)) byId.set(id, blank(id));
    links.push({ ...l, source, target, relation: str(l.relation) || "related_to", row_id: str(l.row_id), evidence: { ...blank("").evidence, ...(l.evidence ?? {}) } });
  }
  const meta = (g.meta && typeof g.meta === "object" ? g.meta : {}) as Partial<KgGraph["meta"]>;
  const start = (Array.isArray(meta.start_nodes) ? meta.start_nodes.map(str) : []).filter((id) => byId.has(id));
  return {
    word: str(g.word), theme: str(g.theme), canonical: str(g.canonical), mapping: g.mapping === "llm" || g.mapping === "none" ? g.mapping : "ontology",
    nodes: [...byId.values()], links,
    meta: { start_nodes: start.length ? start : byId.size ? [byId.keys().next().value!] : [], depth: Number(meta.depth) || 2, fallback: meta.fallback, ms: Number(meta.ms) || 0 },
  };
}

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error" };
const post = async <T,>(url: string, word: string, signal: AbortSignal): Promise<T> => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word }), signal });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
  return j as T;
};

// Knowledge Graph + Concept Meaning / Literary Context / Cultural–Ethical Significance for the searched word.
// Everything here is independent of the word search: it loads after the result, and any failure stays inside this card.
export default function KnowledgeSection({ word }: { word: string }) {
  const [graph, setGraph] = useState<Load<KgGraph>>({ state: "loading" });
  const [ex, setEx] = useState<Load<KgExplanation>>({ state: "loading" });

  useEffect(() => {
    const ctl = new AbortController();
    const fail = <T,>(set: (s: Load<T>) => void) => (e: Error) => { if (e.name !== "AbortError") set({ state: "error" }); };
    post<KgGraph>("/api/knowledge-graph", word, ctl.signal).then((data) => setGraph({ state: "ok", data: sanitizeGraph(data) })).catch(fail(setGraph));
    post<KgExplanation>("/api/knowledge-graph/explanation", word, ctl.signal).then((data) => {
      const s = (v: unknown) => (typeof v === "string" ? v : "");
      if (!s(data.conceptMeaning) && !s(data.literaryContext) && !s(data.culturalEthicalSignificance)) throw new Error("malformed explanation");
      setEx({ state: "ok", data: { ...data, conceptMeaning: s(data.conceptMeaning), literaryContext: s(data.literaryContext),
        culturalEthicalSignificance: s(data.culturalEthicalSignificance), model: s(data.model), unverified: Array.isArray(data.unverified) ? data.unverified.map(String) : [] } });
    }).catch(fail(setEx));
    return () => ctl.abort();
  }, [word]);

  const g = graph.state === "ok" ? graph.data : undefined;
  return (
    <section className="kg-section" aria-labelledby="kg-title">
      <h3 id="kg-title"><Share2 size={18} /> Knowledge Graph <small>Tolkāppiyam ontology · relationships around this concept</small></h3>
      {graph.state === "loading" && <p className="kg-state"><Loader2 size={16} className="spin" /> Building the knowledge graph…</p>}
      {graph.state === "error" && <p className="kg-state err">Knowledge Graph temporarily unavailable.</p>}
      {g && (g.nodes.length === 0
        ? <p className="kg-state">No related concepts found for this word in the Tolkāppiyam ontology.</p>
        : (
          <>
            <p className="kg-map">
              {g.meta.fallback
                ? <>No ontology concept matches <b lang="ta">{g.word}</b>{g.mapping === "llm" ? <> (AI mapped it to “{g.canonical}”, theme {g.theme || "—"})</> : null} — showing the nearest map, <b>{g.meta.start_nodes[0]}</b>, for orientation.</>
                : g.mapping === "llm"
                  ? <>AI mapped <b lang="ta">{g.word}</b> to <b>{g.canonical}</b> (theme {g.theme || "—"}); start concept <b>{g.meta.start_nodes[0]}</b>.</>
                  : <><b lang="ta">{g.word}</b> is the ontology concept <b>{g.meta.start_nodes[0]}</b>{g.theme ? <> · {g.theme}</> : null}.</>}
            </p>
            <GraphBoundary><KnowledgeGraphView graph={g} /></GraphBoundary>
          </>
        ))}

      <div className="kg-explain">
        <p className="kg-ai"><span className="wc-status ai"><Bot size={14} /> AI-assisted explanation</span>
          <small>Generated from the ontology and the verified evidence above. It is an interpretation, not literary evidence.</small></p>
        {ex.state === "loading" && <p className="kg-state"><Loader2 size={16} className="spin" /> Writing the explanation…</p>}
        {ex.state === "error" && <p className="kg-state err">The explanation is temporarily unavailable. The graph and the verified results are unaffected.</p>}
        {ex.state === "ok" && (
          <>
            <Part title="Concept Meaning" text={ex.data.conceptMeaning} />
            <Part title="Literary Context" text={ex.data.literaryContext} />
            <Part title="Cultural / Ethical Significance" text={ex.data.culturalEthicalSignificance} />
            {ex.data.unverified.length > 0 && (
              <p className="wc-warn">Not verified in the Solveli corpus: {ex.data.unverified.join(", ")}. Treat these references with caution.</p>
            )}
            <p className="fine">Model: {ex.data.model} · prompt from the Tolkāppiyam Knowledge Graph · {ex.data.evidenceUsed} verified evidence lines supplied.</p>
          </>
        )}
      </div>
    </section>
  );
}

function Part({ title, text }: { title: string; text: string }) {
  return (
    <div className="kg-part">
      <h4>{title}</h4>
      {text ? text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>) : <p className="kg-muted">Not provided for this concept.</p>}
    </div>
  );
}
