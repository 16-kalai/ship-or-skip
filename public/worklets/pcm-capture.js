// Captures microphone audio, resamples it to 16 kHz mono 16-bit PCM (what Gemini Live
// expects) and posts 100 ms chunks, with their loudness, to the main thread.
const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 1600; // 100 ms

class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE;
    this.pos = 0;
    this.last = 0;
    this.out = new Int16Array(CHUNK_SAMPLES);
    this.count = 0;
    this.energy = 0;
  }

  push(value) {
    const clamped = Math.max(-1, Math.min(1, value));
    this.out[this.count++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    this.energy += clamped * clamped;
    if (this.count === CHUNK_SAMPLES) {
      const rms = Math.sqrt(this.energy / CHUNK_SAMPLES);
      const pcm = this.out.slice(0);
      this.port.postMessage({ pcm: pcm.buffer, rms }, [pcm.buffer]);
      this.count = 0;
      this.energy = 0;
    }
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    const len = channel.length;
    // Linear interpolation; `pos` may be -1..0 to use the last sample of the previous block.
    for (;;) {
      const i = Math.floor(this.pos);
      if (i + 1 >= len) break;
      const s0 = i < 0 ? this.last : channel[i];
      const s1 = channel[i + 1];
      this.push(s0 + (s1 - s0) * (this.pos - i));
      this.pos += this.ratio;
    }
    this.pos -= len;
    this.last = channel[len - 1];
    return true;
  }
}

registerProcessor("pcm-capture", PcmCapture);
