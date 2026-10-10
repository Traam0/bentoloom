import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { DEFAULT_CONFIG, generateLayout } from "../dist/index.js";

const OUT = new URL("../assets/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const write = (name, svg) => writeFileSync(new URL(name, OUT), svg);

const FONT = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const SERIF = `ui-serif, Georgia, "Times New Roman", serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const INK = "#2b2a28";
const MUTED = "#78716c";
const CARD = "#fbf8f3";
const LINE = "#e7dfd2";
const ACCENT = "#1f5f54";
const PALETTE = ["#f4b9a4", "#9fd3c7", "#f6d58e", "#b8c4f0", "#e9a8c1", "#a8d5a2", "#f0c4a0", "#9cc3e6"];

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => {
    const v = (n >> s) & 255;
    return Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

const defs = () =>
  `<defs>${PALETTE.map(
    (c, i) =>
      `<linearGradient id="p${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, -0.14)}"/></linearGradient>`,
  ).join("")}</defs>`;

const r2 = (n) => +n.toFixed(2);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x, y, s, { size = 14, weight = 400, fill = INK, anchor = "start", family = FONT, italic = false } = {}) =>
  `<text x="${r2(x)}" y="${r2(y)}" font-family='${family}' font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ""}>${esc(s)}</text>`;

function svg(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${defs()}<rect width="${w}" height="${h}" rx="22" fill="${CARD}" stroke="${LINE}"/>${body}</svg>\n`;
}

/* ───────── shapes: CSS border-radius -> SVG path (with CSS corner clamping) ───────── */
function pathFor(x, y, w, h, radiusCss, rem) {
  const parts = radiusCss.split("/")[0].trim().split(/\s+/);
  const px = (t) =>
    t.endsWith("rem") ? parseFloat(t) * rem : t.endsWith("px") ? parseFloat(t) : t.endsWith("%") ? (parseFloat(t) / 100) * Math.min(w, h) : 0;
  const v = parts.map(px);
  const [tl, tr, br, bl] =
    v.length === 1 ? [v[0], v[0], v[0], v[0]] : v.length === 2 ? [v[0], v[1], v[0], v[1]] : v.length === 3 ? [v[0], v[1], v[2], v[1]] : v;
  const lim = (len, sum) => (sum > 0 ? len / sum : Infinity);
  const f = Math.min(1, lim(w, tl + tr), lim(w, bl + br), lim(h, tl + bl), lim(h, tr + br));
  const [a, b, c, d] = [tl * f, tr * f, br * f, bl * f].map(r2);
  return `M${r2(x + a)} ${r2(y)}H${r2(x + w - b)}A${b} ${b} 0 0 1 ${r2(x + w)} ${r2(y + b)}V${r2(y + h - c)}A${c} ${c} 0 0 1 ${r2(x + w - c)} ${r2(y + h)}H${r2(x + d)}A${d} ${d} 0 0 1 ${r2(x)} ${r2(y + h - d)}V${r2(y + a)}A${a} ${a} 0 0 1 ${r2(x + a)} ${r2(y)}Z`;
}


const ASPECT_DIMS = { square: [11, 11], tall: [9, 15], wide: [16, 10] };
function aspectIcons(cx, y, list, fill = MUTED) {
  const gap = 8;
  const total = list.reduce((s, a) => s + ASPECT_DIMS[a][0], 0) + gap * (list.length - 1);
  let x = cx - total / 2;
  return list.map((a) => {
    const [w, h] = ASPECT_DIMS[a];
    const out = `<rect x="${r2(x)}" y="${r2(y - h / 2)}" width="${w}" height="${h}" rx="2.5" fill="none" stroke="${fill}" stroke-width="1.6"/>`;
    x += w + gap;
    return out;
  }).join("");
}

