import { notFound } from "next/navigation";
import LessonPlayer from "@/components/academy/LessonPlayer";
import { lessonCatalog } from "@/lib/corpus";

export function generateStaticParams() {
  return lessonCatalog().map((l) => ({ id: l.id }));
}

export default async function LessonPage({ params }: PageProps<"/academy/lessons/[id]">) {
  const { id } = await params;
  const all = lessonCatalog();
  const i = all.findIndex((l) => l.id === id);
  if (i < 0) notFound();
  const next = all[i + 1];
  return <LessonPlayer lesson={all[i]} next={next ? { id: next.id, title: next.title } : undefined} />;
}
