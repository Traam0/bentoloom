// Measures the real published build. Usage: npm run bench  -> src/data/bench.json
import os from "node:os";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { generateLayout, DEFAULT_CONFIG } from "bentoloom";

const require = createRequire(import.meta.url);
const pkg = require("bentoloom/package.json");

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `img-${i}` }));
const sorted = (a) => [...a].sort((x, y) => x - y);
const median = (a) => sorted(a)[Math.floor(a.length / 2)];
const pct = (a, p) => sorted(a)[Math.min(a.length - 1, Math.floor(a.length * p))];
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const r = (n, d = 2) => +n.toFixed(d);
const time = (fn, warm, runs) => {
  for (let i = 0; i < warm; i++) fn();
  const out = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    fn();
    out.push(performance.now() - t);
  }
  return out;
};
const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const fnv = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
};
const rects = (l, bp) => l.chunks.flatMap((c) => c.tiles.map((t) => t[bp]));

function gapless(layout) {
  for (const c of layout.chunks)
    for (const bp of ["mobile", "desktop"]) {
      const cols = DEFAULT_CONFIG.grid[bp].cols, rows = c.rows[bp];
      const cov = Array.from({ length: rows }, () => new Array(cols).fill(0));
      for (const t of c.tiles) {
        const p = t[bp];
        if (p.x < 0 || p.y < 0 || p.x + p.w > cols || p.y + p.h > rows) return false;
        for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) cov[p.y + j][p.x + i]++;
      }
      if (!cov.flat().every((v) => v === 1)) return false;
    }
  return true;
}
// heuristic: the row fallback gives every tile the same fixed height
const usedFallback = (l, bp) =>
  l.chunks.some((c) => c.tiles.length > 3 && c.tiles.every((t) => t[bp].h === DEFAULT_CONFIG.grid[bp].fallbackRowHeight && t[bp].y % DEFAULT_CONFIG.grid[bp].fallbackRowHeight === 0));
const ratioOf = (p) => Math.max(p.w, p.h) / Math.min(p.w, p.h);

const D = { u: 77, g: 16 }; // desktop cell and gap at a 1100px container
const M = { u: 80.5, g: 12 }; // mobile at a 358px container
const px = (p, s) => ({ w: p.w * s.u + (p.w - 1) * s.g, h: p.h * s.u + (p.h - 1) * s.g });
const pageHeight = (l, bp, s) =>
  l.chunks.reduce((a, c) => a + c.rows[bp] * s.u + (c.rows[bp] - 1) * s.g, 0) + (l.chunks.length - 1) * s.g;

const out = {
  meta: {
    bentoloom: pkg.version,
    node: process.version,
    cpu: os.cpus()[0]?.model?.trim() ?? "unknown",
    cores: os.cpus().length,
    platform: `${os.platform()} ${os.arch()}`,
    date: new Date().toISOString().slice(0, 10),
  },
};

/* 1. scaling */
out.scaling = [12, 24, 48, 120, 240, 480, 1000, 2000, 5000].map((n) => {
  const imgs = items(n);
  const runs = time(() => generateLayout(imgs), 5, n >= 2000 ? 7 : 15);
  return { n, median: r(median(runs), 3), p95: r(pct(runs, 0.95), 3), min: r(Math.min(...runs), 3), perImage: r(median(runs) / n, 4) };
});

/* 2. attempts sweep: speed vs tile squareness (48 images, 100 salts) */
out.attempts = [1, 5, 10, 20, 40, 80].map((a) => {
  const ms = [], ratios = [];
  for (let s = 0; s < 100; s++) {
    const t = performance.now();
    const l = generateLayout(items(48), { config: { attempts: a, salt: `a${s}` } });
    ms.push(performance.now() - t);
    ratios.push(...rects(l, "desktop").map(ratioOf));
  }
  return { attempts: a, ms: r(mean(ms), 2), meanRatio: r(mean(ratios), 3), p90Ratio: r(pct(ratios, 0.9), 2) };
});

/* 3. reliability across 2000 layouts (3..60 images) */
{
  let bad = 0, nondet = 0, fbD = 0, fbM = 0, tiles = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const n = 3 + ((i * 7) % 58), cfg = { config: { salt: `rel${i}` } };
    const l = generateLayout(items(n), cfg);
    if (!gapless(l)) bad++;
    if (JSON.stringify(l) !== JSON.stringify(generateLayout(items(n), cfg))) nondet++;
    if (usedFallback(l, "desktop")) fbD++;
    if (usedFallback(l, "mobile")) fbM++;
    tiles += l.chunks.reduce((a, c) => a + c.tiles.length, 0);
  }
  out.reliability = { layouts: N, tiles, gapViolations: bad, nonDeterministic: nondet, fallbackDesktop: fbD, fallbackMobile: fbM };
}