/* ───────── glyphs ───────── */
const photoGlyph = (cx, cy, s) =>
  `<g fill="#fff" fill-opacity=".62"><circle cx="${r2(cx - 0.22 * s)}" cy="${r2(cy - 0.2 * s)}" r="${r2(0.09 * s)}"/><path d="M${r2(cx - 0.5 * s)} ${r2(cy + 0.35 * s)}L${r2(cx - 0.12 * s)} ${r2(cy - 0.05 * s)}L${r2(cx + 0.08 * s)} ${r2(cy + 0.18 * s)}L${r2(cx + 0.22 * s)} ${r2(cy + 0.02 * s)}L${r2(cx + 0.5 * s)} ${r2(cy + 0.35 * s)}Z"/></g>`;

const pawGlyph = (cx, cy, s, fill) =>
  `<g transform="translate(${r2(cx - s / 2)} ${r2(cy - s / 2)}) scale(${r2(s / 24)})" fill="${fill}"><circle cx="5.5" cy="11" r="2.2"/><circle cx="9.5" cy="6.5" r="2.2"/><circle cx="14.5" cy="6.5" r="2.2"/><circle cx="18.5" cy="11" r="2.2"/><path d="M12 12c-3 0-5.5 3-5.5 5.2 0 1.7 1.4 2.3 2.8 2.3 1 0 1.8-.4 2.7-.4s1.7.4 2.7.4c1.4 0 2.8-.6 2.8-2.3C17.5 15 15 12 12 12z"/></g>`;

