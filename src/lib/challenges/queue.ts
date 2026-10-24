import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProblem, type Problem } from "@/lib/challenges/bank";
import { generateProblem, type HistoryItem } from "@/lib/challenges/generate";
import { EMPTY_PROFILE, PROFILE_COLUMNS } from "@/lib/chat/onboarding";
import type { Profile } from "@/lib/chat/types";

// Each learner's next problem is generated ahead of time, so "Next problem" is instant. Every
// generated problem is stored with why it was made, and linked to the attempt that used it.

type Learner = { profile: Profile; history: HistoryItem[]; done: number };

async function learner(admin: SupabaseClient, userId: string): Promise<Learner> {
  const [{ data: saved }, { data: attempts }] = await Promise.all([
    admin.from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle<Profile>(),
    admin
      .from("attempts")
      .select("problem_id, problem, correct, tries")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .returns<{ problem_id: string; problem: Problem | null; correct: boolean | null; tries: number }[]>(),
  ]);
  const profile: Profile = { ...EMPTY_PROFILE, ...saved, stack: saved?.stack ?? [], goals: saved?.goals ?? [] };
  const history = (attempts ?? []).map((a) => {
    const p = resolveProblem(a);
    return { title: p?.title ?? a.problem_id, skill: p?.skill ?? "", correct: a.correct, tries: a.tries };
  });
  return { profile, history, done: history.length };
}

async function generateAndStore(admin: SupabaseClient, userId: string, status: "ready" | "used", l: Learner) {
  const generated = await generateProblem(l);
  if (!generated) return null;
  const { problem, context } = generated;
  const { error } = await admin.from("generated_problems").insert({
    id: problem.id.replace(/^gen:/, ""),
    user_id: userId,
    status,
    level: problem.level,
    skill: problem.skill,
    area: problem.area ?? null,
    kind: problem.kind ?? "code",
    problem,
    context,
    used_at: status === "used" ? new Date().toISOString() : null,
  });
  if (error) {
    console.error("[queue] store", error);
    return null;
  }
  return problem;
}

// Makes sure one generated problem is waiting for this learner. Safe to call often; never throws.
export async function prefetchProblem(admin: SupabaseClient, userId: string) {
  try {
    const { count } = await admin
      .from("generated_problems")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "ready");
    if ((count ?? 0) > 0) return;
    const l = await learner(admin, userId);
    // The first problem is always the hand-written festive discount; generate from the second on.
    await generateAndStore(admin, userId, "ready", { ...l, done: Math.max(1, l.done + 1) });
  } catch (e) {
    console.error("[queue] prefetch", e);
  }
}

// Takes the waiting generated problem, or generates one now. Null means: use the bank.
export async function takeGeneratedProblem(admin: SupabaseClient, userId: string): Promise<Problem | null> {
  const { data: ready } = await admin
    .from("generated_problems")
    .select("id, problem")
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; problem: Problem }>();
  if (ready) {
    // Claim it; only one request can (a double tap won't hand out the same problem twice).
    const { data: claimed } = await admin
      .from("generated_problems")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", ready.id)
      .eq("status", "ready")
      .select("id");
    if (claimed?.length) return ready.problem;
  }
  try {
    return await generateAndStore(admin, userId, "used", await learner(admin, userId));
  } catch (e) {
    console.error("[queue] generate now", e);
    return null;
  }
}
