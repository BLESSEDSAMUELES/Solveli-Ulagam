// Character artwork, keyed by the ids the app already uses (GUIDE_META ids for guides, COMPANIONS ids for companions).
// To add a character: put <id>.webp (640×960 portrait) and <id>-face.webp (256×256 head crop) in /public/characters and
// add one entry here — guide cards, guide profiles, onboarding and companion avatars pick it up automatically.
// Source renders: G:\Solveli\*.jpeg (1024×1536), converted with sharp: portrait = resize 640×960 cover/top;
// face = square crop of the source (left, top, size): thiruvalluvar 330,50,340 · ilango 320,10,330 · kambar 300,30,340 ·
// tolkappiyar 340,10,320 · yaazhini 350,140,380 · valavan 340,50,350 (valavan.jpeg, replaced 23 Sep) · avvaiyar 340,40,330
// ("avaiyar sangam world.png") · sattanar 320,20,340 ("Cīttalai Cāttaṉār.png") · uvsa 330,40,340 ("u v swaminatha iyer.png") → 256×256.
// uvsa.webp is a head-and-shoulders crop (800×400 from the top): the source shows a book titled "Swadeshi Shipping", which
// belongs to V. O. Chidambaram Pillai, not U. V. Swaminatha Iyer — cropped out so a wrong attribution is never displayed.

export type Character = {
  id: string;
  name: string;
  kind: "guide" | "companion";
  portrait: string; // full-length portrait, 2:3
  face: string;     // square head-and-shoulders crop, for avatars
  bust: string;     // CSS object-position that frames head + shoulders when the portrait is cropped to a wide box
  alt: string;
};

// `file` defaults to the id. When a character's artwork is replaced, give the new files a new name (e.g. "valavan-2"):
// the image optimiser and browsers cache by URL, so reusing the old name keeps serving the old picture.
const make = (id: string, name: string, kind: Character["kind"], bust: string, alt: string, file = id): Character =>
  ({ id, name, kind, portrait: `/characters/${file}.webp`, face: `/characters/${file}-face.webp`, bust, alt });

export const CHARACTERS: Record<string, Character> = {
  thiruvalluvar: make("thiruvalluvar", "Thiruvalluvar", "guide", "50% 6%", "Thiruvalluvar, bearded, in a white veshti, holding palm-leaf manuscripts"),
  ilango: make("ilango", "Ilango Adigal", "guide", "50% 3%", "Ilango Adigal, a shaven-headed ascetic in white, holding palm-leaf manuscripts"),
  kambar: make("kambar", "Kambar", "guide", "48% 5%", "Kambar in a saffron turban and red shawl, holding a palm-leaf bundle"),
  tolkappiyar: make("tolkappiyar", "Tolkappiyar", "guide", "50% 4%", "Tolkappiyar in white robes with a stylus and palm-leaf manuscripts"),
  avvaiyar: make("avvaiyar", "Avvaiyar", "guide", "50% 5%", "Avvaiyar, an elderly poet with grey hair in a white sari, holding a staff and palm-leaf manuscripts"),
  sattanar: make("sattanar", "Cīttalai Cāttaṉār", "guide", "50% 4%", "Cīttalai Cāttaṉār in white robes with a topknot, holding palm-leaf manuscripts"),
  uvsa: make("uvsa", "U. V. Swaminatha Iyer", "guide", "50% 30%", "U. V. Swaminatha Iyer in a white turban and veshti"),
  yaazhini: make("yaazhini", "Yaazhini", "companion", "50% 14%", "Yaazhini, your explorer companion, smiling and holding out her hand"),
  valavan: make("valavan", "Valavan", "companion", "50% 6%", "Valavan, your learning companion, with a travel satchel and scroll", "valavan-2"),
};

export const character = (id: string | undefined): Character | undefined => (id ? CHARACTERS[id] : undefined);
/** Companion id from the display name used in profile names() ("Valavan" → "valavan"). */
export const companionId = (name: string) => (name.toLowerCase().startsWith("val") ? "valavan" : "yaazhini");
