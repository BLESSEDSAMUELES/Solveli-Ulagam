// Animated illustrations for the onboarding choices, keyed by step and by the existing option ids in lib/onboarding.ts
// (ROLES / LEVELS). Onboarding reads this map; an option without an entry keeps its Tamil glyph.
// All files are from LottieFiles' free library, each checked to be under the Lottie Simple License (FL 9.13.21) —
// free to use, modify and redistribute, including commercially; attribution is optional but given here and in
// public/animations/onboarding/LICENSE.md. Stored locally (optimised JSON) so onboarding never depends on a third-party CDN.

export type Anim = { src: string; title: string; author: string; url: string; meaning: string };

const a = (file: string, title: string, author: string, slug: string, meaning: string): Anim =>
  ({ src: `/animations/onboarding/${file}.json`, title, author, url: `https://lottiefiles.com/free-animation/${slug}`, meaning });

export const ONBOARDING_ANIMATIONS: Record<"role" | "level", Record<string, Anim>> = {
  role: {
    student: a("student", "Student with books", "Barnabás Prifer", "student-with-books-6zWUEiTgus", "A student with an armful of books"),
    educator: a("educator", "Teacher", "Kishor A", "teacher-yTs2BYVMkd", "A teacher at the board with a learner"),
    researcher: a("researcher", "Research Lottie Animation", "SM Rony", "research-lottie-animation-l2HMtzXN3x", "A magnifying glass over data — inspecting evidence"),
    explorer: a("explorer", "Journey", "Anna Bolshakova", "journey-jes76An0tS", "A traveller walking between map pins"),
  },
  level: {
    new: a("new", "Paper notebook writing animation", "MD Abdur", "paper-notebook-writing-animation-eY3NoiibMr", "Writing the first letters in a notebook"),
    basic: a("basic", "Writing an exam", "Natalia Świerz", "writing-an-exam-FxdIloLhZw", "Ticking off practice questions"),
    reader: a("reader", "Book with bookmark", "Spencer Lalonde", "book-with-bookmark-r3ctwEz66b", "An open book, read and understood"),
    deep: a("deep", "Graduation", "manju", "graduation-vxyplxIfYS", "A graduation cap and scroll — mastery"),
  },
};

export const onboardingAnimation = (step: string, id: string): Anim | undefined =>
  (ONBOARDING_ANIMATIONS as Record<string, Record<string, Anim>>)[step]?.[id];
