import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProblem, type Problem } from "@/lib/challenges/bank";
import { EMPTY_PROFILE, PROFILE_COLUMNS, areaLabels } from "@/lib/chat/onboarding";
import { GOALS } from "@/lib/chat/quick-replies";
import type { Profile } from "@/lib/chat/types";
import { serverEnv } from "@/lib/env";
import type { Report } from "@/lib/interview/types";
import { computeRating } from "@/lib/progress/rating";
import { runAgent } from "@/lib/coach/agenticorg";

// The Coach agent (Pine Labs AgenticOrg) turns a learner's results into a 7-day prep plan.
// It runs in the background after practice and interviews; Rev writes a plan itself whenever
// the agent isn't configured, fails, runs out of budget, or is still waiting for human review.

export const CoachPlanSchema = z.object({
  headline: z.string().min(1).max(160),
  focus: z.array(z.object({ area: z.string().max(60), why: z.string().max(200) })).max(3),
  days: z.array(z.object({ day: z.number().int().min(1).max(7), title: z.string().max(80), task: z.string().max(240) })).min(3).max(7),
  interview_tip: z.string().max(240),
});
export type CoachPlan = z.infer<typeof CoachPlanSchema>;

export type StoredCoach = {
  plan: CoachPlan | null;
  // agenticorg: written by the Coach agent; rev: our own plan (fallback).
  source: "agenticorg" | "rev";
  // ready, or review (the agent's plan is a draft waiting for a human to approve it in AgenticOrg).
  status: "ready" | "review";
  confidence: number | null;
  runStatus: string | null;
  at: string;
};

type AttemptRow = { problem_id: string; problem: Problem | null; status: string; correct: boolean | null; score: number | null; tries: number; breakdown: { flaw?: number } | null };

// What the agent sees: results and self-reported focus. No name, email or resume text.
async function learnerSummary(admin: SupabaseClient, userId: string) {
  const [{ data: saved }, { data: attempts }, { data: interview }] = await Promise.all([
    admin.from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle<Profile>(),
    admin
      .from("attempts")
      .select("problem_id, problem, status, correct, score, tries, breakdown")
      .eq("user_id", userId)
      .eq("status", "graded")
      .order("graded_at", { ascending: true })
      .returns<AttemptRow[]>(),
    admin
      .from("interviews")
      .select("role_title, company, overall, report")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ role_title: string; company: string | null; overall: number | null; report: Report | null }>(),
  ]);
  const profile: Profile = { ...EMPTY_PROFILE, ...saved, stack: saved?.stack ?? [], goals: saved?.goals ?? [] };
  const graded = attempts ?? [];
  const rating = computeRating(graded);
  return {
    profile,
    graded,
    interview,
    summary: {
      role: profile.title ?? profile.situation,
      level: profile.level,
      years_experience: profile.years_experience,
      stack: profile.stack,
      goals: profile.goals.map((g) => GOALS.find((x) => x.value === g)?.label ?? g),
      self_reported_strengths: areaLabels(profile.strengths),
      wants_to_improve: areaLabels(profile.weaknesses),
      ai_code_judgement: rating.score === null ? null : { score_out_of_10: rating.score, right_calls_pct: rating.rightCalls, named_issue_pct: rating.namedIssue, first_try_pct: rating.firstTry },
      recent_problems: graded.slice(-10).map((a) => {
        const p = resolveProblem(a);
        return { title: p?.title, skill: p?.skill, level: p?.level, got_it: a.correct, score: a.score, tries: a.tries };
      }),
      latest_mock_interview: interview
        ? {
            role: interview.role_title,
            readiness_out_of_10: interview.overall,
            verdict: interview.report?.verdict,
            improvements: interview.report?.improvements,
            weakest_skills: interview.report?.dimensions.filter((d) => d.score !== null && d.score < 6).map((d) => d.key),
          }
        : null,
    },
  };
}

