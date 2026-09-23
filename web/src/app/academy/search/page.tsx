import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Panel, VerseCard } from "@/components/academy/ui";
import { Discover } from "@/components/academy/Discover";
import AiMeaning from "@/components/academy/AiMeaning";
import KnowledgeSection from "@/components/academy/KnowledgeSection";
import SearchBox, { Highlight } from "@/components/academy/SearchBox";
import { analyzeSentence, englishToTamil, isKnownWord, libraryTexts, searchWord, suggestedWords, tamilTokens, type Candidate } from "@/lib/corpus";
import { KIND_LABEL, search, tanglishWord, type Hit, type Kind } from "@/lib/search";
import { romanize } from "@/lib/tanglish";

const LAYER_WORLD: Record<string, string> = { Sangam: "sangam", Bhakti: "bhakti", Spiritual: "bhakti", Epic: "history", Didactic: "thirukkural" };
const ORDER: Kind[] = ["kural", "chapter", "word", "lesson", "challenge", "world", "guide", "library", "community", "page", "verse"];
const LAYERS = () => [...new Set(libraryTexts().map((t) => t.layer))];

export default async function SearchPage({ searchParams }: PageProps<"/academy/search">) {
  const sp = await searchParams;
  const one = (k: string) => { const v = sp[k]; return ((Array.isArray(v) ? v[0] : v) ?? "").trim().slice(0, 120); };
  const query = one("q");
  const ctx = one("ctx") || undefined;
  const layer = one("layer") || undefined;
  const global = query ? search(query, { limit: 60, perKind: 8 }) : undefined;
  const ms = global?.ms ?? 0;

  // Input detection → normalisation → verified vocabulary first; Groq only for a single Tamil word it doesn't know.
  const tokens = tamilTokens(query);
  const sentence = tokens.length > 1 ? analyzeSentence(query) : undefined;
  const tl = tokens.length ? undefined : tanglishWord(query); // existing Tanglish path, unchanged
  const english = !tokens.length && !tl?.tamil.length && /^[a-z]+$/i.test(query) ? englishToTamil(query) : [];
  const pick = sentence ? (one("w") || bestCandidate(sentence)) : tokens.length === 1 ? tokens[0] : tl?.tamil[0]?.word ?? english[0];
  const r = pick ? searchWord(pick, { layer, ctx, sentence: sentence ? query : undefined }) : undefined;
  const unknown = !sentence && tokens.length === 1 && r?.kind === "empty" && !isKnownWord(tokens[0]);
  const via = tl?.tamil.length ? `Tanglish “${query}”` : english.length ? `English “${query}” (Solveli ontology)` : undefined;

  const word = r?.kind === "result" ? r.query : undefined;
  const groups = ORDER.map((k) => ({ kind: k, hits: (global?.hits ?? []).filter((h) => h.kind === k && !(k === "word" && (h.title === query || h.title === word))) })).filter((g) => g.hits.length);
  const terms = global?.highlight ?? [];
  const nothing = query && !groups.length && r?.kind !== "result" && !unknown && !sentence;
  const here = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: query, w: sentence ? pick : undefined, ctx, layer, ...extra })) if (v) u.set(k, v);
    return `/academy/search?${u}`;
  };

  return (
    <Panel eyebrow="Search" title={query || "Search Solveli"} wide
      sub={query ? `${global?.total ?? 0} result${global?.total === 1 ? "" : "s"} across kurals, verses, words and lessons · ${ms} ms`
        : "Tamil words or sentences, English words, Tanglish, kural numbers, chapter names or \"exact phrases\"."}>
      <SearchBox big initial={query} placeholder="Try அன்பு, அவன் அன்புடன் பேசினான், love, anbu, 391 or “store of learning”" />

      {!query && (
        <ul className="suggest">{[...suggestedWords(), "391", "chapter 40", "\"store of learning\""].map((w) => <li key={w}><Link href={`/academy/search?q=${encodeURIComponent(w)}`}>{w}</Link></li>)}</ul>
      )}
      {nothing && (
        <div className="empty">
          <p>No results for “{query}”.</p>
          <p className="sub">Solveli never invents an answer. Try a Tamil word, Tanglish (anbu, kalvi), a kural number, or one of these:</p>
          <ul className="suggest center">{suggestedWords().map((w) => <li key={w}><Link href={`/academy/search?q=${encodeURIComponent(w)}`}>{w}</Link></li>)}</ul>
        </div>
      )}

      {global && global.tanglish.length > 0 && (
        <p className="notice tanglish-note">
          Tanglish detected — searching Tamil too:{" "}
          {global.tanglish.map((m) => (
            <span key={m.input}><b>{m.input}</b> → {m.tamil.slice(0, 4).map((c) => (
              <Link key={c.word} href={`/academy/search?q=${encodeURIComponent(c.word)}`} lang="ta">{c.word}</Link>
            ))}</span>
          ))}
        </p>
      )}

      {sentence && (
        <section className="sentence">
          <h2>Sentence detected <small>{sentence.length} words · pick one to explore it in this sentence</small></h2>
          <ul className="cands">
            {sentence.map((c) => {
              const key = c.lemma ?? (c.occurrences ? c.token : undefined); // corpus-only words (அவன்) are still verified
              return (
                <li key={c.token}>
                  <Link href={key ? here({ w: key, layer: undefined }) : `/academy/search?q=${encodeURIComponent(c.token)}`}
                    className={`cand ${key && key === word ? "on" : ""} ${key ? "" : "unknown"}`} aria-current={key && key === word ? "true" : undefined}>
                    <b lang="ta">{c.token}</b>
                    <small>{c.lemma ? <>{c.lemma !== c.token && <><span lang="ta">{c.lemma}</span> · </>}{c.senses} senses · {c.occurrences} verses</>
                      : key ? `in corpus · ${c.occurrences} verses` : "not in vocabulary · AI-assisted"}</small>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {unknown && <AiMeaning key={tokens[0]} word={tokens[0]} />}

      {r?.kind === "result" && <WordView r={r} via={via} here={here} sentence={sentence ? query : undefined} />}

      {global?.partial && <p className="notice">No result contains every word — showing the closest matches.</p>}
      {groups.length > 0 && (
        <div className="results">
          {groups.map((g) => (
            <section key={g.kind} className="result-group">
              <h2>{KIND_LABEL[g.kind]} <small>{g.hits.length}{g.hits.length === 8 ? "+" : ""}</small></h2>
              <ul>{g.hits.map((h, i) => <ResultItem key={`${h.href}-${i}`} h={h} terms={terms} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

// In a sentence, explore the resolved word with the most verified data first (pronouns and particles rarely win).
function bestCandidate(cands: Candidate[]) {
  return [...cands].filter((c) => c.lemma).sort((a, b) => (b.senses ? 1 : 0) + Math.log1p(b.occurrences) / 10 - ((a.senses ? 1 : 0) + Math.log1p(a.occurrences) / 10)
    || [...b.lemma!].length - [...a.lemma!].length)[0]?.lemma ?? "";
}

type WordResult = Extract<ReturnType<typeof searchWord>, { kind: "result" }>;

function WordView({ r, via, here, sentence }: { r: WordResult; via?: string; here: (x: Record<string, string | undefined>) => string; sentence?: string }) {
  const related = [...new Set(r.senses.flatMap((s) => [...s.synonyms, ...s.broader]))].filter((w) => w !== r.query).slice(0, 14);
  const glosses = r.senses.slice(0, 3).map((s) => s.gloss).filter(Boolean);
  const c = r.context;
  const status = r.byLayer.length ? "Verified in Solveli corpus" : "Verified in Solveli vocabulary · no corpus occurrence";
  return (
    <section className="word-card verified">
      <header className="wc-head">
        <h2 lang="ta">{r.query}</h2>
        <span className="wc-tr">{romanize(r.query)}</span>
        <span className="wc-status ok"><BadgeCheck size={14} /> {status}</span>
      </header>
      {(r.from || via) && <p className="sub">Normalised from {r.from ? <b lang="ta">{r.from}</b> : via}{r.from && via ? ` · ${via}` : ""}</p>}
      <Discover word={r.query} />

      <h3>Meaning <small>What does this word mean?</small></h3>
      {r.meaning && <p className="wc-meaning">{r.meaning.en}{r.meaning.desc && r.meaning.desc !== r.meaning.en ? <small> — {r.meaning.desc}</small> : null}</p>}
      {glosses.length > 0 && <p className="wc-meaning ta" lang="ta">{glosses.join(" · ")}</p>}
      {!r.meaning && !glosses.length && <p className="sub">No dictionary gloss in the verified vocabulary — read its occurrences below.</p>}
      <p className="fine">{[r.meaning && r.meaning.source, glosses.length && "IndoWordNet (modern Tamil glosses)"].filter(Boolean).join(" · ")}</p>
      {r.senses.length > 1 && (
        <details className="wc-senses">
          <summary>All {r.senses.length} possible senses{sentence ? " · ranked by your sentence" : c && !c.auto ? " · ranked by this passage" : ""}</summary>
          <ol className="senses">
            {r.senses.map((s) => (
              <li key={s.id}>
                <span className="pos">{s.pos}</span>
                <p lang="ta">{s.gloss}</p>
                {s.example && <p className="example" lang="ta">“{s.example}”</p>}
                <Related label="Synonyms" words={s.synonyms} />
                <Related label="Broader" words={s.broader} />
                <Related label="Narrower" words={s.narrower} />
              </li>
            ))}
          </ol>
        </details>
      )}

      {/* Knowledge Graph + Concept Meaning / Literary Context / Cultural–Ethical Significance (replaces Contextual Meaning).
          Client-side and isolated: it loads after this result and cannot break it. */}
      <KnowledgeSection key={r.query} word={r.query} />

      <h3>Literary Evidence</h3>
      {r.byLayer.length > 0 ? (
        <>
          <ul className="suggest periods">
            <li><Link href={here({ layer: undefined })} className={!r.layer ? "on" : ""}>All periods</Link></li>
            {LAYERS().map((l) => {
              const n = r.byLayer.find((x) => x.layer === l)?.count ?? 0;
              return <li key={l}><Link href={here({ layer: l })} className={r.layer === l ? "on" : ""}>{l} <small>{n}</small></Link></li>;
            })}
          </ul>
          {r.occurrences.length === 0 && <p className="notice">Word found, but no verified occurrence is available for the selected period.</p>}
          {r.occurrences.length > 0 && (
            <>
              <p className="sub">Showing {r.occurrences.length} of {r.total}, across texts. Tap any word in a passage to explore it.</p>
              <div className="verse-grid">{r.occurrences.map((v) => <VerseCard key={v.id} v={v} word={r.query} />)}</div>
            </>
          )}
          {!r.layer && LAYER_WORLD[r.byLayer[0].layer] && (
            <p className="recommend">
              Most evidence is in <b>{r.byLayer[0].layer}</b> literature — a starting point, not a verdict.{" "}
              <Link href={`/academy/worlds/${LAYER_WORLD[r.byLayer[0].layer]}`}>Enter that world →</Link>
            </p>
          )}
        </>
      ) : <p className="sub">In the verified vocabulary, but no occurrence in the current corpus.</p>}

      {related.length > 0 && <><h3>Related Words</h3><Related label="IndoWordNet" words={related} /></>}
      <p className="wc-row"><span>Status</span><b className="wc-status ok">{status}</b></p>
      <p className="fine">Occurrence matching is substring-based, so sandhi-joined forms can be missed.</p>
    </section>
  );
}

function ResultItem({ h, terms }: { h: Hit; terms: string[] }) {
  return (
    <li className="reveal">
      <Link href={h.href} className="result">
        <span className="result-top">
          <b><Highlight text={h.title} terms={terms} /></b>
          {h.meta && <span className="sp-meta">{h.meta}</span>}
        </span>
        <small>{h.subtitle}</small>
        {h.snippet && <p lang={/[஀-௿]/.test(h.snippet) ? "ta" : undefined}><Highlight text={h.snippet} terms={terms} /></p>}
      </Link>
    </li>
  );
}

function Related({ label, words }: { label: string; words: string[] }) {
  if (!words.length) return null;
  return (
    <p className="related"><span>{label}</span>{words.map((w) => <Link key={w} href={`/academy/search?q=${encodeURIComponent(w)}`} lang="ta">{w}</Link>)}</p>
  );
}
