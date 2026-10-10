import { describe, expect, it } from "vitest";
import { createLayoutGenerator, generateLayout, resolveConfig } from "../src";
import { aspectOf } from "../src/shapes";
import { expectGapless, makeItems } from "./helpers";

const itemTiles = <T>(l: ReturnType<typeof generateLayout<T>>) =>
  l.chunks.map((c) => c.tiles.filter((t) => t.kind === "item").length);
const fillerTiles = <T>(l: ReturnType<typeof generateLayout<T>>) =>
  l.chunks.flatMap((c) => c.tiles.filter((t) => t.kind === "filler"));

describe("determinism", () => {
  it("same input + salt gives identical output", () => {
    const items = makeItems(30);
    expect(generateLayout(items)).toEqual(generateLayout(items));
  });

  it("salt rerolls the layout", () => {
    const items = makeItems(30);
    const a = generateLayout(items, { config: { salt: "a" } });
    const b = generateLayout(items, { config: { salt: "b" } });
    expect(a.chunks.map((c) => c.id)).not.toEqual(b.chunks.map((c) => c.id));
  });

  it("strings and {id} objects with the same keys seed identically", () => {
    const objs = makeItems(10);
    const a = generateLayout(objs);
    const b = generateLayout(objs.map((o) => o.id));
    expect(a.chunks.map((c) => c.id)).toEqual(b.chunks.map((c) => c.id));
    expect(a.chunks[0].tiles.map((t) => t.desktop.area)).toEqual(
      b.chunks[0].tiles.map((t) => t.desktop.area),
    );
  });

  it("custom getKey is used for seeding", () => {
    const items = makeItems(10);
    const a = generateLayout(items, { getKey: (i) => i.id });
    const b = generateLayout(items, { getKey: (i) => i.id + "!" });
    expect(a.chunks[0].id).not.toBe(b.chunks[0].id);
  });

  it("falls back to the index for items without any key field", () => {
    const items = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }];
    expect(generateLayout(items)).toEqual(generateLayout(items.map((x) => ({ ...x }))));
    expect(generateLayout([1, 2, 3, 4] as unknown[])).toBeTruthy(); // primitives non-string
  });

  it("accepts numeric key fields", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(generateLayout(items).chunks).toHaveLength(1);
  });
});

describe("chunking", () => {
  it("returns no chunks for no items", () => {
    expect(generateLayout([])).toEqual({ chunks: [], items: [] });
  });

  it.each([
    [1, [1]],
    [12, [12]],
    [13, [13]], // tail of 1 < minTail merges back
    [24, [12, 12]],
    [25, [12, 13]],
    [26, [12, 14]],
    [28, [12, 12, 4]], // tail == minTail stays separate
  ])("%i items -> item tiles per chunk %j", (n, expected) => {
    expect(itemTiles(generateLayout(makeItems(n)))).toEqual(expected);
  });

  it("respects custom chunkSize / minTail", () => {
    const l = generateLayout(makeItems(10), { config: { chunkSize: 4, minTail: 3 } });
    expect(itemTiles(l)).toEqual([4, 6]);
  });

  it("keeps reading order: indices are sequential and items preserved", () => {
    const items = makeItems(30);
    const l = generateLayout(items);
    const idx = l.chunks.flatMap((c) =>
      c.tiles.flatMap((t) => (t.kind === "item" ? [t.index] : [])),
    );
    expect(idx).toEqual(items.map((_, i) => i));
    expect(l.items).toEqual(items);
    for (const c of l.chunks)
      for (const t of c.tiles) if (t.kind === "item") expect(t.item).toBe(items[t.index]);
  });

  it("does not hold on to the caller's array", () => {
    const items = makeItems(5);
    const l = generateLayout(items);
    expect(l.items).not.toBe(items);
  });
});

describe("fillers", () => {
  it("adds one filler per chunk by default, cycling kinds", () => {
    const l = generateLayout(makeItems(36));
    expect(fillerTiles(l).map((t) => (t.kind === "filler" ? t.filler : ""))).toEqual([
      "stat",
      "pulse",
      "paw",
    ]);
  });

  it("never puts a filler first", () => {
    for (let n = 3; n < 40; n++)
      for (const c of generateLayout(makeItems(n)).chunks) expect(c.tiles[0].kind).toBe("item");
  });

  it("skips fillers for tiny chunks", () => {
    expect(fillerTiles(generateLayout(makeItems(2)))).toHaveLength(0);
  });

  it("can be disabled", () => {
    expect(fillerTiles(generateLayout(makeItems(30), { config: { fillers: [] } }))).toHaveLength(0);
    expect(
      fillerTiles(generateLayout(makeItems(30), { config: { fillersPerChunk: 0 } })),
    ).toHaveLength(0);
  });

  it("supports custom kinds and several per chunk", () => {
    const l = generateLayout(makeItems(12), {
      config: { fillers: ["logo", "quote"], fillersPerChunk: 2 },
    });
    expect(fillerTiles(l).map((t) => (t.kind === "filler" ? t.filler : ""))).toEqual(["logo", "quote"]);
  });

  it("caps fillers at one per three items", () => {
    const l = generateLayout(makeItems(4), { config: { fillersPerChunk: 5 } });
    expect(fillerTiles(l)).toHaveLength(1);
  });
});

