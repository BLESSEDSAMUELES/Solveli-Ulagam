"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, BookOpen, Compass, LayoutGrid, Library, Minus, Plus, RotateCcw, Scroll, Trophy, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { WORLDS } from "@/lib/worlds";
import { enterWorld } from "@/components/academy/WorldIntro";

type WorldInfo = { evidence: string; texts: string[]; lessons: number; quote?: { line: string; cite: string } };
type Thinai = Record<string, { en: string; ta: string; landscape: string; mood: string }>;

// Positions on the painted map, as % of the 1536×1024 artwork (measured from the source image).
const PINS: Record<string, [number, number]> = {
  sangam: [31.8, 17.8], grammar: [58.3, 18.3], thirukkural: [57.6, 36.1], history: [33.9, 52.7], bhakti: [58.7, 55.9],
};
const HOTSPOTS: Record<string, [number, number]> = {
  Kurinji: [47.4, 9.8], Mullai: [38.8, 30.3], Marutham: [51.8, 39.8], Palai: [38.1, 63.3], Neytal: [57.1, 66.4],
};
const SOURCE_W = 1536;
const FOCUS_ZOOM = 1.3;

type Cam = { s: number; x: number; y: number };
type Motion = "glide" | "quick" | "none";

const noop = () => () => {};

