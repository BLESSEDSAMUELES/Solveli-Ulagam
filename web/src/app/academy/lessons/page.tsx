import LessonsHub from "@/components/academy/LessonsHub";
import { lessonCatalog, verseById } from "@/lib/corpus";

export default function LessonsPage() {
  const lessons = lessonCatalog().map(({ steps, ...l }) => ({ ...l, steps: steps.length }));
  const puram = verseById("PURN-192");
  return <LessonsHub lessons={lessons} quote={puram ? { line: puram.lines[0], cite: "Puṟanāṉūṟu 192" } : undefined} />;
}
