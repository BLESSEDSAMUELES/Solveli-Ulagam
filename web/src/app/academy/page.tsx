import Home from "@/components/academy/Home";
import { worldCounts } from "@/lib/corpus";

export default function AcademyHome() {
  return <Home counts={worldCounts()} />;
}
