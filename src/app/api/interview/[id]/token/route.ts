import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { mintInterviewToken } from "@/lib/interview/live";
import { loadInterview } from "@/lib/interview/store";
import { takeVoiceSlot } from "@/lib/voice/limits";

// A single-use Gemini Live token for this interview call, with the interviewer locked in.
export async function POST(_request: Request, ctx: RouteContext<"/api/interview/[id]/token">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const admin = createAdminClient();
  const { id } = await ctx.params;
  const interview = await loadInterview(admin, id, user.id);
  if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  if (interview.status !== "active") return NextResponse.json({ error: "This interview has ended." }, { status: 409 });
  try {
    if (!(await takeVoiceSlot(admin, user.id, "call"))) {
      return NextResponse.json({ error: "That's a lot of calls this hour. Try again a bit later." }, { status: 429 });
    }
    const { GEMINI_API_KEY, GEMINI_LIVE_MODEL } = serverEnv();
    const token = await mintInterviewToken(GEMINI_API_KEY, GEMINI_LIVE_MODEL, {
      roleTitle: interview.role_title,
      company: interview.company,
      candidateName: interview.plan.candidate_name ?? null,
      plan: interview.plan,
    });
    return NextResponse.json({ token, model: GEMINI_LIVE_MODEL }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[interview/token]", e);
    return NextResponse.json({ error: "Couldn't start the call. Try again." }, { status: 503 });
  }
}
