export { generateLayout, createLayoutGenerator, type LayoutGenerator } from "./generate";
export { resolveConfig, DEFAULT_CONFIG, LayoutConfigError } from "./config";
export { tileCssVars, chunkCssVars } from "./css";
export { SHAPE_PRESETS, type ShapePresetName } from "./presets";
export type {
  Aspect,
  Chunk,
  GenerateOptions,
  GridConfig,
  Layout,
  LayoutConfig,
  Placement,
  ShapeDef,
  ShapesConfig,
  ShapesInput,
  Tile,
  UserConfig,
} from "./types";
