"use client";

import { createStore } from "@/lib/store";
import { COMPANIONS, LEVELS, ROLES } from "@/lib/onboarding";
import { guideMeta } from "@/lib/guides";

export type Profile = { role: string; level: string; companion: string; guide: string };

export const profile = createStore<Profile>("solveli.onboarding", { role: "student", level: "new", companion: "yaazhini", guide: "thiruvalluvar" });

export const lang = createStore<{ lang: "en" | "ta" }>("solveli.lang", { lang: "en" });

export function names(p: Profile) {
  return {
    role: ROLES.find((x) => x.id === p.role)?.title ?? "Student",
    level: LEVELS.find((x) => x.id === p.level)?.title ?? "",
    companion: COMPANIONS.find((x) => x.id === p.companion)?.name ?? "Yaazhini",
    guide: guideMeta(p.guide)?.name ?? "Thiruvalluvar",
  };
}
