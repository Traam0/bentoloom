import { describe, expect, it } from "vitest";
import { hash, mulberry32 } from "../src/rng";

describe("hash", () => {
  it("is stable", () => {
    expect(hash("abc")).toBe(hash("abc"));
    expect(hash("")).toBe(2166136261);
  });
  it("differs for different input", () => {
    expect(hash("abc")).not.toBe(hash("abd"));
  });
  it("returns an unsigned 32-bit integer", () => {
    const h = hash("some longer string with ünïcode");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe("mulberry32", () => {
  it("is deterministic per seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(Array.from({ length: 10 }, a)).toEqual(Array.from({ length: 10 }, b));
  });
  it("differs per seed", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it("stays in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
