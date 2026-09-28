import { Biquad, brownNoise, makeLoop, mulberry32, normalize, pinkNoise, SR } from './dsp';

/** Sons d'ambiance entièrement synthétisés (aucun fichier audio sous licence). */
export type AmbientId =
  'rain' | 'wind' | 'water' | 'birds' | 'crickets' | 'frogs' | 'cicadas' | 'stream';

const len = (s: number) => new Float32Array(Math.floor(s * SR));

function rain(): Float32Array {
  const rng = mulberry32(1);
  const out = len(9);
  const pink = pinkNoise(rng);
  const hp = new Biquad('highpass', 700);
  const lp = new Biquad('lowpass', 6500);
  const dropBp = new Biquad('bandpass', 3200, 1.2);
  let drop = 0;
  for (let i = 0; i < out.length; i++) {
    if (rng() < 90 / SR) drop = 0.6 + rng() * 0.6;
    drop *= 0.994;
    const d = dropBp.process((rng() * 2 - 1) * drop);
    out[i] = lp.process(hp.process(pink())) * 0.7 + d * 0.8;
  }
  return normalize(makeLoop(out), 0.7);
}

function wind(): Float32Array {
  const rng = mulberry32(2);
  const out = len(12);
  const brown = brownNoise(rng);
  const bp = new Biquad('bandpass', 400, 0.8);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const gust = 0.55 + 0.45 * Math.sin(t * 0.55) * Math.sin(t * 0.21 + 1);
    if (i % 64 === 0) bp.set('bandpass', 280 + 260 * gust, 0.9);
    out[i] = bp.process(brown()) * gust;
  }
  return normalize(makeLoop(out, 1.2), 0.7);
}

function water(): Float32Array {
  const rng = mulberry32(3);
  const out = len(10);
  const brown = brownNoise(rng);
  const lp = new Biquad('lowpass', 520);
  let plop = 0;
  let f = 0;
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const am = 0.5 + 0.5 * Math.sin(t * 2.1) * Math.sin(t * 0.7 + 2);
    if (rng() < 0.7 / SR) {
      plop = 0.5 + rng() * 0.4;
      f = 350 + rng() * 350;
    }
    plop *= 0.9985;
    f *= 0.99985;
    ph += (2 * Math.PI * f) / SR;
    out[i] = lp.process(brown()) * (0.35 + am * 0.65) + Math.sin(ph) * plop * 0.35;
  }
  return normalize(makeLoop(out, 1), 0.6);
}

function birds(): Float32Array {
  const rng = mulberry32(4);
  const out = len(16);
  const lp = new Biquad('lowpass', 7000);
  let i = Math.floor(SR * 0.5);
  while (i < out.length - SR) {
    const species = Math.floor(rng() * 3);
    const notes = 3 + Math.floor(rng() * 5);
    const base = 2400 + rng() * 1800;
    for (let n = 0; n < notes; n++) {
      const dur = Math.floor(SR * (species === 2 ? 0.18 : 0.06 + rng() * 0.07));
      const f0 = base * (species === 1 ? 1 + n * 0.08 : 1 + (rng() - 0.5) * 0.3);
      const f1 = f0 * (species === 0 ? 1.5 : species === 1 ? 0.8 : 1.15);
      let ph = 0;
      for (let k = 0; k < dur && i + k < out.length; k++) {
        const t = k / dur;
        const env = Math.sin(Math.PI * t) ** 2;
        const f = f0 + (f1 - f0) * t + Math.sin(k * 0.02) * 60;
        ph += (2 * Math.PI * f) / SR;
        out[i + k] = out[i + k]! + Math.sin(ph) * env * 0.5;
      }
      i += dur + Math.floor(SR * (0.03 + rng() * 0.08));
    }
    i += Math.floor(SR * (0.8 + rng() * 2.4));
  }
  for (let k = 0; k < out.length; k++) out[k] = lp.process(out[k]!);
  return normalize(out, 0.55);
}

function crickets(): Float32Array {
  const rng = mulberry32(5);
  const out = len(8);
  for (const c of [
    { f: 4300, period: 0.62, phase: 0.1, amp: 0.5 },
    { f: 4650, period: 0.81, phase: 0.33, amp: 0.35 },
    { f: 3900, period: 0.97, phase: 0.6, amp: 0.25 },
  ]) {
    for (let i = 0; i < out.length; i++) {
      const t = i / SR + c.phase;
      const inChirp = t % c.period;
      const pulse = Math.floor(inChirp / 0.03);
      if (pulse < 4 && inChirp % 0.03 < 0.02) {
        const e = Math.sin(((inChirp % 0.03) / 0.02) * Math.PI);
        out[i] = out[i]! + Math.sin(2 * Math.PI * c.f * t) * e * c.amp;
      }
    }
  }
  void rng;
  return normalize(out, 0.5);
}

function frogs(): Float32Array {
  const rng = mulberry32(6);
  const out = len(10);
  const bp = new Biquad('bandpass', 600, 2);
  let i = Math.floor(SR * 0.3);
  while (i < out.length - SR) {
    const f = 95 + rng() * 60;
    const dur = Math.floor(SR * (0.15 + rng() * 0.2));
    for (let k = 0; k < dur; k++) {
      const t = k / SR;
      const saw = ((t * f) % 1) * 2 - 1;
      const am = 0.5 + 0.5 * Math.sin(2 * Math.PI * 28 * t);
      const env = Math.sin((k / dur) * Math.PI);
      out[i + k] = out[i + k]! + saw * am * env;
    }
    i += dur + Math.floor(SR * (0.25 + rng() * (rng() < 0.3 ? 2.5 : 0.6)));
  }
  for (let k = 0; k < out.length; k++) out[k] = bp.process(out[k]!);
  return normalize(out, 0.6);
}

