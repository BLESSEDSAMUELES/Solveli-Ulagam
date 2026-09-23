"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { discoverWord, progress, XP } from "@/lib/progress";

// Records a searched word as discovered (+20 XP, once) and shows its mastery state.
export function Discover({ word }: { word: string }) {
  const state = progress.use().words[word];
  useEffect(() => discoverWord(word), [word]);
  return (
    <p className="discover">
      <Sparkles size={16} /> {state ? <>Mastery: <b>{state}</b> · open a source to move it to “learning”.</> : <>+{XP.discoverWord} XP for discovering this word</>}
    </p>
  );
}
