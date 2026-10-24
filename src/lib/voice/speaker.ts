"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";

// Close the Gemini connection after this much silence: concurrent Live sessions are limited,
// so a learner reading code shouldn't hold one open.
const IDLE_CLOSE_MS = 20_000;

function fromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

/**
 * Rev's speaking voice. Reads Rev's chat messages aloud with the Gemini Live model: connects on
 * demand with a server-minted token, plays the 24 kHz audio gap-free, and disconnects when idle.
 * A newer message cuts off the one being spoken. If Live isn't available, the browser's own
 * voice reads it instead.
 */
export class RevSpeaker {
  private ctx: AudioContext | null = null;
  private session: Session | null = null;
  private connecting: Promise<Session | null> | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextPlayTime = 0;
  // Audio from a cut-off message is ignored until Gemini finishes that turn.
  private skipTurns = 0;
  private busy = false;
  private queued: string | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private liveFailed = false;

  constructor(private readonly onSpeaking: (speaking: boolean) => void) {}

  // Call from a click or key press: browsers only start audio after a user gesture.
  unlock() {
    this.ctx ??= new AudioContext({ sampleRate: 24000 });
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  speak(text: string) {
    const clean = text.replace(/`/g, "").trim();
    if (!clean) return;
    this.stopAudio();
    if (this.liveFailed) return this.speakWithBrowser(clean);
    if (this.busy) {
      // Cut off the current message; say this one once Gemini finishes the old turn.
      this.skipTurns++;
      this.queued = clean;
      return;
    }
    void this.send(clean);
  }

  stop() {
    this.stopAudio();
    if (this.busy) this.skipTurns++;
    this.queued = null;
    window.speechSynthesis?.cancel();
  }

  dispose() {
    this.stop();
    this.closeSession();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private async send(text: string) {
    this.busy = true;
    this.clearIdle();
    const session = await this.ensureSession();
    if (!session) {
      this.busy = false;
      return this.speakWithBrowser(text);
    }
    session.sendClientContent({ turns: [{ role: "user", parts: [{ text: `[SAY]${text}[/SAY]` }] }], turnComplete: true });
  }

  private ensureSession(): Promise<Session | null> {
    if (this.session) return Promise.resolve(this.session);
    this.connecting ??= (async () => {
      try {
        const res = await fetch("/api/voice/speak-token", { method: "POST" });
        if (!res.ok) throw new Error(`token ${res.status}`);
        const { token, model } = (await res.json()) as { token: string; model: string };
        // Short-lived tokens are served from the v1alpha API surface.
        const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });
        this.session = await ai.live.connect({
          model,
          // The token locks the real configuration on the server; this is ignored.
          config: { responseModalities: [Modality.AUDIO] },
          callbacks: {
            onmessage: (m) => this.onMessage(m),
            onerror: (e) => console.error("[speaker]", e),
            onclose: () => {
              this.session = null;
              this.busy = false;
            },
          },
        });
        return this.session;
      } catch (e) {
        console.error("[speaker] falling back to the browser voice", e);
        this.liveFailed = true;
        return null;
      } finally {
        this.connecting = null;
      }
    })();
    return this.connecting;
  }

  private onMessage(message: LiveServerMessage) {
    const content = message.serverContent;
    if (this.skipTurns === 0) {
      for (const part of content?.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) this.play(part.inlineData.data, part.inlineData.mimeType ?? "audio/pcm;rate=24000");
      }
    }
    if (content?.turnComplete) {
      if (this.skipTurns > 0) this.skipTurns--;
      this.busy = false;
      if (this.queued && this.skipTurns === 0) {
        const next = this.queued;
        this.queued = null;
        void this.send(next);
      } else {
        this.scheduleIdleClose();
      }
    }
  }

  private play(base64: string, mimeType: string) {
    this.unlock();
    const ctx = this.ctx!;
    const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
    const pcm = fromBase64(base64);
    const buffer = ctx.createBuffer(1, pcm.length, rate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(this.nextPlayTime, ctx.currentTime + 0.02);
    source.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;
    this.sources.add(source);
    this.onSpeaking(true);
    source.onended = () => {
      this.sources.delete(source);
      if (this.sources.size === 0) this.onSpeaking(false);
    };
  }

  private stopAudio() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
    }
    this.sources.clear();
    this.nextPlayTime = 0;
    this.onSpeaking(false);
    window.speechSynthesis?.cancel();
  }

  private speakWithBrowser(text: string) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1.05;
    utterance.onstart = () => this.onSpeaking(true);
    utterance.onend = () => this.onSpeaking(false);
    synth.speak(utterance);
  }

  private scheduleIdleClose() {
    this.clearIdle();
    this.idleTimer = setTimeout(() => this.closeSession(), IDLE_CLOSE_MS);
  }

  private clearIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private closeSession() {
    this.clearIdle();
    try {
      this.session?.close();
    } catch {}
    this.session = null;
    this.busy = false;
    this.skipTurns = 0;
  }
}
