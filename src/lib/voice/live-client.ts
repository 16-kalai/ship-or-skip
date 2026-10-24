"use client";

import {
  FunctionResponseScheduling,
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai";

// Tools that are bookkeeping only; the model shouldn't wait on them (see lib/voice/live.ts).
const DEFAULT_NON_BLOCKING = ["update_profile"];
const DEFAULT_KICKOFF = "[The learner just switched to voice. Continue from where the conversation is, briefly.]";

export type LiveVoiceCallbacks = {
  onStatus: (status: "connecting" | "live" | "ended") => void;
  onSpeaking: (speaking: boolean) => void;
  // Words as they're recognised, for live captions.
  onCaption: (who: "user" | "rev", text: string) => void;
  // A finished turn: the learner's words once Rev starts answering, Rev's once Rev finishes.
  onTurn: (who: "user" | "rev", text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onError: (message: string) => void;
  // What Rev is told when the call connects, so it speaks first.
  kickoff?: string;
  // Tool names whose answers shouldn't interrupt the conversation.
  nonBlocking?: string[];
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

/**
 * One live voice conversation with Rev over Gemini Live (the Truvet pattern): the server mints
 * a locked single-use token, the browser streams 16 kHz mic audio straight to Gemini and plays
 * back 24 kHz speech, with captions, interruptions and tool calls.
 */
export class LiveVoice {
  private session: Session | null = null;
  private micStream: MediaStream | null = null;
  private micContext: AudioContext | null = null;
  private playContext: AudioContext | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextPlayTime = 0;
  private revTurnStarted = false;
  private userText = "";
  private revText = "";
  private ended = false;
  private muted = false;
  private readonly nonBlocking: Set<string>;

  constructor(private readonly cb: LiveVoiceCallbacks) {
    this.nonBlocking = new Set(cb.nonBlocking ?? DEFAULT_NON_BLOCKING);
  }

  // Stops sending the mic to Gemini without ending the call.
  setMuted(muted: boolean) {
    this.muted = muted;
  }

  // A text note to the model mid-call, e.g. a [clock] reminder.
  note(text: string) {
    this.session?.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
  }

  // Call from a click: browsers only allow audio and the mic after a user gesture.
  async start(fetchToken: () => Promise<{ token: string; model: string }>) {
    this.cb.onStatus("connecting");
    try {
      // Create audio contexts inside the gesture, before any await.
      this.playContext = new AudioContext({ sampleRate: 24000 });
      this.micContext = new AudioContext();
      const [{ token, model }, stream] = await Promise.all([
        fetchToken(),
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        }),
      ]);
      this.micStream = stream;
      if (this.ended) return this.stop();

      await this.micContext.audioWorklet.addModule("/worklets/pcm-capture.js");
      const node = new AudioWorkletNode(this.micContext, "pcm-capture");
      node.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer }>) => {
        if (this.muted) return;
        this.session?.sendRealtimeInput({
          audio: { data: toBase64(new Uint8Array(event.data.pcm)), mimeType: "audio/pcm;rate=16000" },
        });
      };
      this.micContext.createMediaStreamSource(stream).connect(node);

      // Short-lived tokens are served from the v1alpha API surface.
      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });
      this.session = await ai.live.connect({
        model,
        // The token locks the real configuration on the server; this is ignored.
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onmessage: (message) => this.onMessage(message),
          onerror: (e) => {
            console.error("[voice] error", e);
            this.cb.onError("Voice dropped. Tap the mic to try again, or type.");
          },
          onclose: () => {
            if (!this.ended) this.stop();
          },
        },
      });
      this.cb.onStatus("live");
      // Rev speaks first, picking up wherever the conversation is.
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: this.cb.kickoff ?? DEFAULT_KICKOFF }] }],
        turnComplete: true,
      });
    } catch (e) {
      const denied = e instanceof DOMException && e.name === "NotAllowedError";
      this.cb.onError(
        denied
          ? "Microphone access is blocked. Allow it from the icon in the address bar, then tap the mic again."
          : e instanceof Error
            ? e.message
            : "Voice couldn't start. Type instead.",
      );
      this.stop();
    }
  }

  stop() {
    if (this.ended) return;
    this.ended = true;
    this.flushUser();
    this.flushRev();
    try {
      this.session?.close();
    } catch {}
    this.session = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    void this.micContext?.close().catch(() => {});
    void this.playContext?.close().catch(() => {});
    this.sources.clear();
    this.cb.onSpeaking(false);
    this.cb.onStatus("ended");
  }

  private onMessage(message: LiveServerMessage) {
    const content = message.serverContent;

    // The learner talked over Rev: stop speaking at once.
    if (content?.interrupted) {
      this.stopPlayback();
      this.revTurnStarted = false;
      this.flushRev();
    }

    for (const part of content?.modelTurn?.parts ?? []) {
      if (!part.inlineData?.data) continue;
      if (!this.revTurnStarted) {
        // Rev started answering, so the learner's turn is over.
        this.revTurnStarted = true;
        this.flushUser();
      }
      this.play(part.inlineData.data, part.inlineData.mimeType ?? "audio/pcm;rate=24000");
    }

    const heard = content?.inputTranscription?.text;
    if (heard) {
      this.userText += heard;
      this.cb.onCaption("user", this.userText);
    }
    const said = content?.outputTranscription?.text;
    if (said) {
      this.revText += said;
      this.cb.onCaption("rev", this.revText);
    }

    if (content?.turnComplete) {
      this.revTurnStarted = false;
      this.flushRev();
    }

    if (message.toolCall?.functionCalls?.length) void this.answerTools(message);

    // A connection lasts about 10 minutes; end cleanly so the learner can tap the mic again.
    if (message.goAway) this.cb.onError("Voice sessions last about 10 minutes. Tap the mic to keep talking.");
  }

  private async answerTools(message: LiveServerMessage) {
    const calls = message.toolCall?.functionCalls ?? [];
    // Anything Rev said before the call is a finished turn.
    this.flushUser();
    const functionResponses = await Promise.all(
      calls.map(async (call) => {
        const name = call.name ?? "unknown";
        let response: Record<string, unknown>;
        try {
          response = await this.cb.onToolCall(name, (call.args ?? {}) as Record<string, unknown>);
        } catch {
          response = { error: "Something went wrong on our side." };
        }
        return {
          id: call.id,
          name,
          response,
          // Bookkeeping answers don't interrupt; the model reads them once it's idle.
          ...(this.nonBlocking.has(name) && { scheduling: FunctionResponseScheduling.WHEN_IDLE }),
        };
      }),
    );
    if (!this.ended) this.session?.sendToolResponse({ functionResponses });
  }

  private play(base64: string, mimeType: string) {
    const ctx = this.playContext;
    if (!ctx) return;
    const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
    const pcm = fromBase64(base64);
    const buffer = ctx.createBuffer(1, pcm.length, rate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    // Queue chunks back to back so speech has no gaps.
    const startAt = Math.max(this.nextPlayTime, ctx.currentTime + 0.02);
    source.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;
    this.sources.add(source);
    this.cb.onSpeaking(true);
    source.onended = () => {
      this.sources.delete(source);
      if (this.sources.size === 0) this.cb.onSpeaking(false);
    };
  }

  private stopPlayback() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
    }
    this.sources.clear();
    this.nextPlayTime = 0;
    this.cb.onSpeaking(false);
  }

  private flushUser() {
    const text = this.userText.trim();
    this.userText = "";
    if (text) this.cb.onTurn("user", text);
  }

  private flushRev() {
    const text = this.revText.trim();
    this.revText = "";
    if (text) this.cb.onTurn("rev", text);
  }
}
