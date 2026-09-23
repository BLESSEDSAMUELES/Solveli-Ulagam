# Third-party materials

Solveli's own work is proprietary (see [LICENSE](LICENSE)). The materials below belong to their respective owners
and are used under their own licences, which continue to apply to them. The proprietary licence does not claim them.

## Included in this repository

| Material | Location | Owner | Licence |
| --- | --- | --- | --- |
| Sentamizh Corpus — annotated Classical Tamil verses | `sentamizh-corpus/sentamizh_corpus.json` | Sentamizh Corpus authors (see `sentamizh-corpus/CITATION.cff`) | Apache License 2.0 — full text in `sentamizh-corpus/LICENSE` |
| Tolkāppiyam e-text | `Tholkappiam.txt` | © Project Madurai, 1998–2024 | Free distribution, provided the header page is kept intact (it is) |
| Tanglish vocabulary and neighbours, derived from nlp-for-tanglish | `datasets/tanglish/` | © 2020 Gaurav Arora | MIT — full text in `datasets/tanglish/LICENSE-nlp-for-tanglish` |
| Onboarding animations (8 files) | `web/public/animations/onboarding/` | Individual creators on LottieFiles (listed in the folder's `LICENSE.md`) | Lottie Simple License (FL 9.13.21) — full text and credits in `web/public/animations/onboarding/LICENSE.md` |

Notes:
- The Sentamizh Corpus includes English translations it credits to Vaidehi Herbert (Kuṟuntokai, Naṟṟiṇai). Those
  translations are her work; commercial use of them may require her permission, independent of the corpus licence.
- The Lottie Simple License requires that the animations be distributed under the same licence; they are not part
  of the proprietary Work.

## Used at runtime, not included

| Material | Why it is not in the repository | How to provide it |
| --- | --- | --- |
| Tirukkuṟaḷ data (`datasets/Thirukkural.pdf` → `datasets/thirukkural.json`) | The source PDF includes modern commentaries (Kalaignar, Mu. Varadarasanar, Solomon Pappaiah) whose copyright status is uncertain | Obtain a source you have rights to, place it as `datasets/Thirukkural.pdf`, run `python datasets/extract_thirukkural.py` |
| IndoWordNet (Tamil synsets and relations) | Distributed by CFILT, IIT Bombay "free for research"; redistribution and commercial terms are not stated with the data | Obtain from https://www.cfilt.iitb.ac.in/indowordnet/ under its terms and place it in `iwn_data/` (`synsets/all.tamil`, `synset_relations/hypernymy.noun`, `synset_relations/hyponymy.noun`) |

## Software dependencies (installed by npm, not included)

next (MIT), react and react-dom (MIT), @supabase/supabase-js and @supabase/ssr (MIT), d3 (ISC), lottie-web (MIT),
lucide-react (ISC), and their transitive dependencies under their own licences. Fonts (Cormorant Garamond, EB Garamond,
Noto Serif Tamil) are loaded through Google Fonts under the SIL Open Font License.

## Services

Groq (AI-assisted explanations) and Supabase (authentication and database) are external services used under their
own terms; no keys are stored in this repository.

## Ported functionality

The Knowledge Graph (`web/src/lib/knowledge-graph.ts`, `web/src/components/academy/KnowledgeGraph.tsx`) is adapted
from the "Tolkappiyam AI" project (Flask + D3). The Copyright Holders must hold the rights to that project, or obtain
them, before licensing the Work commercially.
