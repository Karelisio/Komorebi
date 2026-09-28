import type { Point, PondShape } from '@/world/layout';
import { pointInPolygon } from '@/world/layout';
import type { Rng } from '@/world/random';

export interface FishAgent {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Taille relative (0.3..1). */
  size: number;
  /** Profondeur 0 = surface, 1 = fond. */
  z: number;
  wander: number;
  /** Audace 0..1 : les audacieux suivent davantage le doigt. */
  boldness: number;
  /** Phase de nage (ondulation). */
  phase: number;
  /** Vitesse courante (pour l'animation). */
  speed: number;
  /** Instant où le poisson a mangé pour la dernière fois (s). */
  ateAt: number;
}

export interface Pellet {
  id: number;
  x: number;
  y: number;
  age: number;
}

export interface BoidsWorld {
  shape: PondShape;
  food: Pellet[];
  attractor: Point | null;
  time: number;
}

export interface BoidsEvents {
  onEat?(fish: FishAgent, pellet: Pellet): void;
}

const BASE_SPEED = 20;
const MAX_SPEED = 62;

/** Distance au bord le plus proche et direction vers l'intérieur. */
export function edgeInfo(
  shape: PondShape,
  x: number,
  y: number,
): { dist: number; nx: number; ny: number; inside: boolean } {
  const pts = shape.points;
  let best = Infinity;
  let bx = 0;
  let by = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j]!;
    const b = pts[i]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / (abx * abx + aby * aby || 1)),
    );
    const px = a.x + abx * t;
    const py = a.y + aby * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best) {
      best = d;
      bx = px;
      by = py;
    }
  }
  const inside = pointInPolygon({ x, y }, pts);
  let nx = x - bx;
  let ny = y - by;
  const l = Math.hypot(nx, ny) || 1;
  nx /= l;
  ny /= l;
  if (!inside) {
    nx = -nx;
    ny = -ny;
  }
  return { dist: inside ? best : -best, nx, ny, inside };
}

export function spawnAgent(id: string, shape: PondShape, rng: Rng, size: number): FishAgent {
  let x = shape.cx;
  let y = shape.cy;
  for (let i = 0; i < 20; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 0.7;
    const px = shape.cx + Math.cos(a) * shape.rx * r;
    const py = shape.cy + Math.sin(a) * shape.ry * r;
    if (pointInPolygon({ x: px, y: py }, shape.points)) {
      x = px;
      y = py;
      break;
    }
  }
  const h = rng() * Math.PI * 2;
  return {
    id,
    x,
    y,
    vx: Math.cos(h) * BASE_SPEED,
    vy: Math.sin(h) * BASE_SPEED,
    size,
    z: 0.3 + rng() * 0.5,
    wander: h,
    boldness: rng(),
    phase: rng() * 10,
    speed: BASE_SPEED,
    ateAt: -999,
  };
}

/** Un pas de simulation du banc (séparation, alignement, cohésion, errance, nourriture, doigt, berges). */
export function stepBoids(
  agents: FishAgent[],
  world: BoidsWorld,
  dt: number,
  rng: Rng,
  events: BoidsEvents = {},
): void {
  const eaten = new Set<number>();
  for (const f of agents) {
    let ax = 0;
    let ay = 0;
    let sepX = 0;
    let sepY = 0;
    let aliX = 0;
    let aliY = 0;
    let cohX = 0;
    let cohY = 0;
    let nA = 0;
    let nC = 0;
    const sepR = 26 + 26 * f.size;
    for (const o of agents) {
      if (o === f) continue;
      const dx = o.x - f.x;
      const dy = o.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d < sepR && d > 0.001) {
        sepX -= (dx / d) * (sepR - d);
        sepY -= (dy / d) * (sepR - d);
      }
      if (d < 90) {
        aliX += o.vx;
        aliY += o.vy;
        nA++;
      }
      if (d < 150) {
        cohX += dx;
        cohY += dy;
        nC++;
      }
    }
    ax += sepX * 1.6;
    ay += sepY * 1.6;
    if (nA) {
      ax += (aliX / nA - f.vx) * 0.25;
      ay += (aliY / nA - f.vy) * 0.25;
    }
    if (nC) {
      ax += (cohX / nC) * 0.05;
      ay += (cohY / nC) * 0.05;
    }

    // Errance paisible
    f.wander += (rng() - 0.5) * 1.6 * dt;
    ax += Math.cos(f.wander) * 9;
    ay += Math.sin(f.wander) * 9;

    let excited = 0;
    // Nourriture
    let target: Pellet | null = null;
    let td = 280;
    for (const p of world.food) {
      if (eaten.has(p.id)) continue;
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      if (d < td) {
        td = d;
        target = p;
      }
    }
    if (target) {
      const k = 1.2 + (1 - td / 280) * 1.5;
      ax += ((target.x - f.x) / (td || 1)) * 60 * k;
      ay += ((target.y - f.y) / (td || 1)) * 60 * k;
      excited = 1;
      if (td < 8 + 10 * f.size) {
        eaten.add(target.id);
        f.ateAt = world.time;
        events.onEat?.(f, target);
      }
    } else if (world.attractor) {
      const dx = world.attractor.x - f.x;
      const dy = world.attractor.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 320 && d > 20) {
        const k = 0.35 + f.boldness * 0.9;
        ax += (dx / d) * 40 * k;
        ay += (dy / d) * 40 * k;
        excited = 0.5 + f.boldness * 0.3;
      }
    }

    // Berges : on tourne avant de toucher le bord
    const e = edgeInfo(world.shape, f.x, f.y);
    const margin = 36 + 20 * f.size;
    if (e.dist < margin) {
      const k = (margin - e.dist) / margin;
      ax += e.nx * 190 * k * k + e.nx * 30;
      ay += e.ny * 190 * k * k + e.ny * 30;
      if (e.dist < margin * 0.5) f.wander = Math.atan2(e.ny, e.nx) + (rng() - 0.5);
    }

    // Rotation limitée : les koïs décrivent des courbes amples
    const heading = Math.atan2(f.vy, f.vx);
    const dvx = f.vx + ax * dt;
    const dvy = f.vy + ay * dt;
    let turn = Math.atan2(dvy, dvx) - heading;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const maxTurn = (1.1 + excited * 1.6) * dt;
    const newHeading = heading + Math.max(-maxTurn, Math.min(maxTurn, turn));
    const want = BASE_SPEED * (0.75 + 0.5 * f.size) * (1 + excited * 1.4);
    const sp = Math.hypot(f.vx, f.vy) || 1;
    const target2 = Math.min(MAX_SPEED, sp + (want - sp) * Math.min(1, dt * 1.5));
    f.vx = Math.cos(newHeading) * target2;
    f.vy = Math.sin(newHeading) * target2;
    f.speed = target2;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (!e.inside) {
      // Filet de sécurité : ramène à l'intérieur.
      f.x += e.nx * 4;
      f.y += e.ny * 4;
    }
    // Profondeur : remonte vers la surface quand il y a de l'animation
    const zTarget = excited > 0 ? 0.05 : 0.35 + 0.35 * Math.sin(world.time * 0.07 + f.phase);
    f.z += (zTarget - f.z) * Math.min(1, dt * 0.8);
    f.phase += dt * (2 + target2 * 0.12);
  }
  if (eaten.size) world.food = world.food.filter((p) => !eaten.has(p.id));
}
