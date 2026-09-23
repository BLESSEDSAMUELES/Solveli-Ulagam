"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3, BookOpen, ChevronRight, Compass, Diamond, Heart, Home, Library, MessagesSquare, Play,
  LogIn, LogOut, RotateCcw, Search, Settings2, SkipForward, Sparkles, Trophy, User, UserCircle, UserPlus, Users, Volume2, VolumeX, X,
} from "lucide-react";
import { LangToggle, Logo, Tagline } from "@/components/brand";
import SearchBox from "@/components/academy/SearchBox";
import { WorldIntroHost } from "@/components/academy/WorldIntro";
import { CharacterAvatar } from "@/components/academy/Character";
import { companionId } from "@/lib/characters";
import { useT, type Key } from "@/lib/i18n";
import { names, profile } from "@/lib/profile";
import { levelOf, progress, QUESTS, resetProgress } from "@/lib/progress";
import { signOut, useAuth, type Account } from "@/lib/auth";

const NAV: { icon: typeof Home; key: Key; href: string }[] = [
  { icon: Home, key: "home", href: "/academy" }, { icon: Compass, key: "worlds", href: "/academy/worlds" },
  { icon: BookOpen, key: "lessons", href: "/academy/lessons" }, { icon: Trophy, key: "challenges", href: "/academy/challenges" },
  { icon: Users, key: "guides", href: "/academy/guides" }, { icon: BarChart3, key: "progress", href: "/academy/progress" },
  { icon: Library, key: "library", href: "/academy/library" }, { icon: MessagesSquare, key: "community", href: "/academy/community" },
];

type Phase = "boot" | "video" | "fade" | "done";

// Environment per section. The Worlds map draws its own zoomable stage (see WorldMap), so it has no backdrop here.
const BACKDROP: Record<string, string | null> = {
  home: "/bg/academy.webp", inner: "/bg/academy.webp", lessons: "/bg/lessons.webp", challenges: "/bg/challenges.webp", worlds: null,
  progress: "/bg/progress.webp", community: "/bg/community.webp",
};
const routeOf = (path: string) =>
  path === "/academy" ? "home" : path === "/academy/worlds" ? "worlds" : path.startsWith("/academy/lessons") ? "lessons"
    : path.startsWith("/academy/challenges") ? "challenges" : path.startsWith("/academy/progress") ? "progress"
    : path.startsWith("/academy/community") ? "community" : "inner";
