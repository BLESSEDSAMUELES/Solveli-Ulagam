# Solveli · சொல்வெளி — Solveli Ulagam

*Every Tamil word has a world inside it.*

Solveli is a Tamil literary exploration platform built for AUREX'26 (Track 03 — WordNet: Explore Tamil Words Across
Literature and Context). Search a Tamil word — in Tamil, Tanglish or English — and see its verified senses, where it
lives in Classical Tamil literature, a Tolkāppiyam knowledge graph around the concept, and AI-assisted explanations
that are always labelled and never presented as evidence.

**Team Solveli** — Blessed Samueles N G, Andrew Savio M, Logesh E.

> **Proprietary software — all rights reserved.** Viewing on GitHub and competition evaluation are permitted; any
> other use, including commercial or institutional use, requires a written licence from the Copyright Holders.
> See [LICENSE](LICENSE). Third-party materials keep their own licences: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## What's inside

| Path | Contents |
| --- | --- |
| `web/` | Next.js 16 application (App Router): Academy, worlds, lessons, challenges, guides, progress, library, community, word search |
| `web/supabase/` | Database schema, row-level security and seed migrations; `npm run test:db` checks them locally |
| `datasets/` | Solveli ontology, query mappings, Tanglish vocabulary, Tirukkuṟaḷ extraction scripts |
| `sentamizh-corpus/` | Sentamizh Corpus verses (Apache-2.0) |
| `Tholkappiam.txt` | Tolkāppiyam e-text (Project Madurai) |

Highlights: verified-first word search with lemmatisation, sentence analysis and a Reading Chamber (tap any word in a
passage); Tanglish search built on nlp-for-tanglish; Tirukkuṟaḷ search; an interactive Tolkāppiyam knowledge graph;
Groq AI assistance only for words the corpus does not know, clearly marked; Supabase authentication (email and Google)
with profiles, progress and community stored under row-level security; cinematic world introductions.

## Running it

Requirements: Node.js 20+, npm.

1. **Provide the two datasets not included in this repository** (see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
   for why):
   - `datasets/thirukkural.json` — place your Tirukkuṟaḷ source as `datasets/Thirukkural.pdf` and run
     `python datasets/extract_thirukkural.py`.
   - `iwn_data/` — IndoWordNet from CFILT, IIT Bombay (`synsets/all.tamil`, `synset_relations/hypernymy.noun`,
     `synset_relations/hyponymy.noun`).
2. **Create `web/.env`** (never committed):
   ```
   SUPABASE_URL=...        # your Supabase project URL
   SUPABASE_KEY=...        # the project's publishable (anon) key — never a secret/service-role key
   GROQ-API=...            # Groq API key, used only on the server
   ```
3. **Set up the database** — follow [web/supabase/README.md](web/supabase/README.md) (apply the two migrations; enable
   Google sign-in if wanted).
4. **Start it:**
   ```
   cd web
   npm install
   npm run dev
   ```
   Open http://localhost:3000.

The app reads datasets from the repository root by default; set `SOLVELI_DATA_DIR` to use another location.
