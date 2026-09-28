import { describe, expect, it } from 'vitest';
import { encodeWav, SR } from './dsp';
import { AMBIENT_SYNTH, kotoPluck, SFX_SYNTH } from './synth';

describe('synthèse audio', () => {
  it('toutes les ambiances sont finies, bornées et non silencieuses', () => {
    for (const [id, make] of Object.entries(AMBIENT_SYNTH)) {
      const s = make();
      expect(s.length, id).toBeGreaterThan(SR * 4);
      let peak = 0;
      let finite = true;
      for (const v of s) {
        if (!Number.isFinite(v)) finite = false;
        peak = Math.max(peak, Math.abs(v));
      }
      expect(finite, id).toBe(true);
      expect(peak, id).toBeGreaterThan(0.1);
      expect(peak, id).toBeLessThanOrEqual(1);
    }
  });

  it('les boucles se raccordent sans clic', () => {
    for (const id of ['rain', 'wind', 'water', 'cicadas', 'stream'] as const) {
      const s = AMBIENT_SYNTH[id]();
      expect(Math.abs(s[0]! - s[s.length - 1]!), id).toBeLessThan(0.25);
    }
  });

  it('effets et koto', () => {
    for (const make of Object.values(SFX_SYNTH)) expect(make().every(Number.isFinite)).toBe(true);
    const k = kotoPluck(440, 1);
    expect(k.length).toBe(SR);
  });

  it('encodage WAV', () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1]));
    const v = new DataView(wav);
    expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe(
      'RIFF',
    );
    expect(wav.byteLength).toBe(44 + 8);
  });
});