// The full brief for the Coach agent. Rich, explicit context (what every field means, how to
// handle missing data, the exact output) lets the agent answer with high confidence, so its
// plans clear the 88% floor instead of being held for review.
export function coachTask(summary: object) {
  return `ROLE
You are the Learning Coach for Ship or Skip, an app that trains developers to judge AI-written code. Learners read code (or an AI's reasoning) written for a short request and decide "ship it" (correct) or "skip it" (has a real issue), then explain why. They also take voice mock interviews built from a real job description and their resume.

OBJECTIVE
Write this learner's 7-day prep plan. It must be specific to the data below, realistic (15-30 minutes a day, done inside the app), and move them towards their goals.

DATA DICTIONARY (fields in LEARNER DATA)
- role, level (beginner/intermediate/advanced), years_experience, stack: who they are.
- goals: why they're here (e.g. "Crack coding interviews").
- self_reported_strengths / wants_to_improve: areas they picked themselves. Areas are: "Reading what was really asked", "Edge cases and boundaries", "Security and access control", "Performance and caching", "Reliability and failures", "Logic and estimation". Empty means "not sure".
- ai_code_judgement: their score out of 10 from recent reviews (null = no reviews yet). right_calls_pct = how often they made the correct ship/skip call; named_issue_pct = how often they named the actual issue; first_try_pct = how often they got it on the first try.
- recent_problems: their last reviews, oldest first. got_it=false means they missed it even after nudges; tries = 1 to 3 (more tries = needed nudges); score is out of 10.
- latest_mock_interview: null if they haven't done one. readiness_out_of_10, verdict ("Ready to interview" / "Almost there" / "Not yet"), improvements, and weakest_skills (thinking, judgment, ownership, depth, adaptability, communication, role_knowledge).

HOW TO PLAN
1. Find the evidence: missed skills (got_it=false or tries=3), a gap between right_calls_pct and named_issue_pct (they guess right but can't say why), weak interview skills, and what they want to improve.
2. Pick at most 3 focus areas, most important first, each backed by one concrete piece of evidence from the data (quote the problem title or the number).
3. Days 1-7: build up. Early days practise the top focus area with problems; mid-week a logic or estimation day; at least one mock interview day (two if their goal is interviews or their verdict is "Not yet"/"Almost there"); end the week by re-testing the weakest area.
4. If data is thin (no reviews, or no interview), say so in the headline and plan a sensible start: fundamentals first, then a first mock interview. Do not invent results.
5. interview_tip: one concrete, specific tip drawn from their interview improvements, or from their weakest area if they haven't interviewed.

LEARNER DATA (JSON)
${JSON.stringify(summary)}

OUTPUT
Reply with ONLY a JSON object (no markdown, no code fences, no extra text) in exactly this shape:
{"confidence": a number from 0 to 1: how well grounded this plan is in the data (0.9+ when every focus area and day follows from the evidence above, including when you correctly planned a sensible start for thin data),
 "headline": "one sentence: where they are and what this week is for",
 "focus": [{"area": "short area name", "why": "one sentence of evidence from the data"}],
 "days": [{"day": 1, "title": "2-5 words", "task": "one sentence, doable in the app in 15-30 minutes"}, ... exactly 7 days],
 "interview_tip": "one specific sentence"}

Example of the expected style (for a different learner):
{"headline": "You catch bugs but can't always say why; this week turns instinct into clear reasoning.", "focus": [{"area": "Naming the issue", "why": "You made 80% right calls but named the issue only 40% of the time."}], "days": [{"day": 1, "title": "Say the why", "task": "Solve 2 problems and, before submitting, write one sentence naming the exact line and why it breaks."}], "interview_tip": "Lead every answer with the decision, then the reason, then one example from your own project."}

SELF-CHECK BEFORE ANSWERING
- Every focus "why" cites real data from LEARNER DATA.
- Exactly 7 days, each doable in the app.
- "confidence" reflects how well the plan follows from the data.
- Valid JSON only.`;
}

// Agents sometimes run a little long; trim text and extra days rather than throw the plan away.
function normalise(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const cut = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : v);
  return {
    headline: cut(r.headline, 160),
    focus: Array.isArray(r.focus)
      ? r.focus.slice(0, 3).map((f: Record<string, unknown>) => ({ area: cut(f?.area, 60), why: cut(f?.why, 200) }))
      : [],
    days: Array.isArray(r.days)
      ? r.days.slice(0, 7).map((d: Record<string, unknown>, i: number) => ({ day: Number(d?.day) || i + 1, title: cut(d?.title, 80), task: cut(d?.task, 240) }))
      : r.days,
    interview_tip: cut(r.interview_tip, 240),
  };
}

// Pulls the plan out of whatever shape the agent returned (an object, or text with JSON in it).
export function parsePlan(output: unknown): CoachPlan | null {
  const candidates: unknown[] = [output];
  if (output && typeof output === "object") candidates.push(...Object.values(output as Record<string, unknown>));
  for (const c of candidates) {
    const direct = CoachPlanSchema.safeParse(normalise(c));
    if (direct.success) return direct.data;
    if (typeof c === "string") {
      const match = c.match(/\{[\s\S]*\}/);
      if (!match) continue;
      try {
        const parsed = CoachPlanSchema.safeParse(normalise(JSON.parse(match[0])));
        if (parsed.success) return parsed.data;
      } catch {}
    }
  }
  return null;
}

