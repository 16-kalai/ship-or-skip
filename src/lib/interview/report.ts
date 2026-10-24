import { z } from "zod";
import { BRAND } from "@/lib/brand";
import { generateJson } from "@/lib/ai/gemini";
import type { Plan } from "@/lib/interview/plan";
import { DIMENSIONS, type Dimension, type Level, type Report } from "@/lib/interview/types";

// Truvet's weights by seniority (each column sums to 100).
const WEIGHTS: Record<Level, Record<Dimension, number>> = {
  fresher: { thinking: 25, judgment: 10, ownership: 5, depth: 10, adaptability: 15, communication: 20, role_knowledge: 15 },
  mid: { thinking: 20, judgment: 15, ownership: 15, depth: 15, adaptability: 10, communication: 10, role_knowledge: 15 },
  senior: { thinking: 15, judgment: 20, ownership: 20, depth: 15, adaptability: 10, communication: 10, role_knowledge: 10 },
};

const DimensionScore = z.object({
  // -1 when there isn't enough evidence; missing evidence never counts as zero.
  score: z.number().min(-1).max(10),
  note: z.string().max(220),
  // The candidate's exact words that best support the score.
  quote: z.string().max(240),
});

const Written = z.object({
  headline: z.string().max(140),
  dimensions: z.object(Object.fromEntries(DIMENSIONS.map((d) => [d, DimensionScore])) as Record<Dimension, typeof DimensionScore>),
  strengths: z.array(z.string().max(160)).max(3),
  improvements: z.array(z.string().max(160)).max(3),
  // One per question, in order. score -1 if the call never reached it.
  questions: z.array(
    z.object({ score: z.number().min(-1).max(10), feedback: z.string().max(320), better_answer: z.string().max(600) }),
  ),
  next_steps: z.array(z.string().max(160)).max(3),
});

// What was said during each question on the call, from Gemini Live's transcripts.
export type QuestionTranscript = { interviewer: string[]; candidate: string[] };

function normalise(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// The practice report: dimension scores with evidence, an overall score out of 10, per-question
// coaching and next steps. The AI recommends; the candidate (and any human) decides.
export async function writeReport(args: {
  roleTitle: string;
  level: Level;
  plan: Plan;
  transcript: QuestionTranscript[];
}): Promise<Report> {
  const asked = args.plan.questions.map((q, i) => ({
    section: q.section,
    question: q.question,
    rubric: q.rubric,
    interviewer_said: args.transcript[i]?.interviewer ?? [],
    candidate_said: args.transcript[i]?.candidate ?? [],
  }));
  const { data } = await generateJson({
    schema: Written,
    system: `You are ${BRAND.tutor}, scoring a PRACTICE voice interview for a ${args.roleTitle} role (${args.level}) from its transcript, and writing honest, encouraging feedback. The transcript is speech-to-text: ignore filler and transcription slips; judge substance, never English style or accent. Second person ("you"). Base everything on what they actually said.

- questions: exactly one entry per question below, in order. score 0-10 against that question's rubric, counting their follow-up answers too (9-10 specific and complete, 6-8 solid with gaps, 3-5 vague or partly wrong, 0-2 no real answer); -1 if the call never reached it. feedback: 2 sentences (what worked, what was missing). better_answer: a strong answer in 3-4 sentences, first person, as they could say it.
- headline: one specific sentence on how ready they are for this interview.
- dimensions (thinking, judgment, ownership, depth, adaptability, communication, role_knowledge): score 0-10, or -1 if there's no real evidence. note: one sentence why. quote: their EXACT words (a short verbatim phrase) that best supports it, or "".
- strengths, improvements: up to 3 each, specific.
- next_steps: up to 3 concrete things to practise before the real interview.`,
    contents: [{ role: "user", parts: [{ text: JSON.stringify({ role_summary: args.plan.role_summary, candidate: args.plan.resume_summary, questions: asked }) }] }],
    temperature: 0.3,
  });
  const answersByQuestion = asked.map((q) => q.candidate_said);

  // Quotes must really be theirs; a quote we can't find in their answers is dropped.
  const said = normalise(answersByQuestion.flat().join(" "));
  const weights = WEIGHTS[args.level];
  let total = 0;
  let weight = 0;
  const dimensions = DIMENSIONS.map((key) => {
    const d = data.dimensions[key];
    const quote = d.quote && said.includes(normalise(d.quote)) ? d.quote : null;
    const score = d.score < 0 ? null : Math.round(d.score);
    if (score !== null) {
      total += score * weights[key];
      weight += weights[key];
    }
    return { key, score, note: d.note, quote };
  });
  // Missing dimensions are left out and their weight redistributed.
  const fromDimensions = weight ? total / weight : 0;
  const reached = asked
    .map((q, i) => ({ q, score: Math.round(data.questions[i]?.score ?? -1) }))
    .filter((x) => x.score >= 0 && x.q.candidate_said.length > 0);
  const fromQuestions = reached.length ? reached.reduce((n, x) => n + x.score, 0) / reached.length : 0;
  // Half how they reasoned overall, half how each answer measured up to its rubric.
  const overall = Math.round(((weight ? fromDimensions : fromQuestions) + fromQuestions) / 2 * 10) / 10;

  return {
    overall,
    verdict: overall >= 7.5 ? "Ready to interview" : overall >= 5.5 ? "Almost there" : "Not yet",
    headline: data.headline,
    dimensions,
    strengths: data.strengths,
    improvements: data.improvements,
    questions: reached.map(({ q, score }) => {
      const i = asked.indexOf(q);
      return {
        section: q.section,
        question: q.question,
        score,
        feedback: data.questions[i]?.feedback ?? "",
        better_answer: data.questions[i]?.better_answer ?? "",
      };
    }),
    next_steps: data.next_steps,
  };
}
