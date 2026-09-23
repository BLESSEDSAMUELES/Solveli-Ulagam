import CommunityHub from "@/components/academy/CommunityHub";
import { verseById } from "@/lib/corpus";

export default async function Community({ searchParams }: PageProps<"/academy/community">) {
  const post = (await searchParams).post;
  const v = verseById("PURN-192");
  return (
    <CommunityHub focus={typeof post === "string" ? post : undefined}
      quote={v ? { lines: v.lines, cite: `Puṟanāṉūṟu 192 (corpus edition)`, href: `/academy/verse/${v.id}`, ctx: v.id } : undefined} />
  );
}
