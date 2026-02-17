import { buildApproxUniforms, type ApproxRenderParams, type ApproxUniforms } from "./approxMath.js";
import { computeRenderDimensions, type ApproxRenderOptions } from "./approxRenderer.js";

type SourceSizeCandidate = Partial<{
  naturalWidth: number;
  naturalHeight: number;
  videoWidth: number;
  videoHeight: number;
  width: number;
  height: number;
}>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function getValidDimension(value: number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

function resolveSourceSize(
  image: CanvasImageSource,
  fallbackWidth: number,
  fallbackHeight: number,
): { width: number; height: number } {
  const source = image as SourceSizeCandidate;

  return {
    width: getValidDimension(
      source.naturalWidth,
      getValidDimension(source.videoWidth, getValidDimension(source.width, fallbackWidth)),
    ),
    height: getValidDimension(
      source.naturalHeight,
      getValidDimension(source.videoHeight, getValidDimension(source.height, fallbackHeight)),
    ),
  };
}

function applyToneAndColor(
  r: number,
  g: number,
  b: number,
  uniforms: ApproxUniforms,
): [number, number, number] {
  let nr = r * uniforms.wbMultipliers[0];
  let ng = g * uniforms.wbMultipliers[1];
  let nb = b * uniforms.wbMultipliers[2];

  const luma = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;
  const shadowZone = 1 - clamp(luma / 0.5, 0, 1);
  const highlightZone = clamp((luma - 0.5) / 0.5, 0, 1);

  nr -= shadowZone * uniforms.shadow * 0.12;
  ng -= shadowZone * uniforms.shadow * 0.12;
  nb -= shadowZone * uniforms.shadow * 0.12;

  nr -= highlightZone * uniforms.highlight * 0.12;
  ng -= highlightZone * uniforms.highlight * 0.12;
  nb -= highlightZone * uniforms.highlight * 0.12;

  nr = nr / (1 + uniforms.dynamicRangeCompression * nr);
  ng = ng / (1 + uniforms.dynamicRangeCompression * ng);
  nb = nb / (1 + uniforms.dynamicRangeCompression * nb);

  const gray = 0.299 * nr + 0.587 * ng + 0.114 * nb;
  nr = gray + (nr - gray) * uniforms.saturation;
  ng = gray + (ng - gray) * uniforms.saturation;
  nb = gray + (nb - gray) * uniforms.saturation;

  const detailScale = clamp(1 + uniforms.clarity * 0.3 + uniforms.sharpness * 0.25, 0.5, 1.5);
  const nrPenalty = clamp(1 - uniforms.noiseReduction * 0.35, 0.5, 1);
  nr = gray + (nr - gray) * detailScale * nrPenalty;
  ng = gray + (ng - gray) * detailScale * nrPenalty;
  nb = gray + (nb - gray) * detailScale * nrPenalty;

  return [nr, ng, nb];
}

function applyColorChrome(
  r: number,
  g: number,
  b: number,
  uniforms: ApproxUniforms,
): [number, number, number] {
  let nr = r;
  let ng = g;
  let nb = b;

  const maxChannel = Math.max(nr, ng, nb);
  const minChannel = Math.min(nr, ng, nb);
  const chroma = maxChannel - minChannel;
  const luma = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;

  const saturationMask = smoothstep(0.18, 0.72, chroma);
  const toneMask = smoothstep(0.2, 0.95, luma);
  const chromeMask = saturationMask * toneMask;
  const chromeAmount = uniforms.chromeStrength * chromeMask;

  nr *= 1 - chromeAmount * 0.16;
  ng *= 1 - chromeAmount * 0.16;
  nb *= 1 - chromeAmount * 0.16;

  const gray = 0.299 * nr + 0.587 * ng + 0.114 * nb;
  const saturationBoost = 1 + chromeAmount * 0.24;
  nr = gray + (nr - gray) * saturationBoost;
  ng = gray + (ng - gray) * saturationBoost;
  nb = gray + (nb - gray) * saturationBoost;

  const blueDominance = clamp(nb - Math.max(nr, ng), 0, 1);
  const blueMask = smoothstep(0.05, 0.35, blueDominance) * saturationMask;
  const blueAmount = uniforms.chromeBlueStrength * blueMask;

  nb *= 1 + blueAmount * 0.25;
  nr *= 1 - blueAmount * 0.07;
  ng *= 1 - blueAmount * 0.04;
  nr *= 1 - blueAmount * 0.08;
  ng *= 1 - blueAmount * 0.08;
  nb *= 1 - blueAmount * 0.08;

  return [nr, ng, nb];
}

export function applyCpuApproxPixel(
  r: number,
  g: number,
  b: number,
  uniforms: ApproxUniforms,
  grainSeed: number,
): [number, number, number] {
  let [nr, ng, nb] = applyToneAndColor(r, g, b, uniforms);
  [nr, ng, nb] = applyColorChrome(nr, ng, nb, uniforms);

  const luma = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;
  const grain = (grainSeed - 0.5) * uniforms.grainAmount * (0.35 + 0.65 * (1 - luma));
  nr += grain;
  ng += grain;
  nb += grain;

  return [clamp(nr, 0, 1), clamp(ng, 0, 1), clamp(nb, 0, 1)];
}

export class ApproxCpuRenderer {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  render(
    image: CanvasImageSource,
    params: ApproxRenderParams,
    options: ApproxRenderOptions = {},
  ): void {
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("2D canvas context is not available");
    }

    const uniforms = buildApproxUniforms(params);
    const sourceSize = resolveSourceSize(image, this.canvas.width, this.canvas.height);
    const renderSize = computeRenderDimensions(
      sourceSize.width,
      sourceSize.height,
      options.resolutionScale ?? 1,
    );

    this.canvas.width = renderSize.width;
    this.canvas.height = renderSize.height;

    context.drawImage(image, 0, 0, renderSize.width, renderSize.height);
    const frame = context.getImageData(0, 0, renderSize.width, renderSize.height);
    const { data } = frame;

    for (let index = 0; index < data.length; index += 4) {
      const r = data[index] / 255;
      const g = data[index + 1] / 255;
      const b = data[index + 2] / 255;

      const pixel = index / 4;
      const x = pixel % renderSize.width;
      const y = Math.floor(pixel / renderSize.width);
      const grainFrequency = uniforms.grainSize > 0.5 ? 0.12 : 0.24;
      const grainSeed =
        (Math.sin((x + 1) * 12.9898 * grainFrequency + (y + 1) * 78.233) * 43758.5453) % 1;
      const normalizedSeed = grainSeed < 0 ? grainSeed + 1 : grainSeed;

      const [nr, ng, nb] = applyCpuApproxPixel(r, g, b, uniforms, normalizedSeed);

      data[index] = Math.round(nr * 255);
      data[index + 1] = Math.round(ng * 255);
      data[index + 2] = Math.round(nb * 255);
    }

    context.putImageData(frame, 0, 0);
  }
}
