import ChallengesHub from "@/components/academy/ChallengesHub";
import { challengeCatalog, kural } from "@/lib/corpus";

export default function Challenges() {
  const cards = challengeCatalog().map(({ pool, ...c }) => ({ ...c, questions: pool.length }));
  const k = kural(596);
  return <ChallengesHub challenges={cards} quote={k ? { lines: k.lines, cite: `Tirukkuṟaḷ ${k.number}`, href: `/academy/thirukkural/${k.number}` } : undefined} />;
}
