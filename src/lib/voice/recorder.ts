"use client";

const SAMPLE_RATE = 16000;
const MAX_SECONDS = 60;

// 16-bit mono PCM to a WAV file.
function toWav(chunks: Int16Array[]) {
  const samples = chunks.reduce((n, c) => n + c.length, 0);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++, offset += 2) view.setInt16(offset, chunk[i], true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Push-to-talk: records the mic locally (16 kHz, via the same worklet as voice calls) until
 * stopped or a minute passes, then hands back a WAV. Nothing is sent while recording.
 */
export class PushToTalk {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private chunks: Int16Array[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onLevel: (rms: number) => void,
    private readonly onAutoStop: () => void,
  ) {}

  async start() {
    this.chunks = [];
    this.ctx = new AudioContext();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    await this.ctx.audioWorklet.addModule("/worklets/pcm-capture.js");
    const node = new AudioWorkletNode(this.ctx, "pcm-capture");
    node.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => {
      this.chunks.push(new Int16Array(event.data.pcm));
      this.onLevel(event.data.rms);
    };
    this.ctx.createMediaStreamSource(this.stream).connect(node);
    this.timer = setTimeout(() => this.onAutoStop(), MAX_SECONDS * 1000);
  }

  // Stops recording and returns the clip (null if nothing was captured).
  stop(): Blob | null {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
    // Under half a second is a mis-tap.
    const samples = this.chunks.reduce((n, c) => n + c.length, 0);
    const clip = samples > SAMPLE_RATE / 2 ? toWav(this.chunks) : null;
    this.chunks = [];
    return clip;
  }
}
