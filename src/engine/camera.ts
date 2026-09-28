import { clamp, lerp } from '@/world/math';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Caméra 2D : centre (x, y) en coordonnées monde et zoom (px écran par unité monde).
 * Gère l'inertie, les bornes et une dérive lente pour le mode contemplation.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  minZoom = 0.3;
  maxZoom = 3;
  viewW = 1;
  viewH = 1;
  private vx = 0;
  private vy = 0;
  private dragging = false;
  private driftT = 0;
  drift = false;

  constructor(public bounds: Rect) {}

  resize(width: number, height: number): void {
    this.viewW = width;
    this.viewH = height;
    // Zoom mini : le monde remplit toujours l'écran.
    this.minZoom = Math.max(width / this.bounds.width, height / this.bounds.height);
    this.zoom = clamp(this.zoom, this.minZoom, this.maxZoom);
    this.clampToBounds();
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.x + (sx - this.viewW / 2) / this.zoom,
      y: this.y + (sy - this.viewH / 2) / this.zoom,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + this.viewW / 2,
      y: (wy - this.y) * this.zoom + this.viewH / 2,
    };
  }

  /** Rectangle visible en coordonnées monde. */
  visible(): Rect {
    const w = this.viewW / this.zoom;
    const h = this.viewH / this.zoom;
    return { x: this.x - w / 2, y: this.y - h / 2, width: w, height: h };
  }

  beginDrag(): void {
    this.dragging = true;
    this.vx = 0;
    this.vy = 0;
  }

  /** Déplacement en pixels écran (suivi du doigt). */
  panBy(dxScreen: number, dyScreen: number, dt = 1 / 60): void {
    const dx = -dxScreen / this.zoom;
    const dy = -dyScreen / this.zoom;
    this.x += dx;
    this.y += dy;
    if (dt > 0) {
      this.vx = lerp(this.vx, dx / dt, 0.5);
      this.vy = lerp(this.vy, dy / dt, 0.5);
    }
    this.clampToBounds();
  }

  endDrag(): void {
    this.dragging = false;
  }

  /** Zoom autour d'un point écran (pinch). */
  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clampToBounds();
  }

  lookAt(x: number, y: number, zoom?: number): void {
    this.x = x;
    this.y = y;
    if (zoom !== undefined) this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
    this.clampToBounds();
  }

  update(dt: number): void {
    if (!this.dragging) {
      const decay = Math.exp(-dt * 4.5);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= decay;
      this.vy *= decay;
      if (Math.abs(this.vx) < 0.5) this.vx = 0;
      if (Math.abs(this.vy) < 0.5) this.vy = 0;
    }
    if (this.drift && !this.dragging) {
      // Dérive lente et organique (Lissajous très lent).
      this.driftT += dt;
      this.x += Math.sin(this.driftT * 0.05) * 6 * dt;
      this.y += Math.sin(this.driftT * 0.031 + 1.3) * 3.5 * dt;
    }
    this.clampToBounds();
  }

  private clampToBounds(): void {
    const halfW = this.viewW / this.zoom / 2;
    const halfH = this.viewH / this.zoom / 2;
    const b = this.bounds;
    this.x =
      halfW * 2 >= b.width ? b.x + b.width / 2 : clamp(this.x, b.x + halfW, b.x + b.width - halfW);
    this.y =
      halfH * 2 >= b.height
        ? b.y + b.height / 2
        : clamp(this.y, b.y + halfH, b.y + b.height - halfH);
  }
}
