import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Orb } from "@/components/orb";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { resolveProblem } from "@/lib/challenges/bank";
import { progressFor } from "@/lib/chat/actions";
import { EMPTY_PROFILE, PROFILE_COLUMNS } from "@/lib/chat/onboarding";
import { GOALS } from "@/lib/chat/quick-replies";
import type { Profile } from "@/lib/chat/types";
import { summaryFor, type GradedAttempt, type Summary } from "@/lib/profile/summary";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { PROVISIONAL_BELOW, computeRating, ratingMeaning } from "@/lib/progress/rating";
import { CoachButton } from "@/components/profile/coach-button";
import type { StoredCoach } from "@/lib/coach/coach";
import { ShareProfile } from "@/components/profile/share-profile";
import { siteOrigin } from "@/lib/site";

const SITUATION_LABEL = {
  student: "Student",
  working: "Developer",
  switching: "Switching into tech",
  other: "Working professional",
} as const;

export default function ProfilePage() {
  return (
    <main className="min-h-dvh bg-background-secondary/60">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
        <Link href="/chat" className="flex items-center gap-2.5 text-[14px] font-medium text-foreground-secondary hover:text-foreground">
          <span aria-hidden="true">←</span> Back to {BRAND.tutor}
        </Link>
        <span className="flex items-center gap-2 font-semibold">
          <Orb size={22} />
          {BRAND.name}
        </span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-[14px] font-medium text-foreground-tertiary hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Orb size={40} speaking />
          </div>
        }
      >
        <ProfileBody />
      </Suspense>
    </main>
  );
}

