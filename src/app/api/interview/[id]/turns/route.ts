import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addTurns, loadInterview } from "@/lib/interview/store";

const Turn = z.object({
  role: z.enum(["interviewer", "candidate"]),
  content: z.string().trim().min(1).max(6000),
  question_index: z.number().int().min(0).max(4),
});
const MAX_TURNS = 300;

// Saves one finished turn of the call (from Gemini Live's transcripts) for scoring and replay.
export async function POST(request: Request, ctx: RouteContext<"/api/interview/[id]/turns">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const parsed = Turn.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid turn" }, { status: 400 });
  const admin = createAdminClient();
  const { id } = await ctx.params;
  const interview = await loadInterview(admin, id, user.id);
  if (!interview || interview.status !== "active") return NextResponse.json({ error: "Interview not active." }, { status: 409 });
  const { count } = await admin.from("interview_turns").select("id", { count: "exact", head: true }).eq("interview_id", interview.id);
  if ((count ?? 0) >= MAX_TURNS) return NextResponse.json({ error: "Too many turns" }, { status: 429 });
  try {
    await addTurns(admin, interview, [
      { ...parsed.data, kind: parsed.data.role === "candidate" ? "answer" : "question" },
    ]);
    if (parsed.data.question_index > interview.current_index) {
      await admin.from("interviews").update({ current_index: parsed.data.question_index }).eq("id", interview.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[interview/turns]", e);
    return NextResponse.json({ error: "Couldn't save" }, { status: 500 });
  }
}
