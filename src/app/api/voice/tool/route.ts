import { NextResponse, after } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshCoachPlan, shouldRefreshAfterProblem } from "@/lib/coach/coach";
import { prefetchProblem } from "@/lib/challenges/queue";
import { appendMessages, giveHint, gradeOpen, openProblem, problemIntro, progressFor, saveProfile } from "@/lib/chat/actions";
import { hasEssentials, mergeBackground, stageFor } from "@/lib/chat/onboarding";
import { MAX_TRIES } from "@/lib/chat/types";
import type { ChatMessage, Stage } from "@/lib/chat/types";
import { loadLearner } from "@/lib/voice/learner";

const Call = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("update_profile"),
    args: z.object({
      situation: z.enum(["student", "working", "switching", "other"]).optional(),
      title: z.string().max(100).optional(),
      years_experience: z.number().min(0).max(60).optional(),
      stack: z.array(z.string().max(40)).max(10).optional(),
      level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      goals: z.array(z.string().max(120)).max(6).optional(),
      strengths: z.array(z.string().max(120)).max(6).optional(),
      weaknesses: z.array(z.string().max(120)).max(6).optional(),
      summary: z.string().max(400).optional(),
      complete: z.boolean().optional(),
    }),
  }),
  z.object({ name: z.literal("next_problem"), args: z.object({}).passthrough() }),
  z.object({ name: z.literal("give_hint"), args: z.object({}).passthrough() }),
  z.object({
    name: z.literal("submit_answer"),
    args: z.object({ verdict: z.enum(["ship", "skip"]), explanation: z.string().max(2000) }),
  }),
]);

type ToolReply = { result: Record<string, unknown>; messages: ChatMessage[]; stage: Stage };

// Runs one of Rev's voice tools for the signed-in learner. The browser forwards Gemini Live's
// tool calls here; the result goes back to the model, the messages go into the chat thread.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const parsed = Call.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown tool call" }, { status: 400 });

  const admin = createAdminClient();
  const call = parsed.data;
  try {
    const learner = await loadLearner(admin, user.id);
    let reply: ToolReply;

    if (call.name === "update_profile") {
      const { complete, goals, strengths, weaknesses, ...facts } = call.args;
      const next = mergeBackground(learner.profile, facts);
      if (goals?.length) next.goals = goals;
      if (strengths) next.strengths = strengths;
      if (weaknesses) next.weaknesses = weaknesses;
      // Finishing by voice without the focus questions counts as "not sure".
      if (complete) {
        next.strengths ??= [];
        next.weaknesses ??= [];
      }
      if (facts.stack?.length || facts.summary) next.background_done = true;
      if (complete && hasEssentials(next) && !next.onboarded_at) next.onboarded_at = new Date().toISOString();
      await saveProfile(admin, user.id, next);
      reply = {
        result: { saved: true, onboardingComplete: Boolean(next.onboarded_at) },
        messages: [],
        stage: stageFor(next, { open: Boolean(learner.open), count: learner.count }),
      };
    } else if (call.name === "next_problem") {
      if (!learner.profile.onboarded_at) {
        return NextResponse.json({ result: { error: "Finish getting to know them first." }, messages: [], stage: learner.stage });
      }
      const { problem, number } = await openProblem(admin, user.id, learner.profile);
      after(() => prefetchProblem(createAdminClient(), user.id));
      const messages = await appendMessages(admin, user.id, [
        { role: "rev", content: problemIntro(problem, number), meta: { kind: "challenge", problem, number } },
      ]);
      reply = {
        result: { shownOnScreen: true, request: problem.request, filename: problem.filename, code: problem.code },
        messages,
        stage: "challenge",
      };
    } else if (call.name === "give_hint") {
      if (!learner.open) return NextResponse.json({ result: { error: "No problem is open." }, messages: [], stage: learner.stage });
      const hint = await giveHint(admin, learner.open);
      const messages = await appendMessages(admin, user.id, [
        { role: "rev", content: `Here's a nudge: ${hint}`, meta: { kind: "hint" } },
      ]);
      reply = { result: { hint }, messages, stage: "challenge" };
    } else {
      if (!learner.open) return NextResponse.json({ result: { error: "No problem is open." }, messages: [], stage: learner.stage });
      const answer = `${call.args.verdict === "ship" ? "Ship it" : "Skip it"}: ${call.args.explanation}`;
      // The voice model has already asked for their reason, so grade whatever they gave.
      const outcome = await gradeOpen(admin, user.id, learner.open, answer, { askedWhy: true });
      if (outcome.kind === "ask") throw new Error("Grader asked again after askedWhy");
      if (outcome.kind === "nudge") {
        const messages = await appendMessages(admin, user.id, [
          { role: "rev", content: `Not quite. ${outcome.reply}`, meta: { kind: "nudge", tries: outcome.tries, of: MAX_TRIES } },
        ]);
        reply = {
          result: { gotIt: false, triesUsed: outcome.tries, triesLeft: MAX_TRIES - outcome.tries, nudge: outcome.reply },
          messages,
          stage: "challenge",
        };
      } else {
        const { result } = outcome;
        const progress = await progressFor(admin, user.id);
        if (shouldRefreshAfterProblem(progress.attempted)) after(() => refreshCoachPlan(createAdminClient(), user.id));
        const messages = await appendMessages(admin, user.id, [
          { role: "rev", content: "Here's how you did.", meta: { kind: "result", result } },
          { role: "rev", content: "Here's where you stand.", meta: { kind: "progress", progress } },
        ]);
        reply = {
          result: {
            gotIt: result.correct,
            taughtAfterThreeTries: result.taught,
            correctVerdict: result.answer,
            score: result.score,
            outOf: 10,
            theRealIssue: outcome.flaw,
            fix: result.fix,
            ruleToRemember: result.rule,
            suggestedFeedback: outcome.reply,
            totalPoints: progress.points,
            rank: progress.rank,
          },
          messages,
          stage: "result",
        };
      }
    }
    return NextResponse.json(reply);
  } catch (e) {
    console.error("[voice/tool]", call.name, e);
    return NextResponse.json({ result: { error: "Something went wrong on our side." }, messages: [], stage: "challenge" }, { status: 502 });
  }
}
