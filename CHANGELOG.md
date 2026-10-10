# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
A change to the layout produced for a given input, config and version is treated as a **breaking change**.

## [1.0.0-rc] - 2026-10-10

First stable release.

### Added
- **Layout engine.** `generateLayout(items, options)` turns any list into gapless, seeded bento layouts: chunked grids, weight-proportional slicing-treemap partitioning, best-of-N candidate selection, and a guaranteed hole-free fallback.
- **Deterministic by design.** The same items, config and version always produce the same layout, on the server and in the browser, so hydration is safe. `salt` rerolls everything.
- **Mobile and desktop placements** for every tile, solved independently, each with a ready-to-use CSS `grid-area`, `border-radius`, shape name and `x / y / w / h`.
- **Irregular shapes.** Ten built-in shapes (`circle`, `pill`, `arch`, `tab`, `petalA`, `petalB`, `cornTL`, `cornTR`, `cornBR`, `soft`) chosen from per-aspect pools (`square`, `tall`, `wide`), avoiding immediate repeats.
- **Filler tiles.** Decorative tiles (`stat`, `pulse`, `paw` by default) inserted into each chunk. Fully configurable (`fillers`, `fillersPerChunk`) or disabled with `fillers: []`. Rendering is left to you.
- **Layered configuration.** `DEFAULT_CONFIG` (frozen) < `createLayoutGenerator(defaults)` < per-call `config`. Objects merge deeply, arrays are replaced.
- **Shape extension helpers.** `shapes.add`, `shapes.remove`, `shapes.radii` and `shapes.pools` to extend or fully replace the shape set at any layer.
- **Config validation.** Invalid values throw a `LayoutConfigError` that lists every problem at once, including pools that reference unknown shapes.
- **Generic items.** Any item type works; `tile.item` is your original object. The seed key defaults to `id | key | src | file | url` (or the string itself, or the index) and can be overridden with `getKey`.
- **CSS helpers.** `tileCssVars` and `chunkCssVars` for CSS-variable driven grids (Tailwind, vanilla CSS, CSS-in-JS).
- **Packaging.** Zero runtime dependencies, ESM and CJS builds with bundled type declarations, `sideEffects: false`, Node 18+. Verified with `publint` and `@arethetypeswrong/cli`.
- **Quality.** 66 tests (determinism, gapless-grid invariants for 0–60 items, chunking edge cases, config merging and validation, shapes, golden snapshot) with coverage thresholds enforced in CI.
- **Docs and tooling.** README illustrations generated from the real build (`npm run docs:assets`), GitHub Actions CI on Node 18/20/22, and a tag-driven release workflow that publishes to npm and uses the matching `CHANGELOG.md` section as release notes.
