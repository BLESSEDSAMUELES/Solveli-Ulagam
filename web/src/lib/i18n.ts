"use client";

import { lang } from "@/lib/profile";

// Interface strings only. Literary evidence is always shown in its original Tamil with its source.
const en = {
  home: "Home", worlds: "Worlds", lessons: "Lessons", challenges: "Challenges", guides: "Guides",
  progress: "Progress", library: "Library", community: "Community",
  searchPh: "Search words, kurals, lessons…",
  welcomeTo: "Welcome to", academy: "Solveli Academy", motto: "Explore · Learn · Connect · Grow",
  quest: "Begin Your First Quest", questSub: "A small step into a bigger world.",
  help: "Need help?", ask: "Ask",
  thirukkural: "Thirukkural World", sangam: "Sangam World", bhakti: "Bhakti World", grammar: "Grammar World", history: "History World",
  level: "Lv.",
};

const ta: typeof en = {
  home: "முகப்பு", worlds: "உலகங்கள்", lessons: "பாடங்கள்", challenges: "சவால்கள்", guides: "வழிகாட்டிகள்",
  progress: "முன்னேற்றம்", library: "நூலகம்", community: "சமூகம்",
  searchPh: "சொல், குறள், பாடம் தேடுக…",
  welcomeTo: "வருக", academy: "சொல்வெளி கல்விக்கூடம்", motto: "ஆராய் · கற்றுக்கொள் · இணை · வளர்",
  quest: "உங்கள் முதல் பயணம்", questSub: "பெரிய உலகிற்குள் ஒரு சிறிய அடி.",
  help: "உதவி வேண்டுமா?", ask: "கேளுங்கள்:",
  thirukkural: "திருக்குறள் உலகம்", sangam: "சங்க உலகம்", bhakti: "பக்தி உலகம்", grammar: "இலக்கண உலகம்", history: "வரலாற்று உலகம்",
  level: "நிலை",
};

export type Key = keyof typeof en;

export function useT() {
  const { lang: l } = lang.use();
  return { t: (k: Key) => (l === "ta" ? ta : en)[k], lang: l };
}
