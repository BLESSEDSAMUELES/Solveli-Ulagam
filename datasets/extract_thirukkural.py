"""Extract datasets/Thirukkural.pdf into datasets/thirukkural.json (run once; the app reads the JSON).

    python datasets/extract_thirukkural.py

Each kural keeps: number, book (paal), section (iyal), chapter (number + English + Tamil name),
the couplet lines, three Tamil commentaries (Kalaignar, Mu. Varadarasanar, Solomon Pappaiah),
and the English translation + explanation printed in the PDF.
"""
import collections
import json
import re
import sys
from pathlib import Path

import pymupdf

from tk_glyphs import decode

HERE = Path(__file__).parent
PDF = HERE / "Thirukkural.pdf"
OUT = HERE / "thirukkural.json"
TAMIL_FONT = "TTFFA99EB8"


def page_lines(page):
    """Rebuild text lines from raw glyphs; drop the 4× overprinted fake-bold copies."""
    chars_all = []
    for span in page.get_texttrace():
        tamil = TAMIL_FONT in span["font"]
        if not tamil and "Times" not in span["font"]:
            continue
        for c in span["chars"]:
            x, y = c[2]
            chars_all.append((y, x, tamil, c[1], c[0]))
    # Cluster baselines: the Tamil and Latin fonts sit ~1pt apart on the same visual line.
    rows, last_y = [], None
    for y, x, tamil, g, u in sorted(chars_all):
        if last_y is None or y - last_y > 2.5:
            rows.append([])
        rows[-1].append((x, tamil, g, u))
        last_y = y
    lines = []
    for row in rows:
        chars, kept = sorted(row), []
        for ch in chars:
            # an overprint copy: same glyph, same font, within 1pt of one already kept
            if any(k[2] == ch[2] and k[1] == ch[1] and abs(k[0] - ch[0]) < 1.0 for k in kept[-8:]):
                continue
            kept.append(ch)
        text, buf = "", []
        for x, tamil, g, u in kept:
            if tamil and u != 32:
                buf.append(g)
                continue
            if buf:
                text += decode(buf)
                buf = []
            text += " " if u == 32 else chr(u)
        if buf:
            text += decode(buf)
        text = re.sub(r"\s+", " ", text).strip()
        if text and not text.isdigit():  # page numbers
            lines.append(text)
    return lines


