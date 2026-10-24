import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { mintSpeakerToken } from "@/lib/voice/live";
import { takeVoiceSlot } from "@/lib/voice/limits";

// A single-use Gemini Live token for Rev's speaking voice (reads Rev's messages aloud).
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  try {
    if (!(await takeVoiceSlot(createAdminClient(), user.id, "speak"))) {
      return NextResponse.json({ error: "Rev's voice is resting for a bit." }, { status: 429 });
    }
    const { GEMINI_API_KEY, GEMINI_LIVE_MODEL } = serverEnv();
    const token = await mintSpeakerToken(GEMINI_API_KEY, GEMINI_LIVE_MODEL);
    return NextResponse.json({ token, model: GEMINI_LIVE_MODEL }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[voice/speak-token]", e);
    return NextResponse.json({ error: "Rev's voice is busy." }, { status: 503 });
  }
}
