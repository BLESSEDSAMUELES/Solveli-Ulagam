// Server-only Groq access, shared by every AI-assisted feature (/api/meaning, the Knowledge Graph).
// The key stays on the server (web/.env: GROQ-API or GROQ_API_KEY). If the configured model has been retired on the
// account, a live one is picked from the account's model list once and remembered for the process.

const GROQ = "https://api.groq.com/openai/v1";
const PREFER = ["llama-3.3-70b", "llama-4-maverick", "gpt-oss-120b", "llama-4-scout", "qwen", "llama"];
const model = (globalThis as unknown as { __groqModel?: { id: string } }).__groqModel ??= { id: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile" };

export const groqConfigured = () => !!(process.env.GROQ_API_KEY ?? process.env["GROQ-API"]);

export type ChatOptions = { system?: string; user: string; json?: boolean; temperature?: number; timeoutMs?: number };

/** One chat completion; throws on any failure (callers decide how to degrade). */
export async function groqChat({ system, user, json = false, temperature = 0.2, timeoutMs = 15000 }: ChatOptions): Promise<string> {
  const key = process.env.GROQ_API_KEY ?? process.env["GROQ-API"];
  if (!key) throw new Error("AI assistance is not configured.");
  const auth = { Authorization: `Bearer ${key}` };
  const ask = (id: string) => fetch(`${GROQ}/chat/completions`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: id, temperature, ...(json ? { response_format: { type: "json_object" } } : {}),
      max_tokens: 2000, // reasoning models (gpt-oss) spend part of this before the answer
      messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let r = await ask(model.id);
  if (r.status === 404) { // configured model retired → pick a live one from the account's model list, once
    const list: { id: string }[] = (await (await fetch(`${GROQ}/models`, { headers: auth })).json()).data ?? [];
    const ids = list.map((m) => m.id).filter((id) => !/whisper|guard|tts|orpheus|compound/i.test(id));
    const next = PREFER.map((p) => ids.find((id) => id.includes(p))).find(Boolean) ?? ids[0];
    if (next && next !== model.id) { model.id = next; r = await ask(next); }
  }
  if (!r.ok) throw new Error(`Groq ${r.status} (${model.id}): ${(await r.text()).slice(0, 200)}`);
  const text = (await r.json()).choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") throw new Error(`Groq returned no text (${model.id})`);
  return text.trim();
}

export const groqModel = () => model.id;
