import { NextResponse, after } from "next/server";
import type { Content, Part } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshCoachPlan, shouldRefreshAfterProblem } from "@/lib/coach/coach";
import { prefetchProblem } from "@/lib/challenges/queue";
import { AiUnavailableError, generateJson } from "@/lib/ai/gemini";
import {
  Background,
  ChatTurn,
  EMPTY_PROFILE,
  GOAL_ASK,
  PROFILE_COLUMNS,
  PROJECTS_ASK,
  RESUME_ASK,
  START_LINE,
  STRENGTHS_ASK,
  WEAKNESSES_ASK,
  areasFromText,
  backgroundSystem,
  chatSystem,
  goalsFromText,
  inferLevel,
  mergeBackground,
  situationFromText,
  situationReaction,
  stageFor,
} from "@/lib/chat/onboarding";
import { AREAS, GOALS, NOT_SURE, NO_RESUME, SITUATIONS } from "@/lib/chat/quick-replies";
import type { MessageMeta } from "@/lib/challenges/types";
import {
  appendMessages,
  giveHint,
  gradeOpen,
  loadAttempts,
  markAskedWhy,
  openProblem,
  problemIntro,
  progressFor,
  saveProfile,
} from "@/lib/chat/actions";
import {
  MAX_PDF_BYTES,
  MAX_TEXT_CHARS,
  MAX_TRIES,
  type ChatAction,
  type ChatMessage,
  type ChatResponse,
  type Profile,
  type Stage,
} from "@/lib/chat/types";

const MESSAGES_PER_HOUR = 80;
const HISTORY_LIMIT = 20;
// "Yes", "ready", "next one"… when Rev offers a problem.
const WANTS_PROBLEM = /^\s*(y(es|eah|ep|up)?|ready|ok(ay)?|sure|go|let'?s go|next|another|bring it|start|hit me|i'?m ready|show me)\b/i;
// A bare verdict with no reason, e.g. "Ship it". Rev asks why without an AI call.
const BARE_VERDICT = /^\s*(ship|skip)( it)?[\s.!]*$/i;

type Reply = { content: string; meta?: MessageMeta };

const AREA_CHOICES = [...AREAS, { label: NOT_SURE, value: "not_sure" }];

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

