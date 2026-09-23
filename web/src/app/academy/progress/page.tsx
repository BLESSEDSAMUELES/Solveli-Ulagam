import ProgressDashboard from "@/components/academy/ProgressDashboard";
import { challengeCatalog, kural, lessonCatalog } from "@/lib/corpus";

const cite = (n: number) => { const k = kural(n); return k && { lines: k.lines, cite: `Tirukkuṟaḷ ${n}`, href: `/academy/thirukkural/${n}` }; };

export default function ProgressPage() {
  return (
    <ProgressDashboard
      lessons={lessonCatalog().map((l) => ({ id: l.id, world: l.world, title: l.title, image: l.image }))}
      challenges={challengeCatalog().map((c) => ({ id: c.id, world: c.world, title: c.title }))}
      quote={cite(616)} wisdom={cite(391)} />
  );
}
