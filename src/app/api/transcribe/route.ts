import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AiUnavailableError, generateJson } from "@/lib/ai/gemini";
import { takeVoiceSlot } from "@/lib/voice/limits";

// 60 s of 16 kHz mono 16-bit audio is ~1.9 MB.
const MAX_BYTES = 2.2 * 1024 * 1024;
const Transcript = z.object({ text: z.string().max(4000) });

// Push-to-talk: a recorded clip in, the learner's words out (they edit and send them).
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "No audio." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Keep it under a minute." }, { status: 400 });
  const bytes = Buffer.from(await audio.arrayBuffer());
  if (bytes.subarray(0, 4).toString("latin1") !== "RIFF") return NextResponse.json({ error: "Unsupported audio." }, { status: 400 });

  try {
    if (!(await takeVoiceSlot(createAdminClient(), user.id, "transcribe"))) {
      return NextResponse.json({ error: "That's a lot of talking! Type for a bit." }, { status: 429 });
    }
    const { data } = await generateJson({
      schema: Transcript,
      system:
        "Transcribe the speaker's words exactly, in English, as plain text. Keep code terms as spoken (for example 'ship it', 'total times 0.9'). If there's no speech, return an empty string.",
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: bytes.toString("base64") } }] }],
      temperature: 0,
    });
    return NextResponse.json({ text: data.text.trim() });
  } catch (e) {
    console.error("[transcribe]", e);
    const busy = e instanceof AiUnavailableError;
    return NextResponse.json({ error: busy ? "Couldn't hear that right now. Try again or type." : "Couldn't transcribe that." }, { status: 503 });
  }
}
