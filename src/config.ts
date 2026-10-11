import type { Aspect, LayoutConfig, UserConfig } from "./types";

export const ASPECTS: readonly Aspect[] = ["square", "tall", "wide"];

export class LayoutConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid bentoloom config:\n - ${problems.join("\n - ")}`);
    this.name = "LayoutConfigError";
  }
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    Object.values(o as object).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

/** The built-in defaults. Frozen: override via `resolveConfig`/`createLayoutGenerator`. */
export const DEFAULT_CONFIG: Readonly<LayoutConfig> = deepFreeze<LayoutConfig>({
  chunkSize: 12,
  minTail: 4,
  attempts: 20,
  heroChance: 0.15,
  weights: { hero: [2.1, 2.7], normal: [0.8, 1.6], filler: 0.8 },
  fillers: ["stat", "pulse", "paw"],
  fillersPerChunk: 1,
  salt: "",
  grid: {
    desktop: { cols: 12, cellsPerWeight: 10, minSide: 2, minArea: 6, fallbackPerRow: 3, fallbackRowHeight: 4 },
    mobile: { cols: 4, cellsPerWeight: 6, minSide: 2, minArea: 4, fallbackPerRow: 2, fallbackRowHeight: 3 },
  },
  shapes: {
    radii: {
      circle: "9999px",
      pill: "9999px",
      arch: "9999px 9999px 1.5rem 1.5rem",
      tab: "1.5rem 1.5rem 9999px 9999px",
      petalA: "5rem 1rem 5rem 1rem",
      petalB: "1rem 5rem 1rem 5rem",
      cornTL: "6rem 1rem 1rem 1rem",
      cornTR: "1rem 6rem 1rem 1rem",
      cornBR: "1rem 1rem 6rem 1rem",
      soft: "2.5rem",
    },
    clips: {},
    pools: {
      square: ["circle", "petalA", "petalB", "soft", "cornTL", "cornBR"],
      tall: ["arch", "tab", "pill", "petalA", "petalB", "cornBR", "cornTL"],
      wide: ["pill", "petalA", "petalB", "cornTL", "cornBR", "cornTR", "soft"],
    },
  },
});

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function clone<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clone) as T;
  if (isPlain(v)) {
    const out: Plain = {};
    for (const k of Object.keys(v)) out[k] = clone(v[k]);
    return out as T;
  }
  return v;
}

/** Objects merge recursively; arrays and primitives are replaced. `undefined` is ignored. */
function merge(base: Plain, patch: Plain): Plain {
  const out: Plain = { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    if (pv === undefined) continue;
    const bv = base[k];
    out[k] = isPlain(bv) && isPlain(pv) ? merge(bv, pv) : clone(pv);
  }
  return out;
}

const CLIP_RE = /^(polygon|circle|ellipse|inset|path|rect|xywh|shape|url)\(/i;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

const isInt = (n: unknown, min: number): boolean =>
  typeof n === "number" && Number.isInteger(n) && n >= min;
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function validate(c: LayoutConfig): void {
  const p: string[] = [];
  if (!isInt(c.chunkSize, 1)) p.push("chunkSize must be an integer >= 1");
  if (!isInt(c.minTail, 0)) p.push("minTail must be an integer >= 0");
  if (!isInt(c.attempts, 1)) p.push("attempts must be an integer >= 1");
  if (!isInt(c.fillersPerChunk, 0)) p.push("fillersPerChunk must be an integer >= 0");
  if (!isNum(c.heroChance) || c.heroChance < 0 || c.heroChance > 1)
    p.push("heroChance must be between 0 and 1");

  for (const k of ["hero", "normal"] as const) {
    const [lo, hi] = c.weights[k];
    if (!isNum(lo) || !isNum(hi) || lo <= 0 || lo > hi)
      p.push(`weights.${k} must be [min, max] with 0 < min <= max`);
  }
  if (!isNum(c.weights.filler) || c.weights.filler <= 0) p.push("weights.filler must be > 0");

  for (const bp of ["desktop", "mobile"] as const) {
    const g = c.grid[bp];
    if (!isInt(g.cols, 1)) p.push(`grid.${bp}.cols must be an integer >= 1`);
    if (!isNum(g.cellsPerWeight) || g.cellsPerWeight <= 0)
      p.push(`grid.${bp}.cellsPerWeight must be > 0`);
    if (!isInt(g.minSide, 1)) p.push(`grid.${bp}.minSide must be an integer >= 1`);
    if (!isInt(g.minArea, 1)) p.push(`grid.${bp}.minArea must be an integer >= 1`);
    if (!isInt(g.fallbackPerRow, 1) || g.fallbackPerRow > g.cols)
      p.push(`grid.${bp}.fallbackPerRow must be an integer between 1 and cols`);
    if (!isInt(g.fallbackRowHeight, 1)) p.push(`grid.${bp}.fallbackRowHeight must be an integer >= 1`);
  }

  for (const [name, radius] of Object.entries(c.shapes.radii)) {
    if (typeof radius !== "string" || !radius.trim())
      p.push(`shapes.radii.${name} must be a non-empty CSS border-radius string`);
  }
  for (const [name, clip] of Object.entries(c.shapes.clips)) {
     if (typeof clip !== "string" || !CLIP_RE.test(clip.trim()))
       p.push(`shapes.clips.${name} must be a CSS clip-path value such as polygon(...), circle(...), inset(...) or path(...)`);
  }
  for (const a of ASPECTS) {
    const pool = c.shapes.pools[a];
    if (!pool.length) p.push(`shapes.pools.${a} must not be empty`);
    for (const name of pool)
      if(!has(c.shapes.radii, name) && !has(c.shapes.clips, name))
        p.push(`shapes.pools.${a} references unknown shape "${name}"`);
  }
  if (p.length) throw new LayoutConfigError(p);
}

/**
 * Layer `patch` on top of `base` (default: DEFAULT_CONFIG), validate, and
 * return a fresh config. Never mutates its inputs.
 */
export function resolveConfig(
  patch: UserConfig = {},
  base: Readonly<LayoutConfig> = DEFAULT_CONFIG,
): LayoutConfig {
  const { shapes: sp, ...rest } = patch;
  const cfg = merge(clone(base) as unknown as Plain, rest as Plain) as unknown as LayoutConfig;

  const radii = { ...cfg.shapes.radii, ...(sp?.radii ?? {}) };
  const clips = { ...cfg.shapes.clips, ...(sp?.clips ?? {}) };
  const pools = {} as Record<Aspect, string[]>;
  for (const a of ASPECTS) pools[a] = [...(sp?.pools?.[a] ?? cfg.shapes.pools[a])];
 
   for (const [name, def] of Object.entries(sp?.add ?? {})) {
     if (def.radius === undefined && def.clipPath === undefined)
       throw new LayoutConfigError([`shapes.add.${name} needs a radius, a clipPath, or both`]);
     if (def.radius !== undefined) radii[name] = def.radius;
     if (def.clipPath !== undefined) clips[name] = def.clipPath;
     for (const a of def.aspects ?? ASPECTS) if (!pools[a].includes(name)) pools[a].push(name);
   }
   if (sp?.remove?.length) {
     for (const a of ASPECTS) pools[a] = pools[a].filter((n) => !sp.remove!.includes(n));
   }

  cfg.shapes = { radii, clips, pools };
  validate(cfg);
  return cfg;
}