describe("geometry", () => {
  it("is gapless and overlap-free for 0..60 items across salts", () => {
    for (let n = 0; n <= 60; n++)
      for (const salt of ["", "x", "petcare"]) {
        const cfg = resolveConfig({ salt });
        expectGapless(generateLayout(makeItems(n), { config: { salt } }), cfg);
      }
  });

  it("stays gapless with custom grids", () => {
    const config = {
      chunkSize: 6,
      grid: { desktop: { cols: 8, cellsPerWeight: 8 }, mobile: { cols: 2, fallbackPerRow: 1 } },
    };
    expectGapless(generateLayout(makeItems(40), { config }), resolveConfig(config));
  });

  it("uses the gapless fallback when no partition satisfies the constraints", () => {
    const config = { grid: { desktop: { minSide: 7 }, mobile: { minSide: 3 } } };
    const l = generateLayout(makeItems(10), { config });
    expectGapless(l, resolveConfig(config));
    // fallback rows hold `fallbackPerRow` tiles at fixed height
    const first = l.chunks[0].tiles[0].desktop;
    expect(first.h).toBe(4);
  });

  it("respects minSide when a real partition is found", () => {
    const l = generateLayout(makeItems(30));
    for (const c of l.chunks)
      for (const t of c.tiles) {
        expect(Math.min(t.desktop.w, t.desktop.h)).toBeGreaterThanOrEqual(2);
        expect(Math.min(t.mobile.w, t.mobile.h)).toBeGreaterThanOrEqual(2);
      }
  });

  it("reports row counts consistent with the grid", () => {
    const l = generateLayout(makeItems(12));
    const c = l.chunks[0];
    const maxD = Math.max(...c.tiles.map((t) => t.desktop.y + t.desktop.h));
    expect(c.rows.desktop).toBe(maxD);
  });
});

describe("shapes in output", () => {
  it("picks shapes from the pool matching each tile's aspect", () => {
    const cfg = resolveConfig();
    const l = generateLayout(makeItems(40));
    for (const c of l.chunks)
      for (const t of c.tiles)
        for (const bp of ["desktop", "mobile"] as const) {
          const p = t[bp];
          expect(cfg.shapes.pools[aspectOf(p)]).toContain(p.shape);
          expect(p.radius).toBe(cfg.shapes.radii[p.shape]);
        }
  });

  it("avoids immediate repeats when the pool allows", () => {
    const l = generateLayout(makeItems(60));
    let repeats = 0;
    let total = 0;
    for (const c of l.chunks)
      c.tiles.forEach((t, i) => {
        if (i === 0) return;
        total++;
        if (t.desktop.shape === c.tiles[i - 1].desktop.shape) repeats++;
      });
    expect(repeats / total).toBeLessThan(0.15);
  });

  it("uses only a custom pool when replaced", () => {
    const l = generateLayout(makeItems(30), {
      config: {
        shapes: {
          radii: { only: "7px" },
          pools: { square: ["only"], tall: ["only"], wide: ["only"] },
        },
      },
    });
    for (const c of l.chunks)
      for (const t of c.tiles) {
        expect(t.desktop.shape).toBe("only");
        expect(t.mobile.radius).toBe("7px");
      }
  });

  it("an added shape can show up in a layout", () => {
    const l = generateLayout(makeItems(60), {
      config: {
        shapes: {
          pools: { square: ["blob"], tall: ["blob"], wide: ["blob"] },
          add: { blob: { radius: "40%" } },
        },
      },
    });
    expect(l.chunks[0].tiles.every((t) => t.desktop.shape === "blob")).toBe(true);
  });
});

describe("createLayoutGenerator", () => {
  it("exposes the resolved config", () => {
    const g = createLayoutGenerator({ chunkSize: 5 });
    expect(g.config.chunkSize).toBe(5);
    expect(g.config.heroChance).toBe(0.15);
  });

  it("applies generator defaults, then per-call overrides", () => {
    const g = createLayoutGenerator({ chunkSize: 5, fillers: [] });
    expect(itemTiles(g.generate(makeItems(10)))).toEqual([5, 5]);
    expect(itemTiles(g.generate(makeItems(10), { config: { chunkSize: 10 } }))).toEqual([10]);
    // the per-call override did not leak into the generator
    expect(itemTiles(g.generate(makeItems(10)))).toEqual([5, 5]);
  });

  it("shape additions accumulate across layers", () => {
    const g = createLayoutGenerator({ shapes: { add: { a: { radius: "1px" } } } });
    const l = g.generate(makeItems(40), {
      config: {
        shapes: {
          add: { b: { radius: "2px" } },
          pools: { square: ["a", "b"], tall: ["a", "b"], wide: ["a", "b"] },
        },
      },
    });
    const used = new Set(l.chunks.flatMap((c) => c.tiles.map((t) => t.desktop.shape)));
    expect([...used].sort()).toEqual(["a", "b"]);
  });

  it("throws on invalid config at creation time", () => {
    expect(() => createLayoutGenerator({ chunkSize: 0 })).toThrow(/chunkSize/);
  });

  it("generateLayout throws on invalid per-call config", () => {
    expect(() => generateLayout(makeItems(3), { config: { heroChance: 5 } })).toThrow(/heroChance/);
  });
});

describe("golden snapshot", () => {
  it("locks the algorithm output (changes here are breaking changes)", () => {
    const l = generateLayout(makeItems(14), { config: { salt: "golden" } });
    const summary = l.chunks.map((c) => ({
      id: c.id,
      rows: c.rows,
      tiles: c.tiles.map((t) => [
        t.kind === "item" ? t.index : t.filler,
        t.desktop.area,
        t.desktop.shape,
        t.mobile.area,
        t.mobile.shape,
      ]),
    }));
    expect(summary).toMatchSnapshot();
  });
});
