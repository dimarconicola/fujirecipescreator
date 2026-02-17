export type RenderMode = "interactive" | "settle";

export type RenderCacheKeyInput = {
  imageId: string;
  profileId: string;
  params: Record<string, unknown>;
  mode: RenderMode;
};

function stableSerialize(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`);
  return `{${entries.join(",")}}`;
}

export function computeRenderCacheKey(input: RenderCacheKeyInput): string {
  return stableSerialize(input);
}

export type RendererCapabilities = {
  webgl2: boolean;
  supports3dTextures: boolean;
};

export type PipelineMode = "webgl2" | "cpu_fallback";

export function resolvePipelineMode(capabilities: RendererCapabilities): PipelineMode {
  return capabilities.webgl2 ? "webgl2" : "cpu_fallback";
}

export {
  buildApproxUniforms,
  computeWbMultipliers,
  DEFAULT_APPROX_STRENGTH_SCALARS,
  resolveFilmSimId,
  type ApproxStrengthScalars,
  type ApproxRenderParams,
  type ApproxUniforms,
} from "./approxMath.js";

export {
  ApproxWebglRenderer,
  computeRenderDimensions,
  type ApproxRenderOptions,
} from "./approxRenderer.js";
export { ApproxCpuRenderer, applyCpuApproxPixel } from "./cpuRenderer.js";
