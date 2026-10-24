import { getProblem } from "@/lib/challenges/bank";

// The AI Code Judgement score: one number out of 10 a hiring manager can read at a glance.
// The difficulty-weighted average of the learner's last 10 graded problems, so it reflects
// current skill, counts harder problems more, and can't be inflated by grinding easy ones.

const WINDOW = 10;
// Below this many graded problems the score is shown as provisional.
export const PROVISIONAL_BELOW = 3;
const LEVEL_WEIGHT = { beginner: 1, intermediate: 1.25, advanced: 1.5 } as const;

export type RatingInput = {
  problem_id: string;
  // Generated problems carry their own level in the attempt's snapshot.
  problem?: { level?: "beginner" | "intermediate" | "advanced" } | null;
  score: number | null;
  correct: boolean | null;
  tries: number;
  breakdown: { flaw?: number } | null;
};

export type Rating = {
  // Null until the first graded problem.
  score: number | null;
  band: "Learning" | "Developing" | "Solid" | "Strong" | "Exceptional" | null;
  provisional: boolean;
  basedOn: number;
  // The evidence behind the number, as whole percentages.
  rightCalls: number;
  namedIssue: number;
  firstTry: number;
  avgTries: number;
};

export function bandFor(score: number): NonNullable<Rating["band"]> {
  if (score >= 9) return "Exceptional";
  if (score >= 8) return "Strong";
  if (score >= 6) return "Solid";
  if (score >= 4) return "Developing";
  return "Learning";
}

// Oldest first in, most recent window used.
export function computeRating(graded: RatingInput[]): Rating {
  const recent = graded.slice(-WINDOW);
  if (!recent.length) {
    return { score: null, band: null, provisional: true, basedOn: 0, rightCalls: 0, namedIssue: 0, firstTry: 0, avgTries: 0 };
  }
  let weighted = 0;
  let weights = 0;
  for (const a of recent) {
    const level = a.problem?.level ?? getProblem(a.problem_id)?.level ?? "beginner";
    weighted += (a.score ?? 0) * LEVEL_WEIGHT[level];
    weights += LEVEL_WEIGHT[level];
  }
  const score = Math.round((weighted / weights) * 10) / 10;
  const pct = (n: number) => Math.round((n / recent.length) * 100);
  return {
    score,
    band: bandFor(score),
    provisional: recent.length < PROVISIONAL_BELOW,
    basedOn: graded.length,
    rightCalls: pct(recent.filter((a) => a.correct).length),
    namedIssue: pct(recent.filter((a) => (a.breakdown?.flaw ?? 0) > 0).length),
    firstTry: pct(recent.filter((a) => a.correct && a.tries <= 1).length),
    avgTries: Math.round((recent.reduce((n, a) => n + Math.max(1, a.tries), 0) / recent.length) * 10) / 10,
  };
}

// What the score means, in one line for a hiring manager. Provisional scores say so.
export function ratingMeaning(rating: Rating) {
  if (rating.basedOn > 0 && rating.provisional) {
    return `An early read from ${rating.basedOn} review${rating.basedOn === 1 ? "" : "s"}. It becomes a reliable score after ${PROVISIONAL_BELOW}.`;
  }
  switch (rating.band) {
    case "Exceptional":
      return "Reliably catches subtle bugs in AI-written code and explains them like a senior reviewer.";
    case "Strong":
      return "Catches most flaws in AI-written code and explains them clearly. Safe to trust with reviews.";
    case "Solid":
      return "Catches common flaws in AI-written code; sometimes needs a nudge on subtler ones.";
    case "Developing":
      return "Spots some flaws in AI-written code; still learning to check edge cases and intent.";
    case "Learning":
      return "Early in learning to review AI-written code; tends to trust it at face value.";
    default:
      return "No reviews yet.";
  }
}
