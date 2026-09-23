import WorldMap from "@/components/academy/WorldMap";
import { mapData, THINAI } from "@/lib/corpus";

export default function Worlds() {
  const { worlds, thinaiCounts } = mapData();
  return (
    <>
      <h1 className="sr-only">Worlds — map of Tamilakam</h1>
      <WorldMap info={worlds} thinai={THINAI} thinaiCounts={thinaiCounts} />
    </>
  );
}
