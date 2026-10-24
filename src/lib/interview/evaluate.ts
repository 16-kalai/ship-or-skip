import { z } from "zod";
import { BRAND } from "@/lib/brand";
import { generateJson } from "@/lib/ai/gemini";
import type { PlannedQuestion } from "@/lib/interview/plan";

const Evaluation = z.object({
  score: z.number().min(0).max(10),
  covered: z.array(z.string().max(160)).max(5),
  missed: z.array(z.string().max(160)).max(5),
  needs_follow_up: z.boolean(),
  follow_up: z.string().max(300),
  acknowledgement: z.string().max(160),
});
export type Evaluation = z.infer<typeof Evaluation>;

// Scores one answer (with any follow-up) against the question's private rubric, and decides
// whether a real interviewer would probe once more.
export async function evaluateAnswer(args: {
  roleTitle: string;
  question: PlannedQuestion;
  // The candidate's words for this question so far, oldest first (main answer, then follow-up).
  answers: string[];
  followUpAsked: boolean;
}) {
  const { question } = args;
  const system = `You are ${BRAND.tutor}, a sharp, warm senior colleague running a PRACTICE interview for a ${args.roleTitle} role. Evaluate the candidate's answer to one question. Answers may be typed or spoken (speech-to-text), so ignore filler and transcription slips; judge substance, not English style or accent.

Question: "${question.question}"
${question.card ? `They were shown this code (${question.card.problem.filename}):\n${question.card.problem.code}\n` : ""}
What a strong answer covers (private rubric):
${question.rubric.map((r) => `- ${r}`).join("\n")}

Return:
- score 0-10: 9-10 covers nearly everything with specifics and reasons; 6-8 solid with gaps; 3-5 vague or partly wrong; 0-2 off-topic, "I don't know", or no real answer.
- covered / missed: rubric points they covered and missed (short).
- needs_follow_up: true if a real interviewer would probe: the answer is vague, has no "why", no concrete example, or misses the key point.${args.followUpAsked ? " (A follow-up was already asked: set false.)" : ""}
- follow_up: if needed, ONE short, natural probing question (ask for the why, a specific example, or what they'd check). Never reveal the answer or hint at the rubric.
- acknowledgement: a short, neutral line to move on, like "Thanks, that's clear." or "Got it." Never say good, great, right or wrong.`;
  const { data } = await generateJson({
    schema: Evaluation,
    system,
    contents: [{ role: "user", parts: [{ text: args.answers.map((a, i) => (i ? `Follow-up answer: ${a}` : a)).join("\n\n") }] }],
    temperature: 0.2,
  });
  return { ...data, score: Math.round(data.score) };
}
