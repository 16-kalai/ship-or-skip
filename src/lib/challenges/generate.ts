import { z } from "zod";
import { BRAND } from "@/lib/brand";
import { generateJson } from "@/lib/ai/gemini";
import { levelsFor, type Problem } from "@/lib/challenges/bank";
import { AREAS } from "@/lib/chat/quick-replies";
import type { Profile } from "@/lib/chat/types";

// Gemini writes each practice problem for the learner: their stack, their difficulty stage,
// their weak areas and recent misses. A second, blind review must reach the same verdict and
// find the same issue, or the problem is thrown away. Nothing unverified reaches a learner.

type Language = "javascript" | "typescript" | "python" | "java" | "tsx" | "sql";

const GenProblem = z.object({
  title: z.string().min(2).max(50),
  skill: z.string().min(2).max(40),
  request: z.string().min(10).max(300),
  filename: z.string().min(2).max(40),
  code: z.string().min(5).max(1400),
  flaw: z.string().min(10).max(400),
  fix_before: z.string().max(200),
  fix_after: z.string().max(200),
  rule: z.string().min(5).max(160),
  hint: z.string().min(5).max(200),
});

const BlindReview = z.object({
  verdict: z.enum(["ship", "skip"]),
  issue: z.string().max(400),
});

const SameIssue = z.object({ same: z.boolean() });

export type HistoryItem = { title: string; skill: string; correct: boolean | null; tries: number };

const LEVEL_GUIDE = {
  beginner: "Beginner: one small function with everyday logic, 4-10 lines. The issue is a fundamental one (a wrong operator, a boundary, a wrong formula, a missing case).",
  intermediate: "Intermediate: an API handler, a query, or a UI component, 8-16 lines. The issue needs a little thought (a missing check from the request, a wrong data type, an effect that never re-runs, pagination).",
  advanced: "Advanced: production-style code, 10-18 lines. The issue is subtle and costly (security or access control, unsafe retries, cache scope, races, data leaks).",
} as const;

// What an issue in each area looks like, so the problem really practises that area.
const AREA_GUIDE: Record<string, string> = {
  requirements: "the code doesn't do what the request says (a wrong formula, the wrong field, a misread requirement)",
  edge_cases: "a boundary or edge case breaks (off-by-one, empty input, zero, negatives, exactly-at-the-limit)",
  security: "a security hole (no ownership or permission check, trusting user input, missing validation, leaking data)",
  performance: "a performance or caching mistake (a query in a loop, no limit on a query, a cache key shared across users)",
  reliability: "a reliability mistake (unsafe retries, no timeout, swallowing errors, double-charging on retry)",
};

function languageFor(stack: string[], index: number): Language {
  const s = stack.join(" ").toLowerCase();
  const fits: Language[] = [];
  if (/react|next|tsx/.test(s)) fits.push("tsx");
  if (/typescript|\bts\b|nest|angular/.test(s)) fits.push("typescript");
  if (/javascript|\bjs\b|node|express|vue/.test(s)) fits.push("javascript");
  if (/python|django|flask|fastapi/.test(s)) fits.push("python");
  if (/java\b|spring|kotlin/.test(s)) fits.push("java");
  if (/sql|postgres|mysql/.test(s)) fits.push("sql");
  const pool: Language[] = fits.length ? fits : ["javascript", "python"];
  return pool[index % pool.length];
}

