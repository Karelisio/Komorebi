import { mulberry32, rand, type Rng } from '@/world/random';

/** Couleur de fond (dominance W > Y > C > K). */
export type GroundAllele = 'W' | 'Y' | 'C' | 'K';
/** Allèles binaires : majuscule = dominant. */
export type Pair<T extends string> = readonly [T, T];

export interface Patch {
  /** Position le long du corps, 0 = tête, 1 = queue. */
  t: number;
  /** Position transversale -1 (gauche) → 1 (droite). */
  s: number;
  /** Taille relative. */
  r: number;
}

export interface Genome {
  ground: Pair<GroundAllele>;
  /** Taches rouges (hi) : H présent, h absent. */
  hi: Pair<'H' | 'h'>;
  /** Taches noires (sumi) : S présent, s absent. */
  sumi: Pair<'S' | 's'>;
  /** Style du sumi : U (enveloppant, type Utsuri/Showa) dominant sur p (taches, type Sanke). */
  sumiStyle: Pair<'U' | 'p'>;
  /** Écailles : N normales dominant, d = doitsu (récessif). */
  scales: Pair<'N' | 'd'>;
  /** Métallique (ogon) : M dominant. */
  metallic: Pair<'M' | 'm'>;
  /** Dos bleu réticulé (asagi) : a récessif. */
  asagi: Pair<'A' | 'a'>;
  /** Tancho : t récessif — le rouge se limite à un rond sur la tête. */
  tancho: Pair<'T' | 't'>;
  /** Gin-rin (écailles scintillantes) : G dominant, rare. */
  ginrin: Pair<'G' | 'g'>;
  /** Nageoires papillon : b récessif. */
  butterfly: Pair<'B' | 'b'>;
  /** Quantitatifs 0..1 (hérités par moyenne + bruit). */
  hiAmount: number;
  sumiAmount: number;
  /** Nuance du rouge : 0 orangé → 1 cramoisi. */
  hiShade: number;
  hiPatches: Patch[];
  sumiPatches: Patch[];
}

export type Sex = 'f' | 'm';

export const VARIETIES = [
  'kohaku',
  'tancho',
  'sanke',
  'showa',
  'shiro-utsuri',
  'ki-utsuri',
  'hi-utsuri',
  'asagi',
  'shusui',
  'ogon',
  'platinum',
  'hariwake',
  'kujaku',
  'kigoi',
  'chagoi',
  'karasugoi',
  'benigoi',
  'hakugei',
  'bekko',
  'goshiki',
] as const;
export type Variety = (typeof VARIETIES)[number];

export interface Phenotype {
  ground: GroundAllele;
  hi: boolean;
  sumi: boolean;
  sumiWrap: boolean;
  doitsu: boolean;
  metallic: boolean;
  asagi: boolean;
  tancho: boolean;
  ginrin: boolean;
  butterfly: boolean;
  variety: Variety;
  /** Rareté 1 (commun) → 5 (légendaire). */
  rarity: number;
}

const GROUND_ORDER: GroundAllele[] = ['W', 'Y', 'C', 'K'];

function dominantGround(p: Pair<GroundAllele>): GroundAllele {
  return GROUND_ORDER[Math.min(GROUND_ORDER.indexOf(p[0]), GROUND_ORDER.indexOf(p[1]))]!;
}

const has = <T extends string>(p: Pair<T>, dom: T): boolean => p[0] === dom || p[1] === dom;
const homo = <T extends string>(p: Pair<T>, rec: T): boolean => p[0] === rec && p[1] === rec;

