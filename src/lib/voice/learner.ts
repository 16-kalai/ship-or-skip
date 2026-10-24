import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProblem, toPublic } from "@/lib/challenges/bank";
import { loadAttempts } from "@/lib/chat/actions";
import { EMPTY_PROFILE, PROFILE_COLUMNS, stageFor } from "@/lib/chat/onboarding";
import type { ChatMessage, Profile } from "@/lib/chat/types";

// Everything a voice call needs to know about where the learner is.
export async function loadLearner(admin: SupabaseClient, userId: string) {
  const [{ data: saved }, attempts, { data: recent }] = await Promise.all([
    admin.from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle<Profile>(),
    loadAttempts(admin, userId),
    admin
      .from("messages")
      .select("id, role, content, meta, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<ChatMessage[]>(),
  ]);
  const profile: Profile = { ...EMPTY_PROFILE, ...saved, stack: saved?.stack ?? [], goals: saved?.goals ?? [] };
  const openProblem = attempts.open ? resolveProblem(attempts.open) : null;
  return {
    profile,
    stage: stageFor(profile, { open: Boolean(attempts.open), count: attempts.count }),
    open: attempts.open,
    count: attempts.count,
    problem: openProblem ? toPublic(openProblem) : null,
    recent: (recent ?? []).reverse(),
  };
}
