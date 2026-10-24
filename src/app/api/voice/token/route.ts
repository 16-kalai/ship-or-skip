import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { liveInstructions, mintLiveToken } from "@/lib/voice/live";
import { loadLearner } from "@/lib/voice/learner";
import { takeVoiceSlot } from "@/lib/voice/limits";

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

// A single-use Gemini Live token for one voice session with Rev, with the instructions, tools
// and model locked in by the server. The API key never reaches the browser.
export async function POST() {
  const user = await getUser();
  if (!user) return error(401, "Sign in to talk to Rev.");

  const admin = createAdminClient();
  try {
    // Each call runs up to about 10 minutes, so this caps one person near an hour of calls.
    if (!(await takeVoiceSlot(admin, user.id, "call"))) {
      return error(429, "That's a lot of talking! Type for a bit, then try a call again.");
    }
  } catch (e) {
    console.error("[voice/token] limit", e);
    return error(503, "Voice isn't available right now. Type instead.");
  }

  try {
    const learner = await loadLearner(admin, user.id);
    const firstName = (user.user_metadata?.full_name ?? user.user_metadata?.name)?.split(" ")[0] ?? null;
    const { GEMINI_API_KEY, GEMINI_LIVE_MODEL } = serverEnv();
    const token = await mintLiveToken(
      GEMINI_API_KEY,
      GEMINI_LIVE_MODEL,
      liveInstructions({ firstName, ...learner }),
    );
    return NextResponse.json(
      { token, model: GEMINI_LIVE_MODEL },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    console.error("[voice/token]", e);
    return error(503, "Voice is busy right now. Type instead.");
  }
}
