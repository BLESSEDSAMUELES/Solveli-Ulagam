import { notFound } from "next/navigation";
import ChallengePlayer from "@/components/academy/ChallengePlayer";
import { challengeCatalog } from "@/lib/corpus";

export function generateStaticParams() {
  return challengeCatalog().map((c) => ({ id: c.id }));
}

export default async function ChallengePage({ params }: PageProps<"/academy/challenges/[id]">) {
  const { id } = await params;
  const all = challengeCatalog();
  const i = all.findIndex((c) => c.id === id);
  if (i < 0) notFound();
  const next = all[(i + 1) % all.length];
  return <ChallengePlayer challenge={all[i]} next={{ id: next.id, title: next.title }} />;
}
