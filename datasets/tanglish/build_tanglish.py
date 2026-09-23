"""Build datasets/tanglish/tanglish.json from goru001/nlp-for-tanglish (MIT, see LICENSE-nlp-for-tanglish).

    python datasets/tanglish/build_tanglish.py <path-to-nlp-for-tanglish-checkout>

What we take from the repository, and why:
  * language-model/ulmfit_embeddings_metadata.tsv — the 8,000-piece SentencePiece vocabulary the authors trained on
    Tamil Wikipedia transliterated to Latin script (datasets-preparation/transliterate.ipynb, via indictrans).
    Solveli uses it to recognise and segment Tanglish input.
  * language-model/ulmfit_embeddings.tsv — the ULMFiT LM's 400-d input embeddings for that vocabulary.
    We precompute each whole-word piece's nearest neighbours (cosine) so the search can expand a Tanglish word with
    related Tanglish words, without shipping 35 MB of vectors or running the model at request time.
The trained SentencePiece model and the full LM are hosted on Google Drive (not in the repo) and are not needed here.
"""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
repo = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "nlp-for-tanglish"
lm = repo / "language-model"

pieces = (lm / "ulmfit_embeddings_metadata.tsv").read_text(encoding="utf-8").splitlines()
vectors = np.loadtxt(lm / "ulmfit_embeddings.tsv", delimiter="\t", dtype=np.float32)
assert len(pieces) == len(vectors) == 8000, (len(pieces), vectors.shape)

# Whole-word pieces ("▁anbu"): alphabetic, at least 3 letters.
words = [(i, p[1:]) for i, p in enumerate(pieces) if p.startswith("▁") and p[1:].isalpha() and p[1:].isascii() and len(p) >= 4]
idx = np.array([i for i, _ in words])
m = vectors[idx]
m = m / np.linalg.norm(m, axis=1, keepdims=True)
sims = m @ m.T
np.fill_diagonal(sims, -1)

K, MIN_SIM = 6, 0.45
neighbours = {}
for row, (_, w) in enumerate(words):
    top = np.argsort(-sims[row])[:K]
    near = [[words[j][1], round(float(sims[row, j]), 3)] for j in top if sims[row, j] >= MIN_SIM]
    if near:
        neighbours[w] = near

out = {
    "source": "https://github.com/goru001/nlp-for-tanglish (MIT, Copyright (c) 2020 Gaurav Arora)",
    "pieces": [p for p in pieces if not p.startswith("xx")],  # SentencePiece vocabulary (special tokens dropped)
    "words": [w for _, w in words],
    "neighbours": neighbours,
}
dest = HERE / "tanglish.json"
dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(out['pieces'])} pieces, {len(words)} whole words, {len(neighbours)} with neighbours -> {dest} ({dest.stat().st_size // 1024} KB)")
for probe in ["anbu", "kalvi", "tamil", "thiru", "yaar", "ulagam", "manam"]:
    print(probe, neighbours.get(probe, [])[:5])
