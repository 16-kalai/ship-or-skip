import type { PublicProblem } from "@/lib/challenges/types";

// A practice interview follows Truvet's skeleton, shortened to five sections (~10 minutes):
// test decisions about the work, not the work itself.
export const SECTIONS = ["warm_up", "ownership", "merge_this", "approach", "twist"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABEL: Record<Section, string> = {
  warm_up: "Warm-up",
  ownership: "Your work",
  merge_this: "Merge this?",
  approach: "Approach",
  twist: "Twist",
};

export type Level = "fresher" | "mid" | "senior";

// What the browser sees of a turn. Rubrics never leave the server.
export type InterviewTurn = {
  id: string;
  role: "interviewer" | "candidate";
  kind: "question" | "follow_up" | "answer" | "close";
  question_index: number;
  content: string;
  card: { problem: PublicProblem } | null;
  created_at: string;
};

export const DIMENSIONS = [
  "thinking",
  "judgment",
  "ownership",
  "depth",
  "adaptability",
  "communication",
  "role_knowledge",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  thinking: "Thinking",
  judgment: "Judgment",
  ownership: "Ownership",
  depth: "Depth",
  adaptability: "Adaptability",
  communication: "Communication",
  role_knowledge: "Role knowledge",
};

export type Report = {
  overall: number;
  verdict: "Ready to interview" | "Almost there" | "Not yet";
  headline: string;
  dimensions: Array<{ key: Dimension; score: number | null; note: string; quote: string | null }>;
  strengths: string[];
  improvements: string[];
  questions: Array<{ section: Section; question: string; score: number; feedback: string; better_answer: string }>;
  next_steps: string[];
};

// One card on the candidate's canvas (what Rev puts on screen for a question).
export type CanvasCard = {
  section: Section;
  title: string;
  question: string;
  context: string | null;
  problem: PublicProblem | null;
};

export type InterviewView = {
  id: string;
  roleTitle: string;
  company: string | null;
  candidateName: string | null;
  status: "active" | "completed" | "abandoned";
  canvas: CanvasCard[];
  turns: InterviewTurn[];
  report: Report | null;
};

// How long a practice call should run; Rev is nudged to wrap up around here.
export const CALL_MINUTES = 8;
