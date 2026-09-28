export interface ScreenPoint {
  x: number;
  y: number;
}

export interface GestureHandlers {
  /** Contact initial (avant de savoir si c'est un tap ou un glissé). */
  down?(p: ScreenPoint): void;
  tap?(p: ScreenPoint): void;
  /** Appui long. Retourner true pour démarrer un glissé d'objet. */
  longPress?(p: ScreenPoint): boolean;
  /** Début de glissé à un doigt. Retourner true pour le consommer (outil), sinon la caméra se déplace. */
  dragStart?(p: ScreenPoint): boolean;
  dragMove?(p: ScreenPoint, prev: ScreenPoint): void;
  dragEnd?(p: ScreenPoint): void;
  panStart?(): void;
  pan?(dx: number, dy: number, dt: number): void;
  panEnd?(): void;
  pinch?(factor: number, center: ScreenPoint): void;
  /** Mouvement du doigt (même pendant un pan), utile pour faire suivre les koïs. */
  hover?(p: ScreenPoint | null): void;
  wheel?(factor: number, center: ScreenPoint): void;
}

const TAP_MAX_MS = 280;
const MOVE_SLOP = 9;
const LONG_PRESS_MS = 480;

type Mode = 'idle' | 'pending' | 'pan' | 'drag' | 'pinch';

/** Reconnaissance des gestes tactiles/souris sur un élément. */
export class GestureController {
  private pointers = new Map<number, ScreenPoint>();
  private mode: Mode = 'idle';
  private start: ScreenPoint = { x: 0, y: 0 };
  private startTime = 0;
  private last: ScreenPoint = { x: 0, y: 0 };
  private lastTime = 0;
  private longTimer: ReturnType<typeof setTimeout> | undefined;
  private pinchDist = 0;
  enabled = true;

  constructor(
    private readonly el: HTMLElement,
    private readonly handlers: GestureHandlers,
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  destroy(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onCancel);
    this.el.removeEventListener('pointerleave', this.onLeave);
    this.el.removeEventListener('wheel', this.onWheel);
    this.clearLong();
  }

  private point(e: PointerEvent | WheelEvent): ScreenPoint {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private clearLong(): void {
    if (this.longTimer !== undefined) clearTimeout(this.longTimer);
    this.longTimer = undefined;
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    this.el.setPointerCapture?.(e.pointerId);
    const p = this.point(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.mode = 'pending';
      this.start = p;
      this.last = p;
      this.startTime = this.lastTime = performance.now();
      this.handlers.down?.(p);
      this.handlers.hover?.(p);
      this.clearLong();
      this.longTimer = setTimeout(() => {
        if (this.mode !== 'pending') return;
        if (this.handlers.longPress?.(this.last)) this.mode = 'drag';
      }, LONG_PRESS_MS);
    } else if (this.pointers.size === 2) {
      this.clearLong();
      if (this.mode === 'drag') this.handlers.dragEnd?.(this.last);
      if (this.mode === 'pan') this.handlers.panEnd?.();
      this.mode = 'pinch';
      this.pinchDist = this.pinchDistance();
    }
  };

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 1;
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  private pinchCenter(): ScreenPoint {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return this.last;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private readonly onMove = (e: PointerEvent): void => {
    if (!this.enabled) return;
    const p = this.point(e);
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') this.handlers.hover?.(p);
      return;
    }
    const prevCenter = this.mode === 'pinch' ? this.pinchCenter() : this.last;
    this.pointers.set(e.pointerId, p);
    const now = performance.now();
    const dt = Math.max(0.001, (now - this.lastTime) / 1000);

    if (this.mode === 'pinch') {
      const d = this.pinchDistance();
      const c = this.pinchCenter();
      this.handlers.pinch?.(d / this.pinchDist, c);
      this.handlers.pan?.(c.x - prevCenter.x, c.y - prevCenter.y, dt);
      this.pinchDist = d;
      this.lastTime = now;
      return;
    }

    this.handlers.hover?.(p);
    if (this.mode === 'pending') {
      if (Math.hypot(p.x - this.start.x, p.y - this.start.y) < MOVE_SLOP) return;
      this.clearLong();
      if (this.handlers.dragStart?.(this.start)) {
        this.mode = 'drag';
      } else {
        this.mode = 'pan';
        this.handlers.panStart?.();
      }
    }
    if (this.mode === 'drag') this.handlers.dragMove?.(p, this.last);
    else if (this.mode === 'pan') this.handlers.pan?.(p.x - this.last.x, p.y - this.last.y, dt);
    this.last = p;
    this.lastTime = now;
  };

  private readonly onUp = (e: PointerEvent): void => {
    const p = this.point(e);
    const had = this.pointers.delete(e.pointerId);
    if (!had) return;
    this.clearLong();
    if (this.mode === 'pinch') {
      if (this.pointers.size === 1) {
        // On repasse en pan avec le doigt restant.
        const remaining = [...this.pointers.values()][0]!;
        this.last = remaining;
        this.lastTime = performance.now();
        this.mode = 'pan';
        this.handlers.panStart?.();
      }
      return;
    }
    if (this.mode === 'pending' && performance.now() - this.startTime < TAP_MAX_MS) {
      this.handlers.tap?.(p);
    } else if (this.mode === 'drag') {
      this.handlers.dragEnd?.(p);
    } else if (this.mode === 'pan') {
      this.handlers.panEnd?.();
    }
    if (this.pointers.size === 0) {
      this.mode = 'idle';
      this.handlers.hover?.(null);
    }
  };

  private readonly onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.clearLong();
    if (this.mode === 'drag') this.handlers.dragEnd?.(this.last);
    if (this.mode === 'pan') this.handlers.panEnd?.();
    if (this.pointers.size === 0) {
      this.mode = 'idle';
      this.handlers.hover?.(null);
    }
  };

  private readonly onLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && !this.pointers.has(e.pointerId)) this.handlers.hover?.(null);
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.handlers.wheel?.(Math.exp(-e.deltaY * 0.0015), this.point(e));
  };
}
