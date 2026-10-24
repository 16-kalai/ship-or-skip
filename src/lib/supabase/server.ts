import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Per-request client that acts as the signed-in user, so row level security applies.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server components can't set cookies; proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}

// Verified against Supabase Auth. Cached per request, so several components can ask for free.
export const getUser = cache(async () => {
  // Marks the caller as request-time before Supabase reads the clock (Date.now) to check the
  // session; with Cache Components on, Next otherwise tries to prerender it and errors.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});