/* 4. what the layouts look like: 48 images, 300 salts */
{
  const shapes = {}, sizes = new Set(), area = { small: 0, medium: 0, large: 0 };
  let tot = 0, rep = 0, adj = 0, fillers = 0;
  for (let s = 0; s < 300; s++) {
    const l = generateLayout(items(48), { config: { salt: `d${s}` } });
    for (const c of l.chunks) c.tiles.forEach((t, i) => {
      const p = t.desktop, a = p.w * p.h;
      shapes[p.shape] = (shapes[p.shape] ?? 0) + 1;
      sizes.add(`${p.w}x${p.h}`);
      area[a <= 8 ? "small" : a <= 20 ? "medium" : "large"]++;
      tot++;
      if (t.kind === "filler") fillers++;
      if (i) { adj++; if (p.shape === c.tiles[i - 1].desktop.shape) rep++; }
    });
  }
  out.distribution = {
    layouts: 300, tiles: tot, distinctSizes: sizes.size,
    shapes: Object.fromEntries(Object.entries(shapes).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r((v / tot) * 100, 1)])),
    areaShare: Object.fromEntries(Object.entries(area).map(([k, v]) => [k, r((v / tot) * 100, 1)])),
    adjacentRepeatPct: r((rep / adj) * 100, 1),
    fillerPct: r((fillers / tot) * 100, 1),
  };
}

/* 5. crop cost with object-fit: cover, simulated photos */
{
  const PHOTO = [[1.5, 0.5], [1.3333, 0.15], [0.6667, 0.25], [1, 0.1]];
  const pick = (rng) => { let x = rng(), a = 0; for (const [v, p] of PHOTO) { a += p; if (x < a) return v; } return 1.5; };
  const crop = (ph, t) => 1 - Math.min(ph, t) / Math.max(ph, t);
  const res = { bentoloom: [], square: [], "4:3": [], "3:2": [] };
  for (let s = 0; s < 300; s++) {
    const rng = mulberry(s + 1);
    const l = generateLayout(items(48), { config: { salt: `c${s}`, fillers: [] } });
    for (const t of l.chunks.flatMap((c) => c.tiles)) {
      const ph = pick(rng), q = px(t.desktop, D);
      res.bentoloom.push(crop(ph, q.w / q.h));
      res.square.push(crop(ph, 1));
      res["4:3"].push(crop(ph, 4 / 3));
      res["3:2"].push(crop(ph, 3 / 2));
    }
  }
  out.crop = Object.entries(res).map(([k, v]) => ({ layout: k, meanPct: r(mean(v) * 100, 1), p90Pct: r(pct(v, 0.9) * 100, 1) }));
}

/* 6. case study: 40 images, salt "case-study", defaults */
{
  const N = 40, cfg = { config: { salt: "case-study" } }, imgs = items(N);
  const l = generateLayout(imgs, cfg);
  const runs = time(() => generateLayout(imgs, cfg), 5, 15);
  const json = JSON.stringify(l);
  const fp = fnv(l.chunks.flatMap((c) => c.tiles.map((t) => t.desktop.area + t.mobile.area + t.desktop.shape + t.mobile.shape)).join("|"));
  out.caseStudy = {
    items: N, salt: "case-study", chunks: l.chunks.length,
    tiles: l.chunks.reduce((a, c) => a + c.tiles.length, 0),
    fillers: l.chunks.reduce((a, c) => a + c.tiles.filter((t) => t.kind === "filler").length, 0),
    rowsDesktop: l.chunks.map((c) => c.rows.desktop), rowsMobile: l.chunks.map((c) => c.rows.mobile),
    ms: r(median(runs), 3),
    jsonBytes: json.length, gzipBytes: gzipSync(json).length,
    distinctSizes: new Set(rects(l, "desktop").map((p) => `${p.w}x${p.h}`)).size,
    distinctShapes: new Set(rects(l, "desktop").map((p) => p.shape)).size,
    heightDesktop: Math.round(pageHeight(l, "desktop", D)),
    heightMobile: Math.round(pageHeight(l, "mobile", M)),
    heightUniformDesktop: Math.round(Math.ceil(N / 4) * ((1100 - 3 * 16) / 4) + (Math.ceil(N / 4) - 1) * 16),
    fingerprint: fp,
  };
}

/* 6b. tuning: page height vs cellsPerWeight (case-study items) */
out.caseStudy.tuning = [6, 8, 10, 14].map((c) => {
  const l = generateLayout(items(40), { config: { salt: "case-study", grid: { desktop: { cellsPerWeight: c }, mobile: { cellsPerWeight: c * 0.6 } } } });
  return { cellsPerWeight: c, heightDesktop: Math.round(pageHeight(l, "desktop", D)), usedFallback: usedFallback(l, "desktop") };
});

/* 7. bundle size, minified + gzipped with esbuild */
try {
  const esbuild = await import("esbuild");
  const src = readFileSync(new URL("../node_modules/bentoloom/dist/index.js", import.meta.url), "utf8");
  const min = esbuild.transformSync(src, { minify: true, loader: "js" }).code;
  out.bundle = { rawBytes: src.length, minBytes: min.length, minGzipBytes: gzipSync(min).length };
} catch (e) {
  out.bundle = null;
  console.warn("bundle size skipped:", e.message);
}

mkdirSync(new URL("../src/data/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/data/bench.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
