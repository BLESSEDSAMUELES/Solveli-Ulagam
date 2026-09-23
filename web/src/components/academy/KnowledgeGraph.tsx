"use client";

// Interactive Knowledge Graph — ported from the Tolkappiyam project's static/js/graph.js (drawGraph, focusNode, showNodeModal,
// hierarchy view, searchNodeByName, resetView) and research.js (evidence block, degree + category analytics).
// Same force layout parameters, category palette, arrows, relation labels, hover growth + tooltip, click-to-focus with
// re-centring, zoom 0.15–6×, drag, and the force ↔ hierarchy toggle with collapsible sub-trees.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  drag, forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, hierarchy, select, tree, zoom, zoomIdentity,
  type HierarchyNode, type Selection, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum, type ZoomBehavior,
} from "d3";
import "d3-transition";
import { GitBranch, Maximize2, Minus, Network, Plus, Search as SearchIcon, X } from "lucide-react";
import { lang } from "@/lib/profile";
import type { KgGraph, KgLink, KgNode } from "@/lib/knowledge-graph";

// ---------- category palette (graph.js CATEGORIES / getCategory) ----------
const CATEGORIES = {
  thinai: { color: "#22c55e", label: "Thinai" },
  akam: { color: "#3b82f6", label: "Akam" },
  puram: { color: "#f97316", label: "Puram" },
  grammar: { color: "#a855f7", label: "Grammar" },
  ethics: { color: "#ef4444", label: "Ethics / Culture" },
  default: { color: "#0ea5e9", label: "Concept" },
} as const;
type Cat = keyof typeof CATEGORIES;
export function categoryOf(n: Pick<KgNode, "id" | "category">): Cat {
  const c = `${n.id || ""} ${n.category || ""}`.toLowerCase();
  if (c.includes("thinai")) return "thinai";
  if (c.includes("akam")) return "akam";
  if (c.includes("puram")) return "puram";
  if (c.includes("grammar") || c.includes("ezhuthu") || c.includes("sol")) return "grammar";
  if (c.includes("ethic") || c.includes("culture") || c.includes("aram")) return "ethics";
  return "default";
}
const SIZE = 30; // graph.js: every category uses size 30
const rel = (r: string) => (r || "related to").replace(/^reverse_/, "").replace(/_/g, " ");
const clip = (s: string, n = 12) => ([...s].length > n ? [...s].slice(0, n - 1).join("") + "…" : s);

type N = KgNode & SimulationNodeDatum;
type L = SimulationLinkDatum<N> & Omit<KgLink, "source" | "target"> & { source: string | N; target: string | N };
const idOf = (v: string | N) => (typeof v === "string" ? v : v.id);

