import type { GridConfig, Rect } from "./types";
import { mulberry32, type Rng } from "./rng";

const ratio = (r: Rect) => Math.max(r.w, r.h) / Math.min(r.w, r.h);

// Groups of tiles may be stretchier than single tiles.
const penalty = (r: Rect, count: number) => {
  const p = (ratio(r) - 1) * (ratio(r) - 1);
  return count === 1 ? p : p * 0.3;
};

/**
 * Ordered slicing treemap. Recursively cuts `r` into two rectangles
 * (vertical or horizontal) at the weight-proportional position, for every
 * possible split of items [lo, hi). Guillotine cuts on integer coordinates
 * can never leave holes or overlaps. Returns false if no valid cut exists.
 */
export function partition(
  pre: number[],
  lo: number,
  hi: number,
  r: Rect,
  cfg: GridConfig,
  rng: Rng,
  out: Rect[],
): boolean {
  if (hi - lo === 1) {
    if (r.w < cfg.minSide || r.h < cfg.minSide) return false;
    out[lo] = r;
    return true;
  }

  const span = pre[hi] - pre[lo];
  const cands: { k: number; a: Rect; b: Rect; score: number }[] = [];

  for (let k = lo + 1; k < hi; k++) {
    const frac = (pre[k] - pre[lo]) / span;
    for (const vert of [true, false]) {
      const len = vert ? r.w : r.h;
      const cut = Math.round(len * frac);
      if (cut < cfg.minSide || len - cut < cfg.minSide) continue;

      const a: Rect = vert
        ? { x: r.x, y: r.y, w: cut, h: r.h }
        : { x: r.x, y: r.y, w: r.w, h: cut };
      const b: Rect = vert
        ? { x: r.x + cut, y: r.y, w: r.w - cut, h: r.h }
        : { x: r.x, y: r.y + cut, w: r.w, h: r.h - cut };
      if (a.w * a.h < (k - lo) * cfg.minArea || b.w * b.h < (hi - k) * cfg.minArea) continue;

      const drift = cut / len - frac;
      const score =
        penalty(a, k - lo) + penalty(b, hi - k) + drift * drift * 6 + rng() * 0.6;
      cands.push({ k, a, b, score });
    }
  }

  cands.sort((x, y) => x.score - y.score);
  const tries = Math.min(cands.length, 4);
  const start = tries > 1 && rng() < 0.3 ? 1 : 0;

  for (let t = 0; t < tries; t++) {
    const c = cands[(start + t) % tries];
    const snapshot = out.slice();
    if (
      partition(pre, lo, c.k, c.a, cfg, rng, out) &&
      partition(pre, c.k, hi, c.b, cfg, rng, out)
    ) {
      return true;
    }
    for (let i = lo; i < hi; i++) out[i] = snapshot[i]; // backtrack
  }
  return false;
}

/** Lower is better: squarer tiles, and areas close to their weight. */
export function quality(rects: Rect[], ws: number[], cellsPerWeight: number): number {
  let q = 0;
  rects.forEach((r, i) => {
    q += (ratio(r) - 1) * (ratio(r) - 1);
    const dev = (r.w * r.h) / (ws[i] * cellsPerWeight) - 1;
    q += dev * dev * 0.5;
  });
  return q;
}

/** Always valid, never has holes. Used only if every attempt fails. */
export function fallback(n: number, cfg: GridConfig): { rows: number; rects: Rect[] } {
  const rects: Rect[] = [];
  let y = 0;
  for (let i = 0; i < n; i += cfg.fallbackPerRow) {
    const k = Math.min(cfg.fallbackPerRow, n - i);
    let x = 0;
    for (let j = 0; j < k; j++) {
      const w = Math.floor(cfg.cols / k) + (j < cfg.cols % k ? 1 : 0);
      rects.push({ x, y, w, h: cfg.fallbackRowHeight });
      x += w;
    }
    y += cfg.fallbackRowHeight;
  }
  return { rows: y, rects };
}

/** Run `attempts` randomized partitions and keep the best-scoring one. */
export function solve(
  ws: number[],
  cfg: GridConfig,
  seed: number,
  attempts: number,
): { rows: number; rects: Rect[] } {
  const total = ws.reduce((a, b) => a + b, 0);
  const rows = Math.max(cfg.minSide * 2, Math.ceil((total * cfg.cellsPerWeight) / cfg.cols));
  const pre = [0];
  ws.forEach((w, i) => pre.push(pre[i] + w));

  let best: Rect[] | null = null;
  let bestQ = Infinity;
  for (let a = 0; a < attempts; a++) {
    const rng = mulberry32(seed + a * 0x9e3779b1);
    const out: Rect[] = new Array(ws.length);
    if (!partition(pre, 0, ws.length, { x: 0, y: 0, w: cfg.cols, h: rows }, cfg, rng, out)) continue;
    const q = quality(out, ws, cfg.cellsPerWeight);
    if (q < bestQ) {
      bestQ = q;
      best = out;
    }
  }
  return best ? { rows, rects: best } : fallback(ws.length, cfg);
}
