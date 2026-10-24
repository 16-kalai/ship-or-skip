import type { Choice } from "@/lib/challenges/types";

// Onboarding step 1: what they're doing now. Tapping one sends its label.
export const SITUATIONS: Choice[] = [
  { label: "I'm a student", value: "student", hint: "Learning to code" },
  { label: "I'm a developer", value: "working", hint: "Writing code at work" },
  { label: "I'm switching into tech", value: "switching", hint: "Moving into a dev role" },
  { label: "I'm a working professional", value: "other", hint: "Not a developer" },
];

// Onboarding step 2: no resume is a full answer.
export const NO_RESUME = "I don't have a resume handy.";

// Onboarding step 3: what they want from this. Several can be picked.
export const GOALS: Choice[] = [
  { label: "Crack coding interviews", value: "interviews" },
  { label: "Review AI code at work", value: "review_at_work" },
  { label: "Write better code with AI", value: "better_with_ai" },
  { label: "Just curious", value: "curious" },
];

// Onboarding steps 4 and 5: strong areas, then areas to improve. Several can be picked.
export const AREAS: Choice[] = [
  { label: "Reading what was really asked", value: "requirements", hint: "Does the code match the request?" },
  { label: "Edge cases and boundaries", value: "edge_cases", hint: "Empty, zero, negative, off-by-one" },
  { label: "Security and access control", value: "security", hint: "Who's allowed, what's checked" },
  { label: "Performance and caching", value: "performance", hint: "Speed, caches, queries" },
  { label: "Reliability and failures", value: "reliability", hint: "Retries, timeouts, double charges" },
  { label: "Logic and estimation", value: "reasoning", hint: "Puzzles, maths, back-of-envelope" },
];
export const NOT_SURE = "Not sure yet";
