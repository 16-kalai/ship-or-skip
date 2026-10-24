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
import { LiveVoice } from "@/lib/voice/live-client";
import { PushToTalk } from "@/lib/voice/recorder";
import { RevSpeaker } from "@/lib/voice/speaker";

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

  // Rev's voice: reads Rev's messages aloud (Gemini Live), unless switched off.
  const [voiceOn, setVoiceOn] = useState(true);
  const [revSpeaking, setRevSpeaking] = useState(false);
  const speakerRef = useRef<RevSpeaker | null>(null);
  const greetedRef = useRef(false);

  // Push-to-talk: record, transcribe, edit, send.
  const [rec, setRec] = useState<"idle" | "recording" | "transcribing">("idle");
  const [level, setLevel] = useState(0);
  const recorderRef = useRef<PushToTalk | null>(null);

  // Optional live call (Gemini Live with tools).
  const [callStatus, setCallStatus] = useState<"off" | "connecting" | "live">("off");
  const [captions, setCaptions] = useState({ user: "", rev: "" });
  const [toolBusy, setToolBusy] = useState(false);
  const callRef = useRef<LiveVoice | null>(null);
  const inCall = callStatus !== "off";

  useEffect(() => {
    speakerRef.current = new RevSpeaker(setRevSpeaking);
    return () => {
      speakerRef.current?.dispose();
      callRef.current?.stop();
      recorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, error, captions]);

  function say(text: string) {
    if (voiceOn && !inCall) speakerRef.current?.speak(text);
  }

  // The greeting can only be spoken after the first click or key press (browser rule).
  function onFirstGesture() {
    speakerRef.current?.unlock();
    if (!greetedRef.current && messages.length === 0) {
      greetedRef.current = true;
      say(greeting);
    }
  }

  // One turn, typed, tapped or dictated. Resolves with Rev's reply text; throws a friendly message.
  const sendTurn = useCallback(
    async ({ text = "", file = null, action }: Turn): Promise<string> => {
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
        return data.messages
          .filter((m) => m.role === "rev")
          .map((m) => m.content)
          .join(" ");
      } finally {
        setPending(null);
      }
    },
    [router],
  );

  async function send(turn: Turn) {
    if (pending || rec !== "idle") return;
    const { text = "", file = null, action } = turn;
    if (!text.trim() && !file && !action) return;
    speakerRef.current?.unlock();
    speakerRef.current?.stop();
    setDraft("");
    setVerdict(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    try {
      say(await sendTurn(turn));
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
    speakerRef.current?.unlock();
    setVerdict(v);
    inputRef.current?.focus();
  }

  async function toggleRecording() {
    if (rec === "transcribing" || inCall) return;
    if (rec === "recording") return void finishRecording();
    setError(null);
    speakerRef.current?.stop();
    const recorder = new PushToTalk(setLevel, () => void finishRecording());
    recorderRef.current = recorder;
    try {
      await recorder.start();
      setRec("recording");
    } catch (e) {
      recorderRef.current = null;
      const denied = e instanceof DOMException && e.name === "NotAllowedError";
      setError(denied ? "Microphone access is blocked. Allow it from the address bar, then try again." : "Couldn't start the mic.");
    }
  }

  async function finishRecording() {
    const clip = recorderRef.current?.stop() ?? null;
    recorderRef.current = null;
    setLevel(0);
    if (!clip) return setRec("idle");
    setRec("transcribing");
    try {
      const body = new FormData();
      body.set("audio", clip, "clip.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't hear that. Try again or type.");
      if (data.text) setDraft((d) => (d ? `${d} ${data.text}` : data.text!));
      else setError("I didn't catch anything. Try again a little closer to the mic.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't hear that. Try again or type.");
    } finally {
      setRec("idle");
      inputRef.current?.focus();
    }
  }

  function cancelRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setLevel(0);
    setRec("idle");
  }

  // Live call: Gemini Live hears and speaks; its tools run on our server.
  function addSpokenTurn(role: "user" | "rev", content: string) {
    setCaptions((c) => ({ ...c, [role]: "" }));
    setMessages((prev) => [
      ...prev,
      { id: `voice-${Date.now()}-${role}`, role, content, meta: { via: "voice" }, created_at: new Date().toISOString() },
    ]);
    void fetch("/api/voice/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, content }),
    }).catch((e) => console.error("[voice/log]", e));
  }

  async function runTool(name: string, args: Record<string, unknown>) {
    setToolBusy(true);
    try {
      const res = await fetch("/api/voice/tool", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, args }),
      });
      const data = (await res.json().catch(() => ({}))) as { result?: Record<string, unknown>; messages?: ChatMessage[]; stage?: Stage };
      if (data.messages?.length) setMessages((prev) => [...prev, ...data.messages!]);
      if (data.stage) setStage(data.stage);
      return data.result ?? { error: "Something went wrong on our side." };
    } finally {
      setToolBusy(false);
    }
  }

  function startCall() {
    if (inCall || pending) return;
    setError(null);
    speakerRef.current?.stop();
    const call = new LiveVoice({
      onStatus: (status) => {
        setCallStatus(status === "ended" ? "off" : status);
        if (status === "ended") {
          callRef.current = null;
          setCaptions({ user: "", rev: "" });
        }
      },
      onSpeaking: setRevSpeaking,
      onCaption: (who, text) => setCaptions((c) => ({ ...c, [who]: text })),
      onTurn: addSpokenTurn,
      onToolCall: runTool,
      onError: setError,
    });
    callRef.current = call;
    void call.start(async () => {
      const res = await fetch("/api/voice/token", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { token?: string; model?: string; error?: string };
      if (!res.ok || !data.token || !data.model) throw new Error(data.error ?? "Voice is busy right now. Type instead.");
      return { token: data.token, model: data.model };
    });
  }

  // Which card can still be used: the latest one of its kind, while the flow is at that step.
  const last = messages.at(-1);
  const lastChallengeId = [...messages].reverse().find((m) => m.meta.kind === "challenge")?.id;
  const isActive = (m: ChatMessage) => {
    if (pending || inCall) return false;
    if (m.meta.kind === "challenge") return stage === "challenge" && m.id === lastChallengeId;
    return m.id === last?.id;
  };
  const showStartChip =
    !pending &&
    !inCall &&
    ((stage === "start" && last?.meta.kind !== "howto") || (stage === "result" && last?.meta.kind !== "progress"));

  return (
    <main className="flex h-dvh flex-col bg-background" onPointerDownCapture={onFirstGesture} onKeyDownCapture={onFirstGesture}>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Orb size={28} speaking={revSpeaking} />
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-[-0.01em]">{BRAND.name}</span>
            <span className="text-[12.5px] text-foreground-quaternary">
              {inCall
                ? callStatus === "connecting"
                  ? "Calling Rev…"
                  : "On a call with Rev"
                : revSpeaking
                  ? "Rev is speaking…"
                  : "with Rev, your AI code buddy"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HeaderButton
            label={voiceOn ? "Rev's voice is on" : "Rev's voice is off"}
            onClick={() => {
              speakerRef.current?.unlock();
              if (voiceOn) speakerRef.current?.stop();
              setVoiceOn(!voiceOn);
            }}
          >
            {voiceOn ? <SpeakerIcon /> : <MutedIcon />}
            <span className="hidden sm:inline">{voiceOn ? "Voice on" : "Voice off"}</span>
          </HeaderButton>
          <Link
            href="/interview"
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            <span aria-hidden="true">🎯</span>
            <span className="hidden sm:inline">Practice interview</span>
            <span className="sm:hidden">Interview</span>
          </Link>
          <HeaderButton label="Call Rev (live voice)" onClick={inCall ? () => callRef.current?.stop() : startCall}>
            <PhoneIcon />
            <span className="hidden sm:inline">{inCall ? "End call" : "Call Rev"}</span>
          </HeaderButton>
          <Link
            href="/profile"
            aria-label="Your profile"
            className="ml-1 flex size-9 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-background-secondary text-sm font-semibold text-foreground-secondary transition-shadow hover:ring-4 hover:ring-border"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              user.initial
            )}
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-8 pt-10 sm:px-6">
          <RevMessage content={greeting}>
            <ChoicesCard
              choices={SITUATIONS}
              multi={false}
              active={messages.length === 0 && !pending && !inCall}
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

          {captions.user && <UserMessage live>{captions.user}</UserMessage>}
          {captions.rev && <RevMessage content={captions.rev} live />}
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

          {inCall ? (
            <CallBar
              connecting={callStatus === "connecting"}
              speaking={revSpeaking}
              thinking={toolBusy}
              onEnd={() => callRef.current?.stop()}
            />
          ) : (
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
              {rec === "recording" ? (
                <div className="flex h-12 items-center gap-3 px-3">
                  <span className="size-2.5 animate-pulse rounded-full bg-danger" />
                  <div className="flex h-6 flex-1 items-center gap-[3px]" aria-hidden="true">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-[3px] rounded-full bg-foreground-quaternary transition-all duration-100"
                        style={{ height: `${Math.max(12, Math.min(100, level * 900 * (0.5 + ((i * 7) % 10) / 10)))}%` }}
                      />
                    ))}
                  </div>
                  <span className="text-[13px] text-foreground-tertiary">Listening…</span>
                </div>
              ) : (
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
                  placeholder={
                    rec === "transcribing"
                      ? "Turning your voice into text…"
                      : verdict
                        ? "Why? Tell Rev what you checked…"
                        : PLACEHOLDER[stage]
                  }
                  autoFocus
                  className="block max-h-[180px] min-h-12 w-full resize-none bg-transparent px-3 py-3 text-[15.5px] outline-none placeholder:text-foreground-quaternary"
                />
              )}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                  {rec === "recording" ? (
                    <ComposerButton label="Cancel recording" onClick={cancelRecording}>
                      <span className="text-[13px] font-medium">Cancel</span>
                    </ComposerButton>
                  ) : (
                    <ComposerButton
                      label="Speak instead of typing"
                      onClick={() => void toggleRecording()}
                      disabled={rec === "transcribing" || Boolean(pending)}
                    >
                      <MicIcon />
                      <span className="text-[13px] font-medium">{rec === "transcribing" ? "Transcribing…" : "Speak"}</span>
                    </ComposerButton>
                  )}
                </div>
                {rec === "recording" ? (
                  <button
                    type="button"
                    onClick={() => void finishRecording()}
                    className="flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-hover"
                  >
                    <span className="size-2.5 rounded-sm bg-white" /> Done
                  </button>
                ) : (
                  <button
                    type="submit"
                    aria-label="Send"
                    disabled={Boolean(pending) || rec !== "idle" || (!draft.trim() && !verdict)}
                    className="flex size-10 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-25"
                  >
                    <SendIcon />
                  </button>
                )}
              </div>
            </form>
          )}
          <p className="mt-2.5 text-center text-[12px] text-foreground-quaternary">
            {BRAND.tutor} speaks with Gemini Live. Type, tap, or press Speak to answer.
          </p>
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

