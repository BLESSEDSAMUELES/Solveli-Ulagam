import { BookOpen, Landmark, Palmtree, Sailboat, Sprout } from "lucide-react";

// Literary regions (master doc §13–14). Periods are approximate ranges, never single dates.
export const WORLDS = [
  { id: "thirukkural", key: "thirukkural", sub: "Ethics for Life", icon: Sprout, color: "#3f7a45", span: "c. 300–600 CE",
    about: "Thiruvalluvar's couplets on aṟam (virtue), poruḷ (wealth) and iṉpam (love), with three Tamil commentaries and an English translation." },
  { id: "sangam", key: "sangam", sub: "People · Love · Nature", icon: Palmtree, color: "#0e5a6e", span: "c. 300 BCE–300 CE",
    about: "Classical anthologies of akam (inner life) and puṟam (public life), set in the five thiṇai landscapes." },
  { id: "bhakti", key: "bhakti", sub: "Devotion · Poetry · Values", icon: Landmark, color: "#b07a1f", span: "c. 600–900 CE",
    about: "Śaiva and Vaiṣṇava devotional hymns — Tēvāram, Nālāyira Divya Prabandham — and the Tirumantiram." },
  { id: "grammar", key: "grammar", sub: "Language · Structure · Beauty", icon: BookOpen, color: "#8a4b22", span: "dating contested",
    about: "Tolkāppiyam: the oldest extant Tamil grammar, in three books — letters (Eḻuttu), words (Col) and subject matter (Poruḷ)." },
  { id: "history", key: "history", sub: "Kings · Culture · Heritage", icon: Sailboat, color: "#5a3f73", span: "c. 2nd–6th century CE",
    about: "The twin epics Cilappatikāram and Maṇimēkalai: courts, cities, trade and ethics in narrative verse." },
] as const;

export type WorldId = (typeof WORLDS)[number]["id"];
export const world = (id: string) => WORLDS.find((w) => w.id === id);
