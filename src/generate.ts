import { resolveConfig } from "./config";
import { solve } from "./partition";
import { hash, mulberry32 } from "./rng";
import { pickShape, toPlacement } from "./shapes";
import type { Chunk, GenerateOptions, Layout, LayoutConfig, Tile, UserConfig } from "./types";

type Slot<T> = { kind: "item"; item: T } | { kind: "filler"; filler: string };

const KEY_FIELDS = ["id", "key", "src", "file", "url"];

function defaultKey(item: unknown, index: number): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    for (const f of KEY_FIELDS) {
      const v = (item as Record<string, unknown>)[f];
      if (typeof v === "string" || typeof v === "number") return String(v);
    }
  }
  return String(index);
}

function chunkItems<T>(items: readonly T[], size: number, minTail: number): T[][] {
  const g: T[][] = [];
  for (let i = 0; i < items.length; i += size) g.push(items.slice(i, i + size));
  if (g.length > 1 && g[g.length - 1].length < minTail) {
    const tail = g.pop()!;
    g[g.length - 1] = g[g.length - 1].concat(tail);
  }
  return g;
}

function build<T>(
  items: readonly T[],
  cfg: LayoutConfig,
  getKey: (item: T, index: number) => string,
): Layout<T> {
  let offset = 0; // items consumed by earlier chunks
  let next = 0; // running tile.index

  const chunks = chunkItems(items, cfg.chunkSize, cfg.minTail).map((group, ci): Chunk<T> => {
    const keys = group.map((it, i) => getKey(it, offset + i));
    offset += group.length;

    const seed = hash(`${cfg.salt}#${ci}#${keys.join("|")}`);
    const rng = mulberry32(seed);

    // 1. slots: items + decorative fillers at random inner positions
    const slots: Slot<T>[] = group.map((item) => ({ kind: "item", item }));
    const nFill =
      cfg.fillers.length > 0 && group.length >= 3
        ? Math.min(cfg.fillersPerChunk, Math.floor(group.length / 3))
        : 0;
    for (let f = 0; f < nFill; f++) {
      const at = 1 + Math.floor(rng() * (slots.length - 1));
      slots.splice(at, 0, {
        kind: "filler",
        filler: cfg.fillers[(ci * cfg.fillersPerChunk + f) % cfg.fillers.length],
      });
    }

    // 2. weights: relative visual size of each slot
    const { hero, normal, filler } = cfg.weights;
    const ws = slots.map((s) =>
      s.kind === "filler"
        ? filler
        : rng() < cfg.heroChance
          ? hero[0] + rng() * (hero[1] - hero[0])
          : normal[0] + rng() * (normal[1] - normal[0]),
    );

    // 3. solve one tiling per breakpoint
    const d = solve(ws, cfg.grid.desktop, seed ^ 0xa5a5a5a5, cfg.attempts);
    const m = solve(ws, cfg.grid.mobile, seed ^ 0x5a5a5a5a, cfg.attempts);

    // 4. shapes + output
    const srng = mulberry32(seed ^ 0xc0ffee);
    const lastD = { v: "" };
    const lastM = { v: "" };

    const tiles = slots.map((s, i): Tile<T> => {
      const desktop = toPlacement(d.rects[i], pickShape(d.rects[i], srng, lastD, cfg.shapes));
      const mobile = toPlacement(m.rects[i], pickShape(m.rects[i], srng, lastM, cfg.shapes));
      if (s.kind === "filler") return { kind: "filler", filler: s.filler, mobile, desktop };
      return { kind: "item", item: s.item, index: next++, mobile, desktop };
    });

    return {
      id: `chunk-${ci}-${seed.toString(36)}`,
      rows: { mobile: m.rows, desktop: d.rows },
      tiles,
    };
  });

  return { chunks, items: [...items] };
}

export interface LayoutGenerator {
  /** The fully resolved config this generator was created with. */
  readonly config: LayoutConfig;
  generate<T>(items: readonly T[], options?: GenerateOptions<T>): Layout<T>;
}

/**
 * Create a generator with your own defaults. Resolution order:
 * built-in defaults < `defaults` < per-call `options.config`.
 */
export function createLayoutGenerator(defaults: UserConfig = {}): LayoutGenerator {
  const base = resolveConfig(defaults);
  return {
    config: base,
    generate<T>(items: readonly T[], options: GenerateOptions<T> = {}): Layout<T> {
      const cfg = options.config ? resolveConfig(options.config, base) : base;
      return build(items, cfg, options.getKey ?? defaultKey);
    },
  };
}

/** One-shot helper using built-in defaults plus `options.config`. */
export function generateLayout<T>(
  items: readonly T[],
  options: GenerateOptions<T> = {},
): Layout<T> {
  return createLayoutGenerator().generate(items, options);
}
