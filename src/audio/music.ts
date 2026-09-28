import { kotoPluck } from './synth';
import { SR } from './dsp';

/** Gammes pentatoniques japonaises (demi-tons). */
const YO = [0, 2, 5, 7, 9];
const IN = [0, 1, 5, 7, 8];

/** Musique générative douce : koto, piano feutré et nappes, sur une réverbération synthétique. */
export class GenerativeMusic {
  private readonly out: GainNode;
  private readonly reverb: ConvolverNode;
  private readonly dry: GainNode;
  private timer: ReturnType<typeof setInterval> | undefined;
  private nextNote = 0;
  private nextChord = 0;
  private degree = 2;
  private pad: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
  private readonly kotoCache = new Map<number, AudioBuffer>();
  /** Nuit : gamme « in », tempo plus lent. */
  night = false;
  root = 146.83; // Ré

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.dry = ctx.createGain();
    this.dry.gain.value = 0.55;
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    this.dry.connect(this.out);
    this.reverb.connect(wet).connect(this.out);
    this.out.connect(destination);
  }

  private impulse(seconds: number): AudioBuffer {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
    }
    return buf;
  }

  private freq(degree: number): number {
    const scale = this.night ? IN : YO;
    const oct = Math.floor(degree / scale.length);
    const idx = ((degree % scale.length) + scale.length) % scale.length;
    return this.root * Math.pow(2, oct + scale[idx]! / 12);
  }

  private send(node: AudioNode): void {
    node.connect(this.dry);
    node.connect(this.reverb);
  }

  private koto(f: number, when: number, vel: number): void {
    const key = Math.round(f);
    let buf = this.kotoCache.get(key);
    if (!buf) {
      const data = kotoPluck(f, 3.5, key);
      buf = this.ctx.createBuffer(1, data.length, SR);
      buf.getChannelData(0).set(data);
      this.kotoCache.set(key, buf);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.22 * vel;
    src.connect(g);
    this.send(g);
    src.start(when);
  }

  private piano(f: number, when: number, vel: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.12 * vel, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 4);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    for (const [mult, amp] of [
      [1, 1],
      [2, 0.35],
      [3, 0.12],
    ] as const) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      const og = this.ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(lp);
      o.start(when);
      o.stop(when + 4.2);
    }
    lp.connect(g);
    this.send(g);
  }

  private chord(when: number): void {
    const old = this.pad;
    if (old) {
      old.gain.gain.cancelScheduledValues(when);
      old.gain.gain.setValueAtTime(old.gain.gain.value, when);
      old.gain.gain.linearRampToValueAtTime(0, when + 6);
      old.oscs.forEach((o) => o.stop(when + 6.5));
    }
    const base = Math.floor(Math.random() * 3) * 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.045, when + 5);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const oscs = [0, 2, 4].flatMap((d) =>
      [-4, 4].map((det) => {
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = this.freq(base + d) / 2;
        o.detune.value = det;
        o.connect(lp);
        o.start(when);
        return o;
      }),
    );
    lp.connect(g);
    this.send(g);
    this.pad = { oscs, gain: g };
  }

  private schedule = (): void => {
    const now = this.ctx.currentTime;
    const horizon = now + 1.5;
    if (this.nextChord < horizon) {
      this.chord(Math.max(now, this.nextChord));
      this.nextChord = Math.max(now, this.nextChord) + 18 + Math.random() * 10;
    }
    while (this.nextNote < horizon) {
      const when = Math.max(now + 0.05, this.nextNote);
      // Marche aléatoire douce sur la gamme, avec silences
      if (Math.random() > 0.18) {
        this.degree = Math.max(3, Math.min(12, this.degree + Math.floor(Math.random() * 5) - 2));
        const vel = 0.6 + Math.random() * 0.4;
        if (Math.random() < 0.6) this.koto(this.freq(this.degree), when, vel);
        else this.piano(this.freq(this.degree), when, vel);
        if (Math.random() < 0.2) this.koto(this.freq(this.degree + 2), when + 0.18, vel * 0.7);
      }
      this.nextNote = when + (this.night ? 2.2 : 1.4) + Math.random() * (this.night ? 3 : 2.2);
    }
  };

  start(): void {
    if (this.timer) return;
    this.nextNote = this.ctx.currentTime + 1;
    this.nextChord = this.ctx.currentTime;
    this.timer = setInterval(this.schedule, 400);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.pad?.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 3);
    this.pad = null;
  }

  setVolume(v: number, seconds = 2): void {
    const g = this.out.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(v, this.ctx.currentTime + seconds);
  }
}
