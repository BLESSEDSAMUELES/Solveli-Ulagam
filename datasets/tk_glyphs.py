"""Glyph-level decoder for the Latha Tamil font embedded in Thirukkural.pdf.

The PDF (Word -> PScript -> Ghostscript, 2009) only maps some glyphs to Unicode, so its text layer is lossy.
We read raw glyph ids instead (PyMuPDF texttrace) and map each one, then reorder the visually-first
vowel signs (ெ ே ை) into Unicode logical order.
"""

# glyph id -> Unicode, identified from a rendered sheet of every glyph used in the PDF.
GLYPHS = {
    53: "ஃ", 54: "அ", 55: "ஆ", 56: "இ", 57: "ஈ", 58: "உ", 59: "ஊ", 60: "எ", 61: "ஏ", 62: "ஐ", 63: "ஒ", 64: "ஓ",
    66: "க", 67: "ங", 68: "ச", 69: "ஜ", 70: "ஞ", 71: "ட", 72: "ண", 73: "த", 74: "ந", 75: "ன", 76: "ப", 77: "ம",
    78: "ய", 79: "ர", 80: "ற", 81: "ல", 82: "ள", 83: "ழ", 84: "வ", 85: "ஷ", 86: "ஸ", 87: "ஹ",
    88: "ா", 89: "ி", 90: "ீ", 91: "ு", 92: "ூ", 93: "ெ", 94: "ே", 95: "ை", 99: "்", 100: "ௗ",
    116: "க்", 117: "ங்", 118: "ச்", 119: "ஜ்", 120: "ஞ்", 121: "ட்", 122: "ண்", 123: "த்", 124: "ந்", 125: "ன்",
    126: "ப்", 127: "ம்", 128: "ய்", 129: "ர்", 130: "ற்", 131: "ல்", 132: "ள்", 133: "ழ்", 134: "வ்", 135: "ஷ்",
    136: "ஸ்", 137: "ஹ்", 427: "ர்", 428: "ரி", 429: "ரீ", 426: "லீ",
    # alternate-width vowel-sign glyphs, identified from context by consonant width (ி: 89 narrow, 142/146 medium, 143 after ள/ன; ீ: 90, 145, 147)
    142: "ி", 143: "ி", 146: "ி", 90: "ீ", 145: "ீ", 147: "ீ",
    148: "கு", 149: "கூ", 150: "ஙு", 151: "ஙூ", 152: "சு", 153: "சூ", 154: "ஞு", 155: "ஞூ", 156: "டி", 157: "டீ",
    158: "டு", 159: "டூ", 160: "ணு", 161: "ணூ", 162: "து", 163: "தூ", 164: "நு", 165: "நூ", 167: "னு", 168: "னூ",
    169: "பு", 170: "பூ", 171: "மு", 172: "மூ", 173: "யு", 174: "யூ", 175: "ரு", 176: "ரூ", 178: "று", 179: "றூ",
    180: "லு", 181: "லூ", 182: "ளு", 183: "ளூ", 184: "ழு", 185: "ழூ", 186: "வு", 187: "வூ",
    192: "",  # dotted-circle placeholder
}

PREFIX = {"ெ", "ே", "ை"}
CONSONANTS = set("கஙசஜஞடணதநனபமயரறலளழவஷஸஹ")


def decode(glyph_ids, unknown=None):
    """Glyph ids in visual order -> logical-order Unicode Tamil."""
    out: list[str] = []
    pending = ""
    for g in glyph_ids:
        s = GLYPHS.get(g)
        if s is None:
            if unknown is not None:
                unknown[g] = unknown.get(g, 0) + 1
            continue
        if s in PREFIX:
            pending = s
            continue
        if pending and s and s[0] in CONSONANTS:
            # prefix vowel sign follows its consonant in Unicode order
            out.append(s[0] + pending + s[1:])
            pending = ""
            continue
        if pending:  # stray sign with no consonant: keep it rather than lose it
            out.append(pending)
            pending = ""
        # two-part vowels: ெ+ா→ொ, ே+ா→ோ, ெ+ௗ→ௌ
        if out and s in ("ா", "ௗ") and out[-1][-1:] in ("ெ", "ே"):
            last = out[-1]
            out[-1] = last[:-1] + {("ெ", "ா"): "ொ", ("ே", "ா"): "ோ", ("ெ", "ௗ"): "ௌ"}.get((last[-1], s), last[-1] + s)
            continue
        out.append(s)
    if pending:
        out.append(pending)
    return "".join(out)
