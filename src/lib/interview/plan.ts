import type { Part } from "@google/genai";
import { z } from "zod";
import { BRAND } from "@/lib/brand";
import { generateJson } from "@/lib/ai/gemini";
import { pickProblem, toPublic } from "@/lib/challenges/bank";
import type { PublicProblem } from "@/lib/challenges/types";
import type { Level, Section } from "@/lib/interview/types";

const Question = z.object({
  // A short headline for the on-screen card, e.g. "Rate-limiting payments in a flash sale".
  title: z.string().min(3).max(70),
  question: z.string().min(10).max(500),
  // What a strong answer covers. Used for grading; never shown during the interview.
  rubric: z.array(z.string().max(200)).min(2).max(5),
});

const JdPlan = z.object({
  candidate_name: z.string().max(60).optional(),
  // What the candidate brings, from their resume (or background), in two or three sentences.
  resume_summary: z.string().max(500),
  // The resume claim the "your work" question drills into, shown on screen.
  resume_hook: z.string().max(200),
  role_title: z.string().min(2).max(80),
  company: z.string().max(80).optional(),
  level: z.enum(["fresher", "mid", "senior"]),
  role_summary: z.string().max(240),
  skills: z.array(z.string().max(40)).max(8),
  stack: z.array(z.string().max(30)).max(8),
  warm_up: Question,
  ownership: Question,
  approach: Question,
  twist: Question,
});

export type PlannedQuestion = {
  section: Section;
  title: string;
  question: string;
  // Shown on the canvas with the question (the resume claim for "your work").
  context?: string;
  rubric: string[];
  card?: { problem: PublicProblem; answer: "ship" | "skip"; flaw: string };
};

export type Plan = {
  candidate_name: string | null;
  resume_summary: string;
  role_summary: string;
  skills: string[];
  stack: string[];
  questions: PlannedQuestion[];
};

const SYSTEM = `You design a short PRACTICE voice interview from a job description and the candidate's resume, for ${BRAND.name}. The principle: test decisions about the work, not the work itself. Candidates think and talk; no live coding.

Read the JD and the resume (or the background they shared) and return:
- candidate_name if the resume shows it; resume_summary: what they bring, 2-3 sentences.
- resume_hook: the one resume claim most relevant to this role that the "ownership" question drills into (e.g. "Built the checkout service handling 5k orders a day at Acme").
- role_title (e.g. "Backend Engineer"), company if named, level: fresher (0-1 yrs / campus), mid (2-5), senior (6+ or lead).
- role_summary: one line on what the role does.
- skills: the main skills the JD asks for. stack: languages and frameworks named in it.
- Four questions, each specific to THIS role and stack, natural and spoken (one or two sentences, no lists):
  - warm_up: an easy opener, e.g. what they're working on now and how it relates to this role.
  - ownership: about the resume_hook project, asking what THEY decided, what broke or what they'd change (not "tell me about yourself"). If there's no resume, ask about a project relevant to the JD.
  - approach: a realistic scenario from this role's day-to-day ("How would you approach…"), with a concrete detail.
  - twist: the SAME scenario with one constraint changed (100x traffic, half the time, a region down, a non-technical user), asking what changes. It must reference the approach scenario.
- title for each: a short on-screen headline (max ~8 words).
- rubric for each: 3-5 short points a strong answer covers (specific, observable).
Fresher roles: simpler scenarios and college projects. Senior: scope, trade-offs, people.
Never invent company facts that aren't in the JD.`;

const LEVEL_TO_PROBLEM = { fresher: "beginner", mid: "intermediate", senior: "advanced" } as const;

// Turns a JD and resume into the interview: four questions from Gemini tailored to both, plus a
// "merge this?" code review taken from our verified problem bank in the JD's stack.
export async function buildPlan(
  jd: string,
  resume: { pdfBase64?: string; text?: string },
  focus: { strengths: string[]; weaknesses: string[] } = { strengths: [], weaknesses: [] },
) {
  const parts: Part[] = [{ text: `JOB DESCRIPTION:\n${jd}` }];
  if (focus.strengths.length || focus.weaknesses.length) {
    parts.push({
      text: `SELF-REPORTED FOCUS:\nStrong at: ${focus.strengths.join(", ") || "not sure"}\nWants to improve: ${focus.weaknesses.join(", ") || "not sure"}\nUse this: the ownership question should check a claimed strength where it fits the role, and the approach or twist should probe one area they want to improve that matters for this role.`,
    });
  }
  if (resume.pdfBase64) {
    parts.push({ text: "CANDIDATE RESUME (attached PDF):" });
    parts.push({ inlineData: { mimeType: "application/pdf", data: resume.pdfBase64 } });
  } else {
    parts.push({ text: `CANDIDATE BACKGROUND (no resume):\n${resume.text || "Not shared."}` });
  }
  const { data } = await generateJson({ schema: JdPlan, system: SYSTEM, contents: [{ role: "user", parts }], temperature: 0.5 });
  const problem = pickProblem(
    { level: LEVEL_TO_PROBLEM[data.level], stack: [...data.stack, ...data.skills] },
    new Set(),
    { level: LEVEL_TO_PROBLEM[data.level] },
  );
  const merge: PlannedQuestion = {
    section: "merge_this",
    title: "An AI agent's pull request",
    question: `Here's a pull request an AI agent opened for your team. The request was: "${problem.request}" Would you merge it? Walk me through how you'd review it.`,
    rubric: [
      `Correct call: ${problem.answer === "ship" ? "merge it (the code is correct)" : "don't merge it as is"}`,
      problem.answer === "ship" ? `Explains why it's correct: ${problem.flaw}` : `Finds the real issue: ${problem.flaw}`,
      "Checks the code against the request with a concrete example or edge case",
      "Says what they'd ask the author or test before merging",
    ],
    card: { problem: toPublic(problem), answer: problem.answer, flaw: problem.flaw },
  };
  const plan: Plan = {
    candidate_name: data.candidate_name ?? null,
    resume_summary: data.resume_summary,
    role_summary: data.role_summary,
    skills: data.skills,
    stack: data.stack,
    questions: [
      { section: "warm_up", ...data.warm_up },
      { section: "ownership", ...data.ownership, context: data.resume_hook },
      merge,
      { section: "approach", ...data.approach },
      { section: "twist", ...data.twist },
    ],
  };
  return { roleTitle: data.role_title, company: data.company ?? null, level: data.level as Level, plan };
}

// What the candidate's screen shows for each question. No rubrics or answer keys.
export function canvasFor(plan: Plan) {
  return plan.questions.map((q) => ({
    section: q.section,
    title: q.title,
    question: q.question,
    context: q.context ?? null,
    problem: q.card?.problem ?? null,
  }));
}