def main():
    doc = pymupdf.open(PDF)
    lines = [l for p in doc for l in page_lines(p)]

    # English chapter names: the introduction lists them in a 3-column table, one text block per cell
    # ("12. Impartiality - …"). The English part is clean in the normal text layer.
    chapters = {}
    for page in doc.pages(0, 16):
        for b in page.get_text("blocks"):
            # "12. Impartiality - …", later cells drop the hyphen ("75. Fortress அரண்"), and long names wrap
            # ("Betting children / The Wealth of\nChildren - …"): the name is the run of Latin text after the number.
            # overlapping search: a number glued to garbled Tamil ("ற536. Truth…") still yields "36."
            for m in re.finditer(r"(?=(\d{1,3})\.\s+([A-Za-z][A-Za-z ,'’/()]*(?:\n[A-Z][A-Za-z ,'’/()]*(?=\s*-))?))", b[4]):
                n = int(m.group(1))
                if 1 <= n <= 133 and n not in chapters:
                    chapters[n] = {"number": n, "en": re.sub(r"\s+", " ", m.group(2)).strip()}

    books = {"அறத்துப்பால்": "Virtue", "பொருட்பால்": "Wealth", "காமத்துப்பால்": "Love"}
    fields = [("கலைஞர் உரை", "kalaignar"), ("மு.வ உரை", "mu_va"), ("சாலமன் பாப்பையா உரை", "solomon_pappaiah"),
              ("Translation", "translation"), ("Explanation", "explanation")]
    kurals, cur, field, heading, after_heading = [], None, None, {}, False
    for line in lines:
        h = re.match(r"^(அறத்துப்பால்|பொருட்பால்|காமத்துப்பால்)\s*-\s*(.+?)\s*-\s*(.+)$", line)
        if h:
            heading = {"book_ta": h.group(1), "section": h.group(2).strip(), "chapter_ta": h.group(3).strip()}
            after_heading = True
            continue
        # a long chapter name wraps onto the next line ("… - புதல்வரைப்" / "பெறுதல்")
        if after_heading and not line.startswith("குறள்") and re.fullmatch(r"[஀-௿ ]{2,40}", line):
            heading["chapter_ta"] += " " + line
            continue
        after_heading = False
        k = re.match(r"^குறள்\s*(\d+)\s*:\s*(.*)$", line)
        if k:
            cur = {"number": int(k.group(1)), "lines": [k.group(2)] if k.group(2) else [], **heading}
            for _, key in fields:
                cur[key] = ""
            kurals.append(cur)
            field = "lines"
            continue
        if cur is None:
            continue
        f = next(((key, line[len(label):].lstrip(" :")) for label, key in fields if line.startswith(label)), None)
        if f:
            field, rest = f
            if rest:
                cur[field] = rest
            continue
        if field == "lines":
            if len(cur["lines"]) < 2:
                cur["lines"].append(line)
            continue
        cur[field] = (cur[field] + " " + line).strip()

    out, problems, seen = [], [], set()
    for k in kurals:
        n = k["number"]
        if n in seen:  # the PDF repeats chapter 107 in place of chapters 116–117
            continue
        seen.add(n)
        c = (n - 1) // 10 + 1
        # A kural is 4 + 3 words; the PDF sometimes prints it on one line or wraps it unevenly.
        words = " ".join(k["lines"]).split()
        couplet = [" ".join(words[:4]), " ".join(words[4:])] if len(words) >= 5 else [" ".join(words)]
        rec = {
            "number": n,
            "book": {"ta": k.get("book_ta", ""), "en": books.get(k.get("book_ta", ""), "")},
            "section": k.get("section", ""),
            "chapter": {"number": c, "en": chapters.get(c, {}).get("en", ""), "ta": k.get("chapter_ta", "")},
            "lines": couplet,
            "translation": k["translation"], "explanation": k["explanation"],
            "commentary": {"kalaignar": k["kalaignar"], "mu_va": k["mu_va"], "solomon_pappaiah": k["solomon_pappaiah"]},
        }
        if len(rec["lines"]) != 2 or not rec["explanation"] or not rec["chapter"]["ta"]:
            problems.append(n)
        out.append(rec)
    out.sort(key=lambda r: r["number"])
    missing = sorted(set(range(1, 1331)) - seen)

    # Sanity checks against couplets known independently.
    known = {1: "அகர முதல எழுத்தெல்லாம் ஆதி", 2: "கற்றதனால் ஆய பயனென்கொல்", 10: "பிறவிப் பெருங்கடல் நீந்துவர்",
             100: "இனிய உளவாக இன்னாத", 391: "கற்க கசடறக் கற்பவை", 400: "கேடில் விழுச்செல்வம் கல்வி", 1330: "ஊடுதல் காமத்திற்கு இன்பம்"}
    byn = {k["number"]: k for k in out}
    for n, start in known.items():
        got = " ".join(byn[n]["lines"]) if n in byn else "(missing)"
        print(f"kural {n}: {got}  {'OK' if got.startswith(start) else 'MISMATCH'}")
    print(f"{len(out)} kurals, {len(chapters)} English chapter names, {len(problems)} incomplete: {problems[:20]}")
    print(f"not present in the PDF: {missing}")
    OUT.write_text(json.dumps({"source": "datasets/Thirukkural.pdf", "count": len(out), "missing_in_source": missing, "kurals": out},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", OUT)
    ok = all(" ".join(byn[n]["lines"]).startswith(v) for n, v in known.items() if n in byn)
    return 0 if ok and len(out) + len(missing) == 1330 and not problems else 1


if __name__ == "__main__":
    sys.exit(main())
