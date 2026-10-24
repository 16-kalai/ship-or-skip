import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BRAND } from "@/lib/brand";
import { generateJson } from "@/lib/ai/gemini";
import { resolveProblem, type Problem } from "@/lib/challenges/bank";
import { compact } from "@/lib/chat/onboarding";
import type { Profile } from "@/lib/chat/types";

export const Summary = z.object({
  headline: z.string().max(120),
  judgement: z.string().max(500),
  strengths: z.array(z.string().max(120)).max(3),
  gaps: z.array(z.string().max(120)).max(3),
  next_step: z.string().max(200),
});
export type Summary = z.infer<typeof Summary>;

export type GradedAttempt = {
  problem_id: string;
  problem?: Problem | null;
  correct: boolean | null;
  score: number | null;
  tries: number;
  breakdown: { flaw?: number; reasoning?: number } | null;
};

// Rev's read on how well this learner judges AI-written code. Regenerated only when they've
// graded more problems since the last one, so a profile view doesn't call the model every time.
export async function summaryFor(
  admin: SupabaseClient,
  userId: string,
  profile: Profile,
  graded: GradedAttempt[],
  cached: { summary: Summary | null; count: number },
): Promise<Summary | null> {
  if (!graded.length) return null;
  if (cached.summary && cached.count === graded.length) return cached.summary;

  const record = graded.map((a) => {
    const p = resolveProblem(a);
    return {
      problem: p?.title,
      skill: p?.skill,
      correct: a.correct,
      score: a.score,
      tries: a.tries,
      namedTheIssue: (a.breakdown?.flaw ?? 0) > 0,
      reasoning: a.breakdown?.reasoning,
    };
  });
  try {
    const { data } = await generateJson({
      schema: Summary,
      system: `You are ${BRAND.tutor}, writing the profile summary for a learner on ${BRAND.name}, which trains people to judge AI-written code (decide "ship it" or "skip it" and explain why). Be honest, specific and encouraging; base everything on their record, never invent. Second person ("you").
- headline: a short, specific title for where they are, e.g. "Sharp on logic bugs, still trusting the happy path".
- judgement: 2 to 3 sentences on how good they are at judging AI code: what they catch, what slips past, how they reason.
- strengths, gaps: up to 3 short points each. If the record is thin, fewer points.
- next_step: one concrete thing to practise next.`,
      contents: [{ role: "user", parts: [{ text: JSON.stringify({ learner: compact(profile), record }) }] }],
      temperature: 0.4,
    });
    await admin.from("profiles").update({ ai_summary: data, ai_summary_count: graded.length }).eq("user_id", userId);
    return data;
  } catch (e) {
    console.error("[profile/summary]", e);
    return cached.summary;
  }
}
