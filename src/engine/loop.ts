export type FrameCallback = (dt: number, time: number) => void;

/**
 * Boucle d'animation avec plafond de fréquence (30/60 fps).
 * `dt` est en secondes, borné pour éviter les sauts après une pause.
 */
export class Loop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private readonly callbacks = new Set<FrameCallback>();
  private minFrameMs = 1000 / 60;
  running = false;
  /** Moyenne glissante du temps de frame (ms), pour l'ajustement de qualité. */
  frameMs = 16;
  /** Moyenne glissante de l'intervalle réel entre deux frames (ms). */
  intervalMs = 16;
  get targetMs(): number {
    return this.minFrameMs;
  }

  setFpsCap(fps: 30 | 60): void {
    this.minFrameMs = 1000 / fps;
  }

  add(cb: FrameCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = this.minFrameMs;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const elapsed = now - this.last;
    this.last = now;
    this.acc += elapsed;
    // Tolérance de 2 ms pour ne pas sauter une frame à cause du jitter vsync.
    if (this.acc < this.minFrameMs - 2) return;
    const dtMs = Math.min(this.acc, 100);
    if (dtMs < 100) this.intervalMs = this.intervalMs * 0.95 + dtMs * 0.05;
    this.acc = 0;
    const start = performance.now();
    const dt = dtMs / 1000;
    for (const cb of this.callbacks) cb(dt, now / 1000);
    this.frameMs = this.frameMs * 0.95 + (performance.now() - start) * 0.05;
  };
}
