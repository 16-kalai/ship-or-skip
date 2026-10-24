"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Orb } from "@/components/orb";
import { CodeCard } from "@/components/chat/code-card";
import { ReportView } from "@/components/interview/report-view";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { CALL_MINUTES, SECTION_LABEL, type InterviewView, type Report } from "@/lib/interview/types";
import { LiveVoice } from "@/lib/voice/live-client";

type Line = { who: "interviewer" | "candidate"; text: string };
type Phase = "ready" | "connecting" | "live" | "scoring" | "done";

// The practice interview call: Gemini Live interviews by voice, puts each question on the canvas,
// and only its own live transcription appears as text. Scored from that transcript at the end.
export function InterviewRoom({ view }: { view: InterviewView }) {
  const [phase, setPhase] = useState<Phase>(view.status === "completed" ? "done" : "ready");
  const [report, setReport] = useState<Report | null>(view.report);
  const [current, setCurrent] = useState(0);
  const [lines, setLines] = useState<Line[]>(view.turns.map((t) => ({ who: t.role, text: t.content })));
  const [captions, setCaptions] = useState({ user: "", rev: "" });
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const callRef = useRef<LiveVoice | null>(null);
  const currentRef = useRef(0);
  const finishingRef = useRef(false);
  const spokeRef = useRef(false);
  const secondsRef = useRef(0);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  useEffect(() => () => callRef.current?.stop(), []);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines, captions]);

  // Call clock: Rev gets [clock] notes so the practice call wraps up on time.
  useEffect(() => {
    if (phase !== "live") return;
    const timer = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        secondsRef.current = next;
        if (next === 6 * 60) callRef.current?.note("[clock] 6 minutes elapsed. Make sure you reach the last questions.");
        if (next === CALL_MINUTES * 60)
          callRef.current?.note("[clock] Time's up. Ask the last question briefly if you haven't, or close now and call end_interview.");
        if (next === (CALL_MINUTES + 2) * 60) void finish();
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
    // finish is stable for the life of the call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function show(index: number) {
    const i = Math.max(0, Math.min(view.canvas.length - 1, Math.round(index)));
    currentRef.current = i;
    setCurrent(i);
  }

  function saveTurn(who: Line["who"], text: string) {
    setLines((l) => [...l, { who, text }]);
    if (who === "candidate") spokeRef.current = true;
    void fetch(`/api/interview/${view.id}/turns`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: who, content: text, question_index: currentRef.current }),
    }).catch((e) => console.error("[interview/turns]", e));
  }

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    callRef.current?.stop();
    setPhase("scoring");
    try {
      // Give the last transcript save a moment to land.
      await new Promise((r) => setTimeout(r, 1200));
      const res = await fetch(`/api/interview/${view.id}/end`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { status?: string; report?: Report | null; error?: string };
      if (data.report) {
        setReport(data.report);
        setPhase("done");
      } else {
        setError(data.error ?? "Couldn't score that call. Try again.");
        setPhase("ready");
      }
    } catch {
      setError("Couldn't score that call. Try again.");
      setPhase("ready");
    } finally {
      finishingRef.current = false;
    }
  }

  function startCall() {
    if (phase !== "ready") return;
    setError(null);
    setSeconds(0);
    setPhase("connecting");
    const call = new LiveVoice({
      kickoff: "[clock] 0 minutes. The candidate has joined the call. Begin.",
      nonBlocking: ["show_question", "end_interview"],
      onStatus: (status) => {
        if (status === "live") setPhase("live");
        if (status === "ended") {
          callRef.current = null;
          setCaptions({ user: "", rev: "" });
          setSpeaking(false);
          // The call dropped or ended: score what was said, if anything.
          if (!finishingRef.current) {
            if (spokeRef.current) void finish();
            else setPhase("ready");
          }
        }
      },
      onSpeaking: setSpeaking,
      onCaption: (who, text) => setCaptions((c) => ({ ...c, [who]: text })),
      onTurn: (who, text) => {
        setCaptions((c) => ({ ...c, [who]: "" }));
        saveTurn(who === "rev" ? "interviewer" : "candidate", text);
      },
      onToolCall: async (name, args) => {
        if (name === "show_question") {
          show(Number(args.index ?? 0));
          return { shown: true };
        }
        if (name === "end_interview") {
          // A model slip mustn't hang up early: only end once the last question is on screen
          // (or time is nearly up). Otherwise tell it to carry on.
          const lastQuestion = currentRef.current >= view.canvas.length - 1;
          if (!lastQuestion && secondsRef.current < (CALL_MINUTES - 1) * 60) {
            return { ended: false, reason: "Not finished: continue with the next question." };
          }
          // Let the closing words finish playing, then score.
          setTimeout(() => void finish(), 4000);
          return { ended: true };
        }
        return { error: "unknown tool" };
      },
      onError: setError,
    });
    callRef.current = call;
    void call.start(async () => {
      const res = await fetch(`/api/interview/${view.id}/token`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { token?: string; model?: string; error?: string };
      if (!res.ok || !data.token || !data.model) throw new Error(data.error ?? "Couldn't start the call. Try again.");
      return { token: data.token, model: data.model };
    });
  }

  const card = view.canvas[current];
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <main className="flex h-dvh flex-col bg-background-secondary/60">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/interview" aria-label="All interviews" className="text-[18px] text-foreground-tertiary hover:text-foreground">
            ←
          </Link>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[15px] font-semibold">
              {view.roleTitle}
              {view.company ? <span className="font-normal text-foreground-tertiary"> · {view.company}</span> : null}
            </span>
            <span className="text-[12.5px] text-foreground-quaternary">Practice interview with {BRAND.tutor}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase === "live" && (
            <span className="flex items-center gap-2 rounded-full bg-[#fef3f2] px-3 py-1 text-[13px] font-semibold text-[#b42318]">
              <span className="size-2 animate-pulse rounded-full bg-[#f04438]" /> Live · {clock}
            </span>
          )}
          {phase === "scoring" && <span className="text-[13px] font-medium text-foreground-tertiary">Scoring your call…</span>}
        </div>
      </header>

      {phase === "done" && report ? (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-4 py-8 sm:px-6">
            <ReportView report={report} roleTitle={view.roleTitle} />
            {lines.length > 0 && (
              <details className="rounded-3xl border border-border bg-background p-6">
                <summary className="cursor-pointer text-[15px] font-semibold">Call transcript</summary>
                <div className="mt-4 flex flex-col gap-3">
                  {lines.map((l, i) => (
                    <TranscriptLine key={i} line={l} />
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* The canvas: what Rev has put on screen */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-background">
            {phase === "ready" || phase === "connecting" ? (
              <PreCall view={view} connecting={phase === "connecting"} error={error} onStart={startCall} resumed={lines.length > 0} />
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-border px-6 py-3">
                  {view.canvas.map((c, i) => (
                    <div key={c.section} className="flex flex-1 flex-col gap-1.5">
                      <div className={cn("h-1 rounded-full", i < current ? "bg-primary" : i === current ? "bg-foreground-quaternary" : "bg-border")} />
                      <span className={cn("hidden text-[12px] sm:block", i === current ? "font-semibold" : "text-foreground-quaternary")}>
                        {SECTION_LABEL[c.section]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                  <p className="font-mono text-[12.5px] font-medium text-foreground-quaternary">
                    QUESTION {current + 1} OF {view.canvas.length} · {SECTION_LABEL[card.section].toUpperCase()}
                  </p>
                  <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.03em]">{card.title}</h2>
                  <p className="mt-3 text-[16.5px] leading-relaxed text-foreground-secondary">{card.question}</p>
                  {card.context && (
                    <div className="mt-5 rounded-2xl bg-background-secondary px-4 py-3 ring-1 ring-border">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-quaternary">From your resume</p>
                      <p className="mt-1 text-[15px]">{card.context}</p>
                    </div>
                  )}
                  {card.problem && (
                    <div className="mt-5 flex flex-col gap-3">
                      <div className="rounded-2xl bg-background-secondary px-4 py-3 ring-1 ring-border">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-quaternary">The request</p>
                        <p className="mt-1 text-[15.5px] font-medium">&ldquo;{card.problem.request}&rdquo;</p>
                      </div>
                      <CodeCard filename={card.problem.filename} code={card.problem.code} />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-4 border-t border-border px-6 py-4">
                  <Orb size={44} speaking={speaking || phase === "scoring"} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-semibold">
                      {phase === "scoring" ? "Writing your readiness report…" : speaking ? `${BRAND.tutor} is speaking` : muted ? "You're muted" : "Your turn: just talk"}
                    </span>
                    <span className="text-[13px] text-foreground-tertiary">Think out loud. Say why, and give real examples.</span>
                  </div>
                  {phase === "live" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          callRef.current?.setMuted(!muted);
                          setMuted(!muted);
                        }}
                        className="rounded-full border border-border-strong px-4 py-2 text-[14px] font-medium hover:bg-background-secondary"
                      >
                        {muted ? "Unmute" : "Mute"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void finish()}
                        className="rounded-full bg-[#d92d20] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#b42318]"
                      >
                        End & get score
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Live transcript: Gemini Live's own transcription of the call */}
          <aside className="flex min-h-[260px] flex-col overflow-hidden rounded-3xl border border-border bg-background">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
              <span className="text-[14px] font-semibold">Live transcript</span>
              <span className="text-[12px] text-foreground-quaternary">Gemini Live</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {lines.length === 0 && !captions.rev && !captions.user ? (
                <p className="text-[14px] text-foreground-quaternary">The conversation appears here as you talk.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {lines.map((l, i) => (
                    <TranscriptLine key={i} line={l} />
                  ))}
                  {captions.rev && <TranscriptLine line={{ who: "interviewer", text: captions.rev }} live />}
                  {captions.user && <TranscriptLine line={{ who: "candidate", text: captions.user }} live />}
                </div>
              )}
              <div ref={transcriptEnd} />
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

function PreCall({
  view,
  connecting,
  error,
  onStart,
  resumed,
}: {
  view: InterviewView;
  connecting: boolean;
  error: string | null;
  onStart: () => void;
  resumed: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-8 text-center">
      <Orb size={72} speaking={connecting} />
      <div className="flex max-w-[520px] flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">
          {resumed ? "Pick up your interview" : `Ready${view.candidateName ? `, ${view.candidateName}` : ""}?`}
        </h1>
        <p className="text-[16px] text-foreground-tertiary">
          A {CALL_MINUTES}-minute voice call with {BRAND.tutor} for the {view.roleTitle} role. Questions appear on this screen as
          they&apos;re asked. Talk like it&apos;s the real thing; you get your readiness score at the end.
        </p>
      </div>
      <ol className="flex flex-wrap justify-center gap-2">
        {view.canvas.map((c, i) => (
          <li key={c.section} className="rounded-full border border-border-strong px-3 py-1 text-[13px] text-foreground-secondary">
            {i + 1}. {SECTION_LABEL[c.section]}
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={onStart}
        disabled={connecting}
        className="flex items-center gap-2.5 rounded-full bg-primary px-7 py-3.5 text-[16px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-70"
      >
        <span aria-hidden="true">📞</span> {connecting ? "Connecting…" : "Start interview call"}
      </button>
      <p className="text-[12.5px] text-foreground-quaternary">Uses your microphone during the call only. Headphones help.</p>
    </div>
  );
}

function TranscriptLine({ line, live = false }: { line: Line; live?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5", live && "opacity-60")}>
      <span className={cn("text-[12px] font-semibold", line.who === "interviewer" ? "text-foreground" : "text-foreground-tertiary")}>
        {line.who === "interviewer" ? BRAND.tutor : "You"}
      </span>
      <p className="text-[14.5px] leading-relaxed">{line.text}</p>
    </div>
  );
}
