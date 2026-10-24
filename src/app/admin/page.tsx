import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Orb } from "@/components/orb";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { serverEnv } from "@/lib/env";
import { loadAdminStats } from "@/lib/admin/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

// Admin: who's using the product, what they've solved, their interviews and their rank.
export default function AdminPage() {
  return (
    <main className="min-h-dvh bg-background-secondary/60">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
        <span className="flex items-center gap-2.5 font-semibold">
          <Orb size={22} />
          {BRAND.name} · Admin
        </span>
        <span className="text-[13px] text-foreground-quaternary">Live · refreshes every 30 s</span>
        <Link href="/chat" className="text-[14px] font-medium text-foreground-tertiary hover:text-foreground">
          Open app
        </Link>
      </header>
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Orb size={40} speaking />
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const user = await getUser();
  if (!user) redirect("/signup?next=/admin");
  // Only listed admins; everyone else gets a 404, so the page's existence isn't revealed.
  if (!serverEnv().ADMIN_EMAILS.includes((user.email ?? "").toLowerCase())) notFound();

  const { totals, users, problems, recentInterviews } = await loadAdminStats(createAdminClient());
  const fmt = (n: number | null, d = 1) => (n === null ? "–" : n.toFixed(d));
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "–";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-8 sm:px-6">
      <AutoRefresh />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Tile label="Users" value={String(totals.users)} />
        <Tile label="Onboarded" value={String(totals.onboarded)} />
        <Tile label="Active today" value={String(totals.activeToday)} />
        <Tile label="Problems done" value={String(totals.problemsAttempted)} sub={`${totals.problemsGenerated} AI-made`} />
        <Tile label="Problems solved" value={String(totals.problemsSolved)} />
        <Tile label="Avg problem score" value={fmt(totals.avgScore)} sub="/10" />
        <Tile label="Interviews done" value={String(totals.interviewsCompleted)} sub={`of ${totals.interviewsStarted}`} />
        <Tile label="Avg readiness" value={fmt(totals.avgReadiness)} sub="/10" />
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-[15px] font-semibold">Leaderboard · all users</h2>
          <span className="text-[13px] text-foreground-quaternary">Ranked by points · {totals.users} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[14px]">
            <thead className="bg-background-secondary/60 text-[12.5px] text-foreground-tertiary">
              <tr>
                {["Rank", "User", "Role", "Points", "Judgement /10", "Problems solved", "Interviews", "Best interview", "Joined", "Last active"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-background-secondary/40">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={cn("font-semibold tabular-nums", u.rank <= 3 && "text-[#b54708]")}>#{u.rank}</span>
                    <span className="text-[12.5px] text-foreground-quaternary"> of {totals.users}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-[12.5px] text-foreground-quaternary">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground-secondary">
                    {u.onboarded ? u.title ?? "–" : <span className="text-foreground-quaternary">Onboarding</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{u.points}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {fmt(u.rating)}
                    {u.rating !== null && u.provisional && <span className="ml-1 text-[12px] text-foreground-quaternary">prov.</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {u.solved}
                    <span className="text-foreground-quaternary"> / {u.attempted}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{u.interviews}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(u.bestInterview)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-foreground-tertiary">{when(u.joined)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-foreground-tertiary">{when(u.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-3xl border border-border bg-background">
          <h2 className="border-b border-border px-6 py-4 text-[15px] font-semibold">Problems</h2>
          {problems.length ? (
            <table className="w-full text-left text-[14px]">
              <thead className="bg-background-secondary/60 text-[12.5px] text-foreground-tertiary">
                <tr>
                  {["Problem", "Level", "Done", "Solved", "Avg"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {problems.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-medium">{p.title}</td>
                    <td className="px-4 py-2.5 capitalize text-foreground-tertiary">{p.level}</td>
                    <td className="px-4 py-2.5 tabular-nums">{p.attempts}</td>
                    <td className="px-4 py-2.5 tabular-nums">{p.solveRate}%</td>
                    <td className="px-4 py-2.5 tabular-nums">{p.avgScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-6 py-5 text-[14px] text-foreground-quaternary">No problems solved yet.</p>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-border bg-background">
          <h2 className="border-b border-border px-6 py-4 text-[15px] font-semibold">Recent interviews</h2>
          {recentInterviews.length ? (
            <ul className="divide-y divide-border">
              {recentInterviews.map((i) => (
                <li key={i.id} className="flex items-center gap-4 px-6 py-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14.5px] font-medium">
                      {i.who} <span className="font-normal text-foreground-tertiary">· {i.role_title}{i.company ? ` @ ${i.company}` : ""}</span>
                    </span>
                    <span className="text-[12.5px] text-foreground-quaternary">{when(i.created_at)}</span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmt(i.overall === null ? null : Number(i.overall))}
                    <span className="text-[12.5px] font-normal text-foreground-quaternary">/10</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-5 text-[14px] text-foreground-quaternary">No interviews completed yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3.5">
      <p className="text-[12.5px] text-foreground-tertiary">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="text-[24px] font-semibold tracking-[-0.03em] tabular-nums">{value}</span>
        {sub && <span className="text-[12.5px] text-foreground-quaternary">{sub}</span>}
      </p>
    </div>
  );
}
