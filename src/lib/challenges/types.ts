// What the browser may see about a problem. The answer key lives only in bank.ts on the server.
export type PublicProblem = {
  id: string;
  title: string;
  skill: string;
  language: "javascript" | "typescript" | "python" | "java" | "tsx" | "sql" | "text";
  filename: string;
  // What the person asked the AI for, in their words.
  request: string;
  code: string;
};

export type Breakdown = {
  call: number; // right verdict: 3
  flaw: number; // named the actual problem (or why it's correct): 4
  reasoning: number; // quality of the why: 2
  firstTry: number; // got it on the first try with no hints: 1
};

export type ResultCard = {
  correct: boolean;
  // Rev explained it after three tries.
  taught: boolean;
  tries: number;
  answer: "ship" | "skip";
  score: number;
  breakdown: Breakdown;
  proVersion: string;
  fix: { before: string; after: string } | null;
  rule: string;
};

export type Progress = {
  // AI Code Judgement score out of 10 (see lib/progress/rating.ts); null before any graded problem.
  rating: number | null;
  band: string | null;
  provisional: boolean;
  points: number;
  rank: number;
  players: number;
  solved: number;
  attempted: number;
  // Oldest first, for the graph.
  history: Array<{ title: string; score: number }>;
  firstTime: boolean;
};

export type Choice = { label: string; value: string; hint?: string };

// Message metadata: tells the chat UI which card to draw.
export type MessageMeta =
  | { fileName?: string; via?: "voice"; kind?: undefined }
  | { kind: "choices"; choices: Choice[]; multi: boolean }
  | { kind: "resume" }
  | { kind: "howto" }
  | { kind: "challenge"; problem: PublicProblem; number: number }
  | { kind: "nudge"; tries: number; of: number }
  | { kind: "result"; result: ResultCard }
  | { kind: "progress"; progress: Progress }
  | { kind: "hint" };