// What this problem should practise, and why (recorded with the problem for later context).
function chooseTarget(profile: Profile, history: HistoryItem[], done: number) {
  const levels = levelsFor(done);
  const level = levels[done % levels.length];
  const kind: "code" | "logic" = done % 4 === 3 ? "logic" : "code";
  const answer: "ship" | "skip" = done % 4 === 1 ? "ship" : "skip";
  const recentMiss = [...history].reverse().slice(0, 5).find((h) => h.correct === false);
  const weak = profile.weaknesses ?? [];
  const area =
    kind === "logic"
      ? "reasoning"
      : recentMiss && done % 3 === 0
        ? null // revisit the recently missed skill below
        : weak.length
          ? weak[done % weak.length]
          : AREAS[done % AREAS.length].value;
  const areaLabel = area ? AREAS.find((a) => a.value === area)?.label ?? area : null;
  const reason = kind === "logic"
    ? "a thinking problem (every fourth one)"
    : !area && recentMiss
      ? `revisit "${recentMiss.skill}", which they recently missed, in a new scenario`
      : weak.includes(area ?? "")
        ? `they want to improve "${areaLabel}"`
        : `cover "${areaLabel}"`;
  return { level, kind, answer, area: area ?? "requirements", areaLabel, revisitSkill: !area ? recentMiss?.skill : undefined, reason };
}

function generationPrompt(args: {
  profile: Profile;
  target: ReturnType<typeof chooseTarget>;
  language: string;
  avoidTitles: string[];
}) {
  const { profile, target } = args;
  return `You write ONE practice problem for ${BRAND.name}, where a learner reviews something an AI produced for a short request and decides "Ship it" (it's correct) or "Skip it" (it needs changes).

The learner: ${profile.title ?? profile.situation ?? "developer"}, ${profile.level ?? "beginner"} level, stack: ${profile.stack.join(", ") || "general"}. ${profile.summary ?? ""}

Make this problem:
- Difficulty: ${LEVEL_GUIDE[target.level]}
- ${target.kind === "logic"
    ? `Kind: a REASONING problem, NOT code. "request" is a short logic, maths or estimation question (realistic: costs, time zones, rates, units, puzzles). "code" is the AI's 1-3 sentence answer in plain English prose, with no code at all. filename: "AI's answer". ${target.answer === "skip" ? "The AI's answer contains one classic reasoning mistake (wrong units, per-day vs per-month, an intuitive-but-wrong puzzle answer). fix_before is the exact wrong sentence from the answer; fix_after the corrected sentence." : ""}`
    : `Kind: CODE in ${args.language}. Practise: ${target.revisitSkill ? `"${target.revisitSkill}" (they recently missed it; use a new scenario)` : `${target.areaLabel}. ${target.answer === "skip" ? `The ONE issue MUST be ${AREA_GUIDE[target.area] ?? target.areaLabel}.` : "Make the code touch this area and get it right."}`}`}
- The correct verdict MUST be: ${target.answer === "ship" ? "SHIP IT. The answer/code is fully correct for the request, including boundaries and edge cases. flaw explains why it's correct (e.g. the boundary checked). fix_before and fix_after are empty strings." : "SKIP IT. There is exactly ONE real issue that makes it not do what the request says. Not a style nit; everything else correct. flaw explains it concretely with an example input and result. fix_before is the EXACT line (copied character for character) from code that's wrong; fix_after is the corrected line."}