const INTRO = "solveli.intro";

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { t } = useT();
  const me = names(profile.use());
  const p = progress.use();
  const auth = useAuth();
  const acct = auth.account;
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("boot");
  const [muted, setMuted] = useState(false);

  const nextQuest = QUESTS.find((q) => !p.quests.includes(q.id));
  const route = routeOf(path);
  const backdrop = BACKDROP[route];
  // Backdrops mount the first time they are needed, then stay for instant crossfades (derived state, set during render).
  const [seen, setSeen] = useState<string[]>(backdrop ? [backdrop] : []);
  if (backdrop && !seen.includes(backdrop)) setSeen([...seen, backdrop]);

  // ---- entrance video: plays once after onboarding (flag set there), then crossfades into the Academy ----
  function startIntro() {
    const v = video.current;
    if (!v || matchMedia("(prefers-reduced-motion: reduce)").matches) return setPhase("done");
    setPhase("video");
    v.currentTime = 0;
    // The click that led here usually allows sound; if the browser refuses, fall back to muted.
    v.play().catch(() => { v.muted = true; setMuted(true); return v.play(); }).catch(() => endIntro("done"));
  }

  // Cleared only when the intro ends: clearing on mount would break under Strict Mode's double effects.
  function endIntro(next: Phase = "fade") {
    try { sessionStorage.removeItem(INTRO); } catch {}
    setPhase((ph) => (ph === "done" ? ph : next));
  }

  /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage is only readable after mount (prerendered page) */
  useEffect(() => {
    let intro = false;
    try { intro = sessionStorage.getItem(INTRO) === "1"; } catch {}
    if (intro && path === "/academy") startIntro();
    else setPhase("done");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Remove the overlay once its fade is over (a timer, not transitionend, so a background tab can't strand it).
  useEffect(() => {
    if (phase !== "fade") return;
    const id = setTimeout(() => setPhase("done"), 1300);
    return () => clearTimeout(id);
  }, [phase]);

  // ---- subtle pointer parallax on the background (desktop pointers only, rAF-throttled) ----
  useEffect(() => {
    const el = root.current;
    if (!el || !matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
        el.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
      });
    };
    addEventListener("pointermove", move);
    return () => { removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);

  function replayIntro() {
    closePopovers();
    if (path !== "/academy") router.push("/academy");
    startIntro();
  }

  async function logout() {
    closePopovers();
    await signOut();
    router.push("/signin");
    router.refresh();
  }

  function reset() {
    if (!confirm("Reset this browser's guest progress (XP, words, quests)? Your onboarding choices stay.")) return;
    resetProgress();
    closePopovers();
  }

  const ready = phase === "fade" || phase === "done";
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

  return (
    <main ref={root} className={`academy ${ready ? "ready" : ""} ${path === "/academy" ? "is-home" : ""} route-${route}`}>
      <div className="parallax" aria-hidden="true">
        {seen.map((src) => (
          <Image key={src} src={src} alt="" fill priority={src === backdrop} sizes="100vw"
            className={`bg academy-bg backdrop ${src === backdrop ? "on" : ""}`} />
        ))}
      </div>
      <div id="academy-stage" className="stage-slot" />
      <div className="academy-shade" />
      {/* Dust in the sunlight: a few composited dots, hidden when reduced motion is on. */}
      <div className="motes" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}</div>

      {/* Kept mounted so "Replay entrance" can reuse it; hidden via CSS once done. */}
      <div className={`intro ${phase}`} aria-hidden={phase === "done"}>
          <video ref={video} src="/video/academy-entrance.mp4" playsInline preload="metadata" muted={muted}
            onTimeUpdate={(e) => phase === "video" && e.currentTarget.duration - e.currentTarget.currentTime < 1.1 && endIntro()}
            onEnded={() => endIntro()} aria-label="Entering the Solveli Academy" />
          <div className="intro-controls">
            <button type="button" className="pill" onClick={() => setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button type="button" className="pill" onClick={() => endIntro()}>Skip <SkipForward size={18} /></button>
          </div>
      </div>

      <header className="topbar a-in" style={d(0)}>
        <div className="brand-row"><Logo /><Tagline /></div>
        <div className="actions">
          <SearchBox placeholder={t("searchPh")} />
          <Link href="/academy/search" className="pill icon-only search-mobile" aria-label="Search"><Search size={18} /></Link>
          <LangToggle />
          <button type="button" className="pill level" popoverTarget="profile-menu">
            {acct ? <Avatar account={acct} size={28} /> : <User size={18} />}
            <span>{t("level")} {levelOf(p.xp)}<br />{acct ? acct.name.split(" ")[0] : me.role}</span>
          </button>
        </div>
      </header>

      <div id="profile-menu" popover="auto" className="pop profile-pop">
        <div className="pop-head">
          {acct ? <Avatar account={acct} size={44} /> : <CharacterAvatar id={companionId(me.companion)} glyph={me.companion === "Valavan" ? "வ" : "யா"} />}
          <span>
            <b>{acct ? acct.name : `${me.role} · ${t("level")} ${levelOf(p.xp)}`}</b>
            {acct ? <>{acct.email}<br />{me.role} · {t("level")} {levelOf(p.xp)} · Guide: {me.guide}</> : <>{me.level} · Guide: {me.guide}</>}
          </span>
        </div>
        <ul className="stats">
          <li><Sparkles size={16} /> {p.xp} XP</li>
          <li><Diamond size={16} /> {p.diamonds}</li>
          <li><Heart size={16} /> {p.hearts}</li>
        </ul>
        <nav className="pop-links">
          <Link href="/academy/progress" onClick={closePopovers}><BarChart3 size={18} /> My progress</Link>
          <Link href="/academy/guides" onClick={closePopovers}><Users size={18} /> Change guide</Link>
          <Link href="/onboarding" onClick={closePopovers}><Settings2 size={18} /> Edit preferences</Link>
          <button type="button" onClick={replayIntro}><Play size={18} /> Replay entrance</button>
          {acct ? (
            <>
              <Link href="/academy/account" onClick={closePopovers}><UserCircle size={18} /> My account</Link>
              <button type="button" onClick={logout}><LogOut size={18} /> Sign out</button>
            </>
          ) : (
            <>
              <button type="button" onClick={reset}><RotateCcw size={18} /> Reset guest progress</button>
              <Link href="/signin" onClick={closePopovers}><LogIn size={18} /> Sign in</Link>
              <Link href="/signup" onClick={closePopovers}><UserPlus size={18} /> Create account</Link>
            </>
          )}
        </nav>
        <p className="pop-note">
          {acct ? (auth.sync === "error" ? "Couldn’t save your latest progress — it will retry on your next step." : "Signed in: your progress is saved to your account.")
            : auth.status === "loading" ? "Checking your session…" : "Guest session: progress is saved in this browser only. Sign in to keep it."}
        </p>
      </div>

      <nav className="side-nav a-in" style={d(150)} aria-label="Academy">
        {NAV.map(({ icon: Icon, key, href }) => {
          const on = href === "/academy" ? path === href : path.startsWith(href);
          return (
            <Link key={key} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
              <Icon size={22} strokeWidth={1.5} /> <span key={t(key)} className="swap">{t(key)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="a-main">{children}</div>
      <WorldIntroHost />

      <Link href={nextQuest?.href ?? "/academy/progress"} className="float-card quest a-in" style={d(1000)}>
        <CharacterAvatar id={companionId(me.companion)} glyph={me.companion === "Valavan" ? "வ" : "யா"} />
        <span key={t("quest")} className="swap"><b>{nextQuest ? t("quest") : "All quests complete"}</b>{nextQuest?.title ?? t("questSub")}</span>
        <ChevronRight size={20} className="nudge" />
      </Link>
      <button type="button" className="float-card help a-in" style={d(1050)} popoverTarget="help-pop">
        <span className="avatar icon"><MessagesSquare size={20} /></span>
        <span key={t("help")} className="swap"><b>{t("help")}</b>{t("ask")} {me.companion}</span>
        <ChevronRight size={20} className="nudge" />
      </button>

      <div id="help-pop" popover="auto" className="pop help-pop">
        <div className="pop-head">
          <CharacterAvatar id={companionId(me.companion)} glyph={me.companion === "Valavan" ? "வ" : "யா"} />
          <span><b>{me.companion}</b>Your companion</span>
          <button type="button" className="pop-x" popoverTarget="help-pop" popoverTargetAction="hide" aria-label="Close"><X size={18} /></button>
        </div>
        <ul className="tips">
          <li><Link href="/academy/search?q=அன்பு" onClick={closePopovers}><b>Look up a word</b>See its senses and every line of literature it appears in. Try அன்பு.</Link></li>
          <li><Link href="/academy/worlds" onClick={closePopovers}><b>Choose a world</b>Each world shows how much verified evidence it holds.</Link></li>
          <li><Link href="/academy/challenges" onClick={closePopovers}><b>Take a challenge</b>Read a real Sangam verse and name its landscape (+15 XP).</Link></li>
          <li><Link href="/academy/progress" onClick={closePopovers}><b>How XP works</b>Word +20 · source +10 · answer +15 · quest +50 · lesson +75.</Link></li>
        </ul>
        {/* ponytail: free-text questions need the grounded chatbot (POST /api/chat, doc §22). */}
        <p className="pop-note">Asking me free-form questions arrives with the grounded chatbot — every answer will cite its source.</p>
      </div>
    </main>
  );
}

function closePopovers() {
  document.querySelectorAll<HTMLElement>("[popover]:popover-open").forEach((el) => el.hidePopover());
}

// The account picture from Google (or wherever the profile has one), else the first letter of the name.
function Avatar({ account, size }: { account: Account; size: number }) {
  return account.avatar
    // eslint-disable-next-line @next/next/no-img-element -- remote avatar host varies (Google, Supabase storage)
    ? <img src={account.avatar} alt="" width={size} height={size} className="avatar photo" referrerPolicy="no-referrer" style={{ width: size, height: size }} />
    : <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>{account.name.slice(0, 1).toUpperCase()}</span>;
}
