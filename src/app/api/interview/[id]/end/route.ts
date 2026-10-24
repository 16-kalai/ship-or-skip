import { NextResponse, after } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshCoachPlan } from "@/lib/coach/coach";
import { writeReport } from "@/lib/interview/report";
import { loadInterview, loadTurns, transcriptByQuestion } from "@/lib/interview/store";

// Ends the call and scores it from the transcript. Too little said to judge: set aside.
export async function POST(_request: Request, ctx: RouteContext<"/api/interview/[id]/end">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const admin = createAdminClient();
  const { id } = await ctx.params;
  const interview = await loadInterview(admin, id, user.id);
  if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  if (interview.status !== "active") return NextResponse.json({ status: interview.status, report: interview.report });

  const turns = await loadTurns(admin, interview.id);
  const spoken = turns.filter((t) => t.role === "candidate").map((t) => t.content).join(" ");
  if (spoken.split(/\s+/).length < 25) {
    // Keep it active so they can call again; there's nothing to score yet.
    return NextResponse.json({ status: "active", report: null, error: "Not enough to score yet. Answer a couple of questions first." });
  }
  try {
    const report = await writeReport({
      roleTitle: interview.role_title,
      level: interview.level,
      plan: interview.plan,
      transcript: transcriptByQuestion(turns, interview.plan.questions.length),
    });
    await admin
      .from("interviews")
      .update({ status: "completed", report, overall: report.overall, completed_at: new Date().toISOString() })
      .eq("id", interview.id)
      .eq("status", "active");
    // After every mock interview, the Coach agent rewrites the prep plan in the background.
    after(() => refreshCoachPlan(createAdminClient(), user.id));
    return NextResponse.json({ status: "completed", report });
  } catch (e) {
    console.error("[interview/end]", e);
    return NextResponse.json({ error: "Couldn't write your report. Try again." }, { status: 502 });
  }
}