async function ProfileBody() {
  const user = await getUser();
  if (!user) redirect("/signup?next=/profile");
  const admin = createAdminClient();
  const [{ data: saved }, { data: attemptRows }, progress] = await Promise.all([
    admin
      .from("profiles")
      .select(`${PROFILE_COLUMNS}, ai_summary, ai_summary_count, coach_plan, share_handle, shared_at`)
      .eq("user_id", user.id)
      .maybeSingle<
        Profile & {
          ai_summary: Summary | null;
          ai_summary_count: number;
          coach_plan: StoredCoach | null;
          share_handle: string | null;
          shared_at: string | null;
        }
      >(),
    admin
      .from("attempts")
      .select("problem_id, problem, correct, score, tries, breakdown, graded_at")
      .eq("user_id", user.id)
      .eq("status", "graded")
      .order("graded_at", { ascending: true })
      .returns<(GradedAttempt & { graded_at: string })[]>(),
    progressFor(admin, user.id),
  ]);
  const profile: Profile = { ...EMPTY_PROFILE, ...saved, stack: saved?.stack ?? [], goals: saved?.goals ?? [] };
  const graded = attemptRows ?? [];
  const fullName: string = profile.name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "You";
  const average = graded.length ? graded.reduce((n, a) => n + (a.score ?? 0), 0) / graded.length : null;
  const goalLabels = profile.goals.map((g) => GOALS.find((x) => x.value === g)?.label ?? g);
  const rating = computeRating(graded);

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-4 py-8 sm:px-6">
      {/* Who they are */}
      <section className="flex flex-col gap-5 rounded-3xl border border-border bg-background p-6 sm:flex-row sm:items-center">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-[28px] font-semibold text-white ring-4 ring-background-secondary">
          {fullName.charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{fullName}</h1>
            <p className="text-[15px] text-foreground-tertiary">
              {[profile.title ?? (profile.situation ? SITUATION_LABEL[profile.situation] : null), profile.years_experience !== null ? `${profile.years_experience} yr${profile.years_experience === 1 ? "" : "s"}` : null, profile.level]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {profile.stack.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.stack.map((s) => (
                <span key={s} className="rounded-full border border-border-strong px-2.5 py-0.5 text-[13px] text-foreground-secondary">
                  {s}
                </span>
              ))}
            </div>
          )}
          {goalLabels.length > 0 && (
            <p className="text-[13.5px] text-foreground-tertiary">Here to: {goalLabels.join(" · ")}</p>
          )}
        </div>
        <ShareProfile
          initialUrl={saved?.share_handle && saved?.shared_at ? `${await siteOrigin()}/u/${saved.share_handle}` : null}
          name={fullName}
          score={computeRating(graded).score}
        />
      </section>

      {/* The score a hiring manager reads first */}
      <section className="overflow-hidden rounded-3xl bg-primary text-white">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex flex-col gap-2 sm:w-[42%]">
            <span className="text-[13px] font-medium uppercase tracking-[0.1em] text-white/55">AI Code Judgement</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[64px] font-semibold leading-none tracking-[-0.05em] tabular-nums">
                {rating.score === null ? "–" : rating.score.toFixed(1)}
              </span>
              <span className="text-[22px] text-white/50">/10</span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {rating.band && (
                <span className="rounded-full bg-white px-3 py-1 text-[13.5px] font-semibold text-[#0a0d12]">{rating.band}</span>
              )}
              <span className="text-[13px] text-white/60">
                {rating.basedOn === 0
                  ? "No problems yet"
                  : rating.provisional
                    ? `Provisional · ${rating.basedOn} of ${PROVISIONAL_BELOW} problems needed`
                    : `Based on ${Math.min(rating.basedOn, 10)} recent problems`}
              </span>
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <p className="text-[16px] leading-relaxed text-white/85">{ratingMeaning(rating)}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Evidence label="Right calls" value={`${rating.rightCalls}%`} />
              <Evidence label="Named the issue" value={`${rating.namedIssue}%`} />
              <Evidence label="First try" value={`${rating.firstTry}%`} />
              <Evidence label="Avg tries" value={rating.basedOn ? String(rating.avgTries) : "–"} />
            </div>
          </div>
        </div>
        <p className="border-t border-white/10 px-6 py-3 text-[12.5px] text-white/45 sm:px-8">
          Difficulty-weighted average of the last 10 reviews, graded by {BRAND.tutor} against a fixed answer key. Hints and
          extra tries lower it.
        </p>
      </section>

      <CoachCard coach={saved?.coach_plan ?? null} />

      <Link
        href="/interview"
        className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-background px-6 py-4 transition-colors hover:bg-background-secondary/60"
      >
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">🎯 Practice an interview for a real job</span>
          <span className="text-[13.5px] text-foreground-tertiary">Paste a JD; {BRAND.tutor} interviews you for that role and scores you.</span>
        </span>
        <span className="text-[14px] font-semibold">Start →</span>
      </Link>

      {/* The numbers */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Points" value={String(progress.points)} />
        <StatTile label="Rank" value={`#${progress.rank}`} sub={`of ${progress.players}`} />
        <StatTile label="Solved" value={String(progress.solved)} sub={`of ${progress.attempted}`} />
        <StatTile label="Average" value={average === null ? "–" : average.toFixed(1)} sub="/10" />
      </section>

      {/* Scores over time */}
      <section className="rounded-3xl border border-border bg-background p-6">
        <h2 className="text-[15px] font-semibold">Your scores</h2>
        {graded.length ? (
          <ScoreChart scores={graded.map((a) => ({ title: resolveProblem(a)?.title ?? a.problem_id, score: a.score ?? 0 }))} />
        ) : (
          <Empty text="Your graph starts with your first problem." />
        )}
      </section>

      {/* Rev's read */}
      <section className="rounded-3xl border border-border bg-background p-6">
        <div className="flex items-center gap-2.5">
          <Orb size={24} />
          <h2 className="text-[15px] font-semibold">How you judge AI code</h2>
        </div>
        <Suspense fallback={<p className="mt-4 text-[14.5px] text-foreground-quaternary">{BRAND.tutor} is writing your summary…</p>}>
          <SummaryBlock
            userId={user.id}
            profile={profile}
            graded={graded}
            cached={{ summary: saved?.ai_summary ?? null, count: saved?.ai_summary_count ?? 0 }}
          />
        </Suspense>
      </section>

      {/* What they've done */}
      <section className="rounded-3xl border border-border bg-background p-6">
        <h2 className="text-[15px] font-semibold">Problems</h2>
        {graded.length ? (
          <ul className="mt-3 divide-y divide-border">
            {[...graded].reverse().map((a, i) => {
              const p = resolveProblem(a);
              return (
                <li key={`${a.problem_id}-${i}`} className="flex items-center gap-4 py-3.5">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl text-[15px]",
                      a.correct ? "bg-[#ecfdf3] text-[#067647]" : "bg-background-secondary text-foreground-tertiary",
                    )}
                  >
                    {a.correct ? "✓" : "↺"}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium">{p?.title ?? a.problem_id}</span>
                    <span className="truncate text-[13px] text-foreground-tertiary">
                      {p?.skill} · {a.correct ? (a.tries > 1 ? `caught on try ${a.tries}` : "caught first try") : "Rev explained it"}
                      {p ? ` · ${p.rule}` : ""}
                    </span>
                  </div>
                  <span className="text-[17px] font-semibold tabular-nums">
                    {a.score}
                    <span className="text-[13px] font-normal text-foreground-quaternary">/10</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty text="No problems yet." cta />
        )}
      </section>
    </div>
  );
}

async function SummaryBlock(props: {
  userId: string;
  profile: Profile;
  graded: GradedAttempt[];
  cached: { summary: Summary | null; count: number };
}) {
  const summary = await summaryFor(createAdminClient(), props.userId, props.profile, props.graded, props.cached);
  if (!summary) return <Empty text="Solve a problem and Rev will write your summary here." cta />;
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <p className="text-[19px] font-semibold tracking-[-0.02em]">{summary.headline}</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-foreground-secondary">{summary.judgement}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ListCard title="Strengths" items={summary.strengths} tone="good" />
        <ListCard title="To work on" items={summary.gaps} tone="work" />
      </div>
      <div className="rounded-2xl bg-primary px-4 py-3 text-[14.5px] text-white">
        <span className="font-semibold">Next: </span>
        {summary.next_step}
      </div>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: "good" | "work" }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-quaternary">{title}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[14.5px]">
            <span className={tone === "good" ? "text-[#067647]" : "text-foreground-quaternary"}>{tone === "good" ? "✓" : "→"}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreChart({ scores }: { scores: Array<{ title: string; score: number }> }) {
  const shown = scores.slice(-12);
  return (
    <div className="mt-4 flex h-40 items-end gap-2.5 border-b border-border pb-px">
      {shown.map((s, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${s.title}: ${s.score}/10`}>
          <span className="text-[12.5px] font-medium tabular-nums text-foreground-secondary">{s.score}</span>
          <div
            className={cn("w-full max-w-12 rounded-t-lg", i === shown.length - 1 ? "bg-primary" : "bg-border-strong")}
            style={{ height: `${Math.max(5, s.score * 10)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

// The Coach agent's 7-day plan (Pine Labs AgenticOrg), or Rev's own when the agent isn't available.
function CoachCard({ coach }: { coach: StoredCoach | null }) {
  const plan = coach?.plan;
  return (
    <section className="rounded-3xl border border-border bg-background p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-[15px] text-white" aria-hidden="true">
            🧭
          </span>
          <div className="flex flex-col leading-tight">
            <h2 className="text-[15px] font-semibold">Your next 7 days</h2>
            <span className="text-[12.5px] text-foreground-quaternary">
              {!coach
                ? "Coach agent · Pine Labs AgenticOrg"
                : coach.source === "agenticorg"
                  ? `${coach.status === "review" ? "Draft from the Coach agent · awaiting human review in" : "Planned by the Coach agent ·"} Pine Labs AgenticOrg${coach.confidence !== null ? ` · confidence ${Math.round(coach.confidence * 100)}%` : ""}`
                  : coach.status === "review"
                    ? "The Coach agent's plan is being reviewed by a person · Rev's plan for now"
                    : "Planned by Rev"}
              {coach?.at && (
                <> · made {new Date(coach.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</>
              )}
            </span>
          </div>
        </div>
        <CoachButton label={plan ? "Ask my coach for a new plan" : "Ask my coach for a plan"} />
      </div>
      {plan ? (
        <div className="mt-5 flex flex-col gap-4">
          <p className="text-[17px] font-semibold leading-snug tracking-[-0.015em]">{plan.headline}</p>
          {plan.focus.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {plan.focus.map((f) => (
                <span key={f.area} title={f.why} className="rounded-full bg-background-secondary px-3 py-1 text-[13px] font-medium ring-1 ring-border">
                  Focus: {f.area}
                </span>
              ))}
            </div>
          )}
          <ol className="grid gap-2 sm:grid-cols-2">
            {plan.days.map((d) => (
              <li key={d.day} className="flex gap-3 rounded-2xl border border-border px-4 py-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[12px] text-white">{d.day}</span>
                <span className="flex flex-col">
                  <span className="text-[14.5px] font-semibold">{d.title}</span>
                  <span className="text-[13.5px] text-foreground-tertiary">{d.task}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="rounded-2xl bg-primary px-4 py-3 text-[14.5px] text-white">
            <span className="font-semibold">Interview tip: </span>
            {plan.interview_tip}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[14.5px] text-foreground-tertiary">
          Your coach writes a plan from your results after your first problem, and again after every mock interview.
        </p>
      )}
    </section>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[20px] font-semibold tabular-nums">{value}</span>
      <span className="text-[12.5px] text-white/55">{label}</span>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-5 py-4">
      <p className="text-[13px] text-foreground-tertiary">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="text-[28px] font-semibold tracking-[-0.03em] tabular-nums">{value}</span>
        {sub && <span className="text-[13px] text-foreground-quaternary">{sub}</span>}
      </p>
    </div>
  );
}

function Empty({ text, cta = false }: { text: string; cta?: boolean }) {
  return (
    <div className="mt-4 flex flex-col items-start gap-3">
      <p className="text-[14.5px] text-foreground-tertiary">{text}</p>
      {cta && (
        <Link href="/chat" className="rounded-xl bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
          Practise with {BRAND.tutor}
        </Link>
      )}
    </div>
  );
}