export default function KnowledgeGraphView({ graph }: { graph: KgGraph }) {
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const api = useRef<{ focus: (id: string) => void; reset: () => void; zoomBy: (k: number) => void; toggle: (id?: string) => void; hierarchyToggle: (id: string) => void } | null>(null);
  const [selected, setSelected] = useState<string | undefined>(graph.meta.start_nodes[0]);
  const [mode, setMode] = useState<"force" | "hierarchy">("force");
  const [find, setFind] = useState("");
  const [findMsg, setFindMsg] = useState("");
  const [tip, setTip] = useState<{ x: number; y: number; name: string; cat: string } | null>(null);
  const ta = lang.use().lang === "ta";
  const name = useCallback((n: KgNode) => (ta ? n.tamil_label || n.id : n.id), [ta]);
  const start = graph.meta.start_nodes[0];

  // Copy the data: d3 mutates nodes (x/y) and links (source/target objects).
  const data = useMemo(() => ({
    nodes: graph.nodes.map((n) => ({ ...n })) as N[],
    links: graph.links.map((l) => ({ ...l })) as L[],
  }), [graph]);
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);

  useEffect(() => {
    const svgEl = svgRef.current, container = box.current;
    if (!svgEl || !container || !data.nodes.length) return;
    const W = container.clientWidth || 800, H = container.clientHeight || 460;
    const svg = select(svgEl).attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = (ms: number) => (reduced ? 0 : ms);

    // defs: arrows (normal + active) and a highlight glow
    const defs = svg.append("defs");
    for (const [id, fill] of [["kg-arrow", "rgba(100,116,139,.6)"], ["kg-arrow-active", "#2563eb"]]) {
      defs.append("marker").attr("id", id).attr("viewBox", "0 -5 10 10").attr("refX", 28).attr("refY", 0)
        .attr("markerWidth", 5).attr("markerHeight", 5).attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", fill);
    }
    const glow = defs.append("filter").attr("id", "kg-glow").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
    glow.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", 6).attr("result", "b");
    const m = glow.append("feMerge"); m.append("feMergeNode").attr("in", "b"); m.append("feMergeNode").attr("in", "SourceGraphic");
    for (const [key, meta] of Object.entries(CATEGORIES)) {
      const g = defs.append("radialGradient").attr("id", `kg-grad-${key}`).attr("cx", "30%").attr("cy", "30%").attr("r", "70%");
      g.append("stop").attr("offset", "0%").attr("stop-color", meta.color).attr("stop-opacity", 0.95);
      g.append("stop").attr("offset", "100%").attr("stop-color", meta.color).attr("stop-opacity", 0.6);
    }

    const layer = svg.append("g").attr("class", "kg-zoom");
    const zb: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>().scaleExtent([0.15, 6]).on("zoom", (e) => layer.attr("transform", e.transform));
    svg.call(zb).on("dblclick.zoom", null);

    const sim: Simulation<N, L> = forceSimulation<N>(data.nodes)
      .force("link", forceLink<N, L>(data.links).id((d) => d.id).distance(150))
      .force("charge", forceManyBody().strength(-600))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collision", forceCollide(SIZE * 1.5))
      .alphaDecay(0.04).velocityDecay(0.45);
    if (reduced) { sim.stop(); for (let i = 0; i < 300; i++) sim.tick(); }

    const link = layer.append("g").attr("class", "kg-links").selectAll<SVGLineElement, L>("line").data(data.links).enter().append("line")
      .attr("class", "kg-link").attr("marker-end", "url(#kg-arrow)");
    const label = layer.append("g").selectAll<SVGTextElement, L>("text").data(data.links).enter().append("text")
      .attr("class", "kg-edge-label").attr("text-anchor", "middle").attr("dy", -4).text((d) => rel(d.relation));

    const node: Selection<SVGGElement, N, SVGGElement, unknown> = layer.append("g").selectAll<SVGGElement, N>("g").data(data.nodes).enter().append("g")
      .attr("class", (d) => `kg-node${d.id === start ? " start" : ""}`).attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (d) => `${d.id}${d.tamil_label ? ` (${d.tamil_label})` : ""}, ${CATEGORIES[categoryOf(d)].label}`);
    node.append("circle").attr("class", "kg-halo").attr("r", SIZE * 1.55).attr("stroke", (d) => CATEGORIES[categoryOf(d)].color)
      .style("animation-delay", (_d, i) => `${(i * 0.3) % 3}s`);
    node.append("circle").attr("class", "kg-body").attr("r", SIZE).attr("fill", (d) => `url(#kg-grad-${categoryOf(d)})`).attr("stroke", (d) => CATEGORIES[categoryOf(d)].color);
    node.append("text").attr("class", "kg-label").attr("text-anchor", "middle").attr("dy", "0.35em")
      .style("font-size", (d) => { const len = [...name(d)].length; return `${len > 10 ? 8 : len > 6 ? 9.5 : 11}px`; })
      .text((d) => clip(name(d)));

    // Animated view changes; under reduced motion they apply at once (a 0 ms transition would still wait for a frame).
    const moveTo = (t: ReturnType<typeof zoomIdentity.scale>, ms: number) => (reduced ? svg.call(zb.transform, t) : svg.transition().duration(ms).call(zb.transform, t));
    const centerOn = (d: N, k = 1.6) => moveTo(zoomIdentity.translate(W / 2 - (d.x ?? 0) * k, H / 2 - (d.y ?? 0) * k).scale(k), 750);

    // focusNode(): dim everything not connected, highlight the focused node's links, re-centre.
    const focus = (id: string) => {
      const d = byId.get(id);
      if (!d) return;
      const connected = new Set([id]);
      for (const l of data.links) { const s = idOf(l.source), t = idOf(l.target); if (s === id || t === id) { connected.add(s); connected.add(t); } }
      node.classed("dim", (n) => !connected.has(n.id)).classed("focused", (n) => n.id === id);
      link.classed("active", (l) => idOf(l.source) === id || idOf(l.target) === id).classed("dim", (l) => idOf(l.source) !== id && idOf(l.target) !== id)
        .attr("marker-end", (l) => (idOf(l.source) === id || idOf(l.target) === id ? "url(#kg-arrow-active)" : "url(#kg-arrow)"));
      label.classed("dim", (l) => idOf(l.source) !== id && idOf(l.target) !== id);
      if (hier) return;
      centerOn(d);
    };
    const reset = () => {
      node.classed("dim", false).classed("focused", false);
      link.classed("active", false).classed("dim", false).attr("marker-end", "url(#kg-arrow)");
      label.classed("dim", false);
      moveTo(zoomIdentity, 750);
    };

    // ---------- hierarchy view (_chooseHierarchyRoot, _buildHierarchyData, collapse beyond depth 2, expand path) ----------
    type T = { id: string; children: T[] };
    type HN = HierarchyNode<T> & { _children?: HN[] | null; x?: number; y?: number };
    let hier: { root: HN; index: Map<string, HN> } | null = null;
    const pairs = data.links.map((l) => ({ s: idOf(l.source), t: idOf(l.target) })).filter((p) => p.s !== p.t);
    const buildTree = (focusId: string) => {
      const parents = new Map<string, string[]>();
      for (const p of pairs) parents.set(p.t, [...(parents.get(p.t) ?? []), p.s].sort());
      let root = focusId; const seen = new Set<string>();
      while (root && !seen.has(root)) { seen.add(root); const up = parents.get(root)?.[0]; if (!up) break; root = up; }
      const kids = new Map<string, string[]>();
      for (const p of pairs) kids.set(p.s, [...new Set([...(kids.get(p.s) ?? []), p.t])].sort());
      const build = (id: string, path: Set<string>): T => ({ id, children: (kids.get(id) ?? []).filter((c) => !path.has(c)).map((c) => build(c, new Set([...path, id]))) });
      const h = hierarchy(build(root, new Set())) as HN;
      h.each((d) => { const x = d as HN; if (x.depth >= 2 && x.children) { x._children = x.children as HN[]; x.children = undefined; } });
      const expandTo = (n: HN): boolean => {
        if (n.data.id === focusId) return true;
        for (const c of [...((n.children as HN[]) ?? []), ...(n._children ?? [])]) {
          if (expandTo(c)) {
            if (n._children?.includes(c)) { n.children = [...((n.children as HN[]) ?? []), c]; n._children = n._children.filter((x) => x !== c); if (!n._children.length) n._children = null; }
            return true;
          }
        }
        return false;
      };
      expandTo(h);
      return h;
    };
    const indexTree = (r: HN) => { const map = new Map<string, HN>(); const walk = (n: HN) => { map.set(n.data.id, n); for (const c of [...((n.children as HN[]) ?? []), ...(n._children ?? [])]) walk(c); }; walk(r); return map; };
    const layoutTree = (centerId?: string) => {
      if (!hier) return;
      tree<T>().size([Math.max(1, W - 80), Math.max(1, H - 60)])(hier.root);
      const pos = new Map<string, { x: number; y: number }>();
      for (const d of hier.root.descendants()) pos.set(d.data.id, { x: (d.x ?? 0) + 40, y: (d.y ?? 0) + 30 });
      const edges = new Set(hier.root.links().map((l) => `${l.source.data.id}→${l.target.data.id}`));
      node.transition().duration(dur(750)).attr("transform", (d) => { const p = pos.get(d.id); if (p) { d.x = p.x; d.y = p.y; } return `translate(${d.x},${d.y})`; })
        .style("opacity", (d) => (pos.has(d.id) ? 1 : 0)).style("pointer-events", (d) => (pos.has(d.id) ? "all" : "none"));
      node.select<SVGTextElement>(".kg-label").text((d) => {
        const h = hier!.index.get(d.id);
        const has = !!((h?.children && h.children.length) || h?._children?.length);
        return (has ? (!h?.children && h?._children?.length ? "▸ " : "▾ ") : "") + clip(name(d));
      });
      link.transition().duration(dur(750))
        .attr("x1", (l) => pos.get(idOf(l.source))?.x ?? 0).attr("y1", (l) => pos.get(idOf(l.source))?.y ?? 0)
        .attr("x2", (l) => pos.get(idOf(l.target))?.x ?? 0).attr("y2", (l) => pos.get(idOf(l.target))?.y ?? 0)
        .attr("marker-end", "none").style("opacity", (l) => (edges.has(`${idOf(l.source)}→${idOf(l.target)}`) ? 1 : 0));
      label.style("opacity", 0);
      const c = centerId ? byId.get(centerId) : undefined;
      if (c) { const p = pos.get(c.id); if (p) moveTo(zoomIdentity.translate(W / 2 - p.x * 1.1, H / 2 - p.y * 1.1).scale(1.1), 650); }
    };
    const toHierarchy = (focusId: string) => {
      sim.stop();
      const root = buildTree(focusId);
      hier = { root, index: indexTree(root) };
      layoutTree(focusId);
    };
    const toForce = (focusId?: string) => {
      hier = null;
      node.style("opacity", 1).style("pointer-events", "all").select<SVGTextElement>(".kg-label").text((d) => clip(name(d)));
      link.style("opacity", 1).attr("marker-end", "url(#kg-arrow)");
      label.style("opacity", 1);
      sim.alpha(0.9).restart();
      const d = focusId ? byId.get(focusId) : undefined;
      if (d) centerOn(d, 1.15);
    };
    const hierarchyToggle = (id: string) => {
      if (!hier) return;
      const h = hier.index.get(id);
      if (!h) return;
      if (h.children?.length) { h._children = h.children as HN[]; h.children = undefined; }
      else if (h._children?.length) { h.children = h._children; h._children = null; }
      hier.index = indexTree(hier.root);
      layoutTree(id);
    };

    // hover (grow + tooltip), click (focus + inspector), keyboard (Enter/Space)
    const choose = (d: N) => { setSelected(d.id); if (hier) hierarchyToggle(d.id); focus(d.id); };
    node
      .on("mouseenter", function (e: MouseEvent, d) {
        select(this).select(".kg-body").transition().duration(dur(200)).attr("r", SIZE * 1.2);
        const r = container.getBoundingClientRect();
        setTip({ x: e.clientX - r.left, y: e.clientY - r.top, name: `${d.id}${d.tamil_label ? ` · ${d.tamil_label}` : ""}`, cat: CATEGORIES[categoryOf(d)].label });
      })
      .on("mousemove", (e: MouseEvent) => { const r = container.getBoundingClientRect(); setTip((t) => (t ? { ...t, x: e.clientX - r.left, y: e.clientY - r.top } : t)); })
      .on("mouseleave", function () { select(this).select(".kg-body").transition().duration(dur(200)).attr("r", SIZE); setTip(null); })
      .on("click", (_e, d) => choose(d))
      .on("keydown", (e: KeyboardEvent, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(d); } })
      .call(drag<SVGGElement, N>()
        .on("start", (e, d) => { if (hier) return; if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { if (hier) return; d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if (hier) return; if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    const tick = () => {
      link.attr("x1", (d) => (d.source as N).x ?? 0).attr("y1", (d) => (d.source as N).y ?? 0).attr("x2", (d) => (d.target as N).x ?? 0).attr("y2", (d) => (d.target as N).y ?? 0);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      label.attr("x", (d) => (((d.source as N).x ?? 0) + ((d.target as N).x ?? 0)) / 2).attr("y", (d) => (((d.source as N).y ?? 0) + ((d.target as N).y ?? 0)) / 2);
    };
    sim.on("tick", tick);
    tick();
    if (start) node.classed("focused", (n) => n.id === start);

    api.current = {
      focus, reset,
      zoomBy: (k) => (reduced ? svg.call(zb.scaleBy, k) : svg.transition().duration(300).call(zb.scaleBy, k)),
      toggle: (id) => { if (hier) toForce(id); else toHierarchy(id || start || data.nodes[0].id); },
      hierarchyToggle,
    };
    return () => { sim.stop(); svg.selectAll("*").remove(); api.current = null; };
  }, [data, byId, name, start]);

  const sel = selected ? byId.get(selected) : undefined;
  const related = sel ? graph.links.filter((l) => l.source === sel.id || l.target === sel.id) : [];
  const counts = useMemo(() => {
    const c = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, 0])) as Record<Cat, number>;
    for (const n of graph.nodes) c[categoryOf(n)]++;
    return c;
  }, [graph]);

  function findNode(e: React.FormEvent) {
    e.preventDefault();
    const q = find.trim().toLowerCase();
    if (!q) return;
    const hit = graph.nodes.find((n) => n.id.toLowerCase().includes(q) || n.tamil_label.includes(find.trim()));
    if (!hit) return setFindMsg(`“${find}” is not in this graph.`);
    setFindMsg("");
    setSelected(hit.id);
    api.current?.focus(hit.id);
  }

  return (
    <div className="kg">
      <div className="kg-toolbar">
        <div className="kg-tools" role="group" aria-label="Graph controls">
          <button type="button" onClick={() => api.current?.zoomBy(1.3)} aria-label="Zoom in"><Plus size={16} /></button>
          <button type="button" onClick={() => api.current?.zoomBy(1 / 1.3)} aria-label="Zoom out"><Minus size={16} /></button>
          <button type="button" onClick={() => { api.current?.reset(); setSelected(undefined); }} aria-label="Reset view"><Maximize2 size={16} /></button>
          <button type="button" className="kg-mode" onClick={() => { api.current?.toggle(selected); setMode(mode === "force" ? "hierarchy" : "force"); }} aria-pressed={mode === "hierarchy"}>
            {mode === "force" ? <><GitBranch size={16} /> Hierarchy view</> : <><Network size={16} /> Network view</>}
          </button>
        </div>
        <form className="kg-find" onSubmit={findNode} role="search">
          <SearchIcon size={15} aria-hidden="true" />
          <input value={find} onChange={(e) => { setFind(e.target.value); setFindMsg(""); }} placeholder="Find a node…" aria-label="Find a node in the graph" />
        </form>
      </div>
      {findMsg && <p className="kg-state" role="status">{findMsg}</p>}

      <div className="kg-body-wrap">
        <div ref={box} className="kg-canvas">
          <svg ref={svgRef} role="img" aria-label={`Knowledge graph of ${graph.canonical}: ${graph.nodes.length} concepts, ${graph.links.length} relationships. Drag to pan, scroll or pinch to zoom, select a node to inspect it.`} />
          {tip && <div className="kg-tip" style={{ left: tip.x + 14, top: tip.y - 10 }}><b>{tip.name}</b><small>{tip.cat}</small></div>}
          <ul className="kg-legend" aria-label="Legend">
            {(Object.keys(CATEGORIES) as Cat[]).filter((k) => counts[k]).map((k) => <li key={k}><i style={{ background: CATEGORIES[k].color }} />{CATEGORIES[k].label} <small>{counts[k]}</small></li>)}
          </ul>
        </div>

        <aside className="kg-inspector" aria-live="polite">
          {sel ? (
            <>
              <header>
                <span className="kg-badge" style={{ "--c": CATEGORIES[categoryOf(sel)].color } as React.CSSProperties}>{CATEGORIES[categoryOf(sel)].label}</span>
                <button type="button" className="pop-x" onClick={() => { setSelected(undefined); api.current?.reset(); }} aria-label="Close node details"><X size={16} /></button>
              </header>
              <h4>{sel.id}{sel.tamil_label && <span lang="ta"> · {sel.tamil_label}</span>}</h4>
              <p>{sel.description || "No description in the ontology."}</p>
              <p className="kg-deg">Degree {sel.degree ?? 0} · centrality {(sel.centrality ?? 0).toFixed(2)}{sel.id === start ? " · start node" : ""}</p>
              {sel.tamil_label && sel.tamil_label !== graph.word && (
                <Link href={`/academy/search?q=${encodeURIComponent(sel.tamil_label.split(/[;,]/)[0])}`} className="link-btn">Explore <span lang="ta">{sel.tamil_label}</span> in Solveli →</Link>
              )}
              <h5>Evidence</h5>
              {sel.evidence.sutra_reference || sel.evidence.source_section ? (
                <dl className="kg-ev">
                  {sel.evidence.source_section && <><dt>Source section</dt><dd>{sel.evidence.source_section}</dd></>}
                  {sel.evidence.sutra_reference && <><dt>Sutra reference</dt><dd>{sel.evidence.sutra_reference}</dd></>}
                  {sel.evidence.source_reference && <><dt>Source</dt><dd>{sel.evidence.source_reference}</dd></>}
                  {sel.evidence.extracted_sentence && <><dt>Term occurs in</dt><dd lang="ta">{sel.evidence.extracted_sentence}</dd></>}
                  {sel.row_id && <><dt>Ontology row</dt><dd><code>{sel.row_id}</code></dd></>}
                </dl>
              ) : <p className="kg-muted">No sutra in the Tolkāppiyam text contains this concept’s Tamil term.</p>}
              <h5>Relationships <small>{related.length}</small></h5>
              {related.length ? (
                <ul className="kg-rels">
                  {related.map((l, i) => (
                    <li key={i}><button type="button" onClick={() => { const other = l.source === sel.id ? l.target : l.source; setSelected(other); api.current?.focus(other); }}>
                      <b>{l.source}</b> <span>—({rel(l.relation)})→</span> <b>{l.target}</b>
                    </button></li>
                  ))}
                </ul>
              ) : <p className="kg-muted">No relationships found.</p>}
            </>
          ) : (
            <div className="kg-summary">
              <p><b>{graph.nodes.length}</b> concepts · <b>{graph.links.length}</b> relationships</p>
              <p className="kg-muted">Select a node to see its description, evidence and relationships. Drag to pan; scroll, pinch or use the buttons to zoom; drag a node to move it.</p>
              <ul className="kg-dist">
                {(Object.keys(CATEGORIES) as Cat[]).filter((k) => counts[k]).map((k) => (
                  <li key={k}><span>{CATEGORIES[k].label}</span><span className="bar"><i style={{ width: `${(counts[k] / graph.nodes.length) * 100}%`, background: CATEGORIES[k].color }} /></span><small>{counts[k]}</small></li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
