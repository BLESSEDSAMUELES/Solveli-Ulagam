import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Box, Search } from "lucide-react";
import { Panel, VerseCard, VisitWorld } from "@/components/academy/ui";
import { ReplayIntroButton } from "@/components/academy/WorldIntro";
import { sutras, thirukkural, worldCounts, worldSamples, worldTexts } from "@/lib/corpus";
import { WORLDS, world } from "@/lib/worlds";

export function generateStaticParams() {
  return WORLDS.map((w) => ({ id: w.id }));
}

export default async function WorldPage({ params }: PageProps<"/academy/worlds/[id]">) {
  const { id } = await params;
  const w = world(id);
  if (!w) notFound();
  const texts = worldTexts(id);
  const samples = worldSamples(id);
  const chapters = id === "grammar" ? firstSutraPerChapter() : [];

  return (
    <Panel eyebrow={`${w.span} · ${worldCounts()[id]}`} title={`${w.id[0].toUpperCase()}${w.id.slice(1)} World`} sub={w.about} wide>
      <VisitWorld id={w.id} title={`${w.id[0].toUpperCase()}${w.id.slice(1)} World`} />
      <nav className="panel-actions">
        <Link href="/academy/worlds" className="btn outline small"><ArrowLeft size={18} /> All worlds</Link>
        <ReplayIntroButton worldId={w.id} />
        {/* ponytail: the 3D region shell (WorldScene, doc §15–16) replaces this notice when it ships. */}
        <span className="notice"><Box size={18} /> 3D walk-through arrives with the world renderer. The evidence below is what it will be built from.</span>
      </nav>

      {texts.length > 0 && (
        <ul className="text-chips">
          {texts.map((t) => <li key={t.name}><b lang="ta">{t.name_ta}</b> {t.name} · {t.count} verses · {t.period}</li>)}
        </ul>
      )}

      {id === "thirukkural" && <KuralChapters />}

      {samples.length > 0 && <div className="verse-grid">{samples.map((v) => <VerseCard key={v.id} v={v} />)}</div>}

      {chapters.length > 0 && (
        <div className="verse-grid">
          {chapters.map((s) => (
            <article key={s.chapter} className="verse reveal">
              <header><b lang="ta">{s.chapter}</b> <span>Tolkāppiyam · sūtra {s.number}</span></header>
              <blockquote lang="ta">{s.lines.map((l, i) => <p key={i}>{l}</p>)}</blockquote>
              <footer><span>Project Madurai edition</span><a href="https://www.projectmadurai.org/" target="_blank" rel="noreferrer">Source ↗</a></footer>
            </article>
          ))}
        </div>
      )}

      {!samples.length && !chapters.length && (
        <div className="empty">
          <p>Not verified in the current corpus.</p>
          <p className="sub">Solveli only shows literature it can cite. Search for a word to see where it does appear.</p>
          <Link href="/academy/search" className="btn teal small"><Search size={18} /> Search the corpus</Link>
        </div>
      )}
    </Panel>
  );
}

function firstSutraPerChapter() {
  const seen = new Set<string>();
  return sutras().filter((s) => !seen.has(s.chapter) && seen.add(s.chapter));
}

// Books -> chapters, each linking to its first kural present in the PDF.
function KuralChapters() {
  const byChapter = new Map<number, ReturnType<typeof thirukkural>["kurals"][number]>();
  for (const k of thirukkural().kurals) if (!byChapter.has(k.chapter.number)) byChapter.set(k.chapter.number, k);
  const books = [...new Set([...byChapter.values()].map((k) => k.book.en))];
  return (
    <div className="kural-books">
      {books.map((b) => {
        const cs = [...byChapter.values()].filter((k) => k.book.en === b);
        return (
          <section key={b}>
            <h2>{b} <small lang="ta">{cs[0].book.ta} · {cs.length} chapters</small></h2>
            <ol className="chapter-grid">
              {cs.map((k) => (
                <li key={k.chapter.number} className="reveal">
                  <Link href={`/academy/thirukkural/${k.number}`}>
                    <small>{k.chapter.number}</small>
                    <b lang="ta">{k.chapter.ta}</b>
                    <span>{k.chapter.en}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      <p className="fine">Chapters 4, 116 and 117 are not in the provided PDF.</p>
    </div>
  );
}
