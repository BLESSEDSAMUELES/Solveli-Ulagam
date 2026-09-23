import { isKnownWord } from "@/lib/corpus";
import { groqChat, groqConfigured } from "@/lib/groq";

// GET /api/meaning?w=… — AI-assisted meaning for a word that is NOT in the verified vocabulary/corpus.
// Trust order: verified corpus → app data → Groq. Known words are refused here, so Groq is never asked about them.
// The key stays server-side (web/.env); the reply is reduced to plain linguistic fields — no citations, sources or quotes.

type AiMeaning = { word: string; transliteration: string; meanings: string[]; partOfSpeech: string; example: string; explanation: string };

const cache = (globalThis as unknown as { __aiMeaning?: Map<string, AiMeaning> }).__aiMeaning ??= new Map();
const str = (x: unknown, max = 400) => (typeof x === "string" ? x.trim().slice(0, max) : "");

const PROMPT = `You explain Tamil words for learners. Reply with JSON only:
{"word": string, "transliteration": string (ISO-15919-ish Latin), "meanings": string[] (1-5 short English glosses),
 "part_of_speech": string, "example": string (one simple modern Tamil sentence you wrote, with English in brackets),
 "explanation": string (2-3 sentences: formation, root, usage notes)}.
Never quote or cite literature, name works, authors, kural numbers, periods or sources. If the input is not a real Tamil word, say so in "explanation" and leave "meanings" empty.`;

export async function GET(request: Request) {
  const w = (new URL(request.url).searchParams.get("w") ?? "").normalize("NFC").trim().slice(0, 40);
  if (!/^[஀-௿]+$/.test(w)) return Response.json({ error: "Only a single Tamil word can be explained." }, { status: 400 });
  if (isKnownWord(w)) return Response.json({ ai: null, verified: true });
  const hit = cache.get(w);
  if (hit) return Response.json({ ai: hit, cached: true });

  if (!groqConfigured()) return Response.json({ ai: null, error: "AI assistance is not configured." });
  try {
    const j = JSON.parse(await groqChat({ system: PROMPT, user: w, json: true }));
    const ai: AiMeaning = {
      word: w, transliteration: str(j.transliteration, 80), partOfSpeech: str(j.part_of_speech, 40),
      meanings: Array.isArray(j.meanings) ? j.meanings.map((m: unknown) => str(m, 80)).filter(Boolean).slice(0, 5) : [],
      example: str(j.example), explanation: str(j.explanation, 600),
    };
    cache.set(w, ai);
    return Response.json({ ai });
  } catch (e) {
    console.error("[meaning] Groq unavailable:", (e as Error).message);
    const detail = process.env.NODE_ENV === "development" ? (e as Error).message : undefined;
    return Response.json({ ai: null, error: "AI assistance is temporarily unavailable.", detail }); // 200: an outage is a normal UI state
  }
}
