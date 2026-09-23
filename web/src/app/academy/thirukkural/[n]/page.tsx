import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Panel } from "@/components/academy/ui";
import Commentary from "@/components/academy/Commentary";
import { kural, thirukkural } from "@/lib/corpus";

export default async function KuralPage({ params }: PageProps<"/academy/thirukkural/[n]">) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1 || n > 1330) notFound();
  const k = kural(n);
  const { missing } = thirukkural();
  const prev = [...Array(n - 1).keys()].map((i) => n - 1 - i).find((x) => kural(x));
  const next = Array.from({ length: 1330 - n }, (_, i) => n + 1 + i).find((x) => kural(x));
  const nav = (
    <nav className="panel-actions">
      {prev && <Link href={`/academy/thirukkural/${prev}`} className="btn outline small"><ArrowLeft size={16} /> Kural {prev}</Link>}
      <Link href="/academy/worlds/thirukkural" className="btn outline small"><BookOpen size={16} /> All chapters</Link>
      {next && <Link href={`/academy/thirukkural/${next}`} className="btn outline small">Kural {next} <ArrowRight size={16} /></Link>}
    </nav>
  );

  if (!k) {
    return (
      <Panel eyebrow="Tirukkuṟaḷ" title={`Kural ${n}`}>
        {nav}
        <div className="empty">
          <p>Kural {n} is not in the provided PDF.</p>
          <p className="sub">The source file skips kurals {missing.slice(0, 10).join(", ")}… — Solveli shows only what it can cite.</p>
        </div>
      </Panel>
    );
  }

  const chapter = thirukkural().kurals.filter((x) => x.chapter.number === k.chapter.number);
  return (
    <Panel eyebrow={`${k.book.en} · ${k.book.ta} · ${k.section} · அதிகாரம் ${k.chapter.number}`} title={`Kural ${n}`}
      sub={<>{k.chapter.en} · <span lang="ta">{k.chapter.ta}</span></>}>
      {nav}
      <blockquote className="kural-couplet" lang="ta">
        {k.lines.map((l, i) => (
          <p key={i}>{l.split(" ").map((w, j) => (
            <span key={j}>{j > 0 && " "}<Link href={`/academy/search?q=${encodeURIComponent(w.replace(/[.,;:!?]/g, ""))}&ctx=KURAL-${n}`}>{w}</Link></span>
          ))}</p>
        ))}
      </blockquote>
      <p className="fine center">Tap any word to see where else it lives in Tamil literature.</p>
      {k.translation && <p className="kural-tr">{k.translation}</p>}
      {k.explanation && <p className="kural-ex"><b>Explanation.</b> {k.explanation}</p>}
      <Commentary c={k.commentary} />
      <h2>Chapter {k.chapter.number} — {k.chapter.en || k.chapter.ta}</h2>
      <ol className="kural-list">
        {chapter.map((x) => (
          <li key={x.number} className={x.number === n ? "on" : ""}>
            <Link href={`/academy/thirukkural/${x.number}`}><small>{x.number}</small><span lang="ta">{x.lines[0]}</span></Link>
          </li>
        ))}
      </ol>
      <p className="fine">Source: datasets/Thirukkural.pdf — couplet, commentaries (கலைஞர், மு.வ, சாலமன் பாப்பையா) and English translation as printed there.</p>
    </Panel>
  );
}
