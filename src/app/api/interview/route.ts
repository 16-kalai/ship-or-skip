import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AiUnavailableError } from "@/lib/ai/gemini";
import { buildPlan } from "@/lib/interview/plan";
import { areaLabels } from "@/lib/chat/onboarding";

const PER_DAY = 10;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

// Starts a practice interview from a JD and the candidate's resume (or their saved background).
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return error(401, "Sign in again.");
  const form = await request.formData().catch(() => null);
  if (!form) return error(400, "That didn't come through. Try again.");

  const jd = String(form.get("jd") ?? "").trim();
  if (jd.length < 80) return error(400, "Paste a bit more of the job description.");
  if (jd.length > 12000) return error(400, "That JD is too long. Paste the main part.");

  const file = form.get("resume");
  let pdfBase64: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF_BYTES) return error(400, "That resume is over 5 MB. Try a smaller PDF.");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return error(400, "Upload your resume as a PDF.");
    pdfBase64 = bytes.toString("base64");
  }

  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count }, { data: profile }] = await Promise.all([
    admin.from("interviews").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", dayAgo),
    admin
      .from("profiles")
      .select("title, years_experience, stack, summary, strengths, weaknesses")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if ((count ?? 0) >= PER_DAY) return error(429, "That's 10 interviews today! Come back tomorrow.");

  // Without a resume, use what they told Rev during onboarding.
  const background = profile
    ? [profile.title, profile.years_experience != null ? `${profile.years_experience} years` : null, profile.stack?.length ? `Stack: ${profile.stack.join(", ")}` : null, profile.summary]
        .filter(Boolean)
        .join(". ")
    : "";

  try {
    const { roleTitle, company, level, plan } = await buildPlan(jd, pdfBase64 ? { pdfBase64 } : { text: background }, {
      strengths: areaLabels(profile?.strengths ?? null),
      weaknesses: areaLabels(profile?.weaknesses ?? null),
    });
    if (!plan.candidate_name) plan.candidate_name = (user.user_metadata?.full_name ?? user.user_metadata?.name)?.split(" ")[0] ?? null;
    // One interview in progress at a time: starting a new one sets the old one aside.
    await admin.from("interviews").update({ status: "abandoned" }).eq("user_id", user.id).eq("status", "active");
    const { data: row, error: insertError } = await admin
      .from("interviews")
      .insert({ user_id: user.id, role_title: roleTitle, company, level, jd, plan })
      .select("id")
      .single<{ id: string }>();
    if (insertError) throw insertError;
    return NextResponse.json({ id: row.id });
  } catch (e) {
    console.error("[interview/create]", e);
    const busy = e instanceof AiUnavailableError;
    return error(busy ? 503 : 502, busy ? "Rev is swamped right now. Try again in a few seconds." : "Couldn't prepare that interview. Try again.");
  }
}
