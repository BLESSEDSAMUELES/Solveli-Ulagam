import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Panel, VerseCard } from "@/components/academy/ui";
import { verseById, WORLD_LAYERS } from "@/lib/corpus";

export default async function VersePage({ params }: PageProps<"/academy/verse/[id]">) {
  const id = decodeURIComponent((await params).id);
  const v = verseById(id);
  if (!v) notFound();
  if (v.url.startsWith("/")) redirect(v.url); // kurals have their own page
  const world = Object.entries(WORLD_LAYERS).find(([, layers]) => layers.includes(v.layer))?.[0];
  return (
    <Panel eyebrow={`${v.layer} · ${v.period}`} title={`${v.text} ${v.number}`} sub={<span lang="ta">{v.textTa}</span>}>
      <nav className="panel-actions">
        {world && <Link href={`/academy/worlds/${world}`} className="btn outline small"><ArrowLeft size={16} /> {world[0].toUpperCase() + world.slice(1)} World</Link>}
      </nav>
      <VerseCard v={v} full />
    </Panel>
  );
}
