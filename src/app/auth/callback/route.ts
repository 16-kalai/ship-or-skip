import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { siteOrigin } from "@/lib/site";

// Google sign-in and email confirmation links land here with a one-time code.
// Redirects use the public origin: behind a host's proxy (Render), request.url is the
// container's own address (localhost:10000), which the browser can't reach.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const origin = await siteOrigin();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth/callback]", error.message);
  }

  return NextResponse.redirect(new URL("/signup?error=auth", origin));
}