// While on a call: the orb, what Rev is doing, and a way out.
function CallBar({
  connecting,
  speaking,
  thinking,
  onEnd,
}: {
  connecting: boolean;
  speaking: boolean;
  thinking: boolean;
  onEnd: () => void;
}) {
  const status = connecting
    ? "Connecting…"
    : thinking
      ? `${BRAND.tutor} is checking…`
      : speaking
        ? `${BRAND.tutor} is speaking`
        : "Listening… just talk";
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-primary px-4 py-3 text-white">
      <Orb size={40} speaking={speaking || thinking} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">On a call with {BRAND.tutor}</span>
        <span className="truncate text-[13.5px] text-white/65">{status}</span>
      </div>
      <button type="button" onClick={onEnd} className="rounded-full bg-[#d92d20] px-4 py-2 text-[14px] font-semibold hover:bg-[#b42318]">
        End call
      </button>
    </div>
  );
}

function RevMessage({
  content,
  tag = null,
  live = false,
  children,
}: {
  content: string;
  tag?: string | null;
  // A caption still being spoken on a call.
  live?: boolean;
  children?: React.ReactNode;
}) {
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
        <p className={cn("mt-1 whitespace-pre-wrap text-[16px] leading-[1.65]", live ? "text-foreground-tertiary" : "text-foreground")}>
          <RichText text={content} />
        </p>
        {children}
      </div>
    </div>
  );
}

function UserMessage({ fileName, live = false, children }: { fileName?: string; live?: boolean; children: string }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      {fileName && (
        <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground-secondary shadow-xs">
          <FileIcon />
          <span className="max-w-[240px] truncate">{fileName}</span>
        </span>
      )}
      <p
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-3xl bg-background-secondary px-4 py-2.5 text-[15.5px] leading-relaxed ring-1 ring-border/60",
          live && "opacity-60",
        )}
      >
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

function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 items-center gap-2 rounded-full border border-border px-3 text-[13.5px] font-medium text-foreground-secondary transition-colors hover:bg-background-secondary"
    >
      {children}
    </button>
  );
}

function ComposerButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 items-center gap-2 rounded-full px-3 text-foreground-tertiary transition-colors hover:bg-background-secondary hover:text-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="m22 9-6 6M16 9l6 6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" />
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
