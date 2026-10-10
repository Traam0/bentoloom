import { describe, expect, it } from "vitest";
import { chunkCssVars, generateLayout, tileCssVars } from "../src";
import { makeItems } from "./helpers";

describe("css helpers", () => {
  const layout = generateLayout(makeItems(6));

  it("tileCssVars maps both breakpoints", () => {
    const t = layout.chunks[0].tiles[0];
    expect(tileCssVars(t)).toEqual({
      "--gm": t.mobile.area,
      "--gd": t.desktop.area,
      "--brm": t.mobile.radius,
      "--brd": t.desktop.radius,
    });
  });

  it("works for filler tiles too", () => {
    const f = layout.chunks[0].tiles.find((t) => t.kind === "filler")!;
    expect(tileCssVars(f)["--gd"]).toBe(f.desktop.area);
  });

  it("chunkCssVars exposes row counts", () => {
    const c = layout.chunks[0];
    expect(chunkCssVars(c)).toEqual({ "--rm": c.rows.mobile, "--rd": c.rows.desktop });
  });
});
