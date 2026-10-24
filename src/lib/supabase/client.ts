"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

// One client per tab; it keeps the session in cookies so the server sees the same user.
export function createClient() {
  browserClient ??= createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return browserClient;
}
