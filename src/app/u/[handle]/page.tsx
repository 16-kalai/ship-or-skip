import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Orb } from "@/components/orb";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { loadPublicProfile, type PublicProfile } from "@/lib/profile/public";

const SITUATION = { student: "Student", working: "Developer", switching: "Switching into tech", other: "Working professional" } as const;

export async function generateMetadata(props: PageProps<"/u/[handle]">): Promise<Metadata> {
  const { handle } = await props.params;
  const profile = await loadPublicProfile(handle);
  if (!profile) return { title: `${BRAND.name}` };
  const score = profile.rating.score === null ? "not rated yet" : `${profile.rating.score.toFixed(1)}/10`;
  const title = `${profile.name} · AI Code Judgement ${score} · ${BRAND.name}`;
  return {
    title,
    description: profile.meaning,
    openGraph: { title, description: profile.meaning, type: "profile" },
    twitter: { card: "summary_large_image", title, description: profile.meaning },
  };
}

// A learner's public profile: their AI Code Judgement score and the evidence behind it.
export default function PublicProfilePage(props: PageProps<"/u/[handle]">) {
  return (
    <main className="min-h-dvh bg-background-secondary/60">
      <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
          <Orb size={24} />
          {BRAND.name}
        </Link>
        <Link href="/signup" className="rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
          Get your own score
        </Link>
      </header>
      <Suspense fallback={<div className="flex justify-center py-24"><Orb size={40} speaking /></div>}>
        <Body params={props.params} />
      </Suspense>
    </main>
  );
}

async function Body({ params }: { params: PageProps<"/u/[handle]">["params"] }) {
  const { handle } = await params;
  const p = await loadPublicProfile(handle);
  if (!p) notFound();
  return <PublicView p={p} />;
}

function PublicView({ p }: { p: PublicProfile }) {
  const { rating } = p;
  const role = [p.title ?? (p.situation ? SITUATION[p.situation as keyof typeof SITUATION] : null), p.years !== null ? `${p.years} yr${p.years === 1 ? "" : "s"}` : null, p.level]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-4 py-8 sm:px-6">
      <section className="flex items-center gap-5 rounded-3xl border border-border bg-background p-6">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-[24px] font-semibold text-white">
          {p.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{p.name}</h1>
          {role && <p className="text-[15px] text-foreground-tertiary">{role}</p>}
          {p.stack.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.stack.map((s) => (
                <span key={s} className="rounded-full border border-border-strong px-2.5 py-0.5 text-[13px] text-foreground-secondary">{s}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl bg-primary text-white">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex flex-col gap-2 sm:w-[42%]">
            <span className="text-[13px] font-medium uppercase tracking-[0.1em] text-white/55">AI Code Judgement</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[64px] font-semibold leading-none tracking-[-0.05em] tabular-nums">{rating.score === null ? "–" : rating.score.toFixed(1)}</span>
              <span className="text-[22px] text-white/50">/10</span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {rating.band && <span className="rounded-full bg-white px-3 py-1 text-[13.5px] font-semibold text-[#0a0d12]">{rating.band}</span>}
              <span className="text-[13px] text-white/60">
                {rating.basedOn === 0 ? "No reviews yet" : rating.provisional ? `Provisional · ${rating.basedOn} review${rating.basedOn === 1 ? "" : "s"}` : `Based on ${Math.min(rating.basedOn, 10)} recent reviews`}
              </span>
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <p className="text-[16px] leading-relaxed text-white/85">{p.meaning}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Evidence label="Right calls" value={`${rating.rightCalls}%`} />
              <Evidence label="Named the issue" value={`${rating.namedIssue}%`} />
              <Evidence label="First try" value={`${rating.firstTry}%`} />
              <Evidence label="Rank" value={`#${p.rank} of ${p.players}`} />
            </div>
          </div>
        </div>
        <p className="border-t border-white/10 px-6 py-3 text-[12.5px] text-white/45 sm:px-8">
          Earned on {BRAND.name}: reviews of AI-written code, graded against a fixed answer key. Hints and extra tries lower it.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Points" value={String(p.points)} />
        <Tile label="Solved" value={String(p.solved)} sub={`of ${p.attempted}`} />
        <Tile label="Best mock interview" value={p.interview?.overall != null ? Number(p.interview.overall).toFixed(1) : "–"} sub={p.interview?.overall != null ? "/10" : undefined} />
        <Tile label="Interview verdict" value={p.interview?.verdict ?? "–"} small />
      </section>

      {p.history.length > 0 && (
        <section className="rounded-3xl border border-border bg-background p-6">
          <h2 className="text-[15px] font-semibold">Scores over time</h2>
          <div className="mt-4 flex h-36 items-end gap-2.5 border-b border-border pb-px">
            {p.history.map((h, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${h.title}: ${h.score}/10`}>
                <span className="text-[12.5px] font-medium tabular-nums text-foreground-secondary">{h.score}</span>
                <div className={cn("w-full max-w-12 rounded-t-lg", i === p.history.length - 1 ? "bg-primary" : "bg-border-strong")} style={{ height: `${Math.max(5, h.score * 10)}%` }} />
              </div>
            ))}
          </div>
        </section>
      )}

      {p.summary && (
        <section className="rounded-3xl border border-border bg-background p-6">
          <div className="flex items-center gap-2.5">
            <Orb size={22} />
            <h2 className="text-[15px] font-semibold">{BRAND.tutor}&apos;s read</h2>
          </div>
          <p className="mt-3 text-[18px] font-semibold tracking-[-0.02em]">{p.summary.headline}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-foreground-secondary">{p.summary.judgement}</p>
          {p.summary.strengths.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {p.summary.strengths.map((s) => (
                <li key={s} className="flex gap-2 text-[14.5px]"><span className="text-[#067647]">✓</span>{s}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {p.problems.length > 0 && (
        <section className="rounded-3xl border border-border bg-background p-6">
          <h2 className="text-[15px] font-semibold">Recent reviews</h2>
          <ul className="mt-3 divide-y divide-border">
            {p.problems.map((q, i) => (
              <li key={i} className="flex items-center gap-4 py-3">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-[14px]", q.correct ? "bg-[#ecfdf3] text-[#067647]" : "bg-background-secondary text-foreground-tertiary")}>
                  {q.correct ? "✓" : "↺"}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium">{q.title}</span>
                  <span className="text-[13px] text-foreground-tertiary">{q.skill}{q.correct ? (q.tries > 1 ? ` · on try ${q.tries}` : " · first try") : " · learned it"}</span>
                </span>
                <span className="font-semibold tabular-nums">{q.score}<span className="text-[12.5px] font-normal text-foreground-quaternary">/10</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col items-center gap-4 rounded-3xl bg-primary px-6 py-10 text-center text-white">
        <Orb size={48} speaking />
        <p className="text-[24px] font-semibold tracking-[-0.03em]">Can you tell when AI-written code is wrong?</p>
        <Link href="/signup" className="rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-[#0a0d12]">Get your own score →</Link>
      </section>
    </div>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[18px] font-semibold tabular-nums">{value}</span>
      <span className="text-[12.5px] text-white/55">{label}</span>
    </div>
  );
}

function Tile({ label, value, sub, small = false }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-5 py-4">
      <p className="text-[13px] text-foreground-tertiary">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className={cn("font-semibold tracking-[-0.03em] tabular-nums", small ? "text-[17px]" : "text-[26px]")}>{value}</span>
        {sub && <span className="text-[13px] text-foreground-quaternary">{sub}</span>}
      </p>
    </div>
  );
}
