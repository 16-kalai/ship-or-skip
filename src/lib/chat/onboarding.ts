import { z } from "zod";
import { BRAND } from "@/lib/brand";
import { AREAS, GOALS, NOT_SURE, SITUATIONS } from "@/lib/chat/quick-replies";
import type { Profile, Stage } from "@/lib/chat/types";

// Rev's first message. Shown by the UI with the "what are you doing" tiles; never stored.
export function greeting(firstName: string | null) {
  return `Hey${firstName ? ` ${firstName}` : ""}! I'm ${BRAND.tutor}. I write code fast, and I sneak mistakes into it. Your job is to catch them. First things first: what are you doing right now?`;
}

export const RESUME_ASK =
  "Got a resume? Drop it below and I'll pick out your skills and projects. No resume? No problem.";
export const PROJECTS_ASK =
  "No worries! In a line or two: what have you built, and which languages or frameworks did you use?";
export const GOAL_ASK = `Last one: what do you want from ${BRAND.name}? Pick as many as you like.`;
export const STRENGTHS_ASK =
  "Nice. Two quick ones so I can pitch this right. Where do you feel strongest? Pick any that fit.";
export const WEAKNESSES_ASK =
  "And which do you want to get better at? I'll lean your practice towards these.";
export const START_LINE =
  "Love it. Let's start with a small problem. Here's how it works, it takes about two minutes:";

// What we can read from a typed answer or a resume.
export const Background = z.object({
  situation: z.enum(["student", "working", "switching", "other"]).optional(),
  title: z.string().max(100).optional(),
  years_experience: z.number().min(0).max(60).optional(),
  stack: z.array(z.string().max(40)).max(10).optional(),
  summary: z.string().max(400).optional(),
  github: z.string().max(39).optional(),
  // One short, specific, friendly reaction to what they shared (mention one concrete detail).
  reaction: z.string().max(240),
});
export type Background = z.infer<typeof Background>;

export function backgroundSystem(known: Profile) {
  return `You read what a developer shares about themselves (a typed answer or a resume) for ${BRAND.name}, an app that teaches people to judge AI-written code. Extract only what is stated or clearly implied; never invent anything.

- situation: student, working (works as a developer), switching (moving into tech), other (works, not as a developer).
- title: their role, e.g. "Full-stack developer at a startup" or "Final-year CS student".
- years_experience: years of coding or professional development experience, as a number.
- stack: languages and frameworks they use (e.g. JavaScript, React, Node, Python, Java, Spring).
- summary: one line on their background and notable projects, in third person.
- github: their GitHub username, if a GitHub link or handle appears.
- reaction: ${BRAND.tutor}'s one-sentence reaction, warm and specific (mention one concrete detail, like a project or a stack). Plain text, at most one emoji.

Already known: ${JSON.stringify(compact(known))}`;
}

// After onboarding, between problems: Rev just chats.
export const ChatTurn = z.object({ reply: z.string().min(1).max(800) });

export function chatSystem(profile: Profile) {
  return `You are ${BRAND.tutor}, the AI code buddy inside ${BRAND.name}. ${BRAND.tutor} shows developers code an AI wrote; they decide "ship it" or "skip it" and say why, then ${BRAND.tutor} teaches what they missed. Talk like a friendly senior developer: warm, specific, 1 to 3 short sentences, plain text, at most one emoji. If they seem nervous, reassure them: it's practice, wrong answers are how they learn. Steer them to the next problem.

The learner: ${JSON.stringify(compact(profile))}`;
}

// Where onboarding stands, from what's saved.
export function stageFor(profile: Profile, attempts: { open: boolean; count: number }): Stage {
  if (!profile.situation) return "situation";
  if (!profile.background_done) return "background";
  if (!profile.goals.length) return "goal";
  if (profile.strengths === null) return "strengths";
  if (profile.weaknesses === null) return "weaknesses";
  if (attempts.open) return "challenge";
  return attempts.count ? "result" : "start";
}

