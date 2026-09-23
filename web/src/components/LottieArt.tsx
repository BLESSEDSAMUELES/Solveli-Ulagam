"use client";

import { useEffect, useRef, useState } from "react";

// A Lottie illustration that costs nothing until it scrolls into view: the light SVG player (~40 KB gz, no expressions)
// and the animation JSON are fetched then, once, and shared. Idle loop at a calm speed, livelier while `active`;
// under prefers-reduced-motion it shows a single still frame. Until it is ready (or if it fails) `fallback` is shown,
// inside the same fixed-size box, so there is no layout shift.
type Player = typeof import("lottie-web/build/player/lottie_light").default;
type AnimationItem = ReturnType<Player["loadAnimation"]>;

let player: Promise<Player> | undefined;
const data = new Map<string, Promise<object>>();
const loadPlayer = () => (player ??= import("lottie-web/build/player/lottie_light").then((m) => m.default));
const loadData = (src: string) => {
  if (!data.has(src)) data.set(src, fetch(src).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }).catch((e) => { data.delete(src); throw e; }));
  return data.get(src)!;
};

export default function LottieArt({ src, label, active = false, fallback }: { src: string; label: string; active?: boolean; fallback?: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const anim = useRef<AnimationItem | null>(null);
  const [state, setState] = useState<"idle" | "ready" | "failed">("idle");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = async () => {
      try {
        const [lottie, json] = await Promise.all([loadPlayer(), loadData(src)]);
        if (cancelled || !box.current) return;
        const a = lottie.loadAnimation({
          container: box.current, renderer: "svg", loop: !reduced, autoplay: !reduced,
          // JSON is cloned: lottie mutates animationData, and the same file may render twice (e.g. Strict Mode).
          animationData: structuredClone(json), rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: true },
        });
        anim.current = a;
        a.addEventListener("DOMLoaded", () => {
          if (cancelled) return;
          if (reduced) a.goToAndStop(Math.floor(a.totalFrames * 0.6), true); // a representative still
          else a.setSpeed(0.8);
          setState("ready");
        });
        a.addEventListener("data_failed", () => !cancelled && setState("failed"));
      } catch {
        if (!cancelled) setState("failed");
      }
    };
    // Lazy: start when the card is (nearly) on screen — or after a short idle wait if the observer never reports
    // (background tabs, embedded previews), so the art is never stuck on its fallback.
    let started = false;
    const go = () => { if (started) return; started = true; io.disconnect(); clearTimeout(idle); void start(); };
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) go(); }, { rootMargin: "120px" });
    io.observe(el);
    const idle = setTimeout(go, 2500);
    return () => { cancelled = true; io.disconnect(); clearTimeout(idle); anim.current?.destroy(); anim.current = null; };
  }, [src]);

  // React to selection: a livelier pass while selected, back to the calm idle loop otherwise.
  useEffect(() => {
    const a = anim.current;
    if (!a || state !== "ready" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    a.setSpeed(active ? 1.25 : 0.8);
    if (active) a.goToAndPlay(0, true);
  }, [active, state]);

  return (
    <div className={`lottie-art ${state}`} role="img" aria-label={label}>
      <div ref={box} className="lottie-stage" aria-hidden="true" />
      {state !== "ready" && fallback && <div className="lottie-fallback" aria-hidden="true">{fallback}</div>}
    </div>
  );
}
