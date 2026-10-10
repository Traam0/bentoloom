import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, LayoutConfigError, resolveConfig } from "../src";

describe("resolveConfig", () => {
  it("returns the defaults when given nothing", () => {
    expect(resolveConfig()).toEqual(DEFAULT_CONFIG);
  });

  it("returns a fresh, unfrozen copy", () => {
    const c = resolveConfig();
    expect(c).not.toBe(DEFAULT_CONFIG);
    expect(Object.isFrozen(c)).toBe(false);
    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CONFIG.shapes.pools.square)).toBe(true);
  });

  it("deep merges nested objects", () => {
    const c = resolveConfig({ grid: { desktop: { cols: 6 } }, heroChance: 0.5 });
    expect(c.grid.desktop.cols).toBe(6);
    expect(c.grid.desktop.minSide).toBe(DEFAULT_CONFIG.grid.desktop.minSide);
    expect(c.grid.mobile).toEqual(DEFAULT_CONFIG.grid.mobile);
    expect(c.heroChance).toBe(0.5);
  });

  it("replaces arrays instead of merging them", () => {
    const c = resolveConfig({ fillers: ["logo"], weights: { hero: [3, 4] } });
    expect(c.fillers).toEqual(["logo"]);
    expect(c.weights.hero).toEqual([3, 4]);
    expect(c.weights.normal).toEqual(DEFAULT_CONFIG.weights.normal);
  });

  it("ignores undefined values", () => {
    expect(resolveConfig({ chunkSize: undefined }).chunkSize).toBe(DEFAULT_CONFIG.chunkSize);
  });

  it("layers on a custom base", () => {
    const base = resolveConfig({ chunkSize: 8 });
    const c = resolveConfig({ minTail: 2 }, base);
    expect(c.chunkSize).toBe(8);
    expect(c.minTail).toBe(2);
  });

  it("does not mutate its inputs", () => {
    const patch = { fillers: ["x"], shapes: { add: { blob: { radius: "40%" } } } };
    const snapshot = JSON.stringify(patch);
    const base = resolveConfig();
    const baseSnapshot = JSON.stringify(base);
    resolveConfig(patch, base);
    expect(JSON.stringify(patch)).toBe(snapshot);
    expect(JSON.stringify(base)).toBe(baseSnapshot);
  });
});

describe("shapes", () => {
  const blob = "30% 70% 70% 30% / 30% 30% 70% 70%";

  it("add: registers a radius and appends to every pool by default", () => {
    const c = resolveConfig({ shapes: { add: { blob: { radius: blob } } } });
    expect(c.shapes.radii.blob).toBe(blob);
    for (const a of ["square", "tall", "wide"] as const) expect(c.shapes.pools[a]).toContain("blob");
  });

  it("add: honours `aspects`", () => {
    const c = resolveConfig({ shapes: { add: { blob: { radius: blob, aspects: ["square"] } } } });
    expect(c.shapes.pools.square).toContain("blob");
    expect(c.shapes.pools.tall).not.toContain("blob");
    expect(c.shapes.pools.wide).not.toContain("blob");
  });

  it("add: never duplicates a name already in a pool", () => {
    const c = resolveConfig({ shapes: { add: { soft: { radius: "1rem" } } } });
    expect(c.shapes.pools.square.filter((n) => n === "soft")).toHaveLength(1);
    expect(c.shapes.radii.soft).toBe("1rem"); // radius overridden
  });

  it("add does not leak into DEFAULT_CONFIG", () => {
    resolveConfig({ shapes: { add: { blob: { radius: blob } } } });
    expect(DEFAULT_CONFIG.shapes.radii).not.toHaveProperty("blob");
    expect(DEFAULT_CONFIG.shapes.pools.square).not.toContain("blob");
  });

  it("radii: merges into existing radii", () => {
    const c = resolveConfig({ shapes: { radii: { soft: "9px", extra: "1px" } } });
    expect(c.shapes.radii.soft).toBe("9px");
    expect(c.shapes.radii.extra).toBe("1px");
    expect(c.shapes.radii.circle).toBe("9999px");
  });

  it("pools: replaces only the given aspects", () => {
    const c = resolveConfig({ shapes: { pools: { square: ["soft"] } } });
    expect(c.shapes.pools.square).toEqual(["soft"]);
    expect(c.shapes.pools.tall).toEqual(DEFAULT_CONFIG.shapes.pools.tall);
  });

  it("remove: drops names from all pools", () => {
    const c = resolveConfig({ shapes: { remove: ["petalA", "circle"] } });
    for (const a of ["square", "tall", "wide"] as const) {
      expect(c.shapes.pools[a]).not.toContain("petalA");
      expect(c.shapes.pools[a]).not.toContain("circle");
    }
    expect(c.shapes.radii).toHaveProperty("petalA"); // definition kept
  });
});

describe("validation", () => {
  const problems = (patch: Parameters<typeof resolveConfig>[0]) => {
    try {
      resolveConfig(patch);
    } catch (e) {
      expect(e).toBeInstanceOf(LayoutConfigError);
      return (e as LayoutConfigError).problems.join("\n");
    }
    throw new Error("expected resolveConfig to throw");
  };

  it("rejects bad scalars", () => {
    expect(problems({ chunkSize: 0 })).toMatch(/chunkSize/);
    expect(problems({ minTail: -1 })).toMatch(/minTail/);
    expect(problems({ attempts: 1.5 })).toMatch(/attempts/);
    expect(problems({ fillersPerChunk: -1 })).toMatch(/fillersPerChunk/);
    expect(problems({ heroChance: 2 })).toMatch(/heroChance/);
    expect(problems({ heroChance: NaN })).toMatch(/heroChance/);
  });

  it("rejects bad weights", () => {
    expect(problems({ weights: { hero: [3, 2] } })).toMatch(/weights\.hero/);
    expect(problems({ weights: { normal: [0, 1] } })).toMatch(/weights\.normal/);
    expect(problems({ weights: { filler: 0 } })).toMatch(/weights\.filler/);
  });

  it("rejects bad grid values", () => {
    const p = problems({
      grid: { desktop: { cols: 0, minSide: 0, minArea: 0, cellsPerWeight: 0, fallbackRowHeight: 0 } },
    });
    for (const f of ["cols", "minSide", "minArea", "cellsPerWeight", "fallbackRowHeight"])
      expect(p).toMatch(new RegExp(`grid\\.desktop\\.${f}`));
    expect(problems({ grid: { mobile: { fallbackPerRow: 99 } } })).toMatch(/fallbackPerRow/);
  });

  it("rejects unknown or empty shapes", () => {
    expect(problems({ shapes: { pools: { square: ["nope"] } } })).toMatch(/unknown shape "nope"/);
    expect(problems({ shapes: { pools: { tall: [] } } })).toMatch(/pools\.tall must not be empty/);
    expect(problems({ shapes: { radii: { soft: "  " } } })).toMatch(/radii\.soft/);
  });

  it("reports every problem at once", () => {
    const p = problems({ chunkSize: 0, attempts: 0 });
    expect(p).toMatch(/chunkSize/);
    expect(p).toMatch(/attempts/);
  });
});
