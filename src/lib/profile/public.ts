import { cacheLife, cacheTag } from "next/cache";
import { resolveProblem, type Problem } from "@/lib/challenges/bank";
import { computeRating, ratingMeaning, type RatingInput } from "@/lib/progress/rating";
import type { Summary } from "@/lib/profile/summary";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = {
  user_id: string;
  name: string | null;
  title: string | null;
  situation: string | null;
  level: string | null;
  years_experience: number | null;
  stack: string[];
  points: number;
  solved: number;
  ai_summary: Summary | null;
  shared_at: string | null;
};

// What anyone with the link may see. Built only from shared profiles; never answers, answer
// keys, email or resume. Cached for minutes so a popular link doesn't hit the database each view.
export async function loadPublicProfile(handle: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`public-profile:${handle}`);

  if (!/^[a-z0-9-]{3,40}$/.test(handle)) return null;
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("user_id, name, title, situation, level, years_experience, stack, points, solved, ai_summary, shared_at")
    .eq("share_handle", handle)
    .not("shared_at", "is", null)
    .maybeSingle<Row>();
  if (!p) return null;

  const [{ data: attempts }, { data: interviews }, { count: ahead }, { count: players }] = await Promise.all([
    admin
      .from("attempts")
      .select("problem_id, problem, correct, score, tries, breakdown")
      .eq("user_id", p.user_id)
      .eq("status", "graded")
      .order("graded_at", { ascending: true })
      .returns<(RatingInput & { problem: Problem | null })[]>(),
    admin
      .from("interviews")
      .select("role_title, company, overall, report")
      .eq("user_id", p.user_id)
      .eq("status", "completed")
      .order("overall", { ascending: false })
      .limit(1)
      .returns<{ role_title: string; company: string | null; overall: number | null; report: { verdict?: string } | null }[]>(),
    admin.from("profiles").select("user_id", { count: "exact", head: true }).gt("points", p.points),
    admin.from("profiles").select("user_id", { count: "exact", head: true }).not("onboarded_at", "is", null),
  ]);
  const graded = attempts ?? [];
  const rating = computeRating(graded);
  const best = interviews?.[0];
  return {
    name: p.name ?? "A Ship or Skip learner",
    title: p.title,
    situation: p.situation,
    level: p.level,
    years: p.years_experience,
    stack: p.stack ?? [],
    rating,
    meaning: ratingMeaning(rating),
    points: p.points,
    solved: p.solved,
    attempted: graded.length,
    rank: (ahead ?? 0) + 1,
    players: Math.max(players ?? 1, (ahead ?? 0) + 1),
    history: graded.slice(-12).map((a) => ({ title: resolveProblem(a)?.title ?? "Problem", score: a.score ?? 0 })),
    problems: [...graded]
      .reverse()
      .slice(0, 15)
      .map((a) => {
        const problem = resolveProblem(a);
        return { title: problem?.title ?? "Problem", skill: problem?.skill ?? "", correct: Boolean(a.correct), score: a.score ?? 0, tries: a.tries };
      }),
    interview: best ? { role: best.role_title, company: best.company, overall: best.overall, verdict: best.report?.verdict ?? null } : null,
    summary: p.ai_summary,
    sharedAt: p.shared_at,
  };
}

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof loadPublicProfile>>>;
