import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProblem, type Problem } from "@/lib/challenges/bank";
import { computeRating, type RatingInput } from "@/lib/progress/rating";

type AttemptRow = RatingInput & { problem: Problem | null; user_id: string; status: "open" | "graded"; created_at: string };
type InterviewRow = { id: string; user_id: string; role_title: string; company: string | null; status: string; overall: number | null; created_at: string };
type ProfileRow = { user_id: string; name: string | null; title: string | null; situation: string | null; stack: string[]; points: number; solved: number; onboarded_at: string | null };

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  joined: string;
  lastSeen: string | null;
  onboarded: boolean;
  title: string | null;
  points: number;
  rank: number;
  attempted: number;
  solved: number;
  rating: number | null;
  provisional: boolean;
  interviews: number;
  bestInterview: number | null;
};

// Everything the admin page shows, read with the service role. Sized for an event (thousands of
// users); beyond that these aggregates belong in SQL views.
export async function loadAdminStats(admin: SupabaseClient) {
  const [{ data: authData }, { data: profiles }, { data: attempts }, { data: interviews }, { count: generated }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("user_id, name, title, situation, stack, points, solved, onboarded_at").returns<ProfileRow[]>(),
    admin
      .from("attempts")
      .select("user_id, problem_id, problem, status, score, correct, tries, breakdown, created_at")
      .order("created_at", { ascending: true })
      .limit(50000)
      .returns<AttemptRow[]>(),
    admin
      .from("interviews")
      .select("id, user_id, role_title, company, status, overall, created_at")
      .order("created_at", { ascending: false })
      .limit(5000)
      .returns<InterviewRow[]>(),
    admin.from("generated_problems").select("id", { count: "exact", head: true }),
  ]);

  const authUsers = authData?.users ?? [];
  const profileBy = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const attemptsBy = new Map<string, AttemptRow[]>();
  for (const a of attempts ?? []) attemptsBy.set(a.user_id, [...(attemptsBy.get(a.user_id) ?? []), a]);
  const interviewsBy = new Map<string, InterviewRow[]>();
  for (const i of interviews ?? []) interviewsBy.set(i.user_id, [...(interviewsBy.get(i.user_id) ?? []), i]);

  const users: AdminUser[] = authUsers.map((u) => {
    const p = profileBy.get(u.id);
    const mine = attemptsBy.get(u.id) ?? [];
    const graded = mine.filter((a) => a.status === "graded");
    const myInterviews = (interviewsBy.get(u.id) ?? []).filter((i) => i.status === "completed");
    const rating = computeRating(graded);
    const lastActivity = [u.last_sign_in_at, mine.at(-1)?.created_at, interviewsBy.get(u.id)?.[0]?.created_at]
      .filter(Boolean)
      .sort()
      .at(-1) as string | undefined;
    return {
      id: u.id,
      name: p?.name ?? (u.user_metadata?.full_name as string | undefined) ?? u.email?.split("@")[0] ?? "Unknown",
      email: u.email ?? "",
      joined: u.created_at,
      lastSeen: lastActivity ?? null,
      onboarded: Boolean(p?.onboarded_at),
      title: p?.title ?? p?.situation ?? null,
      points: p?.points ?? 0,
      rank: 0,
      attempted: graded.length,
      solved: graded.filter((a) => a.correct).length,
      rating: rating.score,
      provisional: rating.provisional,
      interviews: myInterviews.length,
      bestInterview: myInterviews.length ? Math.max(...myInterviews.map((i) => Number(i.overall ?? 0))) : null,
    };
  });
  // Rank by points; ties share a rank.
  for (const u of users) u.rank = 1 + users.filter((o) => o.points > u.points).length;
  users.sort((a, b) => a.rank - b.rank || (b.rating ?? -1) - (a.rating ?? -1));

  const graded = (attempts ?? []).filter((a) => a.status === "graded");
  const completedInterviews = (interviews ?? []).filter((i) => i.status === "completed");
  const today = new Date().toISOString().slice(0, 10);

  const byProblem = new Map<string, { attempts: number; solved: number; total: number; title: string; level: string }>();
  for (const a of graded) {
    const p = resolveProblem(a);
    const s = byProblem.get(a.problem_id) ?? { attempts: 0, solved: 0, total: 0, title: p?.title ?? a.problem_id, level: p?.level ?? "—" };
    s.attempts++;
    if (a.correct) s.solved++;
    s.total += a.score ?? 0;
    byProblem.set(a.problem_id, s);
  }

  return {
    totals: {
      users: users.length,
      onboarded: users.filter((u) => u.onboarded).length,
      activeToday: users.filter((u) => u.lastSeen?.slice(0, 10) === today).length,
      problemsAttempted: graded.length,
      problemsGenerated: generated ?? 0,
      problemsSolved: graded.filter((a) => a.correct).length,
      avgScore: graded.length ? graded.reduce((n, a) => n + (a.score ?? 0), 0) / graded.length : null,
      interviewsStarted: (interviews ?? []).filter((i) => i.status !== "abandoned").length,
      interviewsCompleted: completedInterviews.length,
      avgReadiness: completedInterviews.length
        ? completedInterviews.reduce((n, i) => n + Number(i.overall ?? 0), 0) / completedInterviews.length
        : null,
    },
    users,
    problems: [...byProblem.entries()]
      .map(([id, s]) => ({
        id,
        title: s.title,
        level: s.level,
        attempts: s.attempts,
        solveRate: Math.round((s.solved / s.attempts) * 100),
        avgScore: s.total / s.attempts,
      }))
      .sort((a, b) => b.attempts - a.attempts),
    recentInterviews: completedInterviews.slice(0, 15).map((i) => ({
      ...i,
      who: users.find((u) => u.id === i.user_id)?.name ?? "Unknown",
    })),
  };
}
