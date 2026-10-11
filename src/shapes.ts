import type { Aspect, Placement, Rect, ShapesConfig } from "./types";
import type { Rng } from "./rng";

export const aspectOf = (r: Rect): Aspect =>
  r.w === r.h ? "square" : r.h > r.w ? "tall" : "wide";

/** Pick a shape for the rect's aspect, trying to avoid repeating the previous one. */
export function pickShape(
  r: Rect,
  rng: Rng,
  last: { v: string },
  shapes: ShapesConfig,
): { name: string; radius: string; clipPath: string } {
  const pool = shapes.pools[aspectOf(r)];
  let name = pool[Math.floor(rng() * pool.length)];
  for (let i = 0; i < 4 && name === last.v; i++) {
    name = pool[Math.floor(rng() * pool.length)];
  }
  last.v = name;
  return { name, radius: shapes.radii[name] ?? "0", clipPath: shapes.clips[name] ?? "none" };
}

export const toPlacement = (
  r: Rect,
  s: { name: string; radius: string; clipPath: string },
): Placement => ({
  area: `${r.y + 1} / ${r.x + 1} / ${r.y + r.h + 1} / ${r.x + r.w + 1}`,
  radius: s.radius,
  clipPath: s.clipPath,
  shape: s.name,
  x: r.x,
  y: r.y,
  w: r.w,
  h: r.h,
});
