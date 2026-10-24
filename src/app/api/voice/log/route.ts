import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendMessages } from "@/lib/chat/actions";

const Turn = z.object({ role: z.enum(["user", "rev"]), content: z.string().trim().min(1).max(4000) });
const TURNS_PER_HOUR = 300;

// Saves one finished spoken turn (from Gemini Live's transcripts) into the learner's thread,
// so voice and typing share one conversation that survives a refresh.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const parsed = Turn.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid turn" }, { status: 400 });

  const admin = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", hourAgo);
  if ((count ?? 0) >= TURNS_PER_HOUR) return NextResponse.json({ error: "Too many messages" }, { status: 429 });

  try {
    const [saved] = await appendMessages(admin, user.id, [{ ...parsed.data, meta: { via: "voice" } }]);
    return NextResponse.json({ message: saved });
  } catch (e) {
    console.error("[voice/log]", e);
    return NextResponse.json({ error: "Couldn't save" }, { status: 500 });
  }
}