function fillerSvg(kind, d, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const m = Math.min(w, h);
  if (kind === "stat")
    return `<path d="${d}" fill="${ACCENT}"/>${text(cx, cy + m * 0.06, "4.8★", { size: m * 0.3, fill: "#fff", anchor: "middle", family: SERIF, italic: true })}${text(cx, cy + m * 0.3, "90+ reviews", { size: Math.max(7, m * 0.12), fill: "#ffffffbb", anchor: "middle" })}`;
  if (kind === "pulse") {
    const s = (w * 0.7) / 200;
    return `<path d="${d}" fill="#dcebe4"/><path transform="translate(${r2(cx - 100 * s)} ${r2(cy - 30 * s)}) scale(${r2(s)})" d="M0 30H44L52 30L58 8L68 52L76 20L82 30H130L138 30L144 8L154 52L162 20L168 30H200" fill="none" stroke="${ACCENT}" stroke-width="${r2(3 / Math.max(s, 0.2) * 0.45)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (kind === "paw") return `<path d="${d}" fill="#f6dfc2"/>${pawGlyph(cx, cy, m * 0.5, "#9a5b2e")}`;
  return `<path d="${d}" fill="#e5e0d8"/>`;
}

/* ───────── draw a real generated chunk ───────── */
function drawChunk(chunk, bp, grid, { u, gap, rem }) {
  let out = "";
  for (const t of chunk.tiles) {
    const p = t[bp];
    const x = p.x * (u + gap);
    const y = p.y * (u + gap);
    const w = p.w * u + (p.w - 1) * gap;
    const h = p.h * u + (p.h - 1) * gap;
    const d = pathFor(x, y, w, h, p.radius, rem);
    if (t.kind === "item") {
      out += `<path d="${d}" fill="url(#p${(t.index * 3) % PALETTE.length})"/>${photoGlyph(x + w / 2, y + h / 2, Math.min(w, h) * 0.5)}`;
    } else out += fillerSvg(t.filler, d, x, y, w, h);
  }
  const rows = chunk.rows[bp];
  return { svg: out, w: grid.cols * u + (grid.cols - 1) * gap, h: rows * u + (rows - 1) * gap };
}

/* ═════════════ 1. hero ═════════════ */
{
  const HERO_SALT = process.env.HERO_SALT ?? "bentoloom";
  const items = Array.from({ length: 8 }, (_, i) => ({ id: `photo-${i}` }));
  const chunk = generateLayout(items, { config: { salt: HERO_SALT } }).chunks[0];
  const dk = drawChunk(chunk, "desktop", DEFAULT_CONFIG.grid.desktop, { u: 44, gap: 8, rem: 8 });
  const mb = drawChunk(chunk, "mobile", DEFAULT_CONFIG.grid.mobile, { u: 28, gap: 5, rem: 5 });

  const bx = 40, by = 72, pad = 20, bar = 34;
  const bw = dk.w + pad * 2, bh = dk.h + pad * 2 + bar;
  const phPad = 12;
  const pw = mb.w + phPad * 2 + 10, ph = mb.h + phPad * 2 + 30;
  const px = bx + bw + 60, py = by;
  const W = px + pw + 40;
  const H = Math.max(by + bh, py + ph) + 70;

  const body =
    text(bx, 44, `desktop · ${DEFAULT_CONFIG.grid.desktop.cols} columns`, { size: 15, weight: 600, fill: MUTED }) +
    text(px, 44, `mobile · ${DEFAULT_CONFIG.grid.mobile.cols} columns`, { size: 15, weight: 600, fill: MUTED }) +
    `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="16" fill="#fffdf9" stroke="${LINE}"/>` +
    `<path d="M${bx} ${by + bar}H${bx + bw}" stroke="${LINE}"/>` +
    [0, 1, 2].map((i) => `<circle cx="${bx + 18 + i * 16}" cy="${by + bar / 2}" r="4.5" fill="${["#f2a79b", "#f3d08a", "#a8d5a2"][i]}"/>`).join("") +
    `<rect x="${bx + 90}" y="${by + 9}" width="${bw - 110}" height="16" rx="8" fill="${CARD}" stroke="${LINE}"/>` +
    `<g transform="translate(${bx + pad} ${by + bar + pad})">${dk.svg}</g>` +
    `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="30" fill="${INK}"/>` +
    `<rect x="${px + 5}" y="${py + 5}" width="${pw - 10}" height="${ph - 10}" rx="26" fill="#fffdf9"/>` +
    `<rect x="${px + pw / 2 - 18}" y="${py + 11}" width="36" height="7" rx="3.5" fill="${INK}"/>` +
    `<g transform="translate(${px + 5 + phPad} ${py + 30 + phPad})">${mb.svg}</g>` +
    text(W / 2, H - 26, "One call. Same tiles, two breakpoints, zero holes.", { size: 15, fill: MUTED, anchor: "middle", family: SERIF, italic: true });
  write("hero.svg", svg(W, H, "A generated bento gallery layout shown on desktop and mobile", body));
}

/* ═════════════ 2. pipeline ═════════════ */
{
  const W = 1200, H = 336, cw = 172, cg = 24, cx0 = 24, cy = 36, ch = 222;
  const cards = [
    ["Items", "any T[] · keyed"],
    ["Chunks", "12 each · seeded"],
    ["Weights", "hero · normal · filler"],
    ["Partition", "slicing treemap"],
    ["Best of 20", "lowest quality score"],
    ["Shapes", "radius by aspect"],
  ];
  const mini = [
    // 1 items
    (ox) => [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${ox + 30 + (i % 3) * 38}" y="${100 + Math.floor(i / 3) * 38}" width="30" height="30" rx="8" fill="url(#p${i})"/>`).join(""),
    // 2 chunks
    (ox) =>
      [0, 1].map((g) => [0, 1, 2, 3].map((i) => `<rect x="${ox + 18 + g * 82 + (i % 2) * 22}" y="${100 + Math.floor(i / 2) * 22}" width="18" height="18" rx="5" fill="url(#p${(g * 4 + i) % 8})"/>`).join("") + `<path d="M${ox + 16 + g * 82} 150h42" stroke="${MUTED}" stroke-width="1.5" stroke-linecap="round"/>`).join("") +
      text(ox + 86, 176, "hash(salt, i, keys)", { size: 10.5, fill: MUTED, anchor: "middle", family: MONO }),
    // 3 weights
    (ox) =>
      [30, 18, 46, 20, 22, 34].map((hh, i) => `<rect x="${ox + 20 + i * 24}" y="${180 - hh}" width="16" height="${hh}" rx="4" fill="${i === 3 ? ACCENT : i === 2 ? shade(PALETTE[0], -0.1) : PALETTE[i % 8]}"/>`).join("") +
      `<path d="M${ox + 16} 182h140" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>`,
    // 4 partition
    (ox) => {
      const t = [[0, 0, 5, 5, 0], [0, 5, 5, 3, 1], [5, 0, 7, 4, 2], [5, 4, 4, 4, 3], [9, 4, 3, 4, 4]];
      return `<g transform="translate(${ox + 28} 106)">${t.map(([x, y, w, h, c]) => `<rect x="${x * 9 + 1}" y="${y * 9 + 1}" width="${w * 9 - 2}" height="${h * 9 - 2}" rx="5" fill="url(#p${c})"/>`).join("")}<path d="M45 0V72M45 36H108M81 36V72" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="4 3" fill="none"/></g>`;
    },
    // 5 best of 20
    (ox) =>
      [0, 1, 2, 3].map((i) => {
        const x = ox + 22 + (i % 2) * 66, y = 98 + Math.floor(i / 2) * 44, win = i === 2;
        const cuts = [`M${x + 22} ${y}V${y + 34}M${x + 22} ${y + 16}H${x + 56}`, `M${x + 36} ${y}V${y + 34}M${x} ${y + 18}H${x + 36}`, `M${x + 28} ${y}V${y + 34}M${x + 28} ${y + 17}H${x + 56}M${x + 42} ${y + 17}V${y + 34}`, `M${x} ${y + 10}H${x + 56}M${x + 30} ${y + 10}V${y + 34}`][i];
        return `<rect x="${x}" y="${y}" width="56" height="34" rx="6" fill="#fff" stroke="${win ? ACCENT : LINE}" stroke-width="${win ? 2.2 : 1.2}"/><path d="${cuts}" stroke="${win ? ACCENT : "#cfc6b6"}" stroke-width="1.4" fill="none"/>${win ? `<circle cx="${x + 56}" cy="${y}" r="8" fill="${ACCENT}"/><path d="M${x + 52} ${y}l3 3 5-6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ""}`;
      }).join(""),
    // 6 shapes
    (ox) =>
      [["9999px", 30, 30, 26, 98], ["1.5rem 1.5rem 9999px 9999px", 28, 38, 76, 96], ["5rem 1rem 5rem 1rem", 40, 34, 24, 140], ["9999px", 52, 22, 80, 144]]
        .map(([rad, w, h, x, y], i) => `<path d="${pathFor(ox + x, y, w, h, rad, 5)}" fill="url(#p${[1, 4, 2, 3][i]})"/>`).join(""),
  ];
  let body = "";
  cards.forEach(([title, sub], i) => {
    const ox = cx0 + i * (cw + cg);
    body += `<rect x="${ox}" y="${cy}" width="${cw}" height="${ch}" rx="18" fill="#fffdf9" stroke="${LINE}"/><circle cx="${ox + 24}" cy="${cy + 26}" r="13" fill="${ACCENT}"/>${text(ox + 24, cy + 31, i + 1, { size: 14, weight: 700, fill: "#fff", anchor: "middle" })}${mini[i](ox)}${text(ox + cw / 2, cy + 196, title, { size: 17, weight: 700, anchor: "middle" })}${text(ox + cw / 2, cy + 214, sub, { size: 12, fill: MUTED, anchor: "middle" })}`;
    if (i < cards.length - 1) body += `<path d="M${ox + cw + 6} ${cy + ch / 2 - 7}l8 7-8 7" stroke="${MUTED}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  body += `<rect x="24" y="${cy + ch + 20}" width="${W - 48}" height="40" rx="20" fill="${ACCENT}"/>${text(W / 2, cy + ch + 45, "Layout → chunks[] → tiles[] → { mobile, desktop } placements: grid-area · border-radius · shape", { size: 14, weight: 600, fill: "#fff", anchor: "middle" })}`;
  write("pipeline.svg", svg(W, H, "Pipeline: items, chunks, weights, partition, best of 20, shapes", body));
}

/* ═════════════ 3. partition walk-through ═════════════ */
{
  const W = 1060, H = 330, u = 18, pw = 12 * u, ph = 8 * u, py = 96;
  const wts = [["A", 1.5], ["B", 0.9], ["C", 1.6], ["D", 1.0], ["E", 1.0]];
  const total = wts.reduce((s, [, w]) => s + w, 0);
  let body = text(30, 40, "weights", { size: 13, weight: 700, fill: MUTED });
  let bx = 100;
  wts.forEach(([n, w], i) => {
    const bw = (w / total) * 900;
    body += `<rect x="${bx + 1}" y="22" width="${bw - 2}" height="26" rx="8" fill="url(#p${i})"/>${text(bx + bw / 2, 40, `${n}  ${w}`, { size: 13, weight: 600, anchor: "middle" })}`;
    bx += bw;
  });
  const steps = [
    { tiles: [[0, 0, 12, 8, "A B C D E", -1]], cuts: "", t1: "Start: one rectangle", t2: "holds every item" },
    { tiles: [[0, 0, 5, 8, "A · B", -1], [5, 0, 7, 8, "C · D · E", -1]], cuts: "M5 0V8", t1: "Cut where weight splits", t2: "(A+B) / total ≈ 5 of 12" },
    { tiles: [[0, 0, 5, 5, "A", 0], [0, 5, 5, 3, "B", 1], [5, 0, 7, 4, "C", 2], [5, 4, 7, 4, "D · E", -1]], cuts: "M0 5H5M5 4H12", t1: "Recurse into each half", t2: "best-scoring cut wins" },
    { tiles: [[0, 0, 5, 5, "A", 0], [0, 5, 5, 3, "B", 1], [5, 0, 7, 4, "C", 2], [5, 4, 4, 4, "D", 3], [9, 4, 3, 4, "E", 4]], cuts: "M9 4V8", t1: "Done: no holes", t2: "integer coords, exact fit" },
  ];
  const gx = (W - 4 * pw) / 5;
  steps.forEach((s, i) => {
    const ox = gx + i * (pw + gx);
    body += `<rect x="${ox - 6}" y="${py - 6}" width="${pw + 12}" height="${ph + 12}" rx="14" fill="#fffdf9" stroke="${LINE}"/>`;
    s.tiles.forEach(([x, y, w, h, label, c]) => {
      body += `<rect x="${ox + x * u + 2}" y="${py + y * u + 2}" width="${w * u - 4}" height="${h * u - 4}" rx="7" fill="${c < 0 ? "#efe9de" : `url(#p${c})`}" ${c < 0 ? `stroke="#cfc6b6" stroke-dasharray="4 3"` : ""}/>${text(ox + x * u + (w * u) / 2, py + y * u + (h * u) / 2 + 5, label, { size: 14, weight: 700, anchor: "middle", fill: c < 0 ? MUTED : INK })}`;
    });
    if (s.cuts) body += `<path transform="translate(${ox} ${py}) scale(${u})" d="${s.cuts}" stroke="${ACCENT}" stroke-width="${2.4 / u}" stroke-dasharray="${5 / u} ${4 / u}" stroke-linecap="round" fill="none"/>`;
    body += `<circle cx="${ox + 12}" cy="${py + ph + 36}" r="11" fill="${ACCENT}"/>${text(ox + 12, py + ph + 41, i + 1, { size: 12, weight: 700, fill: "#fff", anchor: "middle" })}${text(ox + 30, py + ph + 35, s.t1, { size: 14, weight: 700 })}${text(ox + 30, py + ph + 53, s.t2, { size: 12, fill: MUTED })}`;
    if (i < 3) body += `<path d="M${ox + pw + gx / 2 - 5} ${py + ph / 2 - 7}l8 7-8 7" stroke="${MUTED}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  write("partition.svg", svg(W, H, "Slicing treemap: cut the grid at weight-proportional positions, recursively", body));
}

/* ═════════════ 4. shapes gallery ═════════════ */
{
  const pools = DEFAULT_CONFIG.shapes.pools;
  const names = Object.keys(DEFAULT_CONFIG.shapes.radii);
  const size = { circle: [64, 64], pill: [100, 48], arch: [56, 84], tab: [56, 84], petalA: [76, 76], petalB: [76, 76], cornTL: [76, 76], cornTR: [100, 62], cornBR: [76, 76], soft: [76, 76] };
  const cols = 4, cw = 236, chh = 168, gx = 18, gy = 18, W = cols * cw + (cols + 1) * gx, rows = 3, H = rows * chh + (rows + 1) * gy + 8;
  let body = "";
  const cell = (i) => ({ x: gx + (i % cols) * (cw + gx), y: gy + Math.floor(i / cols) * (chh + gy) });
  names.forEach((n, i) => {
    const { x, y } = cell(i);
    const [w, h] = size[n];
    const ci = (i * 3 + 1) % 8;
    const aspects = ["square", "tall", "wide"].filter((a) => pools[a].includes(n));
    body += `<rect x="${x}" y="${y}" width="${cw}" height="${chh}" rx="18" fill="#fffdf9" stroke="${LINE}"/><path d="${pathFor(x + (cw - w) / 2, y + 22 + (92 - h) / 2, w, h, DEFAULT_CONFIG.shapes.radii[n], 6)}" fill="url(#p${ci})"/>${text(x + cw / 2, y + 134, n, { size: 15, weight: 700, anchor: "middle", family: MONO })}${aspectIcons(x + cw / 2, y + 150, aspects)}`;
  });
  {
    const { x, y } = cell(names.length);
    body += `<rect x="${x}" y="${y}" width="${cw}" height="${chh}" rx="18" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="7 6"/><rect x="${x + cw / 2 - 36}" y="${y + 32}" width="72" height="72" rx="26" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="4 4"/><path d="M${x + cw / 2} ${y + 54}v28M${x + cw / 2 - 14} ${y + 68}h28" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round"/>${text(x + cw / 2, y + 134, "shapes.add", { size: 15, weight: 700, anchor: "middle", family: MONO, fill: ACCENT })}${text(x + cw / 2, y + 154, "your own, any aspect", { size: 13, fill: MUTED, anchor: "middle" })}`;
  }
  {
    const { x, y } = cell(names.length + 1);
    body += `<rect x="${x}" y="${y}" width="${cw}" height="${chh}" rx="18" fill="#f3eee4" stroke="${LINE}"/>${text(x + 24, y + 42, "Aspect pools", { size: 15, weight: 700 })}${[["square", "w = h"], ["tall", "h > w"], ["wide", "w > h"]].map(([a, d], k) => `${aspectIcons(x + 36, y + 76 + k * 30, [a], ACCENT)}${text(x + 64, y + 81 + k * 30, a, { size: 14, weight: 600, family: MONO })}${text(x + 140, y + 81 + k * 30, d, { size: 13, fill: MUTED })}`).join("")}`;
  }
  write("shapes.svg", svg(W, H, "The ten built-in shapes plus your own via shapes.add", body));
}

/* ═════════════ 5. config layering ═════════════ */
{
  const W = 1104, H = 250, bw = 222, bh = 110, gap = 48, x0 = 36, y0 = 34;
  const boxes = [
    ["Built-in defaults", "DEFAULT_CONFIG", "frozen · always safe", "#fffdf9", INK],
    ["Your project defaults", "createLayoutGenerator({…})", "set once, reuse everywhere", "#fffdf9", INK],
    ["Per call", "generate(items, { config })", "one-off override", "#fffdf9", INK],
    ["Resolved config", "validated copy", "or LayoutConfigError", ACCENT, "#fff"],
  ];
  let body = "";
  boxes.forEach(([t, code, sub, fill, ink], i) => {
    const x = x0 + i * (bw + gap);
    body += `<rect x="${x}" y="${y0}" width="${bw}" height="${bh}" rx="18" fill="${fill}" stroke="${fill === ACCENT ? ACCENT : LINE}"/>${text(x + bw / 2, y0 + 34, t, { size: 16, weight: 700, anchor: "middle", fill: ink })}${text(x + bw / 2, y0 + 62, code, { size: 12.5, anchor: "middle", family: MONO, fill: fill === ACCENT ? "#d6ebe5" : ACCENT })}${text(x + bw / 2, y0 + 88, sub, { size: 12.5, anchor: "middle", fill: fill === ACCENT ? "#ffffffcc" : MUTED })}`;
    if (i < 3) body += `<path d="M${x + bw + 12} ${y0 + bh / 2}h${gap - 24}m-8 -7l8 7-8 7" stroke="${MUTED}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  const chips = ["objects merge deeply", "arrays are replaced", "shapes.add / remove accumulate", "later layers win"];
  let cx = 36;
  chips.forEach((c) => {
    const w = c.length * 7.4 + 30;
    body += `<rect x="${cx}" y="178" width="${w}" height="32" rx="16" fill="#f3eee4" stroke="${LINE}"/>${text(cx + w / 2, 199, c, { size: 13, weight: 600, anchor: "middle", fill: INK })}`;
    cx += w + 14;
  });
  write("config-layers.svg", svg(W, H, "Config resolution order: defaults, generator defaults, per-call overrides", body));
}

/* ═════════════ 6. benchmark (measured, not invented) ═════════════ */
{
  const sizes = [12, 48, 120, 240, 480, 1000];
  const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const results = sizes.map((n) => {
    const imgs = Array.from({ length: n }, (_, i) => `img-${i}.jpg`);
    for (let k = 0; k < 5; k++) generateLayout(imgs);
    const runs = [];
    for (let k = 0; k < 15; k++) {
      const t = performance.now();
      generateLayout(imgs);
      runs.push(performance.now() - t);
    }
    return [n, median(runs)];
  });
  console.log("benchmark (ms, median of 15):", results.map(([n, ms]) => `${n}: ${ms.toFixed(2)}`).join("  "));
  const W = 780, rowH = 44, top = 92, H = top + sizes.length * rowH + 52, max = Math.max(...results.map(([, ms]) => ms));
  let body = text(32, 44, "generateLayout() time vs. number of images", { size: 18, weight: 700 }) + text(32, 66, `median of 15 runs · Node ${process.version} · includes both breakpoints, 20 attempts per chunk`, { size: 12.5, fill: MUTED });
  results.forEach(([n, ms], i) => {
    const y = top + i * rowH, bw = Math.max(6, (ms / max) * 450);
    body += `${text(112, y + 21, `${n} images`, { size: 14, weight: 600, anchor: "end" })}<rect x="128" y="${y + 4}" width="${r2(bw)}" height="26" rx="8" fill="url(#p${(i * 3 + 1) % 8})"/>${text(128 + bw + 10, y + 22, `${ms < 10 ? ms.toFixed(2) : ms.toFixed(1)} ms`, { size: 14, weight: 700 })}`;
  });
  body += text(32, H - 20, "Chunks are independent, so cost grows linearly with the number of images. Run `npm run docs:assets` to measure on your machine.", { size: 12, fill: MUTED });
  write("bench.svg", svg(W, H, "Benchmark: layout generation time by number of images", body));
}
console.log("assets written");
