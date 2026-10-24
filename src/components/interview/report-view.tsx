import Link from "next/link";
import { Orb } from "@/components/orb";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { DIMENSION_LABEL, SECTION_LABEL, type Report } from "@/lib/interview/types";

const VERDICT_TONE: Record<Report["verdict"], string> = {
  "Ready to interview": "bg-[#ecfdf3] text-[#067647]",
  "Almost there": "bg-[#fffaeb] text-[#b54708]",
  "Not yet": "bg-white text-[#0a0d12]",
};

// The practice interview report: overall score, dimensions with evidence, per-question coaching.
export function ReportView({ report, roleTitle }: { report: Report; roleTitle: string }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-3xl bg-primary text-white">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex flex-col gap-2 sm:w-[40%]">
            <span className="text-[13px] font-medium uppercase tracking-[0.1em] text-white/55">Ready for this interview?</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[64px] font-semibold leading-none tracking-[-0.05em] tabular-nums">{report.overall.toFixed(1)}</span>
              <span className="text-[22px] text-white/50">/10</span>
            </span>
            <span className={cn("self-start rounded-full px-3 py-1 text-[13.5px] font-semibold", VERDICT_TONE[report.verdict])}>
              {report.verdict}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-[13px] text-white/55">{roleTitle} · practice interview</p>
            <p className="text-[18px] font-medium leading-snug tracking-[-0.01em]">{report.headline}</p>
          </div>
        </div>
        <p className="border-t border-white/10 px-6 py-3 text-[12.5px] text-white/45 sm:px-8">
          Practice feedback from {BRAND.tutor}. The AI recommends; real hiring decisions are always made by people.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-background p-6">
        <h2 className="text-[15px] font-semibold">How you did, by skill</h2>
        <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {report.dimensions.map((d) => (
            <div key={d.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[14.5px] font-medium">{DIMENSION_LABEL[d.key]}</span>
                <span className="text-[14px] font-semibold tabular-nums">
                  {d.score === null ? <span className="font-normal text-foreground-quaternary">not enough evidence</span> : `${d.score}/10`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-background-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(d.score ?? 0) * 10}%` }} />
              </div>
              <p className="text-[13.5px] text-foreground-tertiary">{d.note}</p>
              {d.quote && <p className="text-[13.5px] italic text-foreground-secondary">You said: &ldquo;{d.quote}&rdquo;</p>}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <ListCard title="What went well" items={report.strengths} mark="✓" good />
        <ListCard title="What to sharpen" items={report.improvements} mark="→" />
      </div>

      <section className="rounded-3xl border border-border bg-background p-6">
        <h2 className="text-[15px] font-semibold">Question by question</h2>
        <div className="mt-3 flex flex-col divide-y divide-border">
          {report.questions.map((q, i) => (
            <details key={i} className="group py-4" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-start gap-4 [&::-webkit-details-marker]:hidden">
                <span className="mt-0.5 w-24 shrink-0 text-[12.5px] font-medium text-foreground-quaternary">{SECTION_LABEL[q.section]}</span>
                <span className="flex-1 text-[15px] font-medium">{q.question}</span>
                <span className="text-[16px] font-semibold tabular-nums">
                  {q.score}
                  <span className="text-[12.5px] font-normal text-foreground-quaternary">/10</span>
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-3 sm:pl-28">
                <p className="text-[14.5px] text-foreground-secondary">{q.feedback}</p>
                <div className="rounded-2xl bg-background-secondary px-4 py-3 ring-1 ring-border">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-quaternary">A stronger answer</p>
                  <p className="mt-1 text-[14.5px] leading-relaxed">{q.better_answer}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      {report.next_steps.length > 0 && (
        <section className="flex flex-col gap-3 rounded-3xl border border-border bg-background p-6">
          <div className="flex items-center gap-2.5">
            <Orb size={22} />
            <h2 className="text-[15px] font-semibold">Practise before your real interview</h2>
          </div>
          <ol className="flex flex-col gap-2">
            {report.next_steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-[14.5px]">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[12px] text-white">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/interview" className="rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-hover">
              Practise another interview
            </Link>
            <Link href="/chat" className="rounded-xl border border-border-strong px-4 py-2.5 text-[14px] font-semibold hover:bg-background-secondary">
              Back to {BRAND.tutor}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function ListCard({ title, items, mark, good = false }: { title: string; items: string[]; mark: string; good?: boolean }) {
  return (
    <section className="rounded-3xl border border-border bg-background p-6">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[14.5px]">
            <span className={good ? "text-[#067647]" : "text-foreground-quaternary"}>{mark}</span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