export function express(g: Genome): Phenotype {
  const ground = dominantGround(g.ground);
  const hi = has(g.hi, 'H') && g.hiAmount > 0.08;
  const sumi = has(g.sumi, 'S') && g.sumiAmount > 0.08;
  const sumiWrap = sumi && has(g.sumiStyle, 'U');
  const doitsu = homo(g.scales, 'd');
  const metallic = has(g.metallic, 'M');
  const asagi = homo(g.asagi, 'a');
  const tancho = hi && homo(g.tancho, 't');
  const ginrin = has(g.ginrin, 'G');
  const butterfly = homo(g.butterfly, 'b');

  let variety: Variety;
  if (asagi) variety = doitsu ? 'shusui' : metallic ? 'kujaku' : 'asagi';
  else if (metallic) variety = hi ? 'hariwake' : ground === 'W' ? 'platinum' : 'ogon';
  else if (tancho) variety = 'tancho';
  else if (sumiWrap) {
    if (hi && ground === 'W') variety = 'showa';
    else if (hi && g.hiAmount > 0.6) variety = 'hi-utsuri';
    else if (ground === 'Y') variety = 'ki-utsuri';
    else variety = 'shiro-utsuri';
  } else if (sumi) {
    if (hi && g.sumiAmount > 0.7 && g.hiAmount > 0.4) variety = 'goshiki';
    else if (hi) variety = 'sanke';
    else variety = 'bekko';
  } else if (hi) variety = g.hiAmount > 0.88 ? 'benigoi' : 'kohaku';
  else
    variety =
      ground === 'Y'
        ? 'kigoi'
        : ground === 'C'
          ? 'chagoi'
          : ground === 'K'
            ? 'karasugoi'
            : 'hakugei';

  const base: Record<Variety, number> = {
    kohaku: 1,
    sanke: 1,
    showa: 2,
    chagoi: 1,
    ogon: 1,
    kigoi: 2,
    bekko: 2,
    asagi: 2,
    'shiro-utsuri': 2,
    platinum: 2,
    'ki-utsuri': 3,
    'hi-utsuri': 3,
    hariwake: 3,
    karasugoi: 3,
    benigoi: 3,
    hakugei: 3,
    shusui: 3,
    tancho: 4,
    goshiki: 4,
    kujaku: 4,
  };
  let rarity = base[variety];
  if (ginrin) rarity += 1;
  if (butterfly) rarity += 1;
  if (doitsu && variety !== 'shusui') rarity += 0.5;
  return {
    ground,
    hi,
    sumi,
    sumiWrap,
    doitsu,
    metallic,
    asagi,
    tancho,
    ginrin,
    butterfly,
    variety,
    rarity: Math.min(5, Math.round(rarity)),
  };
}

const pick = <T extends string>(rng: Rng, p: Pair<T>): T => (rng() < 0.5 ? p[0] : p[1]);
const cross = <T extends string>(rng: Rng, a: Pair<T>, b: Pair<T>): Pair<T> =>
  [pick(rng, a), pick(rng, b)] as const;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Les motifs héritent des taches des parents (sélection + léger déplacement + mutations). */
function inheritPatches(rng: Rng, a: Patch[], b: Patch[], amount: number): Patch[] {
  const pool = [...a.filter(() => rng() < 0.5), ...b.filter(() => rng() < 0.5)];
  const out = pool.map((p) => ({
    t: clamp01(p.t + (rng() - 0.5) * 0.08),
    s: Math.max(-1, Math.min(1, p.s + (rng() - 0.5) * 0.25)),
    r: Math.max(0.06, p.r * (0.85 + rng() * 0.3)),
  }));
  if (rng() < 0.3 || out.length === 0) out.push(randomPatch(rng, amount));
  if (out.length > 1 && rng() < 0.2) out.splice(Math.floor(rng() * out.length), 1);
  return out.slice(0, 7);
}

function randomPatch(rng: Rng, amount: number): Patch {
  return { t: 0.08 + rng() * 0.72, s: (rng() - 0.5) * 1.4, r: 0.12 + rng() * 0.2 + amount * 0.15 };
}

function mutateAllele<T extends string>(
  rng: Rng,
  p: Pair<T>,
  options: readonly T[],
  rate: number,
): Pair<T> {
  if (rng() >= rate) return p;
  const i = rng() < 0.5 ? 0 : 1;
  const next = [...p] as [T, T];
  next[i] = rand.pick(rng, options);
  return next;
}

export const MUTATION_RATE = 0.03;