export function situationFromText(text: string) {
  const t = text.trim().toLowerCase();
  return SITUATIONS.find((s) => s.label.toLowerCase() === t)?.value as Profile["situation"] | undefined;
}

export function goalsFromText(text: string) {
  const picked = GOALS.filter((g) => text.toLowerCase().includes(g.label.toLowerCase())).map((g) => g.value);
  // Anything typed that isn't a tile is kept in their words.
  return picked.length ? picked : [text.trim().slice(0, 120)];
}

// Tapped area labels map to their values; "not sure" is an empty list; anything typed is kept.
export function areasFromText(text: string) {
  const t = text.toLowerCase();
  if (t.includes(NOT_SURE.toLowerCase())) return [];
  const picked = AREAS.filter((a) => t.includes(a.label.toLowerCase())).map((a) => a.value);
  return picked.length ? picked : [text.trim().slice(0, 120)];
}

export function areaLabels(values: string[] | null) {
  return (values ?? []).map((v) => AREAS.find((a) => a.value === v)?.label ?? v);
}

export function situationReaction(situation: NonNullable<Profile["situation"]>) {
  return {
    student: "A student, nice! You're learning at exactly the right time.",
    working: "A working developer, great. You've probably reviewed AI code already, maybe without noticing.",
    switching: "Switching into tech, love that. This is a great way to build real judgement fast.",
    other: "Nice! You don't have to be a developer to get good at spotting what AI gets wrong.",
  }[situation];
}

// Level from experience: under 1 year (or a student) is beginner, 1 to 4 intermediate, 5+ advanced.
export function inferLevel(profile: Profile): Profile["level"] {
  const years = profile.years_experience;
  if (profile.situation === "student" && (years === null || years < 2)) return "beginner";
  if (years === null) return profile.level ?? "beginner";
  return years < 1 ? "beginner" : years < 5 ? "intermediate" : "advanced";
}

// New facts win; anything not mentioned keeps its saved value.
export function mergeBackground(saved: Profile, found: Partial<Background>): Profile {
  const next: Profile = {
    ...saved,
    situation: found.situation ?? saved.situation,
    title: found.title ?? saved.title,
    years_experience: found.years_experience ?? saved.years_experience,
    stack: found.stack?.length ? dedupe([...saved.stack, ...found.stack]) : saved.stack,
    summary: found.summary ?? saved.summary,
    github: found.github && /^[A-Za-z0-9-]{1,39}$/.test(found.github) ? found.github : saved.github,
  };
  next.level = inferLevel(next);
  return next;
}

// The voice call's update_profile tool finishes onboarding once these are known.
export function hasEssentials(profile: Profile) {
  return Boolean(profile.situation && profile.background_done && profile.goals.length && profile.weaknesses !== null);
}

export function compact(profile: Profile) {
  const skip = new Set(["onboarded_at", "background_done", "points", "solved"]);
  return Object.fromEntries(
    Object.entries(profile).filter(
      ([key, value]) => !skip.has(key) && value !== null && !(Array.isArray(value) && value.length === 0),
    ),
  );
}

function dedupe(items: string[]) {
  const seen = new Set<string>();
  return items
    .map((item) => item.trim())
    .filter((item) => item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()))
    .slice(0, 10);
}

export const EMPTY_PROFILE: Profile = {
  name: null,
  situation: null,
  title: null,
  years_experience: null,
  stack: [],
  level: null,
  goal: null,
  goals: [],
  strengths: null,
  weaknesses: null,
  summary: null,
  background_done: false,
  github: null,
  points: 0,
  solved: 0,
  onboarded_at: null,
};

export const PROFILE_COLUMNS =
  "name, situation, title, years_experience, stack, level, goal, goals, strengths, weaknesses, summary, background_done, github, points, solved, onboarded_at";
