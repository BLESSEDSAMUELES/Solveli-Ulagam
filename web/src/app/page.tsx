import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, GraduationCap, Landmark, Network, Search, User, Users } from "lucide-react";
import { FooterLine, LangToggle, Logo, Tagline } from "@/components/brand";

const pillars = [
  ["மொழி", "Language"],
  ["இலக்கியம்", "Literature"],
  ["பண்பாடு", "Culture"],
  ["அறிவு", "Knowledge"],
  ["உலகம்", "Across time"],
];

const features = [
  { icon: BookOpen, title: "Real Literature", sub: "From ancient to modern" },
  { icon: Network, title: "Meaning in Context", sub: "Word · Sense · Time" },
  { icon: Landmark, title: "Immersive 3D Worlds", sub: "Walk through Tamil history" },
  { icon: GraduationCap, title: "Learn for Life", sub: "For all ages" },
  { icon: Users, title: "Guided by Great Minds", sub: "Thiruvalluvar, Avvaiyar and more" },
];

export default function Landing() {
  return (
    <main className="landing">
      <Image src="/bg/landing.webp" alt="" fill priority sizes="100vw" className="bg" />
      <div className="landing-shade" />

      <header className="topbar">
        <div className="brand-row">
          <Logo />
          <Tagline />
        </div>
        <nav className="nav" aria-label="Main">
          <Link href="#">Explore</Link>
          <Link href="#">Learn</Link>
          <Link href="#">World</Link>
          <Link href="#">About</Link>
        </nav>
        <div className="actions">
          <LangToggle />
          <Link href="/signin" className="pill">Sign In</Link>
          <Link href="/signup" className="pill gold">Create Account</Link>
        </div>
      </header>

      <aside className="pillars" aria-hidden="true">
        <ul lang="ta">{pillars.map(([ta]) => <li key={ta}>{ta}</li>)}</ul>
        <hr />
        <ul className="caps">{pillars.map(([, en]) => <li key={en}>{en}</li>)}</ul>
      </aside>

      <section className="hero">
        <p className="eyebrow">A journey across time</p>
        <h1>Every Tamil word<br />has a <em>world</em> inside it.</h1>
        <p className="lede">Explore Tamil language, literature and culture through real texts, across time, in an immersive world.</p>

        <form className="search" action="/academy/search" role="search">
          <Search size={22} aria-hidden="true" />
          <input name="q" placeholder="Search a Tamil word, sentence or Tanglish…" aria-label="Search a Tamil word" required />
          <button aria-label="Search"><ArrowRight size={20} /></button>
        </form>

        <div className="cta-row">
          <Link href="/onboarding" className="btn gold"><Compass size={20} /> Explore the World</Link>
          <Link href="/signup" className="btn ghost"><User size={20} /> Create Account</Link>
        </div>
        <Link href="/onboarding" className="new-link">I am new to Tamil <ArrowRight size={16} /></Link>
      </section>

      <aside className="hero-quote">
        <p lang="ta">“தமிழ்<br />என்றும் உயிருடன்.”</p>
        <p className="quote-en">Tamil.<br />Past. Present. Connected.</p>
      </aside>

      <p className="leaf-cite">
        On the palm leaf: <span lang="ta">யாதும் ஊரே யாவரும் கேளிர்</span> · Puṟanāṉūṟu 192, Kaṇiyaṉ Pūṅkuṉṟaṉār
      </p>

      <footer className="feature-strip">
        <ul>
          {features.map(({ icon: Icon, title, sub }) => (
            <li key={title}>
              <Icon size={30} strokeWidth={1.3} aria-hidden="true" />
              <b>{title}</b>
              <span>{sub}</span>
            </li>
          ))}
        </ul>
        <p className="richer">A richer<br />tomorrow<br />through<br />Tamil</p>
        <FooterLine />
      </footer>
    </main>
  );
}
