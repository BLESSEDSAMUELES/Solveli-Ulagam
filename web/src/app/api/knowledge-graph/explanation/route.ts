import { explain } from "@/lib/knowledge-graph";

// POST /api/knowledge-graph/explanation { word } → { conceptMeaning, literaryContext, culturalEthicalSignificance, ai, model, unverified }
// Separate from the graph so the graph renders immediately while the (slower) AI explanation is generated.
export async function POST(request: Request) {
  let word = "";
  try { word = String((await request.json())?.word ?? "").normalize("NFC").trim(); } catch {}
  if (!word || word.length > 60 || !/^[஀-௿a-zA-Z\s]+$/.test(word)) return Response.json({ error: "Send one Tamil word." }, { status: 400 });
  try {
    return Response.json(await explain(word));
  } catch (e) {
    console.error("[knowledge-graph/explanation]", (e as Error).message);
    const detail = process.env.NODE_ENV === "development" ? (e as Error).message : undefined;
    return Response.json({ error: "Explanation temporarily unavailable.", detail }, { status: 503 });
  }
}
