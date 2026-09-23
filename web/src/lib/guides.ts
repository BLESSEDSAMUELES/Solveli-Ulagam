// Literary guides. Biographies are deliberately brief and conservative: many dates are contested, and several
// names (Avvaiyar, Nakkīrar) cover more than one historical poet. Teachings shown for a guide are only verses that
// the data itself attributes to them — see guideProfiles() in corpus.ts.

export const GUIDE_CATEGORIES = [
  { id: "sangam", label: "Sangam Poets", ta: "சங்கப் புலவர்கள்" },
  { id: "philosophers", label: "Philosophers", ta: "அறிஞர்கள்" },
  { id: "bhakti", label: "Bhakti Saints", ta: "பக்தி அடியார்கள்" },
  { id: "grammarians", label: "Grammarians", ta: "இலக்கண ஆசிரியர்கள்" },
  { id: "epic", label: "Epic Poets", ta: "காப்பியப் புலவர்கள்" },
  { id: "modern", label: "Modern Thinkers", ta: "நவீன அறிஞர்கள்" },
] as const;

export type GuideMeta = {
  id: string; name: string; ta: string; category: (typeof GUIDE_CATEGORIES)[number]["id"];
  era: string; order: number; // order: rough chronological position for "sort by era"
  tags: string[]; world: string; glyph: string; image: string; bio: string;
  poet?: string[]; // name fragments used in the corpus attribution (cultural_context)
};

export const GUIDE_META: GuideMeta[] = [
  { id: "thiruvalluvar", name: "Thiruvalluvar", ta: "திருவள்ளுவர்", category: "philosophers", era: "c. 300–600 CE (contested)", order: 40,
    tags: ["Ethics", "Life", "Humanity"], world: "thirukkural", glyph: "வ", image: "/challenges/kural.webp",
    bio: "Author of the Tirukkuṟaḷ: 1,330 couplets in 133 chapters on virtue (aṟam), wealth (poruḷ) and love (iṉpam). Almost nothing certain is known of his life; the work itself is his portrait." },
  { id: "avvaiyar", name: "Avvaiyar", ta: "ஔவையார்", category: "sangam", era: "Sangam age · and later poets of the name", order: 20,
    tags: ["Wisdom", "Morality", "Education"], world: "sangam", glyph: "ஔ", image: "/lessons/temple.webp", poet: ["ஔவையார்"],
    bio: "“Avvaiyar” names more than one poet. The Sangam Avvaiyar's poems appear in the anthologies, including Kuṟuntokai; the short moral verses of the Āttichūḍi are attributed to a later Avvaiyar." },
  { id: "kapilar", name: "Kapilar", ta: "கபிலர்", category: "sangam", era: "Sangam age", order: 21,
    tags: ["Kuṟiñci", "Nature", "Friendship"], world: "sangam", glyph: "க", image: "/lessons/kurinji.webp", poet: ["கபிலர்"],
    bio: "One of the most prolific Sangam poets, remembered especially for kuṟiñci — poems of the mountain landscape and lovers' union." },
  { id: "paranar", name: "Paranar", ta: "பரணர்", category: "sangam", era: "Sangam age", order: 22,
    tags: ["History", "Akam", "Puṟam"], world: "sangam", glyph: "ப", image: "/lessons/coast.webp", poet: ["பரணர்"],
    bio: "Sangam poet whose verses weave references to kings, battles and places into both love poetry and heroic poetry." },
  { id: "nakkirar", name: "Nakkīrar", ta: "நக்கீரர்", category: "sangam", era: "Sangam age", order: 23,
    tags: ["Poetry", "Truth", "Criticism"], world: "sangam", glyph: "ந", image: "/worlds/sangam.webp", poet: ["நக்கீர"],
    bio: "Sangam poet of Madurai, whose name tradition links with fearless literary judgement. The anthologies preserve poems under forms of his name (நக்கீரர், நக்கீரனார்)." },
  { id: "tolkappiyar", name: "Tolkappiyar", ta: "தொல்காப்பியர்", category: "grammarians", era: "dating contested", order: 10,
    tags: ["Grammar", "Language", "Poetics"], world: "grammar", glyph: "தொ", image: "/lessons/books.webp",
    bio: "Author of the Tolkāppiyam, the oldest extant Tamil grammar, in three books: letters (Eḻuttu), words (Col) and subject matter (Poruḷ) — including the thiṇai landscapes of love poetry." },
  { id: "sambandar", name: "Tirujñāna Sambandar", ta: "திருஞானசம்பந்தர்", category: "bhakti", era: "7th century CE", order: 60,
    tags: ["Devotion", "Music", "Śaiva"], world: "bhakti", glyph: "ச", image: "/lessons/deity.webp", poet: ["Sambandar"],
    bio: "Śaiva poet-saint and one of the three poets of the Tēvāram; the first three books of the Tirumuṟai are his hymns, sung to the shrines of Tamil country." },
  { id: "andal", name: "Andal", ta: "ஆண்டாள்", category: "bhakti", era: "8th century CE", order: 65,
    tags: ["Devotion", "Love", "Vaiṣṇava"], world: "bhakti", glyph: "ஆ", image: "/challenges/temple.webp", poet: ["ஆண்டாள்"],
    bio: "The only woman among the twelve Āḻvārs. Her Tiruppāvai and Nācciyār Tirumoḻi are part of the Nālāyira Divya Prabandham." },
  { id: "ilango", name: "Ilango Adigal", ta: "இளங்கோ அடிகள்", category: "epic", era: "c. 5th–6th century CE (contested)", order: 50,
    tags: ["Epic", "Justice", "Society"], world: "history", glyph: "இ", image: "/lessons/harbor.webp",
    bio: "Traditionally the author of Cilappatikāram, the epic of Kaṇṇaki and Kōvalaṉ that moves across the Chola, Pandya and Chera countries." },
  { id: "sattanar", name: "Cīttalai Cāttaṉār", ta: "சீத்தலைச் சாத்தனார்", category: "epic", era: "c. 6th century CE (contested)", order: 51,
    tags: ["Epic", "Ethics", "Buddhism"], world: "history", glyph: "சா", image: "/challenges/ships.webp",
    bio: "Traditionally the author of Maṇimēkalai, the twin epic to Cilappatikāram, following Kōvalaṉ's daughter into Buddhist renunciation." },
  { id: "kambar", name: "Kambar", ta: "கம்பர்", category: "epic", era: "12th century CE", order: 80,
    tags: ["Epic", "Poetry", "Devotion"], world: "history", glyph: "க", image: "/challenges/city.webp",
    bio: "Author of the Kamparāmāyaṇam, the Tamil telling of the Rāmāyaṇa. His works are not yet in Solveli's corpus." },
  { id: "uvsa", name: "U. V. Swaminatha Iyer", ta: "உ. வே. சாமிநாத ஐயர்", category: "modern", era: "1855–1942", order: 100,
    tags: ["Manuscripts", "Editions", "Preservation"], world: "sangam", glyph: "உ", image: "/lessons/desk.webp",
    bio: "Scholar who searched out palm-leaf manuscripts and published the first printed editions of many classical works, among them Cilappatikāram, Maṇimēkalai and Sangam anthologies. Much of what Solveli can show survives through such editions." },
];

export const guideMeta = (id: string) => GUIDE_META.find((g) => g.id === id);
