import { expect } from "vitest";
import { DEFAULT_CONFIG } from "../src";
import type { Layout, LayoutConfig } from "../src";

/** Every cell of every chunk grid must be covered exactly once (no holes, no overlaps). */
export function expectGapless<T>(layout: Layout<T>, cfg: Readonly<LayoutConfig> = DEFAULT_CONFIG) {
  for (const chunk of layout.chunks) {
    for (const bp of ["mobile", "desktop"] as const) {
      const cols = cfg.grid[bp].cols;
      const rows = chunk.rows[bp];
      const cover = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
      for (const t of chunk.tiles) {
        const p = t[bp];
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(cols);
        expect(p.y + p.h).toBeLessThanOrEqual(rows);
        expect(p.area).toBe(`${p.y + 1} / ${p.x + 1} / ${p.y + p.h + 1} / ${p.x + p.w + 1}`);
        for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) cover[p.y + j][p.x + i]++;
      }
      expect(cover.flat().every((c) => c === 1)).toBe(true);
    }
  }
}

export const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `img-${i}`, alt: `Image ${i}` }));
