import { Howl, Howler } from 'howler';
import type { NatureActivity } from '@/world/events';
import type { SkyState } from '@/world/sky';
import type { WeatherState } from '@/world/weatherTypes';
import { encodeWav, SR } from './dsp';
import { GenerativeMusic } from './music';
import { AMBIENT_SYNTH, SFX_SYNTH, type AmbientId, type SfxId } from './synth';

export interface AudioMix {
  ambient: number;
  music: number;
  sfx: number;
  musicOn: boolean;
}

/**
 * Moteur audio : ambiances en boucle (Howler, sons synthétisés à la volée),
 * musique générative et effets (Web Audio), avec fondu « sommeil ».
 */
class AudioEngine {
  private ambients = new Map<AmbientId, Howl>();
  private sfx = new Map<SfxId, AudioBuffer>();
  private sfxGain: GainNode | null = null;
  private music: GenerativeMusic | null = null;
  private started = false;
  private mix: AudioMix = { ambient: 0.8, music: 0.5, sfx: 0.7, musicOn: true };
  /** Multiplicateur global (mode sommeil). */
  private master = 1;
  private targets = new Map<AmbientId, number>();

  get ready(): boolean {
    return this.started;
  }

  /** À appeler après un geste utilisateur (politique d'autoplay). */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    Howler.autoUnlock = true;
    const ctx = Howler.ctx;
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(Howler.masterGain);
    this.music = new GenerativeMusic(ctx, Howler.masterGain);
    // Génération étalée pour ne pas bloquer l'interface
    const ids = Object.keys(AMBIENT_SYNTH) as AmbientId[];
    for (const id of ids) {
      await new Promise((r) => setTimeout(r, 30));
      const wav = encodeWav(AMBIENT_SYNTH[id]());
      const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
      const h = new Howl({ src: [url], format: ['wav'], loop: true, volume: 0, html5: false });
      h.play();
      this.ambients.set(id, h);
    }
    for (const id of Object.keys(SFX_SYNTH) as SfxId[]) {
      const data = SFX_SYNTH[id]();
      const buf = ctx.createBuffer(1, data.length, SR);
      buf.getChannelData(0).set(data);
      this.sfx.set(id, buf);
    }
    this.applyMix();
  }

  setMix(mix: AudioMix): void {
    this.mix = mix;
    this.applyMix();
  }

  private applyMix(): void {
    if (!this.started) return;
    if (this.sfxGain) this.sfxGain.gain.value = this.mix.sfx * this.master;
    if (this.music) {
      if (this.mix.musicOn) {
        this.music.start();
        this.music.setVolume(this.mix.music * this.master * 0.9);
      } else {
        this.music.setVolume(0);
        this.music.stop();
      }
    }
    for (const [id, h] of this.ambients)
      h.volume((this.targets.get(id) ?? 0) * this.mix.ambient * this.master);
  }

  /** Volumes cibles des ambiances selon l'heure, la saison et la météo (appelé ~1 Hz). */
  updateEnvironment(
    sky: SkyState,
    weather: WeatherState,
    nature: NatureActivity,
    extra: { stream: boolean; nearWater: number },
  ): void {
    const rain = Math.min(1, weather.rain / 4 + (weather.rain > 0.05 ? 0.25 : 0));
    const t: Record<AmbientId, number> = {
      rain: rain * 0.9,
      wind: Math.min(1, 0.12 + weather.wind / 40) * 0.55,
      water: 0.25 + extra.nearWater * 0.35,
      birds: nature.birds * 0.55,
      crickets: nature.crickets * 0.35,
      frogs: nature.frogs * 0.4,
      cicadas: nature.cicadas * 0.25,
      stream: extra.stream ? 0.45 : 0,
    };
    for (const id of Object.keys(t) as AmbientId[]) {
      const target = t[id];
      const prev = this.targets.get(id) ?? 0;
      if (Math.abs(prev - target) < 0.01) continue;
      this.targets.set(id, target);
      const h = this.ambients.get(id);
      if (h) h.fade(h.volume(), target * this.mix.ambient * this.master, 2500);
    }
    if (this.music) this.music.night = sky.sunAltitude < -6;
  }

  play(id: SfxId, volume = 1, rate = 1): void {
    const buf = this.sfx.get(id);
    if (!buf || !this.sfxGain) return;
    const ctx = Howler.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.sfxGain);
    src.start();
  }

  /** Mode sommeil : fondu progressif de tout le son jusqu'au silence. */
  fadeOutAll(seconds: number): void {
    const start = performance.now();
    const from = this.master;
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / (seconds * 1000));
      this.master = from * (1 - k);
      this.applyMix();
      if (k < 1) setTimeout(step, 1000);
    };
    step();
  }

  restoreVolume(): void {
    this.master = 1;
    this.applyMix();
  }

  suspend(): void {
    if (this.started) void Howler.ctx.suspend();
  }

  resume(): void {
    if (this.started) void Howler.ctx.resume();
  }
}

export const audio = new AudioEngine();
