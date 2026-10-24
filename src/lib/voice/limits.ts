import type { SupabaseClient } from "@supabase/supabase-js";

// Per-learner hourly limits on voice, counted in the database so they hold across servers.
const PER_HOUR = { call: 6, speak: 40, transcribe: 60 } as const;
export type VoiceKind = keyof typeof PER_HOUR;

// Records one use if the learner is under the limit. Returns false when they're over it.
export async function takeVoiceSlot(admin: SupabaseClient, userId: string, kind: VoiceKind) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("voice_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", hourAgo);
  if (error) throw error;
  if ((count ?? 0) >= PER_HOUR[kind]) return false;
  const { error: insertError } = await admin.from("voice_sessions").insert({ user_id: userId, kind });
  if (insertError) throw insertError;
  return true;
}
