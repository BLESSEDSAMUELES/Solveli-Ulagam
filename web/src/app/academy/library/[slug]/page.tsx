import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass } from "lucide-react";
import { ExploreLine, Panel } from "@/components/academy/ui";
import { libraryText } from "@/lib/corpus";
import { guideMeta } from "@/lib/guides";

// One work, paginated. Every line is explorable (Reading Chamber) and every entry links to its full source.
export default async function LibraryWork({ params, searchParams }: PageProps<"/academy/library/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const one = (k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v; };
  const guide = one("guide");
  const r = libraryText(slug, Number(one("page")) || 1, 24, guide);
  if (!r) notFound();
  const g = guide ? guideMeta(guide) : undefined;
  const href = (page: number) => `/academy/library/${slug}?${new URLSearchParams({ page: String(page), ...(guide ? { guide } : {}) })}`;
  const nav = (
    <nav className="panel-actions">
      <Link href="/academy/library" className="btn outline small"><ArrowLeft size={16} /> Library</Link>
      <Link href={`/academy/worlds/${r.meta.world}`} className="btn outline small"><Compass size={16} /> Open in world</Link>
      {r.page > 1 && <Link href={href(r.page - 1)} className="btn outline small"><ArrowLeft size={16} /> Page {r.page - 1}</Link>}
      {r.page < r.pages && <Link href={href(r.page + 1)} className="btn outline small">Page {r.page + 1} <ArrowRight size={16} /></Link>}
    </nav>
  );

  return (
    <Panel eyebrow={`${r.meta.layer} · ${r.meta.period}`} title={r.meta.name} wide
      sub={<><span lang="ta">{r.meta.ta}</span> · {r.meta.description} · {r.total.toLocaleString("en-IN")} {r.meta.unit}{g ? ` attributed to ${g.name}` : ""} · page {r.page} of {r.pages}</>}>
      {nav}
      {g && <p className="notice">Showing only entries the corpus attributes to {g.name}. <Link href={`/academy/library/${slug}`}>Show all</Link></p>}
      {r.entries.length === 0 ? (
        <div className="empty"><p>No entries on this page.</p><Link href={href(1)} className="btn outline small">Back to page 1</Link></div>
      ) : (
        <ol className="lib-entries">
          {r.entries.map((e) => (
            <li key={e.id} className="reveal">
              <Link href={e.href} className="le-title">{e.title} <ArrowRight size={14} /></Link>
              <blockquote lang="ta">{e.lines.map((l, i) => <p key={i}>{e.id.startsWith("tol-") ? l : <ExploreLine line={l} ctx={e.id} />}</p>)}</blockquote>
              {e.sub && <small>{e.sub}</small>}
            </li>
          ))}
        </ol>
      )}
      {r.pages > 1 && nav}
      <p className="fine">Tap any word to see its meaning in this passage. Source links on each entry open the full text.</p>
    </Panel>
  );
}