export default function WorldMap({ info, thinai, thinaiCounts }: { info: Record<string, WorldInfo>; thinai: Thinai; thinaiCounts: Record<string, number> }) {
  // Render into the shell's stage slot so the map sits behind the chrome, outside the scrolling content.
  const host = useSyncExternalStore(noop, () => document.getElementById("academy-stage"), () => null);
  const { t } = useT();
  const view = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const [cam, setCam] = useState<Cam>({ s: 1, x: 0, y: 0 });
  const [motion, setMotion] = useState<Motion>("glide");
  const [active, setActive] = useState("sangam");
  const [spot, setSpot] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [maxS, setMaxS] = useState(1.5);

  // Zoom ceiling keeps the artwork at ≤1.9 screen px per source px, so it never turns visibly soft.
  const maxZoom = useCallback(() => {
    const sw = stage.current?.offsetWidth ?? SOURCE_W;
    return Math.min(2.4, Math.max(1.2, (1.9 * SOURCE_W) / sw));
  }, []);

  // Keep the painted stage covering the viewport at every zoom level.
  const clamp = useCallback((c: Cam): Cam => {
    const v = view.current, st = stage.current;
    if (!v || !st) return c;
    const s = Math.min(maxZoom(), Math.max(1, c.s));
    const [W, H] = [v.clientWidth, v.clientHeight];
    const [L, T, SW, SH] = [st.offsetLeft, st.offsetTop, st.offsetWidth, st.offsetHeight];
    const bound = (val: number, lo: number, hi: number) => Math.min(Math.max(val, Math.min(lo, hi)), Math.max(lo, hi));
    return { s, x: bound(c.x, W - (L + SW) * s, -L * s), y: bound(c.y, H - (T + SH) * s, -T * s) };
  }, [maxZoom]);

  const move = useCallback((c: Cam, m: Motion = "glide") => { setMotion(m); setCam(clamp(c)); }, [clamp]);

  // Zoom about a screen point, keeping that point under the cursor.
  const zoomAt = useCallback((factor: number, cx: number, cy: number, m: Motion = "quick") => {
    setMotion(m);
    setCam((c) => {
      const s = Math.min(maxZoom(), Math.max(1, c.s * factor));
      const k = s / c.s;
      return clamp({ s, x: cx - (cx - c.x) * k, y: cy - (cy - c.y) * k });
    });
  }, [clamp, maxZoom]);

  // Glide the camera to a map position, centred in the free area beside the panel.
  const focus = useCallback((pct: [number, number], s = FOCUS_ZOOM) => {
    const v = view.current, st = stage.current;
    if (!v || !st) return;
    const wide = v.clientWidth > 1080;
    const fx = wide ? (230 + v.clientWidth - 400) / 2 : v.clientWidth / 2;
    const fy = wide ? v.clientHeight * 0.46 : v.clientHeight / 2;
    const px = st.offsetLeft + (pct[0] / 100) * st.offsetWidth;
    const py = st.offsetTop + (pct[1] / 100) * st.offsetHeight;
    const z = Math.min(s, maxZoom());
    move({ s: z, x: fx - px * z, y: fy - py * z });
  }, [move, maxZoom]);

  // Wheel zoom needs a non-passive listener so the page never scrolls instead.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = v.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
    };
    v.addEventListener("wheel", onWheel, { passive: false });
    const onResize = () => { setMaxS(maxZoom()); setCam((c) => clamp(c)); };
    addEventListener("resize", onResize);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setSpot(null); move({ s: 1, x: 0, y: 0 }); } };
    addEventListener("keydown", onKey);
    return () => { v.removeEventListener("wheel", onWheel); removeEventListener("resize", onResize); removeEventListener("keydown", onKey); };
  }, [host, zoomAt, clamp, move, maxZoom]);

  function select(id: string) {
    setActive(id);
    setSpot(null);
    focus(PINS[id]);
  }

  function reset() {
    setSpot(null);
    move({ s: 1, x: 0, y: 0 });
  }

  // "Enter" pushes the camera into the region, then the world's introduction film takes over (see WorldIntro).
  function enter(id: string) {
    setEntering(true);
    focus(PINS[id], 2.4);
    setTimeout(() => { enterWorld(id); setEntering(false); }, 650);
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button, a")) return;
    drag.current = { px: e.clientX, py: e.clientY, x: cam.x, y: cam.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) setGrabbing(true);
    d.moved = true;
    move({ s: cam.s, x: d.x + dx, y: d.y + dy }, "none");
  }
  function onPointerUp() { drag.current = null; setGrabbing(false); setMotion("glide"); }

  const w = WORLDS.find((x) => x.id === active)!;
  const wi = info[active];
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

  if (!host) return null;
  return createPortal(
    <div className={`worldmap ${entering ? "entering" : ""}`}>
      <div
        ref={view}
        className={`map-view ${cam.s > 1.01 ? "zoomed" : ""} ${grabbing ? "grabbing" : ""}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onDoubleClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); zoomAt(1.35, e.clientX - r.left, e.clientY - r.top, "glide"); }}
        role="application" aria-label="Map of Tamilakam. Scroll or use the zoom buttons to zoom, drag to pan."
      >
        <div className="map-par">
          <div className={`map-cam m-${motion}`} style={{ transform: `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.s})` }}>
            <div ref={stage} className="map-stage">
              {/* Native-resolution artwork, served as-is (no re-encode) so zooming stays crisp. */}
              <Image src="/bg/worlds-map.webp" alt="Illustrated map of ancient Tamilakam" fill priority unoptimized
                className="map-img" onLoad={() => setMaxS(maxZoom())} draggable={false} />
              <span className="glint g1" aria-hidden="true" /><span className="glint g2" aria-hidden="true" />
              <span className="lamp-glow" aria-hidden="true" />

              {Object.entries(HOTSPOTS).map(([k, [x, y]], i) => (
                <button key={k} className={`hot ${spot === k ? "on" : ""}`} style={{ left: `${x}%`, top: `${y}%`, ...d(900 + i * 80) }}
                  onClick={() => { setSpot(spot === k ? null : k); if (spot !== k) focus([x, y], 1.2); }}
                  aria-label={`${thinai[k].en} landscape: ${thinai[k].landscape}`} aria-expanded={spot === k}>
                  <span className="hot-ring" />
                </button>
              ))}

              {WORLDS.map((wd, i) => {
                const [x, y] = PINS[wd.id];
                return (
                  <button key={wd.id} className={`pin ${active === wd.id ? "on" : ""}`} style={{ left: `${x}%`, top: `${y}%`, "--c": wd.color, ...d(600 + i * 110) } as React.CSSProperties}
                    onClick={() => select(wd.id)} aria-pressed={active === wd.id}>
                    <span className="pin-inner" style={{ transform: `scale(${1 / cam.s})` }}>
                      <span className="pin-icon"><wd.icon size={24} /></span>
                      <span className="pin-text"><b className="swap" key={t(wd.key)}>{t(wd.key)}</b><small>{wd.sub}</small></span>
                      <span className="pin-go"><ArrowRight size={16} /></span>
                    </span>
                  </button>
                );
              })}

              {spot && (
                <div className="spot-card" style={{ left: `${HOTSPOTS[spot][0]}%`, top: `${HOTSPOTS[spot][1]}%` }}>
                  <div style={{ transform: `scale(${1 / cam.s})` }}>
                    <button className="pop-x" onClick={() => setSpot(null)} aria-label="Close"><X size={16} /></button>
                    <b lang="ta">{thinai[spot].ta}</b> <span>{thinai[spot].en} · {thinai[spot].landscape}</span>
                    <p>{thinai[spot].mood}</p>
                    <small>{thinaiCounts[spot] ?? 0} verses in the corpus are tagged with this thiṇai.</small>
                    <div className="row">
                      <Link href={`/academy/search?q=${encodeURIComponent(thinai[spot].ta)}`} className="btn outline small">Find the word</Link>
                      <Link href="/academy/challenges" className="btn teal small">Name the landscape</Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mist m1" aria-hidden="true" /><div className="mist m2" aria-hidden="true" /><div className="mist m3" aria-hidden="true" />
        <div className="map-vignette" aria-hidden="true" />
      </div>

      <div className="zoom-ctl" role="group" aria-label="Map zoom">
        <button onClick={() => { const v = view.current!; zoomAt(1.25, v.clientWidth / 2, v.clientHeight / 2, "glide"); }} aria-label="Zoom in" disabled={cam.s >= maxS - 0.01}><Plus size={18} /></button>
        <button onClick={() => { const v = view.current!; zoomAt(0.8, v.clientWidth / 2, v.clientHeight / 2, "glide"); }} aria-label="Zoom out" disabled={cam.s <= 1.001}><Minus size={18} /></button>
        <button onClick={reset} aria-label="Reset view"><RotateCcw size={16} /></button>
      </div>

      <aside className="world-panel" aria-live="polite">
        <div key={active} className="panel-body swap">
          <span className="world-img-wrap"><Image src={`/worlds/${w.id}.webp`} alt="" width={440} height={280} className="world-img" /></span>
          <header>
            <span className="world-badge" style={{ "--c": w.color } as React.CSSProperties}><w.icon size={22} /></span>
            <span><b>{t(w.key)}</b><small>{w.sub} · {w.span}</small></span>
          </header>
          <p>{w.about}</p>
          <h3>What you&apos;ll explore</h3>
          <ul>
            <li><Scroll size={18} /> {wi.evidence || "No verified evidence yet"}</li>
            {wi.texts.length > 0 && <li><Library size={18} /> {wi.texts.join(", ")}</li>}
            <li><BookOpen size={18} /> {wi.lessons} lesson{wi.lessons === 1 ? "" : "s"}</li>
            {w.id === "sangam" && <li><Trophy size={18} /> Thiṇai challenges</li>}
          </ul>
          <button className="btn teal enter-world" onClick={() => enter(w.id)}>Enter This World <ArrowRight size={20} /></button>
          {wi.quote?.line && <blockquote><p lang="ta">“{wi.quote.line}”</p><cite>— {wi.quote.cite}</cite></blockquote>}
        </div>
      </aside>

      <nav className="map-dock" aria-label="Choose a world">
        <p><b>Explore Tamilakam</b><span>Click a region to begin your journey.</span></p>
        <ul>
          <li><button onClick={reset} className={cam.s <= 1.01 ? "on" : ""}><span className="dock-icon all"><LayoutGrid size={20} /></span>All Worlds</button></li>
          {WORLDS.map((wd) => (
            <li key={wd.id}>
              <button onClick={() => select(wd.id)} className={active === wd.id && cam.s > 1.01 ? "on" : ""} style={{ "--c": wd.color } as React.CSSProperties}>
                <span className="dock-icon"><wd.icon size={20} /></span>{wd.id[0].toUpperCase() + wd.id.slice(1)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <p className="map-hint"><Compass size={14} /> Scroll to zoom · drag to explore · tap a landscape name</p>
    </div>,
    host,
  );
}