/** Croisement de deux parents : chaque gène reçoit un allèle de chaque parent. */
export function breed(a: Genome, b: Genome, seed: number, mutationRate = MUTATION_RATE): Genome {
  const rng = mulberry32(seed);
  const q = (x: number, y: number, spread = 0.12) =>
    clamp01((x + y) / 2 + (rng() - 0.5) * 2 * spread);
  const g: Genome = {
    ground: mutateAllele(rng, cross(rng, a.ground, b.ground), GROUND_ORDER, mutationRate),
    hi: mutateAllele(rng, cross(rng, a.hi, b.hi), ['H', 'h'], mutationRate),
    sumi: mutateAllele(rng, cross(rng, a.sumi, b.sumi), ['S', 's'], mutationRate),
    sumiStyle: mutateAllele(rng, cross(rng, a.sumiStyle, b.sumiStyle), ['U', 'p'], mutationRate),
    scales: mutateAllele(rng, cross(rng, a.scales, b.scales), ['N', 'd'], mutationRate),
    metallic: mutateAllele(rng, cross(rng, a.metallic, b.metallic), ['M', 'm'], mutationRate * 0.5),
    asagi: mutateAllele(rng, cross(rng, a.asagi, b.asagi), ['A', 'a'], mutationRate),
    tancho: mutateAllele(rng, cross(rng, a.tancho, b.tancho), ['T', 't'], mutationRate),
    ginrin: mutateAllele(rng, cross(rng, a.ginrin, b.ginrin), ['G', 'g'], mutationRate * 0.4),
    butterfly: mutateAllele(
      rng,
      cross(rng, a.butterfly, b.butterfly),
      ['B', 'b'],
      mutationRate * 0.5,
    ),
    hiAmount: q(a.hiAmount, b.hiAmount),
    sumiAmount: q(a.sumiAmount, b.sumiAmount),
    hiShade: q(a.hiShade, b.hiShade, 0.08),
    hiPatches: [],
    sumiPatches: [],
  };
  g.hiPatches = inheritPatches(rng, a.hiPatches, b.hiPatches, g.hiAmount);
  g.sumiPatches = inheritPatches(rng, a.sumiPatches, b.sumiPatches, g.sumiAmount);
  return g;
}

/** Génome de départ (poissons offerts au début ou via événements). */
export function randomGenome(seed: number, template?: Variety): Genome {
  const rng = mulberry32(seed);
  const patches = (n: number, amount: number) =>
    Array.from({ length: n }, () => randomPatch(rng, amount));
  const g: Genome = {
    ground: ['W', rand.pick(rng, GROUND_ORDER)],
    hi: ['H', rng() < 0.5 ? 'H' : 'h'],
    sumi: [rng() < 0.4 ? 'S' : 's', 's'],
    sumiStyle: [rng() < 0.3 ? 'U' : 'p', 'p'],
    scales: ['N', rng() < 0.25 ? 'd' : 'N'],
    metallic: ['m', 'm'],
    asagi: ['A', rng() < 0.25 ? 'a' : 'A'],
    tancho: ['T', rng() < 0.3 ? 't' : 'T'],
    ginrin: ['g', 'g'],
    butterfly: ['B', rng() < 0.2 ? 'b' : 'B'],
    hiAmount: 0.3 + rng() * 0.4,
    sumiAmount: 0.2 + rng() * 0.4,
    hiShade: rng(),
    hiPatches: patches(2 + Math.floor(rng() * 3), 0.5),
    sumiPatches: patches(1 + Math.floor(rng() * 3), 0.3),
  };
  switch (template) {
    case 'kohaku':
      return {
        ...g,
        ground: ['W', 'W'],
        hi: ['H', 'H'],
        sumi: ['s', 's'],
        metallic: ['m', 'm'],
        asagi: ['A', 'A'],
        tancho: ['T', 'T'],
      };
    case 'sanke':
      return {
        ...g,
        ground: ['W', 'W'],
        hi: ['H', 'h'],
        sumi: ['S', 's'],
        sumiStyle: ['p', 'p'],
        sumiAmount: 0.35,
        asagi: ['A', 'A'],
        tancho: ['T', 'T'],
      };
    case 'showa':
      return {
        ...g,
        ground: ['W', 'K'],
        hi: ['H', 'h'],
        sumi: ['S', 'S'],
        sumiStyle: ['U', 'p'],
        asagi: ['A', 'A'],
        tancho: ['T', 'T'],
      };
    case 'chagoi':
      return {
        ...g,
        ground: ['C', 'C'],
        hi: ['h', 'h'],
        sumi: ['s', 's'],
        metallic: ['m', 'm'],
        asagi: ['A', 'A'],
      };
    case 'ogon':
      return {
        ...g,
        ground: ['Y', 'Y'],
        hi: ['h', 'h'],
        sumi: ['s', 's'],
        metallic: ['M', 'm'],
        asagi: ['A', 'A'],
      };
    case 'asagi':
      return { ...g, asagi: ['a', 'a'], scales: ['N', 'N'], metallic: ['m', 'm'] };
    default:
      return g;
  }
}