const AREA_FOR_SKILL: Record<string, string> = {
  "Checking AI does what was asked": "Reading what was really asked",
  "Edge cases": "Edge cases and boundaries",
  "Off-by-one at the boundaries": "Edge cases and boundaries",
  "Missing input checks": "Security and access control",
  "Access control": "Security and access control",
  "Cache safety": "Performance and caching",
  "Safe retries": "Reliability and failures",
  "Logical reasoning": "Logic and estimation",
  "Analytical reasoning": "Logic and estimation",
};

// Rev's own plan: from missed skills and what they want to improve.
function fallbackPlan(summary: Awaited<ReturnType<typeof learnerSummary>>): CoachPlan {
  const missed = summary.graded.filter((a) => !a.correct).map((a) => AREA_FOR_SKILL[resolveProblem(a)?.skill ?? ""]).filter(Boolean);
  const wanted = areaLabels(summary.profile.weaknesses);
  const areas = [...new Set([...missed, ...wanted])].slice(0, 3);
  const first = areas[0] ?? "Reading what was really asked";
  const second = areas[1] ?? "Edge cases and boundaries";
  const report = summary.interview?.report;
  return {
    headline: summary.graded.length
      ? `You've done ${summary.graded.length} review${summary.graded.length === 1 ? "" : "s"}. This week: sharpen ${first.toLowerCase()}, then prove it in a mock interview.`
      : "This week: build the habit of checking AI code against the request, then test yourself in a mock interview.",
    focus: areas.map((area) => ({
      area,
      why: missed.includes(area) ? "You missed problems in this area." : "You said you want to get better at this.",
    })),
    days: [
      { day: 1, title: "Warm up", task: "Solve 2 problems. Before each answer, run the code in your head with one real input." },
      { day: 2, title: first, task: `Solve 2 problems and, for each, say out loud how ${first.toLowerCase()} could break.` },
      { day: 3, title: second, task: `Solve 2 problems focusing on ${second.toLowerCase()}. Write the rule you learn.` },
      { day: 4, title: "Thinking day", task: "Do a logic or estimation problem. Check the AI's units and every condition." },
      { day: 5, title: "Mock interview", task: "Take a mock interview with the JD you're targeting. Answer with why and an example." },
      { day: 6, title: "Fix the gaps", task: report?.improvements?.[0] ?? "Redo the problems you missed and explain each fix in one sentence." },
      { day: 7, title: "Prove it", task: "Take a second mock interview and compare your readiness score." },
    ],
    interview_tip: report?.next_steps?.[0] ?? "For every answer, give the why and one concrete example from your own work.",
  };
}

// Writes a fresh plan for the learner and stores it on their profile. Never throws.
export async function refreshCoachPlan(admin: SupabaseClient, userId: string) {
  try {
    const summary = await learnerSummary(admin, userId);
    const { AGENTICORG_COACH_AGENT_ID: agentId } = serverEnv();
    let stored: StoredCoach = {
      plan: fallbackPlan(summary),
      source: "rev",
      status: "ready",
      confidence: null,
      runStatus: null,
      at: new Date().toISOString(),
    };
    if (agentId) {
      try {
        const run = await runAgent(agentId, coachTask(summary.summary));
        if (run) {
          stored.runStatus = run.status;
          stored.confidence = run.confidence;
          // Held for human review (confidence under the agent's floor): the learner still sees the
          // agent's plan, clearly marked as a draft awaiting review in AgenticOrg.
          const usable = run.status === "completed" || run.status === "hitl_triggered";
          const plan = usable ? parsePlan(run.output) : null;
          if (plan) stored = { ...stored, plan, source: "agenticorg" };
          if (run.status === "hitl_triggered") stored.status = "review";
        }
      } catch (e) {
        console.error("[coach] agent", e);
        stored.runStatus = "error";
      }
    }
    await admin.from("profiles").update({ coach_plan: stored, coach_at: stored.at }).eq("user_id", userId);
  } catch (e) {
    console.error("[coach]", e);
  }
}

// Light on AgenticOrg's shared rate limit: after the 1st graded problem, every 3rd after that,
// and after every mock interview.
export function shouldRefreshAfterProblem(gradedCount: number) {
  return gradedCount === 1 || gradedCount % 3 === 0;
}
