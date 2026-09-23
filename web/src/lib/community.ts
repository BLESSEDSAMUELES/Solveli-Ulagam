// Community data model, persisted in Supabase (community_posts / _comments / _reactions / _bookmarks — see supabase/migrations).
// Members post as themselves only (RLS + column grants); guests can read Solveli's prompts. The prompts below are Solveli's own
// discussion starters, each pointing at a real verse, lesson or challenge; they are seeded into community_posts (slug = id)
// and also feed the global search index. `CommunityApi` is what CommunityHub needs from any backend.

export const TOPICS = [
  { id: "discussions", label: "Discussions" }, { id: "showcase", label: "Showcase" }, { id: "study", label: "Study Groups" },
  { id: "events", label: "Events" }, { id: "questions", label: "Questions" }, { id: "collaborate", label: "Collaborate" },
] as const;
export type Topic = (typeof TOPICS)[number]["id"];

export type Author = { name: string; role: string; glyph: string };
export type Post = {
  id: string; slug?: string; topic: Topic; title: string; body: string; tags: string[]; at: string;
  author: Author; ref?: { label: string; href: string }; origin: "solveli" | "member";
  mine: boolean; likes: number; replies: number;
};
export type Reply = { id: string; postId: string; body: string; at: string; author: Author; mine: boolean };
export type PromptDef = Omit<Post, "mine" | "likes" | "replies" | "slug">;

export interface CommunityApi {
  load(): Promise<void>;
  replies(postId: string): Promise<Reply[]>;
  createPost(p: Pick<Post, "topic" | "title" | "body" | "tags">): Promise<Post>;
  reply(postId: string, body: string): Promise<Reply>;
  toggleLike(postId: string): Promise<void>;
  toggleSave(postId: string): Promise<void>;
  remove(postId: string): Promise<void>;
}

export const LIMITS = { title: 120, body: 1200, reply: 600, tags: 5 } as const;

export const SOLVELI: Author = { name: "Solveli Academy", role: "Discussion prompt", glyph: "சொ" };
const AT = "2026-09-01T09:00:00.000Z"; // when the prompts were written

export const PROMPTS: PromptDef[] = [
  { id: "p-anbu-72", topic: "discussions", origin: "solveli", author: SOLVELI, at: AT, tags: ["Thirukkural", "அன்பு", "Context"],
    title: "What does அன்பு mean in Kural 72?",
    body: "“அன்பிலார் எல்லாம் தமக்குரியர்” — the loveless keep everything for themselves. Open the word view from the kural and compare the dictionary sense with the kural's own meaning. Where do they differ?",
    ref: { label: "Explore அன்பு in Kural 72", href: "/academy/search?q=அன்பிலார்&ctx=KURAL-72" } },
  { id: "p-kelir-192", topic: "discussions", origin: "solveli", author: SOLVELI, at: AT, tags: ["Purananuru", "Sangam", "கேளிர்"],
    title: "யாதும் ஊரே யாவரும் கேளிர் — every town is ours, everyone our kin",
    body: "Puṟanāṉūṟu 192 is quoted everywhere. Read the whole poem: what does the rest of it say about fate, good and evil? Tap கேளிர் to see where else the word lives.",
    ref: { label: "Read Puṟanāṉūṟu 192", href: "/academy/verse/PURN-192" } },
  { id: "p-kuru-40", topic: "questions", origin: "solveli", author: SOLVELI, at: AT, tags: ["Kuruntokai", "Kurinji", "Thinai"],
    title: "Why is Kuṟuntokai 40 a kuṟiñci poem?",
    body: "“யாயும் ஞாயும் யார் ஆகியரோ” — my mother and yours, what are they to each other? The corpus tags this verse kuṟiñci (union). Which lines tell you that?",
    ref: { label: "Read Kuṟuntokai 40", href: "/academy/verse/KURU-040" } },
  { id: "p-ezhuthu", topic: "questions", origin: "solveli", author: SOLVELI, at: AT, tags: ["Tolkappiyam", "Grammar", "Ezhuthu"],
    title: "Uyir Ezhuthu or Mei Ezhuthu — how would you explain the difference?",
    body: "Tolkāppiyam begins with letters. Try explaining vowels (உயிர்), consonants (மெய்) and their combinations (உயிர்மெய்) with one example of each.",
    ref: { label: "Lesson: Letters — Eḻuttu", href: "/academy/lessons/ezhuthu" } },
  { id: "p-kalvi", topic: "study", origin: "solveli", author: SOLVELI, at: AT, tags: ["Thirukkural", "கல்வி", "Chapter 40"],
    title: "Study circle: Chapter 40, Learning (கல்வி)",
    body: "Ten kurals, one theme. Read one a day with its three commentaries, and note which commentator you find clearest.",
    ref: { label: "Lesson: Learning — Chapter 40", href: "/academy/lessons/kural-learning" } },
  { id: "p-thinai", topic: "study", origin: "solveli", author: SOLVELI, at: AT, tags: ["Sangam", "Thinai", "Landscape"],
    title: "Study circle: the five thiṇai",
    body: "Mountain, forest, farmland, seashore, desert. Take the lesson, then the “Name the Landscape” challenge — which thiṇai is hardest to recognise?",
    ref: { label: "Lesson: The Five Thiṇai", href: "/academy/lessons/five-thinai" } },
  { id: "p-wordmap", topic: "showcase", origin: "solveli", author: SOLVELI, at: AT, tags: ["Reading Chamber", "Words"],
    title: "Show a word you followed across literature",
    body: "Pick a word, follow it from a kural to a Sangam poem to a Bhakti hymn. Share the three references you found and what changed in its meaning.",
    ref: { label: "Search a word", href: "/academy/search" } },
  { id: "p-sandhi", topic: "collaborate", origin: "solveli", author: SOLVELI, at: AT, tags: ["Search", "Sandhi", "Help wanted"],
    title: "Help Solveli find sandhi-joined words",
    body: "Search matches word parts inside lines, so joined forms like “யாது மூரே” (for யாதும் ஊரே) can be missed. Note any form you notice missing, with its verse reference.",
    ref: { label: "Try it on Puṟanāṉūṟu 192", href: "/academy/search?q=யாதும்" } },
];

export const timeAgo = (iso: string, now = Date.now()) => {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const [n, u] = s < 3600 ? [s / 60, "minute"] : s < 86400 ? [s / 3600, "hour"] : s < 2592000 ? [s / 86400, "day"] : [s / 2592000, "month"];
  const k = Math.floor(n);
  return `${k} ${u}${k === 1 ? "" : "s"} ago`;
};
