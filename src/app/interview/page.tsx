import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Orb } from "@/components/orb";
import { NewInterview } from "@/components/interview/new-interview";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

type Row = { id: string; role_title: string; company: string | null; status: string; overall: number | null; created_at: string; current_index: number };

// Practice interviews: start one from a JD, resume one in progress, or revisit past reports.
export default function InterviewsPage() {
  return (
    <main className="min-h-dvh bg-background-secondary/60">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
        <Link href="/chat" className="flex items-center gap-2.5 text-[14px] font-medium text-foreground-secondary hover:text-foreground">
          <span aria-hidden="true">←</span> Back to {BRAND.tutor}
        </Link>
        <span className="flex items-center gap-2 font-semibold">
          <Orb size={22} />
          Interview practice
        </span>
        <Link href="/profile" className="text-[14px] font-medium text-foreground-tertiary hover:text-foreground">
          Profile
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] font-semibold tracking-[-0.03em]">Practise the interview, not just the code.</h1>
          <p className="max-w-[640px] text-[16px] text-foreground-tertiary">
            Give {BRAND.tutor} the job description and your resume. Then hop on a voice call: {BRAND.tutor} interviews you
            for that exact role, putting each question on screen. At the end you get a readiness score out of 10 and a
            stronger answer for every question.
          </p>
        </div>
        <Suspense fallback={null}>
          <ActiveInterview />
        </Suspense>
        <NewInterview />
        <Suspense fallback={null}>
          <PastInterviews />
        </Suspense>
      </div>
    </main>
  );
}

async function interviewsFor() {
  const user = await getUser();
  if (!user) redirect("/signup?next=/interview");
  const { data } = await createAdminClient()
    .from("interviews")
    .select("id, role_title, company, status, overall, created_at, current_index")
    .eq("user_id", user.id)
    .neq("status", "abandoned")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<Row[]>();
  return data ?? [];
}

async function ActiveInterview() {
  const active = (await interviewsFor()).find((i) => i.status === "active");
  if (!active) return null;
  return (
    <Link
      href={`/interview/${active.id}`}
      className="flex items-center justify-between gap-4 rounded-3xl bg-primary px-6 py-5 text-white transition-colors hover:bg-primary-hover"
    >
      <span className="flex flex-col">
        <span className="text-[13px] text-white/60">Ready for your call</span>
        <span className="text-[17px] font-semibold">
          {active.role_title}
          {active.company ? ` · ${active.company}` : ""}
        </span>
      </span>
      <span className="text-[15px] font-semibold">Join call →</span>
    </Link>
  );
}

async function PastInterviews() {
  const done = (await interviewsFor()).filter((i) => i.status === "completed");
  if (!done.length) return null;
  return (
    <section className="rounded-3xl border border-border bg-background p-6">
      <h2 className="text-[15px] font-semibold">Your interviews</h2>
      <ul className="mt-3 divide-y divide-border">
        {done.map((i) => (
          <li key={i.id}>
            <Link href={`/interview/${i.id}`} className="flex items-center gap-4 py-3.5 hover:opacity-80">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">
                  {i.role_title}
                  {i.company ? <span className="text-foreground-tertiary"> · {i.company}</span> : null}
                </span>
                <span className="text-[13px] text-foreground-quaternary">
                  {new Date(i.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </span>
              <span
                className={cn(
                  "text-[17px] font-semibold tabular-nums",
                  (i.overall ?? 0) >= 7.5 ? "text-[#067647]" : "text-foreground",
                )}
              >
                {i.overall?.toFixed(1) ?? "–"}
                <span className="text-[13px] font-normal text-foreground-quaternary">/10</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
