// Achievement definitions, shared by the client progress store and the database seed (public.achievements).
export const ACHIEVEMENTS = [
  { id: "discover-3", title: "Discover 3 words", description: "Look up three words and see where they live in literature.", goal: 3, xp: 50, diamonds: 5 },
  { id: "challenge-1", title: "Complete 1 contextual challenge", description: "Answer a contextual question correctly.", goal: 1, xp: 50, diamonds: 5 },
  { id: "sources-3", title: "Open 3 source references", description: "Open the source of three verses.", goal: 3, xp: 50, diamonds: 5 },
  { id: "streak-7", title: "7-day streak", description: "Learn something seven days in a row.", goal: 7, xp: 0, diamonds: 0 },
  { id: "perfect", title: "Perfect round in any challenge", description: "Answer every question of a round correctly.", goal: 1, xp: 100, diamonds: 5 },
  { id: "all-worlds", title: "Explore all five worlds", description: "Start a lesson or challenge in every world.", goal: 5, xp: 0, diamonds: 0 },
  { id: "mastered", title: "Master a word", description: "Take a word from Discovered to Mastered.", goal: 1, xp: 0, diamonds: 0 },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];
export const achievement = (id: AchievementId) => ACHIEVEMENTS.find((a) => a.id === id)!;
