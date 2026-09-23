import { connection } from "next/server";
import LibraryHub from "@/components/academy/LibraryHub";
import { challengeCatalog, kuralOfDay, lessonCatalog, LIBRARY_KINDS, libraryCatalog, libraryStats, worldCounts } from "@/lib/corpus";

export default async function Library() {
  await connection(); // the kural of the day is chosen per request, not at build time
  const k = kuralOfDay();
  return (
    <LibraryHub texts={libraryCatalog()} kinds={LIBRARY_KINDS} stats={libraryStats()} counts={worldCounts()}
      lessons={lessonCatalog().length} challenges={challengeCatalog().length}
      today={{ number: k.number, lines: k.lines, translation: k.translation, chapter: `${k.chapter.en || k.chapter.ta} · அதிகாரம் ${k.chapter.number}` }} />
  );
}
