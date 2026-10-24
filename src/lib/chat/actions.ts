import type { SupabaseClient } from "@supabase/supabase-js";
import { pickProblem, resolveProblem, toPublic, type Problem } from "@/lib/challenges/bank";
import { gradeAnswer } from "@/lib/challenges/grade";
import { takeGeneratedProblem } from "@/lib/challenges/queue";
import type { MessageMeta, Progress, PublicProblem, ResultCard } from "@/lib/challenges/types";
import type { Profile } from "@/lib/chat/types";
import { computeRating } from "@/lib/progress/rating";

// Server-side steps of the learning loop, shared by typed chat (/api/chat) and voice tools
// (/api/voice/tool). Every write goes through the admin client after the caller checked the user.

export type OpenAttempt = {
  id: string;
  problem_id: string;
  problem: Problem | null;
  asked_why: boolean;
  hints_used: number;
  tries: number;
};
type AttemptRow = OpenAttempt & {
  status: "open" | "graded";
  score: number | null;
  correct: boolean | null;
  breakdown: { flaw?: number } | null;
  created_at: string;
};

export async function loadAttempts(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("attempts")
    .select("id, problem_id, problem, status, asked_why, hints_used, tries, score, correct, breakdown, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<AttemptRow[]>();
  if (error) throw error;
  const open = data.find((a) => a.status === "open") ?? null;
  return { open, rows: data, seen: new Set(data.map((a) => a.problem_id)), count: data.length };
}

// Opens the learner's next problem. The database allows one open problem per learner, so a
// second tab or a double tap reuses the one already open.
export async function openProblem(
  admin: SupabaseClient,
  userId: string,
  profile: Profile,
): Promise<{ problem: PublicProblem; number: number }> {
  const { open, seen, count } = await loadAttempts(admin, userId);
  if (open) {
    const existing = resolveProblem(open);
    if (existing) return { problem: toPublic(existing), number: count };
  }
  // The first problem is the hand-written festive discount; after that, Gemini writes each one
  // for this learner. If generation isn't possible, the verified bank is the fallback.
  const problem = (count > 0 ? await takeGeneratedProblem(admin, userId) : null) ?? pickProblem(profile, seen);
  const { error } = await admin.from("attempts").insert({ user_id: userId, problem_id: problem.id, problem });
  if (error && error.code !== "23505") throw error;
  return { problem: toPublic(problem), number: count + 1 };
}

export function problemIntro(problem: PublicProblem, number: number) {
  if (problem.language === "text") {
    return `Problem ${number}, a thinking one. Someone asked an AI: "${problem.request}" Here's its answer. Would you trust it, ship it or skip it? Tell me why.`;
  }
  return number === 1
    ? `Here's your first one. Someone asked an AI: "${problem.request}" Read the code, then tell me: ship it or skip it, and why?`
    : `Problem ${number}. Someone asked an AI: "${problem.request}" Ship it or skip it? Tell me why.`;
}

export async function giveHint(admin: SupabaseClient, open: OpenAttempt) {
  const problem = resolveProblem(open);
  if (!problem) throw new Error(`Unknown problem ${open.problem_id}`);
  await admin.from("attempts").update({ hints_used: open.hints_used + 1 }).eq("id", open.id);
  return problem.hint;
}

export async function markAskedWhy(admin: SupabaseClient, open: OpenAttempt) {
  await admin.from("attempts").update({ asked_why: true }).eq("id", open.id);
}

// Grades the open problem against the server-side answer key. A miss gets a nudge (the problem
// stays open); a hit, or the third miss, closes it and adds the points.
export async function gradeOpen(
  admin: SupabaseClient,
  userId: string,
  open: OpenAttempt,
  answer: string,
  options: { askedWhy: boolean },
): Promise<
  | { kind: "ask"; reply: string }
  | { kind: "nudge"; reply: string; tries: number }
  | { kind: "graded"; reply: string; result: ResultCard; flaw: string }
> {
  const problem = resolveProblem(open);
  if (!problem) throw new Error(`Unknown problem ${open.problem_id}`);
  const outcome = await gradeAnswer({
    problem,
    answer,
    askedWhy: options.askedWhy,
    hintsUsed: open.hints_used,
    tries: open.tries,
  });
  if (outcome.kind === "ask") {
    await markAskedWhy(admin, open);
    return outcome;
  }
  if (outcome.kind === "nudge") {
    await admin.from("attempts").update({ tries: outcome.tries, asked_why: true }).eq("id", open.id);
    return outcome;
  }
  const { result } = outcome;
  // Only the request that closes the attempt adds points, so a double submit can't count twice.
  const { data: closed, error } = await admin
    .from("attempts")
    .update({
      status: "graded",
      tries: result.tries,
      answer,
      verdict: outcome.verdict,
      correct: result.correct,
      score: result.score,
      breakdown: result.breakdown,
      graded_at: new Date().toISOString(),
    })
    .eq("id", open.id)
    .eq("status", "open")
    .select("id");
  if (error) throw error;
  if (closed?.length) {
    const { error: pointsError } = await admin.rpc("add_points", {
      p_user: userId,
      p_points: result.score,
      p_solved: result.correct ? 1 : 0,
    });
    if (pointsError) console.error("[add_points]", pointsError);
  }
  return { kind: "graded", reply: outcome.reply, result, flaw: problem.flaw };
}

// Points, rank and score history for the progress card and the profile.
export async function progressFor(admin: SupabaseClient, userId: string): Promise<Progress> {
  const [{ data: me }, attempts, { count: players }] = await Promise.all([
    admin.from("profiles").select("points, solved").eq("user_id", userId).maybeSingle<{ points: number; solved: number }>(),
    loadAttempts(admin, userId),
    admin.from("profiles").select("user_id", { count: "exact", head: true }).not("onboarded_at", "is", null),
  ]);
  const points = me?.points ?? 0;
  const { count: ahead } = await admin
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .gt("points", points);
  const graded = attempts.rows.filter((a) => a.status === "graded");
  const rating = computeRating(graded);
  return {
    rating: rating.score,
    band: rating.band,
    provisional: rating.provisional,
    points,
    rank: (ahead ?? 0) + 1,
    players: Math.max(players ?? 1, (ahead ?? 0) + 1),
    solved: me?.solved ?? 0,
    attempted: graded.length,
    history: graded.slice(-10).map((a) => ({ title: resolveProblem(a)?.title ?? a.problem_id, score: a.score ?? 0 })),
    firstTime: graded.length === 1,
  };
}

export async function saveProfile(admin: SupabaseClient, userId: string, profile: Profile) {
  // Points and solved are only ever changed by add_points, so they're left out here.
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(profile)) if (key !== "points" && key !== "solved") row[key] = value;
  const { error } = await admin.from("profiles").upsert(row);
  if (error) throw error;
}

// Appends messages to the learner's thread in one statement and returns them as saved.
export async function appendMessages(
  admin: SupabaseClient,
  userId: string,
  messages: Array<{ role: "user" | "rev"; content: string; meta?: MessageMeta }>,
) {
  const { data, error } = await admin
    .from("messages")
    .insert(messages.map((m) => ({ user_id: userId, role: m.role, content: m.content, meta: m.meta ?? {} })))
    .select("id, role, content, meta, created_at");
  if (error) throw error;
  return data;
}
