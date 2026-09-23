"use client";

// One world-entry mechanism for the whole Academy. Home's world cards, the Worlds map's "Enter This World" and the landing
// page's "Watch introduction again" all call enterWorld()/replayIntro(). The host (mounted once in the persistent Shell,
// outside the per-route transition) plays that world's film full-screen, routes to the world *behind* it, and crossfades
// the landing page in when the film ends or is skipped. Only the chosen world's video is ever requested.
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Film, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { character } from "@/lib/characters";
import { worldIntro, type WorldIntro } from "@/lib/world-intros";

type Request = { intro: WorldIntro; navigate: boolean; n: number };
let current: Request | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = (r: Request | null) => { current = r; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const pending = new Set<string>(); // world routes to navigate to without a film (reduced motion / no film configured)

/** Enter a world: film first (when one is configured), then the world's landing page. */
export function enterWorld(worldId: string) {
  const intro = worldIntro(worldId);
  if (!intro || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    pending.add(intro?.landingRoute ?? `/academy/worlds/${worldId}`); // host navigates; no cinematic for reduced motion
    emit(null);
    return;
  }
  emit({ intro, navigate: true, n: ++seq });
}

/** Replay a world's film over the current page (no navigation). Explicitly requested, so it plays even under reduced motion. */
export function replayIntro(worldId: string) {
  const intro = worldIntro(worldId);
  if (intro) emit({ intro, navigate: false, n: ++seq });
}

/** Link click handler: plain left clicks enter cinematically; modified clicks (new tab, etc.) keep the normal link. */
export function onEnterWorldClick(worldId: string) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    enterWorld(worldId);
  };
}

export function WorldIntroHost() {
  const req = useSyncExternalStore(subscribe, () => current, () => null);
  const router = useRouter();
  // Reduced motion / no film: navigate straight to the world.
  useEffect(() => subscribe(() => { for (const r of pending) { pending.delete(r); router.push(r); } }), [router]);
  return req ? <IntroOverlay key={req.n} req={req} onDone={() => emit(null)} /> : null;
}

type Phase = "starting" | "playing" | "unavailable" | "blocked" | "fade";

function IntroOverlay({ req, onDone }: { req: Request; onDone: () => void }) {
  const { intro, navigate } = req;
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const skipBtn = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [muted, setMuted] = useState(false);
  const [titleOn, setTitleOn] = useState(true);
  const ended = useRef(false);
  const narrator = character(intro.narrator);
  const narratorName = narrator?.name ?? intro.narrator;

  // Crossfade out: the landing page (already rendered underneath) emerges from blur as the film brightens and fades.
  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    setPhase("fade");
    document.documentElement.classList.add("world-emerging");
    setTimeout(() => document.documentElement.classList.remove("world-emerging"), 1500);
    setTimeout(onDone, 1250);
  };

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (!v.getAttribute("src")) { v.src = intro.video; v.load(); } // re-run after cleanup (Strict Mode) released it
    skipBtn.current?.focus({ preventScroll: true });
    // Route behind the film so the world is ready the moment it ends.
    if (navigate) router.push(intro.landingRoute);
    // The click that brought us here usually allows sound; if not, fall back to muted autoplay, then to a Play button.
    v.play().then(() => setPhase("playing")).catch(() => {
      v.muted = true;
      setMuted(true);
      return v.play().then(() => setPhase("playing"));
    }).catch(() => setPhase((p) => (p === "unavailable" ? p : "blocked")));
    const title = setTimeout(() => setTitleOn(false), 4200);
    // Network stall: never leave the user waiting on a blank screen.
    const stall = setTimeout(() => { if (v.readyState < 3 && !ended.current) setPhase("unavailable"); }, 8000);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    addEventListener("keydown", onKey);
    return () => {
      clearTimeout(title); clearTimeout(stall); removeEventListener("keydown", onKey);
      // Release the file: stop buffering and drop the decoder.
      v.pause(); v.removeAttribute("src"); v.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per request (the overlay is keyed by request)
  }, []);

  // Missing or unsupported file: say so briefly, then continue into the world.
  useEffect(() => {
    if (phase !== "unavailable") return;
    const t = setTimeout(finish, 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className={`world-intro ${phase}`} role="dialog" aria-modal="true" aria-label={`${intro.title} — introduction film`}>
      <Image src={intro.poster} alt="" fill sizes="100vw" className="wi-poster" priority />
      <video ref={video} src={intro.video} poster={intro.poster} preload="auto" playsInline muted={muted}
        onPlaying={() => setPhase((p) => (p === "fade" ? p : "playing"))}
        onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration && v.duration - v.currentTime < 1.1) finish(); }}
        onEnded={finish} onError={() => setPhase("unavailable")} aria-hidden="true" />
      <div className="wi-shade" />

      <div className={`wi-title ${titleOn || phase !== "playing" ? "on" : ""}`}>
        <p className="wi-eyebrow">{intro.eyebrow}</p>
        <h2>{intro.title}</h2>
        <p className="wi-ta" lang="ta">{intro.titleTa}</p>
        {narratorName && <p className="wi-narrator">{narrator && <Image src={narrator.face} alt="" width={40} height={40} />} Introduced by {narratorName}</p>}
      </div>

      {phase === "unavailable" && <p className="wi-note" role="status"><Film size={16} /> Introduction unavailable — entering the world…</p>}
      {phase === "blocked" && (
        <button type="button" className="wi-play" onClick={() => video.current?.play().then(() => setPhase("playing")).catch(() => setPhase("unavailable"))}>
          <Play size={22} /> Play introduction
        </button>
      )}

      <div className="wi-controls">
        {phase === "playing" && (
          <button type="button" className="pill" onClick={() => { const v = video.current; if (v) v.muted = !muted; setMuted(!muted); }} aria-label={muted ? "Unmute introduction" : "Mute introduction"}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
        <button ref={skipBtn} type="button" className="pill" onClick={finish}>
          {phase === "blocked" || phase === "unavailable" ? "Continue to world" : "Skip intro"} <SkipForward size={18} />
        </button>
      </div>
    </div>
  );
}

/** "Watch introduction again" for a world landing page — only rendered when the world has a film. */
export function ReplayIntroButton({ worldId }: { worldId: string }) {
  if (!worldIntro(worldId)) return null;
  return (
    <button type="button" className="btn outline small" onClick={() => replayIntro(worldId)}>
      <Film size={16} /> Watch introduction again
    </button>
  );
}
