import { KIND_LABEL, search } from "@/lib/search";

// GET /api/search?q=…&limit=8 — grouped results for the header autocomplete and any client.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 8));
  const r = search(q, { limit, perKind: Math.max(2, Math.ceil(limit / 3)) });
  return Response.json({
    q: r.query.raw, terms: r.highlight, total: r.total, partial: r.partial, ms: r.ms,
    // Tanglish terms and the Tamil words they resolved to (shown as "anbu → அன்பு" in the UI)
    tanglish: r.tanglish.map((m) => ({ input: m.input, tamil: m.tamil.map((c) => c.word), related: m.related })),
    hits: r.hits.map((h) => ({ kind: h.kind, group: KIND_LABEL[h.kind], title: h.title, subtitle: h.subtitle, href: h.href, snippet: h.snippet, meta: h.meta })),
  });
}