function cicadas(): Float32Array {
  const rng = mulberry32(7);
  const out = len(8);
  const bp = new Biquad('bandpass', 5800, 3);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const swell = 0.4 + 0.6 * Math.sin(t * 0.78) ** 2;
    const am = 0.5 + 0.5 * Math.sin(2 * Math.PI * 62 * t);
    out[i] = bp.process(rng() * 2 - 1) * am * swell;
  }
  return normalize(makeLoop(out, 1), 0.45);
}

function stream(): Float32Array {
  const rng = mulberry32(8);
  const out = len(8);
  const bp = new Biquad('bandpass', 1600, 0.6);
  const lp = new Biquad('lowpass', 900);
  let g = 0;
  let f = 0;
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    if (rng() < 12 / SR) {
      g = 0.3 + rng() * 0.3;
      f = 500 + rng() * 900;
    }
    g *= 0.997;
    f *= 1.0001;
    ph += (2 * Math.PI * f) / SR;
    out[i] = bp.process(rng() * 2 - 1) * 0.6 + lp.process(Math.sin(ph) * g);
  }
  return normalize(makeLoop(out, 0.8), 0.6);
}

export const AMBIENT_SYNTH: Record<AmbientId, () => Float32Array> = {
  rain,
  wind,
  water,
  birds,
  crickets,
  frogs,
  cicadas,
  stream,
};

/* ───────── Effets ponctuels ───────── */

export type SfxId = 'touch' | 'feed' | 'rake' | 'harvest' | 'bell' | 'soft' | 'thunder';

function env(n: number, attack: number, decay: number): (i: number) => number {
  const a = Math.max(1, Math.floor(attack * SR));
  return (i) => (i < a ? i / a : Math.exp(-(i - a) / (decay * SR)));
  void n;
}

export const SFX_SYNTH: Record<SfxId, () => Float32Array> = {
  touch: () => {
    const out = len(0.35);
    const e = env(out.length, 0.004, 0.08);
    let ph = 0;
    for (let i = 0; i < out.length; i++) {
      const f = 900 * Math.exp(-i / (SR * 0.06)) + 280;
      ph += (2 * Math.PI * f) / SR;
      out[i] = Math.sin(ph) * e(i) * 0.6;
    }
    return out;
  },
  feed: () => {
    const out = len(0.25);
    const e = env(out.length, 0.002, 0.05);
    for (let i = 0; i < out.length; i++)
      out[i] = Math.sin((2 * Math.PI * 1320 * i) / SR) * e(i) * 0.35;
    return out;
  },
  rake: () => {
    const rng = mulberry32(9);
    const out = len(0.18);
    const bp = new Biquad('bandpass', 2600, 0.9);
    for (let i = 0; i < out.length; i++)
      out[i] = bp.process(rng() * 2 - 1) * Math.sin((i / out.length) * Math.PI) * 0.6;
    return out;
  },
  harvest: () => {
    const out = len(1.4);
    [0, 0.12, 0.24].forEach((start, k) => {
      const f = [784, 988, 1175][k]!;
      const s = Math.floor(start * SR);
      for (let i = 0; s + i < out.length; i++)
        out[s + i] =
          out[s + i]! + Math.sin((2 * Math.PI * f * i) / SR) * Math.exp(-i / (SR * 0.35)) * 0.25;
    });
    return out;
  },
  bell: () => {
    // Bol chantant : partiels inharmoniques à longue décroissance
    const out = len(8);
    const partials = [
      { f: 220, a: 0.5, d: 5 },
      { f: 220 * 2.71, a: 0.3, d: 3.5 },
      { f: 220 * 5.12, a: 0.15, d: 2 },
      { f: 222.5, a: 0.3, d: 5 },
    ];
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      let v = 0;
      for (const p of partials) v += Math.sin(2 * Math.PI * p.f * t) * p.a * Math.exp(-t / p.d);
      out[i] = v * Math.min(1, t / 0.01) * 0.6;
    }
    return out;
  },
  soft: () => {
    const out = len(0.15);
    for (let i = 0; i < out.length; i++)
      out[i] = Math.sin((2 * Math.PI * 660 * i) / SR) * Math.exp(-i / (SR * 0.03)) * 0.2;
    return out;
  },
  thunder: () => {
    const rng = mulberry32(10);
    const out = len(7);
    const brown = brownNoise(rng);
    const lp = new Biquad('lowpass', 180);
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const e =
        Math.min(1, t / 0.4) *
        Math.exp(-t / 2.2) *
        (0.7 + 0.3 * Math.sin(t * 7) * Math.sin(t * 3.3));
      out[i] = lp.process(brown()) * e;
    }
    return normalize(out, 0.9);
  },
};

/** Corde pincée (Karplus-Strong) : son de koto. */
export function kotoPluck(freq: number, seconds = 3, seed = 1): Float32Array {
  const rng = mulberry32(seed);
  const out = len(seconds);
  const period = Math.max(2, Math.round(SR / freq));
  const buf = new Float32Array(period).map(() => rng() * 2 - 1);
  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const next = (idx + 1) % period;
    const v = (buf[idx]! + buf[next]!) * 0.5 * 0.996;
    out[i] = buf[idx]!;
    buf[idx] = v;
    idx = next;
  }
  // Attaque un peu plus douce
  for (let i = 0; i < 60 && i < out.length; i++) out[i] = out[i]! * (i / 60);
  return out;
}
