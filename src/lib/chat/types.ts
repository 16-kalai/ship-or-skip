// Shared by the server and the chat UI.
import type { MessageMeta } from "@/lib/challenges/types";

export type ChatRole = "user" | "rev";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  // Which card to draw (choices, resume, problem, result…), or { fileName } for an attached resume.
  meta: MessageMeta;
  created_at: string;
};

export type Profile = {
  name: string | null;
  situation: "student" | "working" | "switching" | "other" | null;
  title: string | null;
  years_experience: number | null;
  stack: string[];
  level: "beginner" | "intermediate" | "advanced" | null;
  goal: string | null;
  goals: string[];
  // Area values from AREAS; null means not asked yet, [] means "not sure".
  strengths: string[] | null;
  weaknesses: string[] | null;
  summary: string | null;
  background_done: boolean;
  github: string | null;
  points: number;
  solved: number;
  onboarded_at: string | null;
};

// Where the learner is. Onboarding: situation → background (resume or projects) → goal →
// strengths → weaknesses → start.
// Then: start (first problem offered) → challenge (problem open) → result (graded) → challenge …
export type Stage = "situation" | "background" | "goal" | "strengths" | "weaknesses" | "start" | "challenge" | "result";

// Buttons send these instead of free text.
export type ChatAction = "hint" | "next";

export type ChatResponse = {
  messages: ChatMessage[];
  stage: Stage;
};

export const MAX_TEXT_CHARS = 2000;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_TRIES = 3;
