import {
  Behavior,
  EndSensitivity,
  GoogleGenAI,
  Modality,
  Type,
  type FunctionDeclaration,
} from "@google/genai";
import { BRAND } from "@/lib/brand";
import type { PublicProblem } from "@/lib/challenges/types";
import type { ChatMessage, Profile, Stage } from "@/lib/chat/types";

// Verified in the Truvet project: works with locked short-lived tokens, audio and transcripts.
export const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";
// An upbeat prebuilt voice for a friendly code buddy.
const VOICE = "Puck";

/**
 * Rev's voice tools. The answer key never reaches the voice model: submit_answer is graded on
 * our server, and only the result comes back. update_profile is bookkeeping, so it doesn't
 * block the conversation; the others return what Rev needs to say next, so they do.
 */
export const VOICE_TOOLS: FunctionDeclaration[] = [
  {
    name: "update_profile",
    behavior: Behavior.NON_BLOCKING,
    description: "Save what you've learned about the learner. Call it whenever you learn something new.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        situation: { type: Type.STRING, enum: ["student", "working", "switching", "other"] },
        title: { type: Type.STRING, description: "e.g. Backend developer at a startup" },
        years_experience: { type: Type.NUMBER },
        stack: { type: Type.ARRAY, items: { type: Type.STRING } },
        level: { type: Type.STRING, enum: ["beginner", "intermediate", "advanced"] },
        summary: { type: Type.STRING, description: "One line on their background and projects." },
        goals: { type: Type.ARRAY, items: { type: Type.STRING } },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Areas they feel strong in." },
        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Areas they want to improve." },
        complete: {
          type: Type.BOOLEAN,
          description: "True once you know what they do, their background, their goals, and their strong and weak areas.",
        },
      },
    },
  },
  {
    name: "next_problem",
    description: "Show the learner their next problem (the request and the AI's code) on screen. Returns it.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "give_hint",
    description: "Get a hint for the current problem. Costs the learner one point.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "submit_answer",
    description:
      "Grade the learner's answer to the current problem. Call it once they've given a verdict and their reason.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        verdict: { type: Type.STRING, enum: ["ship", "skip"] },
        explanation: { type: Type.STRING, description: "Their reason, in their own words." },
      },
      required: ["verdict", "explanation"],
    },
  },
];

export function liveInstructions(args: {
  firstName: string | null;
  profile: Profile;
  stage: Stage;
  problem: PublicProblem | null;
  recent: ChatMessage[];
}) {
  const { profile, stage, problem } = args;
  const known = Object.fromEntries(
    Object.entries(profile).filter(
      ([k, v]) => k !== "onboarded_at" && v !== null && !(Array.isArray(v) && v.length === 0),
    ),
  );
  const recent = args.recent
    .slice(-12)
    .map((m) => `${m.role === "rev" ? BRAND.tutor : "Learner"}: ${m.content}`)
    .join("\n");

  return `You are ${BRAND.tutor}, the AI code buddy in ${BRAND.name}. You show developers code an AI wrote; they decide "ship it" (it's right) or "skip it" (needs changes) and say why; then you teach them what they missed. You're talking live, by voice.

How you talk: a warm, playful senior developer. Short turns: one or two sentences, then let them talk. Natural spoken English. Never spell out code symbol by symbol; say "line three" or "total times zero point one".

The learner: ${args.firstName ?? "(name unknown)"}. Known so far: ${JSON.stringify(known)}.
Where things stand: ${STAGE_TEXT[stage]}
${problem ? `Current problem on their screen (${problem.filename}). The request: "${problem.request}"\nThe code:\n${problem.code}\n` : ""}
Recent conversation (typed or spoken):
${recent || "(none yet)"}

The flow:
1. Getting to know them, in this order, one question at a time: what they're doing right now (student, developer, switching into tech, or working professional); then their resume (they can drop the PDF in the chat) or, if they don't have one, what they've built and with which languages; then what they want from this (interviews, reviewing AI code at work, writing better code with AI, curiosity); then where they feel strongest and what they want to get better at (requirements, edge cases, security, performance, reliability, logic). Call update_profile whenever you learn something, and set complete to true once you know all three. Then say "Let's start with a small problem."
2. A problem: call next_problem. It appears on their screen. In one sentence say what was asked, then: "Ship it or skip it? Tell me why."
3. Their answer: if they give a verdict without a reason, ask why, once. Then say a short line like "Okay, let me check" and call submit_answer with their verdict and their reason in their words. Never reveal or hint at the answer yourself.
4. If submit_answer says they haven't got it yet, it gives you a nudge: say it in your own words and let them try again. Don't reveal the answer; after three tries the tool tells you the real issue.
5. When it's graded: react like a friend ("Caught me!" if they got it). Explain the real issue simply with a real example (numbers), say the rule to remember, and tell them their score out of 10. Mention their profile is ready at the top right. Then ask if they want the next one.
6. If they ask for a hint, call give_hint and say it in your own words.

Never make up a score or an answer. If a tool fails, say something went wrong and suggest typing instead.`;
}

const STAGE_TEXT: Record<Stage, string> = {
  situation: "Getting to know them: ask what they're doing right now (step 1).",
  background: "Getting to know them: ask for their resume (they can drop the PDF in the chat) or what they've built (step 1).",
  goal: "Getting to know them: ask what they want from this (step 1).",
  strengths: "Getting to know them: ask where they feel strongest (step 1).",
  weaknesses: "Getting to know them: ask what they want to get better at (step 1).",
  start: "Onboarding is done; offer their first problem (step 2).",
  challenge: "A problem is open and waiting for their answer (step 3).",
  result: "Their last problem was graded; offer the next one (step 2).",
};

const SPEAKER_INSTRUCTIONS = `You are the voice of ${BRAND.tutor}, a friendly AI code buddy. You receive text between [SAY] and [/SAY]. Read it aloud exactly as written, warmly and naturally, like a friendly senior developer talking to a learner. Never add, remove, answer, comment on or summarise anything. Read code naturally: say total * 0.1 as "total times zero point one".`;

// Token for Rev's speaking voice: reads Rev's chat messages aloud, nothing else.
export async function mintSpeakerToken(apiKey: string, model: string) {
  const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
  const now = Date.now();
  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(now + 15 * 60_000).toISOString(),
      newSessionExpireTime: new Date(now + 60_000).toISOString(),
      liveConnectConstraints: {
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SPEAKER_INSTRUCTIONS,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
          contextWindowCompression: { slidingWindow: {} },
        },
      },
    },
  });
  if (!token.name) throw new Error("Gemini returned an auth token without a name");
  return token.name;
}

// A single-use token with the whole call config locked in. The browser connects straight to
// Gemini with it and can't change the instructions, tools or model.
export async function mintLiveToken(apiKey: string, model: string, instructions: string) {
  // Short-lived tokens are served from the v1alpha API surface.
  const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
  const now = Date.now();
  const token = await client.authTokens.create({
    config: {
      uses: 1,
      // A connection lasts about 10 minutes.
      expireTime: new Date(now + 15 * 60_000).toISOString(),
      newSessionExpireTime: new Date(now + 60_000).toISOString(),
      liveConnectConstraints: {
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: instructions,
          tools: [{ functionDeclarations: VOICE_TOOLS }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
          // Patient turn-taking: being cut off mid-thought is worse than a slightly slower reply.
          realtimeInputConfig: {
            automaticActivityDetection: {
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              silenceDurationMs: 1000,
            },
          },
          contextWindowCompression: { slidingWindow: {} },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      },
    },
  });
  if (!token.name) throw new Error("Gemini returned an auth token without a name");
  return token.name;
}
