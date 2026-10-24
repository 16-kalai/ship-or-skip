"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Orb } from "@/components/orb";
import { ChoicesCard, HowToCard, ProblemCard, ProgressCard, ResultCard, ResumeCard } from "@/components/chat/cards";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { NO_RESUME, SITUATIONS } from "@/lib/chat/quick-replies";
import { MAX_TEXT_CHARS, type ChatAction, type ChatMessage, type ChatResponse, type Stage } from "@/lib/chat/types";

type Turn = { text?: string; file?: File | null; action?: ChatAction };
type Props = {
  greeting: string;
  initialMessages: ChatMessage[];
  initialStage: Stage;
  user: { initial: string; avatarUrl: string | null };
};

const PLACEHOLDER: Record<Stage, string> = {
  situation: "Or type it in your own words…",
  background: "Or tell me what you've built…",
  goal: "Or type your goal…",
  strengths: "Or type what you're strong at…",
  weaknesses: "Or type what you want to improve…",
  start: `Message ${BRAND.tutor}…`,
  challenge: "Ship it or skip it? And why…",
  result: `Message ${BRAND.tutor}…`,
};

// Practice with Rev: a text chat with cards. (Voice lives only in the mock interview.)
export function Chat({ greeting, initialMessages, initialStage, user }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [stage, setStage] = useState(initialStage);
  const [draft, setDraft] = useState("");
  const [verdict, setVerdict] = useState<"ship" | "skip" | null>(null);
  const [pending, setPending] = useState<{ text: string; fileName?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, error]);

  // One turn, typed or tapped. Throws a friendly message on failure.
  const sendTurn = useCallback(
    async ({ text = "", file = null, action }: Turn) => {
      const trimmed = text.trim();
      setError(null);
      setPending({
        text: trimmed || (file ? "Here's my resume." : action === "hint" ? "Give me a hint" : "Start the next problem"),
        fileName: file?.name,
      });
      try {
        const body = new FormData();
        body.set("text", trimmed);
        if (file) body.set("file", file);
        if (action) body.set("action", action);
        const res = await fetch("/api/chat", { method: "POST", body });
        const data = (await res.json().catch(() => ({}))) as Partial<ChatResponse> & { error?: string };
        if (res.status === 401) {
          router.replace("/signup?next=/chat");
          throw new Error("Sign in again to keep going.");
        }
        if (!res.ok || !data.messages) throw new Error(data.error ?? "Something went wrong. Try again.");
        setMessages((prev) => [...prev, ...data.messages!]);
        if (data.stage) setStage(data.stage);
      } finally {
        setPending(null);
      }
    },
    [router],
  );

  async function send(turn: Turn) {
    if (pending) return;
    const { text = "", file = null, action } = turn;
    if (!text.trim() && !file && !action) return;
    setDraft("");
    setVerdict(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    try {
      await sendTurn(turn);
    } catch (e) {
      // Put their words back so nothing typed is lost.
      if (!action && !file) setDraft(text);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  function submitDraft() {
    const why = draft.trim();
    if (verdict) {
      const call = verdict === "ship" ? "Ship it" : "Skip it";
      void send({ text: why ? `${call}. ${why}` : call });
    } else {
      void send({ text: draft });
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submitDraft();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitDraft();
    }
  }

  function chooseVerdict(v: "ship" | "skip") {
    setVerdict(v);
    inputRef.current?.focus();
  }

  // Which card can still be used: the latest one of its kind, while the flow is at that step.
  const last = messages.at(-1);
  const lastChallengeId = [...messages].reverse().find((m) => m.meta.kind === "challenge")?.id;
  const isActive = (m: ChatMessage) => {
    if (pending) return false;
    if (m.meta.kind === "challenge") return stage === "challenge" && m.id === lastChallengeId;
    return m.id === last?.id;
  };
  const showStartChip =
    !pending && ((stage === "start" && last?.meta.kind !== "howto") || (stage === "result" && last?.meta.kind !== "progress"));

  return (
    <main className="flex h-dvh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Orb size={28} speaking={Boolean(pending)} />
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-[-0.01em]">{BRAND.name}</span>
            <span className="text-[12.5px] text-foreground-quaternary">with Rev, your AI code buddy</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/interview"
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            <span aria-hidden="true">🎯</span>
            <span className="hidden sm:inline">Practice interview</span>
            <span className="sm:hidden">Interview</span>
          </Link>
          <Link
            href="/profile"
            aria-label="Your profile"
            className="ml-1 flex size-9 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-background-secondary text-sm font-semibold text-foreground-secondary transition-shadow hover:ring-4 hover:ring-border"
          >
            {user.initial}
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-8 pt-10 sm:px-6">
          <RevMessage content={greeting}>
            <ChoicesCard
              choices={SITUATIONS}
              multi={false}
              active={messages.length === 0 && !pending}
              onSubmit={(t) => void send({ text: t })}
            />
          </RevMessage>

          {messages.map((m) =>
            m.role === "user" ? (
              <UserMessage key={m.id} fileName={"fileName" in m.meta ? m.meta.fileName : undefined}>
                {m.content}
              </UserMessage>
            ) : (
              <RevMessage key={m.id} content={m.content} tag={tagFor(m)}>
                {m.meta.kind === "choices" && (
                  <ChoicesCard
                    choices={m.meta.choices}
                    multi={m.meta.multi}
                    active={isActive(m)}
                    onSubmit={(t) => void send({ text: t })}
                  />
                )}
                {m.meta.kind === "resume" && (
                  <ResumeCard
                    active={isActive(m)}
                    onFile={(f) => void send({ file: f })}
                    onNone={() => void send({ text: NO_RESUME })}
                    onError={setError}
                  />
                )}
                {m.meta.kind === "howto" && <HowToCard active={isActive(m)} onStart={() => void send({ action: "next" })} />}
                {m.meta.kind === "challenge" && (
                  <ProblemCard
                    problem={m.meta.problem}
                    number={m.meta.number}
                    active={isActive(m)}
                    verdict={isActive(m) ? verdict : null}
                    onVerdict={chooseVerdict}
                    onHint={() => void send({ action: "hint" })}
                  />
                )}
                {m.meta.kind === "result" && <ResultCard result={m.meta.result} />}
                {m.meta.kind === "progress" && (
                  <ProgressCard progress={m.meta.progress} active={isActive(m)} onNext={() => void send({ action: "next" })} />
                )}
              </RevMessage>
            ),
          )}

          {pending && (
            <>
              <UserMessage fileName={pending.fileName}>{pending.text}</UserMessage>
              <div className="flex items-center gap-3 pl-1">
                <Orb size={28} speaking />
                <span className="text-[14px] text-foreground-quaternary">
                  {pending.fileName ? "Reading your resume…" : `${BRAND.tutor} is thinking…`}
                </span>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="self-center rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="mx-auto w-full max-w-[760px]">
          {showStartChip && (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                onClick={() => void send({ action: "next" })}
                className="rounded-full border border-border bg-background px-4 py-2 text-[14px] font-medium text-foreground-secondary shadow-xs transition-colors hover:bg-background-secondary"
              >
                {stage === "start" ? "Start a problem" : "Next problem →"}
              </button>
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className="rounded-3xl border border-border-strong bg-background p-2 shadow-[0_2px_12px_-4px_rgba(10,13,18,0.08)] focus-within:border-foreground-quaternary"
          >
            {verdict && stage === "challenge" && (
              <div className="m-1.5 mb-0 inline-flex items-center gap-2 rounded-full bg-primary py-1 pl-3 pr-1.5 text-[13px] font-medium text-white">
                Your call: {verdict === "ship" ? "🚢 Ship it" : "✋ Skip it"}
                <button
                  type="button"
                  aria-label="Change your call"
                  onClick={() => setVerdict(null)}
                  className="flex size-5 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={MAX_TEXT_CHARS}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
                }}
                onKeyDown={onKeyDown}
                placeholder={verdict ? "Why? Tell Rev what you checked…" : PLACEHOLDER[stage]}
                autoFocus
                className="block max-h-[180px] min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-[15.5px] outline-none placeholder:text-foreground-quaternary"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={Boolean(pending) || (!draft.trim() && !verdict)}
                className="mb-1 mr-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-25"
              >
                <SendIcon />
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

function tagFor(m: ChatMessage) {
  if (m.meta.kind === "nudge") return `Try ${m.meta.tries + 1} of ${m.meta.of}`;
  if (m.meta.kind === "hint") return "Hint · −1 point";
  return null;
}

function RevMessage({ content, tag = null, children }: { content: string; tag?: string | null; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <Orb size={30} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold">{BRAND.tutor}</span>
          {tag && (
            <span className="rounded-full bg-background-secondary px-2 py-0.5 text-[12px] font-medium text-foreground-tertiary ring-1 ring-border">
              {tag}
            </span>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-[16px] leading-[1.65] text-foreground">
          <RichText text={content} />
        </p>
        {children}
      </div>
    </div>
  );
}

function UserMessage({ fileName, children }: { fileName?: string; children: string }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      {fileName && (
        <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground-secondary shadow-xs">
          <FileIcon />
          <span className="max-w-[240px] truncate">{fileName}</span>
        </span>
      )}
      <p className={cn("max-w-[80%] whitespace-pre-wrap rounded-3xl bg-background-secondary px-4 py-2.5 text-[15.5px] leading-relaxed ring-1 ring-border/60")}>
        {children}
      </p>
    </div>
  );
}

// Rev's replies are plain text; `backticks` become inline code.
function RichText({ text }: { text: string }) {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
      <code key={i} className="rounded-md bg-background-secondary px-1.5 py-0.5 font-mono text-[0.88em] ring-1 ring-border">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-danger" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
