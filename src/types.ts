export type Aspect = "square" | "tall" | "wide";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tunables for one breakpoint's grid. All sizes are in grid cells. */
export interface GridConfig {
  /** Number of grid columns. */
  cols: number;
  /** Cells of area per unit of weight. Bigger = bigger tiles, taller page. */
  cellsPerWeight: number;
  /** Minimum tile side. */
  minSide: number;
  /** Minimum tile area. */
  minArea: number;
  /** Fallback layout: tiles per row. */
  fallbackPerRow: number;
  /** Fallback layout: row height. */
  fallbackRowHeight: number;
}

export interface ShapesConfig {
  /** Shape name -> CSS `border-radius` value. */
  radii: Record<string, string>;
  /** Shape name -> CSS `clip-path` value (`polygon()`, `circle()`, `inset()`, `path()`...). */
  clips: Record<string, string>;
  /** Which shape names may be used for each tile aspect. */
  pools: Record<Aspect, string[]>;
}

export interface LayoutConfig {
  /** Items per chunk. Each chunk is its own independent grid. */
  chunkSize: number;
  /** A last chunk smaller than this is merged into the previous one. */
  minTail: number;
  /** Candidate layouts generated per chunk (best one wins). */
  attempts: number;
  /** Probability (0..1) that an item becomes a large "hero" tile. */
  heroChance: number;
  /** Relative tile sizes: [min, max] ranges plus a fixed filler weight. */
  weights: { hero: [number, number]; normal: [number, number]; filler: number };
  /** Filler kinds, cycled chunk by chunk. `[]` disables fillers. */
  fillers: string[];
  /** Fillers inserted per chunk (needs >= 3 items per filler). */
  fillersPerChunk: number;
  grid: { desktop: GridConfig; mobile: GridConfig };
  shapes: ShapesConfig;
  /** Change to reroll every layout. */
  salt: string;
}

/** A shape needs a `radius`, a `clipPath`, or both. */
export type ShapeDef = (
  | { radius: string; clipPath?: string }
  | { radius?: string; clipPath: string }
) & {
  /** Aspects this shape may be used for. Defaults to all three. */
  aspects?: Aspect[];
};


export interface ShapesInput {
  /** Merged into the existing radii (add or override names). */
  radii?: Record<string, string>;
  /** Merged into the existing clip-paths (add or override names). */
  clips?: Record<string, string>;
  /** Replaces the pool for each aspect given. */
  pools?: Partial<Record<Aspect, string[]>>;
  /** Convenience: register a shape and append it to pools in one go. */
  add?: Record<string, ShapeDef>;
  /** Remove shape names from every pool. */
  remove?: string[];
}

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** What users pass in: everything optional, `shapes` has extra helpers. */
export type UserConfig = Omit<DeepPartial<LayoutConfig>, "shapes"> & {
  shapes?: ShapesInput;
};

export interface Placement {
  /** CSS `grid-area` value: "row-start / col-start / row-end / col-end". */
  area: string;
  /** CSS `border-radius` value. */
  radius: string;
  /** CSS `clip-path` value ("none" when the shape only has a radius). */
  clipPath: string;
  /** Name of the chosen shape. */
  shape: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Tile<T> =
  | { kind: "item"; item: T; index: number; mobile: Placement; desktop: Placement }
  | { kind: "filler"; filler: string; mobile: Placement; desktop: Placement };

export interface Chunk<T> {
  id: string;
  rows: { mobile: number; desktop: number };
  tiles: Tile<T>[];
}

export interface Layout<T> {
  chunks: Chunk<T>[];
  /** Input items in reading order (index matches `tile.index`). */
  items: T[];
}

export interface GenerateOptions<T> {
  /** Per-call config, layered on top of the generator's config. */
  config?: UserConfig;
  /** Stable identity used for seeding. Defaults to id/key/src/file/url, else index. */
  getKey?: (item: T, index: number) => string;
}
