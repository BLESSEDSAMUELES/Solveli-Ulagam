// World introduction films, keyed by the existing WORLDS ids (src/lib/worlds.ts). One entry per world; Home, the Worlds
// map and the "Watch introduction again" button all read from here. To add a film: drop /public/video/worlds/<id>.mp4
// and add an entry. Source files: G:\Solveli\*.mp4 (e.g. "avaiyar sangam world.mp4" → sangam.mp4).

export type WorldIntro = {
  worldId: string;
  video: string;
  poster: string;        // the world's own artwork, shown while the film buffers or if it cannot play
  eyebrow: string;       // small line above the title
  title: string;
  titleTa: string;
  narrator?: string;     // character id (src/lib/characters.ts) or a plain name
  landingRoute: string;
};

const intro = (worldId: string, eyebrow: string, title: string, titleTa: string, narrator: string): WorldIntro => ({
  worldId, video: `/video/worlds/${worldId}.mp4`, poster: `/worlds/${worldId}.webp`, eyebrow, title, titleTa, narrator,
  landingRoute: `/academy/worlds/${worldId}`,
});

export const WORLD_INTROS: Record<string, WorldIntro> = {
  thirukkural: intro("thirukkural", "Ethics for Life · with Thiruvalluvar", "Welcome to the Thirukkural World", "திருக்குறள் உலகம்", "thiruvalluvar"),
  sangam: intro("sangam", "People · Love · Nature · with Avvaiyar", "Welcome to the Sangam World", "சங்க உலகம்", "avvaiyar"),
  bhakti: intro("bhakti", "Devotion · Poetry · Values · with Ilango Adigal", "Enter the Bhakti World", "பக்தி உலகம்", "ilango"),
  grammar: intro("grammar", "Language · Structure · Beauty · with Tolkappiyar", "Enter the Grammar World", "இலக்கண உலகம்", "tolkappiyar"),
  history: intro("history", "Kings · Culture · Heritage · with Kambar", "Enter the History World", "வரலாற்று உலகம்", "kambar"),
};

export const worldIntro = (id: string): WorldIntro | undefined => WORLD_INTROS[id];