// One chat turn: the learner's message (text, a tapped choice, or a PDF) in; Rev's replies out.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return error(401, "Sign in to keep chatting.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "That message didn't come through. Try again.");
  }
  const action = (["hint", "next"] as const).find((a) => a === form.get("action")) as ChatAction | undefined;
  const text = String(form.get("text") ?? "").trim();
  const file = form.get("file");
  const pdf = file instanceof File && file.size > 0 ? file : null;

  if (!text && !pdf && !action) return error(400, "Type a message first.");
  if (text.length > MAX_TEXT_CHARS) return error(400, `Keep it under ${MAX_TEXT_CHARS} characters.`);
  let pdfBase64: string | null = null;
  if (pdf) {
    if (pdf.size > MAX_PDF_BYTES) return error(400, "That PDF is over 5 MB. Try a smaller one.");
    const bytes = Buffer.from(await pdf.arrayBuffer());
    // Check the file itself, not just its name or the type the browser claims.
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return error(400, "Only PDF resumes work here.");
    pdfBase64 = bytes.toString("base64");
  }

  const admin = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: recent }, { data: savedProfile }, attempts] = await Promise.all([
    admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", hourAgo),
    admin.from("profiles").select(PROFILE_COLUMNS).eq("user_id", user.id).maybeSingle<Profile>(),
    loadAttempts(admin, user.id),
  ]);
  if ((recent ?? 0) >= MESSAGES_PER_HOUR) {
    return error(429, "You've been busy! Take a short break and come back in a bit.");
  }

  const fullName: string | undefined = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const profile: Profile = {
    ...EMPTY_PROFILE,
    ...savedProfile,
    name: savedProfile?.name ?? fullName ?? null,
    stack: savedProfile?.stack ?? [],
    goals: savedProfile?.goals ?? [],
    strengths: savedProfile?.strengths ?? null,
    weaknesses: savedProfile?.weaknesses ?? null,
  };
  const stage = stageFor(profile, { open: Boolean(attempts.open), count: attempts.count });
  const userContent = text || (pdf ? "Here's my resume." : action === "hint" ? "Give me a hint" : "Start the next problem");

  let replies: Reply[];
  let nextStage: Stage = stage;
  let nextProfile: Profile | null = null;

  try {
    if (stage === "situation") {
      // Step 1: what they're doing. A tapped tile maps directly; typed text is read by Gemini.
      const tapped = situationFromText(text);
      const found: Partial<Background> = tapped ? { situation: tapped } : await readBackground(profile, text, null);
      if (!found.situation) {
        replies = [{ content: "Got it! Which of these fits you best?", meta: { kind: "choices", choices: SITUATIONS, multi: false } }];
      } else {
        nextProfile = mergeBackground(profile, found);
        // A long typed answer may already cover their background too.
        const extra = !tapped && (found.stack?.length ?? 0) > 0;
        if (extra) nextProfile.background_done = true;
        const reaction = found.reaction || situationReaction(found.situation);
        replies = extra
          ? [{ content: `${reaction} ${GOAL_ASK}`, meta: { kind: "choices", choices: GOALS, multi: true } }]
          : [{ content: `${reaction} ${RESUME_ASK}`, meta: { kind: "resume" } }];
        nextStage = extra ? "goal" : "background";
      }
    } else if (stage === "background") {
      // Step 2: resume, or "what have you built".
      if (!pdf && text === NO_RESUME) {
        replies = [{ content: PROJECTS_ASK }];
      } else {
        const found = await readBackground(profile, text, pdfBase64);
        nextProfile = mergeBackground(profile, found);
        nextProfile.background_done = true;
        replies = [{ content: `${found.reaction} ${GOAL_ASK}`, meta: { kind: "choices", choices: GOALS, multi: true } }];
        nextStage = "goal";
      }
    } else if (stage === "goal") {
      // Step 3: goals. Then where they feel strong.
      nextProfile = { ...profile, goals: goalsFromText(text), level: inferLevel(profile) };
      replies = [{ content: STRENGTHS_ASK, meta: { kind: "choices", choices: AREA_CHOICES, multi: true } }];
      nextStage = "strengths";
    } else if (stage === "strengths") {
      // Step 4: strong areas. Then what to improve.
      nextProfile = { ...profile, strengths: areasFromText(text) };
      replies = [{ content: WEAKNESSES_ASK, meta: { kind: "choices", choices: AREA_CHOICES, multi: true } }];
      nextStage = "weaknesses";
    } else if (stage === "weaknesses") {
      // Step 5: areas to improve. Onboarding is done; the first problem is one tap away.
      nextProfile = { ...profile, weaknesses: areasFromText(text) };
      nextProfile.onboarded_at = new Date().toISOString();
      replies = [{ content: START_LINE, meta: { kind: "howto" } }];
      nextStage = "start";
    } else if (stage === "challenge" && attempts.open) {
      const open = attempts.open;
      if (action === "hint") {
        replies = [{ content: `Here's a nudge: ${await giveHint(admin, open)}`, meta: { kind: "hint" } }];
      } else if (action === "next") {
        replies = [{ content: "Finish this one first. Ship it or skip it? Tell me why, or ask for a hint." }];
      } else if (BARE_VERDICT.test(text) && !open.asked_why) {
        replies = [
          {
            content: /ship/i.test(text)
              ? "Bold! 😄 But why would you ship it? Tell me what you checked."
              : "Ooh, skipping it? Why? What's wrong with it?",
          },
        ];
        await markAskedWhy(admin, open);
      } else {
        const outcome = await gradeOpen(admin, user.id, open, text, { askedWhy: open.asked_why });
        if (outcome.kind === "ask") {
          replies = [{ content: outcome.reply }];
        } else if (outcome.kind === "nudge") {
          replies = [
            {
              content: `Not quite. ${outcome.reply}`,
              meta: { kind: "nudge", tries: outcome.tries, of: MAX_TRIES },
            },
          ];
        } else {
          const progress = await progressFor(admin, user.id);
          // The Coach agent updates their plan in the background; the reply doesn't wait for it.
          if (shouldRefreshAfterProblem(progress.attempted)) after(() => refreshCoachPlan(createAdminClient(), user.id));
          after(() => prefetchProblem(createAdminClient(), user.id));
          replies = [
            { content: `${outcome.reply} You scored ${outcome.result.score} out of 10.`, meta: { kind: "result", result: outcome.result } },
            {
              content: progress.firstTime
                ? "Your profile is ready! Tap your avatar at the top right anytime to see it. Want the next one?"
                : "Here's where you stand. Want the next one?",
              meta: { kind: "progress", progress },
            },
          ];
          nextStage = "result";
        }
      }
    } else if (action === "next" || WANTS_PROBLEM.test(text)) {
      // Open the next problem.
      const { problem, number } = await openProblem(admin, user.id, profile);
      after(() => prefetchProblem(createAdminClient(), user.id));
      replies = [{ content: problemIntro(problem, number), meta: { kind: "challenge", problem, number } }];
      nextStage = "challenge";
    } else {
      // Anything else between problems: a short chat.
      const { data: history } = await admin
        .from("messages")
        .select("id, role, content, meta, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT)
        .returns<ChatMessage[]>();
      const { data } = await generateJson({
        schema: ChatTurn,
        system: chatSystem(profile),
        contents: [...toContents(history), { role: "user", parts: [{ text: userContent }] }],
      });
      replies = [{ content: data.reply }];
    }
  } catch (e) {
    console.error("[api/chat]", e);
    return e instanceof AiUnavailableError
      ? error(503, "Rev is swamped right now. Try again in a few seconds.")
      : error(502, "Rev lost the thread for a second. Try sending that again.");
  }

  try {
    if (nextProfile) await saveProfile(admin, user.id, nextProfile);
    // The learner's message and Rev's replies in one statement: never a question without its answer.
    const saved = await appendMessages(admin, user.id, [
      { role: "user", content: userContent, meta: pdf ? { fileName: pdf.name.slice(0, 120) } : {} },
      ...replies.map((r) => ({ role: "rev" as const, content: r.content, meta: r.meta })),
    ]);
    const body: ChatResponse = {
      messages: (saved as ChatMessage[]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      stage: nextStage,
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[api/chat] save", e);
    return error(500, "Couldn't save that. Try again.");
  }
}

// Reads a typed answer or a resume PDF into profile facts and a short reaction.
async function readBackground(profile: Profile, text: string, pdfBase64: string | null) {
  const parts: Part[] = [];
  if (pdfBase64) parts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64 } });
  parts.push({ text: text || "Here's my resume." });
  const { data } = await generateJson({
    schema: Background,
    system: backgroundSystem(profile),
    contents: [{ role: "user", parts }],
    temperature: 0.3,
  });
  return data;
}

// Saved messages as model turns. Cards are summarised, so the model knows what was on screen.
function toContents(history: ChatMessage[] | null): Content[] {
  return (history ?? []).reverse().map((m) => {
    let text = m.content;
    if (m.meta.kind === "challenge") text += `\n[problem shown: ${m.meta.problem.filename}]`;
    return { role: m.role === "rev" ? "model" : "user", parts: [{ text }] };
  });
}
