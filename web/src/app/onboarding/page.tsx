"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, Compass, Gamepad2, GraduationCap, Landmark, Scroll, Smile, User, Users } from "lucide-react";
import { FooterLine, LangToggle, Logo, Tagline } from "@/components/brand";
import { COMPANIONS, GUIDES, LEVELS, ROLES, STEPS, type Option } from "@/lib/onboarding";
import { profile } from "@/lib/profile";
import { markOnboarded, useAuth } from "@/lib/auth";
import { character } from "@/lib/characters";
import { onboardingAnimation } from "@/lib/onboarding-art";
import LottieArt from "@/components/LottieArt";

type Answers = { role: string; level: string; companion: string; guide: string };

const SUMMARY_ICONS = [GraduationCap, BarChart3, Smile, Scroll];
const SUMMARY_LABELS = ["Role", "Level", "Companion", "Guide"];

const NOTES = [
  ["Every reader starts somewhere. Tell us how you'll use Solveli.", "Yaazhini"],
  ["No matter where you start, every Tamil word will open a new world for you!", "Yaazhini"],
  ["A good companion turns learning into a journey, not a task.", "SOLVELI"],
  ["A guide walks with you in the Academy, the World and beyond. You can meet other guides later.", "Yaazhini"],
  ["A new world of Tamil awaits you. May your curiosity never fade.", "SOLVELI"],
];