Rules:
- request: one or two sentences, a realistic everyday product requirement or question. Indian context is welcome (₹, UPI, IST, PIN codes). Include the detail that matters (e.g. "at least 8", "above ₹500").
- code: looks like a real AI assistant wrote it. No comments that hint at the issue. No real brand or company names. Lines separated by \\n.
- title: 2-5 words, new. Don't reuse any of these: ${args.avoidTitles.slice(-30).join(" | ") || "none"}.
- skill: a short label (e.g. "Edge cases", "Access control", "Logical reasoning").
- hint: a question that points where to look, never stating the issue.
- rule: one sentence, the habit that would catch this.`;
}

const BRANDS = /\b(amazon|google|flipkart|swiggy|zomato|paytm|uber|ola|netflix|meta|facebook|microsoft|apple)\b/i;

function validate(p: z.infer<typeof GenProblem>, target: ReturnType<typeof chooseTarget>) {
  const lines = p.code.split("\n");
  if (target.kind === "code" && (lines.length < 3 || lines.length > 22)) return "code length";
  if (BRANDS.test(p.code) || BRANDS.test(p.request)) return "brand name";
  if (target.kind === "logic" && (/function|return|=>|[{};]/.test(p.code) || lines.length > 4)) return "logic answer looked like code";
  if (target.answer === "skip") {
    if (!p.fix_before.trim() || !p.fix_after.trim()) return "missing fix";
    if (!p.code.includes(p.fix_before.trim())) return "fix_before not in code";
    if (p.hint.includes(p.fix_after.trim())) return "hint gives the fix away";
  }
  return null;
}

// One problem, written and independently checked. Null if no candidate passes.
export async function generateProblem(args: { profile: Profile; history: HistoryItem[]; done: number }) {
  const target = chooseTarget(args.profile, args.history, args.done);
  const language = target.kind === "logic" ? "text" : languageFor(args.profile.stack, args.done);
  const rejected: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data: draft } = await generateJson({
        schema: GenProblem,
        system: generationPrompt({ profile: args.profile, target, language, avoidTitles: args.history.map((h) => h.title) }),
        contents: [{ role: "user", parts: [{ text: `Write the problem.${rejected.length ? ` A previous draft was rejected (${rejected.at(-1)}); make it clearer.` : ""}` }] }],
        temperature: 0.9,
      });
      const invalid = validate(draft, target);
      if (invalid) {
        rejected.push(invalid);
        continue;
      }

      // A blind review: a fresh look at the request and code, with no answer key.
      const { data: review } = await generateJson({
        schema: BlindReview,
        system: `You are a meticulous senior reviewer. Decide whether the AI's ${target.kind === "logic" ? "answer" : "code"} does EXACTLY what the request asks, including boundaries and edge cases. verdict "ship" if fully correct, "skip" if it has a real bug. If skip, name the single most important issue concretely.`,
        contents: [{ role: "user", parts: [{ text: `Request: ${draft.request}\n\n${target.kind === "logic" ? "AI's answer" : `AI's code (${draft.filename})`}:\n${draft.code}` }] }],
        temperature: 0,
      });
      if (review.verdict !== target.answer) {
        rejected.push(`blind review said ${review.verdict}`);
        continue;
      }
      if (target.answer === "skip") {
        const { data: same } = await generateJson({
          schema: SameIssue,
          system: "Do these two descriptions point to the same root cause in the code? Answer strictly.",
          contents: [{ role: "user", parts: [{ text: `A: ${draft.flaw}\nB: ${review.issue}` }] }],
          temperature: 0,
        });
        if (!same.same) {
          rejected.push("reviewer found a different issue");
          continue;
        }
      }

      const id = `gen:${crypto.randomUUID()}`;
      const problem: Problem = {
        id,
        title: draft.title,
        skill: draft.skill,
        level: target.level,
        kind: target.kind,
        area: target.area,
        matches: [],
        language: language as Problem["language"],
        filename: target.kind === "logic" ? "AI's answer" : draft.filename,
        request: draft.request,
        code: draft.code,
        answer: target.answer,
        flaw: draft.flaw,
        fix: target.answer === "skip" ? { before: draft.fix_before.trim(), after: draft.fix_after.trim() } : null,
        rule: draft.rule,
        hint: draft.hint,
      };
      return {
        problem,
        context: {
          stage: args.done,
          level: target.level,
          kind: target.kind,
          area: target.area,
          reason: target.reason,
          language,
          based_on: { stack: args.profile.stack, weaknesses: args.profile.weaknesses, recent: args.history.slice(-5) },
          review: { verdict: review.verdict, issue: review.issue },
          rejected,
        },
      };
    } catch (e) {
      rejected.push(e instanceof Error ? e.message.slice(0, 80) : "error");
    }
  }
  console.error("[generate] no problem passed review", rejected);
  return null;
}
