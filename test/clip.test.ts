import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  LayoutConfigError,
  SHAPE_PRESETS,
  createLayoutGenerator,
  generateLayout,
  resolveConfig,
  tileCssVars,
} from "../src";
import { aspectOf } from "../src/shapes";
import { expectGapless, makeItems } from "./helpers";

const HEX = "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)";
const allPools = (name: string) => ({ square: [name], tall: [name], wide: [name] });

describe("clip-path config", () => {
  it("ships with no clip-paths in the defaults (layouts stay unchanged)", () => {
    expect(DEFAULT_CONFIG.shapes.clips).toEqual({});
    expect(Object.isFrozen(DEFAULT_CONFIG.shapes.clips)).toBe(true);
  });

  it("add: clipPath only registers a clip and appends to every pool", () => {
    const c = resolveConfig({ shapes: { add: { hex: { clipPath: HEX } } } });
    expect(c.shapes.clips.hex).toBe(HEX);
    expect(c.shapes.radii).not.toHaveProperty("hex");
    for (const a of ["square", "tall", "wide"] as const) expect(c.shapes.pools[a]).toContain("hex");
  });

  it("add: radius and clipPath can be combined", () => {
    const c = resolveConfig({ shapes: { add: { both: { radius: "1rem", clipPath: HEX, aspects: ["wide"] } } } });
    expect(c.shapes.radii.both).toBe("1rem");
    expect(c.shapes.clips.both).toBe(HEX);
    expect(c.shapes.pools.wide).toContain("both");
    expect(c.shapes.pools.square).not.toContain("both");
  });

  it("add: a shape with neither radius nor clipPath is rejected", () => {
    expect(() => resolveConfig({ shapes: { add: { nope: {} as never } } })).toThrow(LayoutConfigError);
    expect(() => resolveConfig({ shapes: { add: { nope: { aspects: ["square"] } as never } } })).toThrow(
      /needs a radius, a clipPath, or both/,
    );
  });

  it("add: clipPath on an existing name adds a clip and keeps its radius", () => {
    const c = resolveConfig({ shapes: { add: { soft: { clipPath: HEX } } } });
    expect(c.shapes.radii.soft).toBe("2.5rem");
    expect(c.shapes.clips.soft).toBe(HEX);
  });

  it("clips: merges into existing clips", () => {
    const base = resolveConfig({ shapes: { clips: { a: "circle(50%)" } } });
    const c = resolveConfig({ shapes: { clips: { b: "inset(0 round 1rem)" } } }, base);
    expect(c.shapes.clips).toEqual({ a: "circle(50%)", b: "inset(0 round 1rem)" });
  });

  it("a pool may reference a clip-only shape", () => {
    const c = resolveConfig({ shapes: { clips: { hex: HEX }, pools: allPools("hex") } });
    expect(c.shapes.pools.square).toEqual(["hex"]);
  });

  it("remove works for clip shapes", () => {
    const c = resolveConfig({ shapes: { add: { hex: { clipPath: HEX } }, remove: ["hex"] } });
    for (const a of ["square", "tall", "wide"] as const) expect(c.shapes.pools[a]).not.toContain("hex");
  });

  it("does not leak into DEFAULT_CONFIG", () => {
    resolveConfig({ shapes: { add: { hex: { clipPath: HEX } } } });
    expect(DEFAULT_CONFIG.shapes.clips).toEqual({});
  });

  it.each(["", "   ", "nope", "rotate(3deg)", "hex"])("rejects invalid clip value %j", (bad) => {
    expect(() => resolveConfig({ shapes: { clips: { x: bad } } })).toThrow(/shapes\.clips\.x/);
  });

  it.each([
    "polygon(0 0, 100% 0, 50% 100%)",
    "circle(50%)",
    "ellipse(50% 40% at 50% 50%)",
    "inset(0 round 2rem)",
    "path('M0 0L10 10Z')",
    "url(#clip)",
    "  POLYGON(0 0, 1px 1px, 0 1px)  ",
  ])("accepts clip value %j", (ok) => {
    expect(() => resolveConfig({ shapes: { clips: { x: ok } } })).not.toThrow();
  });

  it("still rejects pools naming a shape that is in neither map", () => {
    expect(() => resolveConfig({ shapes: { pools: { square: ["ghost"] } } })).toThrow(/unknown shape "ghost"/);
  });
});

