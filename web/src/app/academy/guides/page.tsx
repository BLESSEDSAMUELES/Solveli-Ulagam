import GuidesHub from "@/components/academy/GuidesHub";
import { guideProfiles, kural } from "@/lib/corpus";

export default async function Guides({ searchParams }: PageProps<"/academy/guides">) {
  const g = (await searchParams).g;
  const k = kural(2);
  return (
    <GuidesHub guides={guideProfiles()} initial={typeof g === "string" ? g : undefined}
      quote={k ? { lines: k.lines, cite: `Tirukkuṟaḷ ${k.number}`, href: `/academy/thirukkural/${k.number}` } : undefined} />
  );
}
