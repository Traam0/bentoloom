import type { ShapeDef } from "./types";

export type ShapePresetName = "hexagon" | "diamond" | "octagon" | "arrow" | "bevel";

function freeze<T extends Record<string, ShapeDef>>(o: T): Readonly<T> {
  for (const d of Object.values(o)) {
    if (d.aspects) Object.freeze(d.aspects);
    Object.freeze(d);
  }
  return Object.freeze(o);
}

/**
 * Ready-made clip-path shapes. All use percentages, so they scale with the tile.
 * They are NOT in the default pools (that would change existing layouts); opt in:
 *
 *   shapes: { add: { hexagon: SHAPE_PRESETS.hexagon } }
 */
export const SHAPE_PRESETS: Readonly<Record<ShapePresetName, ShapeDef>> = freeze({
  hexagon: {
    clipPath: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
    aspects: ["square", "wide"],
  },
  diamond: {
    clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
    aspects: ["square"],
  },
  octagon: {
    clipPath: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)",
    aspects: ["square"],
  },
  arrow: {
    clipPath: "polygon(0 0, 78% 0, 100% 50%, 78% 100%, 0 100%)",
    aspects: ["wide"],
  },
  bevel: {
    clipPath: "polygon(0 0, 85% 0, 100% 15%, 100% 100%, 15% 100%, 0 85%)",
  },
});