export default function Onboarding() {
  const router = useRouter();
  const auth = useAuth();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ role: "student", level: "new", companion: "yaazhini", guide: "thiruvalluvar" });
  const pick = (k: keyof Answers) => (v: string) => setA({ ...a, [k]: v });

  function finish() {
    try {
      sessionStorage.setItem("solveli.intro", "1"); // play the entrance video once, right after onboarding
    } catch {}
    profile.set(a);
    void markOnboarded(); // saves the four choices to the Supabase profile (or once the account is confirmed)
    router.push("/academy");
  }

  const summary = [
    ROLES.find((x) => x.id === a.role)?.title, LEVELS.find((x) => x.id === a.level)?.title,
    COMPANIONS.find((x) => x.id === a.companion)?.name, GUIDES.find((x) => x.id === a.guide)?.name,
  ];

  return (
    <main className="onboard">
      <Image src="/bg/onboarding.webp" alt="" fill priority sizes="100vw" className="bg" />

      <header className="topbar">
        <div className="brand-row"><Logo /><Tagline /></div>
        <div className="actions">
          <LangToggle />
          <span className="pill"><User size={18} /> {step === 4 ? `Welcome, ${auth.account?.name.split(" ")[0] ?? summary[0]}!` : auth.account?.name ?? "Guest"}</span>
        </div>
      </header>

      <aside className="rail">
        <ol className="steps vertical dark">
          {STEPS.map((s, i) => (
            <li key={s.title} className={i === step ? "active" : i < step ? "done" : ""}>
              <i>{i < step ? <Check size={18} /> : i + 1}</i>
              <span>
                <b>{s.title}</b>
                {i < step ? summary[i] : s.sub}
              </span>
            </li>
          ))}
        </ol>
        <blockquote className="rail-quote">
          <p lang="ta">“கற்க கசடறக் கற்பவை கற்றபின்<br />நிற்க அதற்குத் தக.”</p>
          <p className="quote-en">Learn flawlessly what is worth learning; then live by it.</p>
          <cite>— Tirukkuṟaḷ 391</cite>
        </blockquote>
      </aside>

      <section className="paper onboard-card">
        <p className="eyebrow dark">Step {step + 1} of 5</p>
        {step === 0 && <Cards title="Who are you exploring as?" sub="Your role shapes difficulty and recommendations. Everyone reads the same evidence." name="role" list={ROLES} value={a.role} onPick={pick("role")} />}
        {step === 1 && <Cards title="How comfortable are you with Tamil?" sub="Choose the option that best describes you. We'll personalize your experience." name="level" list={LEVELS} value={a.level} onPick={pick("level")} />}

        {step === 2 && (
          <>
            <h1>Choose Your Companion</h1>
            <p className="sub">Pick a companion to guide you through your journey. You can change this anytime.</p>
            <div className="companions" role="radiogroup" aria-label="Companion">
              {COMPANIONS.map((c) => (
                <label key={c.id} className={`choice companion ${a.companion === c.id ? "on" : ""}`}>
                  <input type="radio" name="companion" checked={a.companion === c.id} onChange={() => pick("companion")(c.id)} />
                  <Portrait glyph={c.glyph} art={c.id} tall />
                  <div>
                    <h2>{c.name}</h2>
                    <p className="role">{c.role}</p>
                    <p className="line" lang="ta">“{c.line}”</p>
                    <ul>{c.points.map((p) => <li key={p}>{p}</li>)}</ul>
                  </div>
                  {a.companion === c.id && <Check className="tick" size={18} />}
                </label>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1>Choose Your Literary Guide</h1>
            <p className="sub">Walk with a great mind. Each guide opens a different world of Tamil.</p>
            <div className="guides" role="radiogroup" aria-label="Literary guide">
              {GUIDES.map((g) => (
                <label key={g.id} className={`choice guide ${a.guide === g.id ? "on gold" : ""}`}>
                  <input type="radio" name="guide" checked={a.guide === g.id} onChange={() => pick("guide")(g.id)} />
                  <Portrait glyph={g.glyph} art={g.id} />
                  <h2>{g.name}</h2>
                  <p className="role">{g.role}</p>
                  {g.line ? <p className="line" lang="ta">“{g.line}”</p> : null}
                  <p className="cite">{g.cite}</p>
                  <ul className="tags">{g.tags.map((t) => <li key={t}>{t}</li>)}</ul>
                  {a.guide === g.id && <Check className="tick" size={18} />}
                </label>
              ))}
            </div>
            <div className="says">
              <b className="says-head"><span className="avatar art"><Image src={character("yaazhini")!.face} alt="" width={40} height={40} /></span> Yaazhini says</b>
              <p>A guide will walk with you in the Academy, World and beyond. You can always meet other guides later!</p>
              <ul>
                <li><BookOpen strokeWidth={1.3} /> Explore Real Texts</li>
                <li><Compass strokeWidth={1.3} /> Learn in Context</li>
                <li><Users strokeWidth={1.3} /> Guided Experience</li>
                <li><Landmark strokeWidth={1.3} /> Multiple Worlds</li>
              </ul>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1>You&apos;re All Set!</h1>
            <p className="sub strong">Ready to begin your journey with Solveli?</p>
            <p className="sub">Here&apos;s a summary of your choices. You can always update these later.</p>
            <ul className="summary">
              {SUMMARY_ICONS.map((Icon, i) => (
                <li key={i}>
                  <Icon size={34} strokeWidth={1.4} aria-hidden="true" />
                  <small>{SUMMARY_LABELS[i]}</small>
                  <b>{summary[i]}</b>
                  <button type="button" className="change" onClick={() => setStep(i)}>Change</button>
                </li>
              ))}
            </ul>
            <h2 className="next-title">What&apos;s Next?</h2>
            <p className="sub">Step into the Solveli Academy and start exploring.</p>
            <ul className="next-row">
              <li><BookOpen strokeWidth={1.3} /><b>Guided Lessons</b><span>Learn step by step</span></li>
              <li><Gamepad2 strokeWidth={1.3} /><b>Interactive Challenges</b><span>Play &amp; earn XP</span></li>
              <li><Compass strokeWidth={1.3} /><b>3D Literary Worlds</b><span>Explore and discover</span></li>
              <li><Users strokeWidth={1.3} /><b>Meet More Guides</b><span>Unlock as you grow</span></li>
            </ul>
            <button className="btn teal enter" onClick={finish}><Landmark size={24} /> Enter the Academy <ArrowRight size={22} /></button>
          </>
        )}

        <nav className="step-nav" aria-label="Onboarding steps">
          <button className="btn outline" onClick={() => setStep(step - 1)} disabled={step === 0}><ArrowLeft size={20} /> Previous</button>
          <div className="progress">
            <div className="track"><span style={{ width: `${(step / 4) * 100}%` }} /></div>
            <small>Step {step + 1} of 5</small>
          </div>
          {step < 4 ? <button className="btn teal" onClick={() => setStep(step + 1)}>Next <ArrowRight size={20} /></button> : <span className="btn-spacer" />}
        </nav>
      </section>

      <aside className="note-card side-note">
        {NOTES[step][1] === "Yaazhini" && <Image src={character("yaazhini")!.face} alt="" width={46} height={46} className="note-face" />}
        <p>{NOTES[step][0]}</p>
        <cite>— {NOTES[step][1]}</cite>
      </aside>

      <FooterLine className="onboard-footer" />
    </main>
  );
}

function Cards({ title, sub, name, list, value, onPick }: { title: string; sub: string; name: string; list: Option[]; value: string; onPick: (v: string) => void }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="sub">{sub}</p>
      <div className="cards" role="radiogroup" aria-label={title}>
        {list.map((o) => (
          <label key={o.id} className={`choice ${value === o.id ? "on" : ""}`}>
            <input type="radio" name={name} checked={value === o.id} onChange={() => onPick(o.id)} />
            <ChoiceArt step={name} option={o} active={value === o.id} />
            <span className="radio" aria-hidden="true" />
            <h2>{o.title}</h2>
            <p className="role">{o.sub}</p>
            <ul>{o.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </label>
        ))}
      </div>
    </>
  );
}

// Role / level illustration from lib/onboarding-art (lazy Lottie), in the same 4:3 box as the glyph portrait it replaces.
function ChoiceArt({ step, option, active }: { step: string; option: Option; active: boolean }) {
  const anim = onboardingAnimation(step, option.id);
  if (!anim) return <Portrait glyph={option.glyph} />;
  return (
    <div className="portrait anim">
      <LottieArt src={anim.src} label={anim.meaning} active={active} fallback={<span lang="ta">{option.glyph}</span>} />
    </div>
  );
}

// Character art from /public/characters when it exists (companions: full portrait; guides: face), else the Tamil glyph.
function Portrait({ glyph, art, tall = false }: { glyph: string; art?: string; tall?: boolean }) {
  const c = character(art);
  if (c) {
    return (
      <div className={`portrait art ${tall ? "tall" : ""}`} aria-hidden="true">
        <Image src={tall ? c.portrait : c.face} alt="" width={tall ? 320 : 128} height={tall ? 480 : 128} sizes={tall ? "200px" : "96px"}
          style={tall ? { objectPosition: c.bust } : undefined} />
      </div>
    );
  }
  return <div className={`portrait ${tall ? "tall" : ""}`} lang="ta" aria-hidden="true">{glyph}</div>;
}
