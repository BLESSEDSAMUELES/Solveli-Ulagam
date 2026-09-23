// Onboarding content. Guide lines are real opening/famous lines with their source,
// never invented speech (master doc §12, §27).

export const STEPS = [
  { title: "Select Your Role", sub: "Student, Educator, Researcher or Explorer" },
  { title: "Tamil Level", sub: "How comfortable are you with Tamil?" },
  { title: "Choose Your Companion", sub: "Yaazhini or Valavan" },
  { title: "Choose Your Guide", sub: "Your literary companion" },
  { title: "Enter the Academy", sub: "Begin your journey" },
];

export type Option = { id: string; title: string; sub: string; points: string[]; glyph: string };

export const ROLES: Option[] = [
  { id: "student", title: "Student", sub: "Understand words and build vocabulary.", glyph: "மா", points: ["Search & explore", "Challenges & XP", "Streaks & mastery"] },
  { id: "educator", title: "Educator", sub: "Demonstrate context and create activities.", glyph: "ஆ", points: ["Compare contexts", "Create quizzes", "Share activities"] },
  { id: "researcher", title: "Researcher", sub: "Inspect evidence and relationships.", glyph: "ஆய்", points: ["Occurrences & graph", "Period comparison", "Citation export"] },
  { id: "explorer", title: "Explorer", sub: "Discover literature casually.", glyph: "உ", points: ["Guided exploration", "Short activities", "Collections"] },
];

export const LEVELS: Option[] = [
  { id: "new", title: "I'm new to Tamil", sub: "I am just starting to learn Tamil.", glyph: "அ", points: ["Simple explanations", "Audio support", "More visuals", "Playful learning"] },
  { id: "basic", title: "I know basic Tamil", sub: "I can read simple Tamil words.", glyph: "இ", points: ["Clear explanations", "Word examples", "Practice questions", "Build vocabulary"] },
  { id: "reader", title: "I can read Tamil", sub: "I can read and understand Tamil.", glyph: "உ", points: ["Contextual meanings", "Literary examples", "Explore regions", "Challenges & progress"] },
  { id: "deep", title: "I study Tamil deeply", sub: "I want detailed meanings, contexts and sources.", glyph: "ஔ", points: ["Multiple contexts", "Compare across periods", "Research tools", "Citations & analysis"] },
];

export const COMPANIONS = [
  { id: "yaazhini", name: "Yaazhini", role: "Your Explorer Companion", glyph: "யா", line: "வாருங்கள், தமிழின் உலகத்தை சேர்ந்து பயணிப்போம்!", points: ["Friendly & curious", "Explains in simple words", "Makes learning fun", "Encourages exploration"] },
  { id: "valavan", name: "Valavan", role: "Your Learning Companion", glyph: "வ", line: "கேள்வி கேள், கண்டுபிடி, முன்னேறு!", points: ["Motivates with challenges", "Helps you think deeper", "Explores with you", "Tracks your progress"] },
];

export const GUIDES = [
  { id: "thiruvalluvar", name: "Thiruvalluvar", role: "Wisdom for Life", glyph: "வ", line: "அகர முதல எழுத்தெல்லாம் ஆதி பகவன் முதற்றே உலகு", cite: "Tirukkuṟaḷ 1", tags: ["Thirukkural", "Ethics & Life", "All Ages"] },
  { id: "avvaiyar", name: "Avvaiyar", role: "Simple Words, Deep Wisdom", glyph: "ஔ", line: "அறம் செய விரும்பு", cite: "Āttichūḍi 1", tags: ["Aathichoodi", "Foundational Tamil", "Kids & Beginners"] },
  { id: "tolkappiyar", name: "Tolkappiyar", role: "The Science of Tamil", glyph: "தொ", line: "எல்லாச் சொல்லும் பொருள் குறித்தனவே", cite: "Tolkāppiyam, Peyariyal 1", tags: ["Tolkappiyam", "Grammar & Language", "Students & Researchers"] },
  { id: "ilango", name: "Ilango Adigal", role: "Stories that Echo Through Time", glyph: "இ", line: "அரைசியல் பிழைத்தோர்க்கு அறம் கூற்றாவதூஉம்", cite: "Cilappatikāram, Patikam", tags: ["Silappathikaram", "History & Society", "Students & Explorers"] },
  { id: "kambar", name: "Kambar", role: "Poetry that Inspires", glyph: "க", line: "உலகம் யாவையும் தாம் உளவாக்கலும்", cite: "Kamparāmāyaṇam, invocation", tags: ["Kamba Ramayanam", "Poetry & Devotion", "All Learners"] },
  { id: "uvsa", name: "U.V. Swaminatha Iyer", role: "The Preserver", glyph: "உ", line: "", cite: "Recovered classical Tamil texts from palm-leaf manuscripts", tags: ["Manuscripts & Texts", "Research & Preservation", "Researchers"] },
];
