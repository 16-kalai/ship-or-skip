"use client";

import { useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { CodeCard } from "@/components/chat/code-card";
import { cn } from "@/lib/cn";
import type { Choice, Progress, PublicProblem, ResultCard as Result } from "@/lib/challenges/types";
import { MAX_PDF_BYTES, MAX_TRIES } from "@/lib/chat/types";

const CARD = "overflow-hidden rounded-2xl border border-border bg-background shadow-[0_1px_2px_rgba(10,13,18,0.05)]";

// Tap-to-answer tiles. Single choice sends at once; multi choice sends on Continue.
export function ChoicesCard({
  choices,
  multi,
  active,
  onSubmit,
}: {
  choices: Choice[];
  multi: boolean;
  active: boolean;
  onSubmit: (text: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {choices.map((c) => {
          const on = picked.includes(c.label);
          return (
            <button
              key={c.value}
              type="button"
              disabled={!active}
              onClick={() => (multi ? setPicked(on ? picked.filter((p) => p !== c.label) : [...picked, c.label]) : onSubmit(c.label))}
              className={cn(
                "group flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
                on ? "border-foreground bg-background-secondary" : "border-border-strong bg-background hover:border-foreground-quaternary hover:bg-background-secondary/60",
                "disabled:cursor-default disabled:opacity-60 disabled:hover:bg-background",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center border transition-colors",
                  multi ? "rounded-md" : "rounded-full",
                  on ? "border-foreground bg-foreground text-white" : "border-border-strong",
                )}
              >
                {on && <CheckIcon />}
              </span>
              <span className="flex flex-col">
                <span className="text-[15px] font-medium">{c.label}</span>
                {c.hint && <span className="text-[13px] text-foreground-tertiary">{c.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {multi && active && (
        <button
          type="button"
          disabled={!picked.length}
          onClick={() => onSubmit(picked.join(", "))}
          className="self-start rounded-xl bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-30"
        >
          Continue
        </button>
      )}
    </div>
  );
}

// Drop or pick a PDF resume, or say there isn't one.
export function ResumeCard({
  active,
  onFile,
  onNone,
  onError,
}: {
  active: boolean;
  onFile: (file: File) => void;
  onNone: () => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function accept(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") return onError("Only PDF resumes work here.");
    if (file.size > MAX_PDF_BYTES) return onError("That PDF is over 5 MB. Try a smaller one.");
    onFile(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (active) accept(e.dataTransfer.files[0]);
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <button
        type="button"
        disabled={!active}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (active) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          over ? "border-foreground bg-background-secondary" : "border-border-strong hover:bg-background-secondary/60",
          "disabled:cursor-default disabled:opacity-60",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-background-secondary ring-1 ring-border">
          <UploadIcon />
        </span>
        <span className="text-[15px] font-semibold">Drop your resume here</span>
        <span className="text-[13px] text-foreground-tertiary">or click to browse · PDF up to 5 MB · read, never stored</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {active && (
        <button
          type="button"
          onClick={onNone}
          className="self-start rounded-xl border border-border-strong px-4 py-2 text-[14px] font-medium text-foreground-secondary transition-colors hover:bg-background-secondary"
        >
          I don&apos;t have one
        </button>
      )}
    </div>
  );
}

const STEPS = [
  { title: "Read the request", body: "What someone asked an AI to build." },
  { title: "Check the AI's code", body: "Hunt for anything that doesn't do what was asked." },
  { title: "Ship it or skip it", body: "Make the call and say why, by typing or speaking." },
];

// How a problem works, before the first one.
export function HowToCard({ active, onStart }: { active: boolean; onStart: () => void }) {
  return (
    <div className={cn(CARD, "mt-4")}>
      <div className="grid gap-px bg-border sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex flex-col gap-1.5 bg-background p-4">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary font-mono text-[13px] text-white">
              {i + 1}
            </span>
            <span className="mt-1 text-[15px] font-semibold">{s.title}</span>
            <span className="text-[13.5px] text-foreground-tertiary">{s.body}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background-secondary/50 px-4 py-3">
        <span className="text-[13.5px] text-foreground-tertiary">
          Up to 10 points each. Miss it? You get {MAX_TRIES} tries, with nudges.
        </span>
        {active && (
          <button
            type="button"
            onClick={onStart}
            className="rounded-xl bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Start my first problem →
          </button>
        )}
      </div>
    </div>
  );
}

// A problem: what was asked, what the AI wrote, and the call to make.
export function ProblemCard({
  problem,
  number,
  active,
  verdict,
  onVerdict,
  onHint,
}: {
  problem: PublicProblem;
  number: number;
  active: boolean;
  verdict: "ship" | "skip" | null;
  onVerdict: (v: "ship" | "skip") => void;
  onHint: () => void;
}) {
  return (
    <div className={cn(CARD, "mt-4")}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background-secondary/50 px-5 py-3">
        <span className="flex items-center gap-2.5">
          <span className="font-mono text-[12.5px] font-medium text-foreground-tertiary">PROBLEM {String(number || 1).padStart(2, "0")}</span>
          <span className="rounded-full border border-border-strong bg-background px-2.5 py-0.5 text-[12.5px] font-medium text-foreground-secondary">
            {problem.skill}
          </span>
        </span>
        <span className="text-[12.5px] text-foreground-quaternary">~2 min</span>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-quaternary">
            {problem.language === "text" ? "The question" : "The request"}
          </p>
          <p className="mt-1.5 text-[17px] font-medium leading-snug tracking-[-0.01em]">&ldquo;{problem.request}&rdquo;</p>
        </div>
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-quaternary">
            {problem.language === "text" ? "The AI's answer" : "What the AI wrote"}
          </p>
          <CodeCard filename={problem.filename} code={problem.code} />
        </div>
      </div>
      {active && (
        <div className="flex flex-wrap items-center gap-2.5 border-t border-border px-5 py-4">
          <VerdictButton on={verdict === "ship"} onClick={() => onVerdict("ship")}>
            🚢 Ship it
          </VerdictButton>
          <VerdictButton on={verdict === "skip"} onClick={() => onVerdict("skip")}>
            ✋ Skip it
          </VerdictButton>
          <button
            type="button"
            onClick={onHint}
            className="ml-auto text-[14px] font-medium text-foreground-tertiary underline-offset-4 hover:text-foreground hover:underline"
          >
            Need a hint? <span className="text-foreground-quaternary">(−1 pt)</span>
          </button>
        </div>
      )}
    </div>
  );
}

function VerdictButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-5 py-2.5 text-[15px] font-semibold transition-all",
        on ? "border-primary bg-primary text-white" : "border-border-strong bg-background hover:border-foreground-quaternary hover:bg-background-secondary",
      )}
    >
      {children}
    </button>
  );
}

const PARTS: Array<{ key: keyof Result["breakdown"]; label: string; max: number }> = [
  { key: "call", label: "Right call", max: 3 },
  { key: "flaw", label: "Named the issue", max: 4 },
  { key: "reasoning", label: "Reasoning", max: 2 },
  { key: "firstTry", label: "First try", max: 1 },
];

// The graded review: score, what earned it, the fix, and the rule to keep.
export function ResultCard({ result }: { result: Result }) {
  // Results saved before retries existed have no tries/taught fields.
  const status = result.taught
    ? { text: "Rev explained this one", cls: "bg-background-secondary text-foreground-secondary ring-1 ring-border" }
    : { text: !result.correct ? "Missed this one" : (result.tries ?? 1) === 1 ? "Caught it first try" : `Caught it on try ${result.tries}`, cls: "bg-[#ecfdf3] text-[#067647]" };
  return (
    <div className={cn(CARD, "mt-4")}>
      <div className="flex flex-wrap items-center gap-6 p-5">
        <div className="flex items-baseline gap-1">
          <span className="text-[44px] font-semibold leading-none tracking-[-0.04em]">{result.score}</span>
          <span className="text-lg text-foreground-quaternary">/10</span>
        </div>
        <div className="flex min-w-[240px] flex-1 flex-col gap-3">
          <span className={cn("self-start rounded-full px-2.5 py-1 text-[13px] font-medium", status.cls)}>
            {status.text} · the call was {result.answer === "ship" ? "Ship it" : "Skip it"}
          </span>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2">
            {PARTS.map((p) => (
              <div key={p.key} className="flex flex-col gap-1">
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-foreground-tertiary">{p.label}</span>
                  <span className="font-medium tabular-nums">
                    {result.breakdown[p.key] ?? 0}/{p.max}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-background-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${((result.breakdown[p.key] ?? 0) / p.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-border bg-background-secondary/40 p-5">
        {result.fix && <CodeCard filename="The fix" code={`- ${result.fix.before}\n+ ${result.fix.after}`} tone="diff" />}
        {result.proVersion && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-quaternary">How a pro would say it</p>
            <p className="mt-1 text-[14.5px] italic text-foreground-secondary">&ldquo;{result.proVersion}&rdquo;</p>
          </div>
        )}
        <div className="flex items-start gap-2.5 rounded-xl bg-primary px-4 py-3 text-white">
          <span aria-hidden="true">💡</span>
          <p className="text-[14.5px]">
            <span className="font-semibold">Rule to keep: </span>
            {result.rule}
          </p>
        </div>
      </div>
    </div>
  );
}

// Points, rank and the score graph, with the way to the profile and the next problem.
export function ProgressCard({
  progress,
  active,
  onNext,
}: {
  progress: Progress;
  active: boolean;
  onNext: () => void;
}) {
  const max = 10;
  return (
    <div className={cn(CARD, "mt-4")}>
      <div className="flex flex-col border-b border-border sm:flex-row">
        <div className="flex flex-col gap-1 bg-primary px-5 py-4 text-white sm:w-[44%]">
          <span className="text-[12.5px] text-white/65">AI Code Judgement</span>
          <span className="flex items-baseline gap-1">
            <span className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
              {progress.rating == null ? "–" : progress.rating.toFixed(1)}
            </span>
            <span className="text-[15px] text-white/55">/10</span>
          </span>
          <span className="mt-1 self-start rounded-full bg-white/12 px-2.5 py-0.5 text-[12.5px] font-medium">
            {progress.provisional || !progress.band ? "Provisional · keep going" : progress.band}
          </span>
        </div>
        <div className="grid flex-1 grid-cols-3 divide-x divide-border">
          <Stat label="Points" value={String(progress.points)} />
          <Stat label="Rank" value={`#${progress.rank}`} sub={`of ${progress.players}`} />
          <Stat label="Solved" value={`${progress.solved}`} sub={`of ${progress.attempted}`} />
        </div>
      </div>
      <div className="px-5 pb-4 pt-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-quaternary">Your scores</p>
        <div className="mt-3 flex h-28 items-end gap-2">
          {progress.history.map((h, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${h.title}: ${h.score}/10`}>
              <span className="text-[12px] font-medium tabular-nums text-foreground-secondary">{h.score}</span>
              <div
                className={cn("w-full max-w-10 rounded-t-md", i === progress.history.length - 1 ? "bg-primary" : "bg-border-strong")}
                style={{ height: `${Math.max(6, (h.score / max) * 100)}%` }}
              />
            </div>
          ))}
          {Array.from({ length: Math.max(0, 5 - progress.history.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex h-full flex-1 flex-col items-center justify-end">
              <div className="h-[6%] w-full max-w-10 rounded-t-md border border-dashed border-border-strong" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background-secondary/50 px-5 py-3">
        <Link href="/profile" className="text-[14px] font-semibold text-foreground underline-offset-4 hover:underline">
          View my profile →
        </Link>
        {active && (
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Next problem
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-5 py-4">
      <span className="text-[12.5px] text-foreground-tertiary">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-[26px] font-semibold tracking-[-0.03em] tabular-nums">{value}</span>
        {sub && <span className="text-[13px] text-foreground-quaternary">{sub}</span>}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-foreground-secondary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}
