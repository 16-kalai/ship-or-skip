import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site";

// POST only, so a link or image elsewhere can't sign people out.
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", await siteOrigin()), { status: 303 });
}
