import type { Chunk, Tile } from "./types";

/**
 * CSS custom properties for a tile. Pair with e.g. Tailwind:
 * `[grid-area:var(--gm)] lg:[grid-area:var(--gd)]`. `--cpm` / `--cpd` hold the
 * clip-path ("none" when the shape has none).
 */
export function tileCssVars<T>(
  tile: Tile<T>,
): Record<"--gm" | "--gd" | "--brm" | "--brd" | "--cpm" | "--cpd", string> {
  return {
    "--gm": tile.mobile.area,
    "--gd": tile.desktop.area,
    "--brm": tile.mobile.radius,
    "--brd": tile.desktop.radius,
    "--cpm": tile.mobile.clipPath,
    "--cpd": tile.desktop.clipPath,
  };
}

/** CSS custom properties with the row count of a chunk's grid, per breakpoint. */
export function chunkCssVars<T>(chunk: Chunk<T>): Record<"--rm" | "--rd", number> {
  return { "--rm": chunk.rows.mobile, "--rd": chunk.rows.desktop };
}
