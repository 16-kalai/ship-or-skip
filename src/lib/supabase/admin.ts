import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

let adminClient: SupabaseClient | undefined;

// Bypasses row level security. Server code only, for writes the user must not control.
export function createAdminClient() {
  adminClient ??= createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
