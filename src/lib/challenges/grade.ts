import { z } from "zod";
import { BRAND } from "@/lib/brand";
import { generateJson } from "@/lib/ai/gemini";
import type { Problem } from "@/lib/challenges/bank";
import type { Breakdown, ResultCard } from "@/lib/challenges/types";
import { MAX_TRIES } from "@/lib/chat/types";

const Review = z.object({
  verdict: z.enum(["ship", "skip", "unclear"]),
  gave_reason: z.boolean(),
  named_flaw: z.boolean(),
  reasoning: z.enum(["none", "partial", "good"]),
  follow_up: z.string().max(300),
  nudge: z.string().max(400),
  reply: z.string().min(1).max(700),
  pro_version: z.string().max(300),
});

function numbered(code: string) {
  return code
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(2)} | ${line}`)
    .join("\n");
}

function system(problem: Problem, attempt: number) {
  return `You are ${BRAND.tutor}, grading a learner's review of AI-written code in ${BRAND.name}. "Ship it" means the code is right as it is. "Skip it" means it needs changes.

${problem.kind === "logic" ? `The question the AI was asked: "${problem.request}"\nThe AI's answer:\n${problem.code}\n(This is a reasoning problem: "ship it" means the AI's answer is right, "skip it" means it's wrong.)` : `The request the AI was given: "${problem.request}"\nThe AI's code (${problem.filename}):\n${numbered(problem.code)}`}

Answer key (never quote it as "the answer key"):
- Correct verdict: ${problem.answer === "ship" ? "SHIP IT (the code is correct)" : "SKIP IT (needs changes)"}
- ${problem.answer === "ship" ? "Why it's correct" : "The real issue"}: ${problem.flaw}

This is their try ${attempt} of ${MAX_TRIES}. Their answer may be typed or spoken (speech-to-text), so be generous with wording, but strict about substance.
Decide:
- verdict: "needs changes", "don't ship", "reject", "has a bug", "skip" mean skip. "looks good", "approve", "merge", "ship" mean ship. Neither: "unclear".
- gave_reason: did they give any reason at all.
- named_flaw: ${problem.answer === "ship" ? "did they say why it's correct (for example, they checked the boundary)?" : "did they identify the real issue above, specifically? Vague answers like 'the math looks off' or 'something's wrong on line 3' without saying what's wrong are false. A different or made-up problem is false."}
- reasoning: none (no real reason, or "I don't know"), partial (on the right track but vague), good (clear and specific).
- follow_up: one short, friendly line asking for what's missing: their verdict if unclear, otherwise their why.
- nudge: if they haven't fully got it, a Socratic nudge that helps them find it themselves WITHOUT revealing the issue, the fix or the answer. ${attempt >= 2 ? "This is their second miss, so be more pointed: tell them which line or which part of the request to look at." : "Point them at something to check, like trying a real input from the request."} One or two short sentences, encouraging, ending with a question.
- reply: your reaction, 2 to 3 short sentences, like a playful senior developer. If they got it (right verdict and the real issue), start in the spirit of "Caught me!" and confirm what they spotted. Otherwise, start in the spirit of "Here's the catch" and explain the real issue concretely with a real example (numbers or inputs). Plain text, \`backticks\` for code, at most one emoji. Don't mention any score.
- pro_version: how a senior reviewer would write this as a one-sentence code review comment.`;
}

export type GradeOutcome =
  | { kind: "ask"; reply: string }
  | { kind: "nudge"; reply: string; tries: number }
  | { kind: "graded"; reply: string; verdict: "ship" | "skip" | null; result: ResultCard };

// Grades one answer. Wrong answers get a nudge instead of the answer, up to MAX_TRIES; after that
// Rev teaches it. `tries` is how many wrong answers they've already given on this problem.
export async function gradeAnswer(args: {
  problem: Problem;
  answer: string;
  askedWhy: boolean;
  hintsUsed: number;
  tries: number;
}): Promise<GradeOutcome> {
  const attempt = args.tries + 1;
  const { data: review } = await generateJson({
    schema: Review,
    system: system(args.problem, attempt),
    contents: [{ role: "user", parts: [{ text: args.answer }] }],
    temperature: 0.3,
  });

  // Missing a verdict or a reason: ask once, then grade whatever they give.
  if ((review.verdict === "unclear" || !review.gave_reason) && !args.askedWhy) {
    return { kind: "ask", reply: review.follow_up || "Bold call. But why? What did you check?" };
  }

  const gotIt =
    review.verdict === args.problem.answer && (args.problem.answer === "ship" || review.named_flaw);
  if (!gotIt && attempt < MAX_TRIES) {
    return { kind: "nudge", reply: review.nudge || args.problem.hint, tries: attempt };
  }

  // Scores out of 10: right call 3, named the issue 4 (2 if it took all three tries),
  // reasoning 2, first try without hints 1. Taught after three misses: reasoning only.
  const breakdown: Breakdown = {
    call: gotIt ? 3 : 0,
    flaw: gotIt && review.named_flaw ? (attempt >= MAX_TRIES ? 2 : 4) : 0,
    reasoning: review.reasoning === "good" ? 2 : review.reasoning === "partial" ? 1 : 0,
    firstTry: gotIt && attempt === 1 && args.hintsUsed === 0 ? 1 : 0,
  };
  const score = breakdown.call + breakdown.flaw + breakdown.reasoning + breakdown.firstTry;
  return {
    kind: "graded",
    reply: review.reply,
    verdict: review.verdict === "unclear" ? null : review.verdict,
    result: {
      correct: gotIt,
      taught: !gotIt,
      tries: attempt,
      answer: args.problem.answer,
      score,
      breakdown,
      proVersion: review.pro_version,
      fix: args.problem.fix,
      rule: args.problem.rule,
    },
  };
}