describe("clip-path in layouts", () => {
  it("defaults emit clipPath 'none' and keep radii", () => {
    const cfg = resolveConfig();
    for (const c of generateLayout(makeItems(20)).chunks)
      for (const t of c.tiles)
        for (const bp of ["mobile", "desktop"] as const) {
          expect(t[bp].clipPath).toBe("none");
          expect(t[bp].radius).toBe(cfg.shapes.radii[t[bp].shape]);
        }
  });

  it("clip-only shapes emit their clipPath and radius '0'", () => {
    const l = generateLayout(makeItems(30), {
      config: { shapes: { add: { hex: { clipPath: HEX } }, pools: allPools("hex") } },
    });
    for (const c of l.chunks)
      for (const t of c.tiles) {
        expect(t.desktop.clipPath).toBe(HEX);
        expect(t.mobile.clipPath).toBe(HEX);
        expect(t.desktop.radius).toBe("0");
      }
  });

  it("clip shapes respect aspect pools", () => {
    const l = generateLayout(makeItems(60), {
      config: {
        shapes: {
          clips: { dia: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" },
          pools: { square: ["dia"] },
        },
      },
    });
    for (const c of l.chunks)
      for (const t of c.tiles)
        for (const bp of ["desktop", "mobile"] as const)
          if (t[bp].shape === "dia") expect(aspectOf(t[bp])).toBe("square");
  });

  it("adding clip shapes never breaks the gapless guarantee", () => {
    const config = { shapes: { add: { ...SHAPE_PRESETS } } };
    for (let n = 0; n <= 40; n++) expectGapless(generateLayout(makeItems(n), { config }), resolveConfig(config));
  });

  it("shape choice does not alter geometry for the same pool size", () => {
    const base = generateLayout(makeItems(24));
    const withClips = generateLayout(makeItems(24), {
      config: { shapes: { add: { hex: { clipPath: HEX } } } },
    });
    expect(withClips.chunks.map((c) => c.tiles.map((t) => t.desktop.area))).toEqual(
      base.chunks.map((c) => c.tiles.map((t) => t.desktop.area)),
    );
  });

  it("tileCssVars exposes clip-paths for both breakpoints", () => {
    const l = generateLayout(makeItems(6), {
      config: { shapes: { add: { hex: { clipPath: HEX } }, pools: allPools("hex") } },
    });
    const vars = tileCssVars(l.chunks[0].tiles[0]);
    expect(vars["--cpm"]).toBe(HEX);
    expect(vars["--cpd"]).toBe(HEX);
  });

  it("works through createLayoutGenerator layers", () => {
    const g = createLayoutGenerator({ shapes: { add: { hex: { clipPath: HEX } } } });
    const l = g.generate(makeItems(40), { config: { shapes: { pools: allPools("hex") } } });
    expect(l.chunks[0].tiles.every((t) => t.desktop.clipPath === HEX)).toBe(true);
  });
});

describe("SHAPE_PRESETS", () => {
  it("are frozen and each has a valid clipPath", () => {
    expect(Object.isFrozen(SHAPE_PRESETS)).toBe(true);
    for (const [name, def] of Object.entries(SHAPE_PRESETS)) {
      expect(Object.isFrozen(def)).toBe(true);
      expect(def.clipPath, name).toMatch(/^polygon\(/);
    }
  });

  it("can all be added at once", () => {
    const c = resolveConfig({ shapes: { add: { ...SHAPE_PRESETS } } });
    for (const name of Object.keys(SHAPE_PRESETS)) expect(c.shapes.clips).toHaveProperty(name);
  });

  it("respect their default aspects", () => {
    const c = resolveConfig({ shapes: { add: { diamond: SHAPE_PRESETS.diamond, arrow: SHAPE_PRESETS.arrow } } });
    expect(c.shapes.pools.square).toContain("diamond");
    expect(c.shapes.pools.wide).not.toContain("diamond");
    expect(c.shapes.pools.wide).toContain("arrow");
    expect(c.shapes.pools.tall).not.toContain("arrow");
  });

  it("presets are percentage-only polygons (scale with any tile size)", () => {
    for (const def of Object.values(SHAPE_PRESETS)) expect(def.clipPath).not.toMatch(/px|rem|calc/);
  });
});
