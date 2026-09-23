import { knowledgeGraph } from "@/lib/knowledge-graph";

// POST /api/knowledge-graph { word } → { word, theme, canonical, mapping, nodes, links, meta }
// Isolated from the word search: any failure here returns a normal JSON error and never touches the search result.
export async function POST(request: Request) {
  let word = "";
  try { word = String((await request.json())?.word ?? "").normalize("NFC").trim(); } catch {}
  if (!word || word.length > 60 || !/^[஀-௿a-zA-Z\s]+$/.test(word)) return Response.json({ error: "Send one Tamil word." }, { status: 400 });
  try {
    return Response.json(await knowledgeGraph(word));
  } catch (e) {
    console.error("[knowledge-graph]", (e as Error).message);
    return Response.json({ error: "Knowledge Graph temporarily unavailable." }, { status: 503 });
  }
}
