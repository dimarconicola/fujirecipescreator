import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import jpeg from "jpeg-js";
import {
  applyCpuApproxPixel,
  buildApproxUniforms,
  type ApproxRenderParams,
} from "../src/index.js";

type Signature = {
  image: string;
  preset: string;
  samples: Array<[number, number, number]>;
};

function makeParams(overrides: Partial<ApproxRenderParams> = {}): ApproxRenderParams {
  return {
    filmSim: "provia",
    dynamicRange: "dr100",
    highlight: 0,
    shadow: 0,
    color: 0,
    chrome: "off",
    chromeBlue: "off",
    clarity: 0,
    sharpness: 0,
    noiseReduction: 0,
    grain: "off",
    grainSize: "small",
    wbMode: "kelvin",
    wbKelvin: 5600,
    wbShift: {
      a_b: 0,
      r_b: 0,
    },
    ...overrides,
  };
}

function loadJpeg(imagePath: string) {
  const raw = readFileSync(new URL(imagePath, import.meta.url));
  return jpeg.decode(raw, {
    useTArray: true,
    formatAsRGBA: true,
  });
}

function sampleSignature(
  imagePath: string,
  preset: string,
  params: ApproxRenderParams,
  columns = 6,
  rows = 4,
): Signature {
  const decoded = loadJpeg(imagePath);
  const uniforms = buildApproxUniforms(params);
  const samples: Array<[number, number, number]> = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const x = Math.floor(((col + 1) / (columns + 1)) * decoded.width);
      const y = Math.floor(((row + 1) / (rows + 1)) * decoded.height);
      const index = (y * decoded.width + x) * 4;
      const r = decoded.data[index] / 255;
      const g = decoded.data[index + 1] / 255;
      const b = decoded.data[index + 2] / 255;
      const grainSeed = ((row + 1) * 10 + (col + 1)) / 100;

      const pixel = applyCpuApproxPixel(r, g, b, uniforms, grainSeed);
      samples.push([
        Math.round(pixel[0] * 255),
        Math.round(pixel[1] * 255),
        Math.round(pixel[2] * 255),
      ]);
    }
  }

  return {
    image: imagePath,
    preset,
    samples,
  };
}

describe("visual regression signatures", () => {
  it("matches baseline signatures for canonical images", () => {
    const baseline = makeParams();

    const signatures = [
      sampleSignature("../../../assets/images/preview/landscape_v1.jpg", "baseline", baseline),
      sampleSignature("../../../assets/images/preview/portrait_v1.jpg", "baseline", baseline),
      sampleSignature("../../../assets/images/preview/night_v1.jpg", "baseline", baseline),
    ];

    expect(signatures).toMatchSnapshot();
  });

  it("matches stylized signatures for canonical images", () => {
    const stylized = makeParams({
      filmSim: "classic_chrome",
      dynamicRange: "dr400",
      highlight: -1,
      shadow: 2,
      color: -1,
      chrome: "strong",
      chromeBlue: "strong",
      clarity: -2,
      sharpness: -1,
      noiseReduction: 2,
      grain: "weak",
      grainSize: "large",
      wbKelvin: 4300,
      wbShift: { a_b: -2, r_b: 3 },
    });

    const signatures = [
      sampleSignature("../../../assets/images/preview/landscape_v1.jpg", "stylized", stylized),
      sampleSignature("../../../assets/images/preview/portrait_v1.jpg", "stylized", stylized),
      sampleSignature("../../../assets/images/preview/night_v1.jpg", "stylized", stylized),
    ];

    expect(signatures).toMatchSnapshot();
  });
});
