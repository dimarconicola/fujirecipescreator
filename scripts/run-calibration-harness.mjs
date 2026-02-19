import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { applyCpuApproxPixel, buildApproxUniforms } from "@fuji/engine-webgl";
import {
  isOracleSourcePolicySupported,
  sha256Hex,
  validateOracleIndexContract,
} from "./lib/calibrationOracleIndex.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = {
  mode: "evaluate",
  manifestPath: "calibration/manifest.v1.json",
  thresholdsPath: "calibration/thresholds.v1.json",
  oracleDir: "artifacts/calibration/oracle-v1",
  oracleIndexPath: null,
  outputDir: null,
  baselineMetricsPath: null,
  requireOracleSource: "any",
};

const D65_WHITE = {
  x: 0.95047,
  y: 1,
  z: 1.08883,
};

const SRGB_TO_LINEAR = new Float64Array(256);
for (let index = 0; index < 256; index += 1) {
  const normalized = index / 255;
  SRGB_TO_LINEAR[index] =
    normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--mode") {
      options.mode = argv[index + 1] ?? options.mode;
      index += 1;
      continue;
    }
    if (token === "--manifest") {
      options.manifestPath = argv[index + 1] ?? options.manifestPath;
      index += 1;
      continue;
    }
    if (token === "--thresholds") {
      options.thresholdsPath = argv[index + 1] ?? options.thresholdsPath;
      index += 1;
      continue;
    }
    if (token === "--oracle-dir") {
      options.oracleDir = argv[index + 1] ?? options.oracleDir;
      index += 1;
      continue;
    }
    if (token === "--oracle-index") {
      options.oracleIndexPath = argv[index + 1] ?? options.oracleIndexPath;
      index += 1;
      continue;
    }
    if (token === "--output-dir") {
      options.outputDir = argv[index + 1] ?? options.outputDir;
      index += 1;
      continue;
    }
    if (token === "--baseline-metrics") {
      options.baselineMetricsPath = argv[index + 1] ?? options.baselineMetricsPath;
      index += 1;
      continue;
    }
    if (token === "--require-oracle-source") {
      options.requireOracleSource = argv[index + 1] ?? options.requireOracleSource;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (options.mode !== "record" && options.mode !== "evaluate") {
    throw new Error(`Unsupported mode "${options.mode}". Use "record" or "evaluate".`);
  }
  if (!isOracleSourcePolicySupported(options.requireOracleSource)) {
    throw new Error(
      `Unsupported oracle source policy "${options.requireOracleSource}". Use "any" or "camera_engine".`,
    );
  }

  return options;
}

function resolveFromRoot(relativeOrAbsolutePath) {
  if (path.isAbsolute(relativeOrAbsolutePath)) {
    return relativeOrAbsolutePath;
  }
  return path.resolve(ROOT_DIR, relativeOrAbsolutePath);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertManifestShape(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Calibration manifest must be an object.");
  }
  if (!Array.isArray(manifest.scenes) || manifest.scenes.length === 0) {
    throw new Error("Calibration manifest must include at least one scene.");
  }
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    throw new Error("Calibration manifest must include at least one case.");
  }
  if (!manifest.base_params || typeof manifest.base_params !== "object") {
    throw new Error("Calibration manifest must include base_params.");
  }
}

function assertThresholdShape(thresholds) {
  if (!thresholds || typeof thresholds !== "object") {
    throw new Error("Calibration thresholds must be an object.");
  }
  if (!thresholds.frame || typeof thresholds.frame !== "object") {
    throw new Error("Calibration thresholds must include frame limits.");
  }
  if (!thresholds.directional || typeof thresholds.directional !== "object") {
    throw new Error("Calibration thresholds must include directional limits.");
  }
  const hasDeltaThreshold =
    typeof thresholds.frame.max_mean_delta_e00 === "number" ||
    typeof thresholds.frame.max_mean_delta_e76 === "number";
  if (!hasDeltaThreshold) {
    throw new Error(
      "Calibration thresholds must include max_mean_delta_e00 (or legacy max_mean_delta_e76).",
    );
  }
}

function clamp01(value) {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function safeDivision(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function p95(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[index];
}

function fLab(value) {
  const delta = 6 / 29;
  const deltaCubed = delta * delta * delta;
  if (value > deltaCubed) {
    return Math.cbrt(value);
  }
  return value / (3 * delta * delta) + 4 / 29;
}

function linearRgbToLab(linearR, linearG, linearB) {
  const x =
    0.4124564 * linearR +
    0.3575761 * linearG +
    0.1804375 * linearB;
  const y =
    0.2126729 * linearR +
    0.7151522 * linearG +
    0.072175 * linearB;
  const z =
    0.0193339 * linearR +
    0.119192 * linearG +
    0.9503041 * linearB;

  const fx = fLab(x / D65_WHITE.x);
  const fy = fLab(y / D65_WHITE.y);
  const fz = fLab(z / D65_WHITE.z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
    y,
  };
}

function deltaE00(labA, labB) {
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const L1 = labA.l;
  const a1 = labA.a;
  const b1 = labA.b;
  const L2 = labB.l;
  const a2 = labB.a;
  const b2 = labB.b;

  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cMean = (c1 + c2) / 2;
  const cMeanPow7 = Math.pow(cMean, 7);
  const g = 0.5 * (1 - Math.sqrt(cMeanPow7 / (cMeanPow7 + Math.pow(25, 7))));

  const a1Prime = (1 + g) * a1;
  const a2Prime = (1 + g) * a2;
  const c1Prime = Math.hypot(a1Prime, b1);
  const c2Prime = Math.hypot(a2Prime, b2);

  let h1Prime = (Math.atan2(b1, a1Prime) * 180) / Math.PI;
  let h2Prime = (Math.atan2(b2, a2Prime) * 180) / Math.PI;
  h1Prime = normalizeAngleDegrees(h1Prime);
  h2Prime = normalizeAngleDegrees(h2Prime);

  const deltaLPrime = L2 - L1;
  const deltaCPrime = c2Prime - c1Prime;

  let deltahPrime = 0;
  if (c1Prime * c2Prime !== 0) {
    const hueDiff = h2Prime - h1Prime;
    if (Math.abs(hueDiff) <= 180) {
      deltahPrime = hueDiff;
    } else if (hueDiff > 180) {
      deltahPrime = hueDiff - 360;
    } else {
      deltahPrime = hueDiff + 360;
    }
  }

  const deltaHPrime =
    2 * Math.sqrt(c1Prime * c2Prime) * Math.sin((deltahPrime * Math.PI) / 360);

  const LMeanPrime = (L1 + L2) / 2;
  const CMeanPrime = (c1Prime + c2Prime) / 2;

  let hMeanPrime = h1Prime + h2Prime;
  if (c1Prime * c2Prime === 0) {
    hMeanPrime = h1Prime + h2Prime;
  } else if (Math.abs(h1Prime - h2Prime) <= 180) {
    hMeanPrime = (h1Prime + h2Prime) / 2;
  } else if (h1Prime + h2Prime < 360) {
    hMeanPrime = (h1Prime + h2Prime + 360) / 2;
  } else {
    hMeanPrime = (h1Prime + h2Prime - 360) / 2;
  }

  const t =
    1 -
    0.17 * Math.cos(((hMeanPrime - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hMeanPrime * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hMeanPrime + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hMeanPrime - 63) * Math.PI) / 180);

  const deltaTheta = 30 * Math.exp(-Math.pow((hMeanPrime - 275) / 25, 2));
  const cMeanPrimePow7 = Math.pow(CMeanPrime, 7);
  const rC = 2 * Math.sqrt(cMeanPrimePow7 / (cMeanPrimePow7 + Math.pow(25, 7)));
  const sL =
    1 +
    (0.015 * Math.pow(LMeanPrime - 50, 2)) /
      Math.sqrt(20 + Math.pow(LMeanPrime - 50, 2));
  const sC = 1 + 0.045 * CMeanPrime;
  const sH = 1 + 0.015 * CMeanPrime * t;
  const rT = -Math.sin((2 * deltaTheta * Math.PI) / 180) * rC;

  const lTerm = deltaLPrime / (kL * sL);
  const cTerm = deltaCPrime / (kC * sC);
  const hTerm = deltaHPrime / (kH * sH);

  return Math.sqrt(
    lTerm * lTerm +
      cTerm * cTerm +
      hTerm * hTerm +
      rT * cTerm * hTerm,
  );
}

function normalizeAngleDegrees(angle) {
  let value = angle % 360;
  if (value < 0) {
    value += 360;
  }
  return value;
}

function angularDifferenceDegrees(a, b) {
  const delta = Math.abs(normalizeAngleDegrees(a) - normalizeAngleDegrees(b));
  return delta > 180 ? 360 - delta : delta;
}

function decodeJpeg(buffer) {
  const decoded = jpeg.decode(buffer, {
    useTArray: true,
  });
  if (!decoded || !decoded.width || !decoded.height || !decoded.data) {
    throw new Error("JPEG decode failed.");
  }
  return decoded;
}

function resizeNearest(decoded, maxDimension) {
  const { width, height, data } = decoded;
  const sourceMax = Math.max(width, height);
  if (sourceMax <= maxDimension) {
    return {
      width,
      height,
      data: Buffer.from(data),
    };
  }

  const scale = maxDimension / sourceMax;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const output = Buffer.alloc(targetWidth * targetHeight * 4);

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor((y / targetHeight) * height));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x / targetWidth) * width));
      const sourceIndex = (sourceY * width + sourceX) * 4;
      const targetIndex = (y * targetWidth + x) * 4;
      output[targetIndex] = data[sourceIndex];
      output[targetIndex + 1] = data[sourceIndex + 1];
      output[targetIndex + 2] = data[sourceIndex + 2];
      output[targetIndex + 3] = 255;
    }
  }

  return {
    width: targetWidth,
    height: targetHeight,
    data: output,
  };
}

function mergeParams(baseParams, overrides) {
  const merged = {
    ...baseParams,
    ...overrides,
    wbShift: {
      ...(baseParams.wbShift ?? {}),
      ...(overrides?.wbShift ?? {}),
    },
  };
  return merged;
}

function renderCaseImage(decoded, params) {
  const uniforms = buildApproxUniforms(params);
  const output = Buffer.alloc(decoded.width * decoded.height * 4);
  const grainFrequency = uniforms.grainSize > 0.5 ? 0.12 : 0.24;

  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const index = (y * decoded.width + x) * 4;
      const sourceR = decoded.data[index] / 255;
      const sourceG = decoded.data[index + 1] / 255;
      const sourceB = decoded.data[index + 2] / 255;

      const grainSeed =
        (Math.sin((x + 1) * 12.9898 * grainFrequency + (y + 1) * 78.233) * 43758.5453) % 1;
      const normalizedSeed = grainSeed < 0 ? grainSeed + 1 : grainSeed;
      const [r, g, b] = applyCpuApproxPixel(
        sourceR,
        sourceG,
        sourceB,
        uniforms,
        normalizedSeed,
      );

      output[index] = Math.round(clamp01(r) * 255);
      output[index + 1] = Math.round(clamp01(g) * 255);
      output[index + 2] = Math.round(clamp01(b) * 255);
      output[index + 3] = 255;
    }
  }

  return {
    width: decoded.width,
    height: decoded.height,
    data: output,
  };
}

function computeFrameMetrics(candidate, oracle, sampleStride) {
  if (candidate.width !== oracle.width || candidate.height !== oracle.height) {
    throw new Error(
      `Frame dimensions mismatch. candidate=${candidate.width}x${candidate.height}, oracle=${oracle.width}x${oracle.height}`,
    );
  }

  const stride = Math.max(1, sampleStride);
  const deltaE00Values = [];
  const deltaE76Values = [];
  let sumDeltaE00 = 0;
  let sumDeltaE76 = 0;
  let sumLumaSquaredError = 0;
  let sumChromaError = 0;
  let sumHueError = 0;
  let hueSamples = 0;
  let sumAbsRgb = 0;
  let sumLumaCandidate = 0;
  let sumLumaOracle = 0;
  let sampleCount = 0;

  for (let y = 0; y < candidate.height; y += stride) {
    for (let x = 0; x < candidate.width; x += stride) {
      const index = (y * candidate.width + x) * 4;

      const candidateR8 = candidate.data[index];
      const candidateG8 = candidate.data[index + 1];
      const candidateB8 = candidate.data[index + 2];
      const oracleR8 = oracle.data[index];
      const oracleG8 = oracle.data[index + 1];
      const oracleB8 = oracle.data[index + 2];

      const candidateR = candidateR8 / 255;
      const candidateG = candidateG8 / 255;
      const candidateB = candidateB8 / 255;
      const oracleR = oracleR8 / 255;
      const oracleG = oracleG8 / 255;
      const oracleB = oracleB8 / 255;

      const candidateLinearR = SRGB_TO_LINEAR[candidateR8];
      const candidateLinearG = SRGB_TO_LINEAR[candidateG8];
      const candidateLinearB = SRGB_TO_LINEAR[candidateB8];
      const oracleLinearR = SRGB_TO_LINEAR[oracleR8];
      const oracleLinearG = SRGB_TO_LINEAR[oracleG8];
      const oracleLinearB = SRGB_TO_LINEAR[oracleB8];

      const candidateLab = linearRgbToLab(
        candidateLinearR,
        candidateLinearG,
        candidateLinearB,
      );
      const oracleLab = linearRgbToLab(oracleLinearR, oracleLinearG, oracleLinearB);

      const deltaL = candidateLab.l - oracleLab.l;
      const deltaA = candidateLab.a - oracleLab.a;
      const deltaB = candidateLab.b - oracleLab.b;
      const deltaE76 = Math.hypot(deltaL, deltaA, deltaB);
      const deltaE00Value = deltaE00(candidateLab, oracleLab);
      deltaE76Values.push(deltaE76);
      deltaE00Values.push(deltaE00Value);
      sumDeltaE76 += deltaE76;
      sumDeltaE00 += deltaE00Value;

      const lumaError = candidateLab.y - oracleLab.y;
      sumLumaSquaredError += lumaError * lumaError;
      sumLumaCandidate += candidateLab.y;
      sumLumaOracle += oracleLab.y;

      const candidateChroma = Math.hypot(candidateLab.a, candidateLab.b);
      const oracleChroma = Math.hypot(oracleLab.a, oracleLab.b);
      sumChromaError += Math.abs(candidateChroma - oracleChroma);

      if (candidateChroma > 2 || oracleChroma > 2) {
        const candidateHue = normalizeAngleDegrees(
          (Math.atan2(candidateLab.b, candidateLab.a) * 180) / Math.PI,
        );
        const oracleHue = normalizeAngleDegrees(
          (Math.atan2(oracleLab.b, oracleLab.a) * 180) / Math.PI,
        );
        sumHueError += angularDifferenceDegrees(candidateHue, oracleHue);
        hueSamples += 1;
      }

      sumAbsRgb +=
        (Math.abs(candidateR - oracleR) +
          Math.abs(candidateG - oracleG) +
          Math.abs(candidateB - oracleB)) /
        3;
      sampleCount += 1;
    }
  }

  return {
    sample_count: sampleCount,
    mean_delta_e00: safeDivision(sumDeltaE00, sampleCount),
    p95_delta_e00: p95(deltaE00Values),
    mean_delta_e76: safeDivision(sumDeltaE76, sampleCount),
    p95_delta_e76: p95(deltaE76Values),
    luma_rmse: Math.sqrt(safeDivision(sumLumaSquaredError, sampleCount)),
    mean_chroma_error: safeDivision(sumChromaError, sampleCount),
    mean_hue_drift_deg: safeDivision(sumHueError, hueSamples),
    mean_abs_rgb: safeDivision(sumAbsRgb, sampleCount),
    mean_luma_candidate: safeDivision(sumLumaCandidate, sampleCount),
    mean_luma_oracle: safeDivision(sumLumaOracle, sampleCount),
  };
}

function buildDifferenceVisualization(candidate, oracle) {
  if (candidate.width !== oracle.width || candidate.height !== oracle.height) {
    throw new Error(
      `Diff visualization dimensions mismatch. candidate=${candidate.width}x${candidate.height}, oracle=${oracle.width}x${oracle.height}`,
    );
  }

  const output = Buffer.alloc(candidate.width * candidate.height * 4);
  for (let y = 0; y < candidate.height; y += 1) {
    for (let x = 0; x < candidate.width; x += 1) {
      const index = (y * candidate.width + x) * 4;
      const deltaR = Math.abs(candidate.data[index] - oracle.data[index]) / 255;
      const deltaG = Math.abs(candidate.data[index + 1] - oracle.data[index + 1]) / 255;
      const deltaB = Math.abs(candidate.data[index + 2] - oracle.data[index + 2]) / 255;
      const delta = (deltaR + deltaG + deltaB) / 3;
      const intensity = Math.round(clamp01(Math.pow(delta, 0.62) * 1.35) * 255);

      output[index] = intensity;
      output[index + 1] = Math.round(intensity * 0.45);
      output[index + 2] = Math.round(intensity * 0.15);
      output[index + 3] = 255;
    }
  }

  return {
    width: candidate.width,
    height: candidate.height,
    data: output,
  };
}

function resolveCommitSha() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function buildTimestampToken(mode) {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${mode}-${randomUUID().slice(0, 8)}`;
}

function frameThresholdFailures(frameMetrics, frameThresholds) {
  const failures = [];
  const meanDeltaThreshold =
    frameThresholds.max_mean_delta_e00 ?? frameThresholds.max_mean_delta_e76;
  const p95DeltaThreshold =
    frameThresholds.max_p95_delta_e00 ?? frameThresholds.max_p95_delta_e76;

  if (
    typeof meanDeltaThreshold === "number" &&
    frameMetrics.mean_delta_e00 > meanDeltaThreshold
  ) {
    failures.push(
      `mean_delta_e00 ${frameMetrics.mean_delta_e00.toFixed(4)} > ${meanDeltaThreshold}`,
    );
  }
  if (
    typeof p95DeltaThreshold === "number" &&
    frameMetrics.p95_delta_e00 > p95DeltaThreshold
  ) {
    failures.push(
      `p95_delta_e00 ${frameMetrics.p95_delta_e00.toFixed(4)} > ${p95DeltaThreshold}`,
    );
  }
  if (frameMetrics.luma_rmse > frameThresholds.max_luma_rmse) {
    failures.push(
      `luma_rmse ${frameMetrics.luma_rmse.toFixed(6)} > ${frameThresholds.max_luma_rmse}`,
    );
  }
  if (frameMetrics.mean_chroma_error > frameThresholds.max_mean_chroma_error) {
    failures.push(
      `mean_chroma_error ${frameMetrics.mean_chroma_error.toFixed(4)} > ${frameThresholds.max_mean_chroma_error}`,
    );
  }
  if (frameMetrics.mean_hue_drift_deg > frameThresholds.max_mean_hue_drift_deg) {
    failures.push(
      `mean_hue_drift_deg ${frameMetrics.mean_hue_drift_deg.toFixed(4)} > ${frameThresholds.max_mean_hue_drift_deg}`,
    );
  }

  return failures;
}

function directionalCorrectness(referenceDelta, candidateDelta, epsilon = 1e-6) {
  if (Math.abs(referenceDelta) <= epsilon && Math.abs(candidateDelta) <= epsilon) {
    return true;
  }
  return Math.sign(referenceDelta) === Math.sign(candidateDelta);
}

function aggregateDirectionalScores(records, directionalThresholds) {
  const grouped = new Map();

  records.forEach((record) => {
    if (!grouped.has(record.axis)) {
      grouped.set(record.axis, []);
    }
    grouped.get(record.axis).push(record);
  });

  const axisScores = [];
  grouped.forEach((axisRecords, axis) => {
    const correct = axisRecords.filter((record) => record.correct).length;
    const total = axisRecords.length;
    const score = safeDivision(correct, total);
    const classification =
      directionalThresholds.axis_classification?.[axis] ?? "secondary";
    const threshold =
      classification === "critical"
        ? directionalThresholds.critical_min_score
        : directionalThresholds.secondary_min_score;
    axisScores.push({
      axis,
      classification,
      score,
      threshold,
      samples: total,
      correct,
      pass: score >= threshold,
    });
  });

  return axisScores.sort((a, b) => a.axis.localeCompare(b.axis));
}

function compareAggregateRegression(currentAggregate, baselineAggregate, regressionThresholds) {
  const failures = [];
  const deltas = [];
  const metricThresholds = regressionThresholds?.max_aggregate_delta ?? {};

  const metricKeys = [
    "mean_delta_e00",
    "p95_delta_e00",
    "luma_rmse",
    "mean_chroma_error",
    "mean_hue_drift_deg",
  ];

  metricKeys.forEach((metricKey) => {
    const allowedDelta = metricThresholds[metricKey];
    const currentValue = currentAggregate[metricKey];
    const baselineValue = baselineAggregate?.[metricKey];

    if (
      typeof allowedDelta !== "number" ||
      typeof currentValue !== "number" ||
      typeof baselineValue !== "number"
    ) {
      return;
    }

    const delta = currentValue - baselineValue;
    deltas.push({
      metric: metricKey,
      baseline: baselineValue,
      current: currentValue,
      delta,
      allowed_delta: allowedDelta,
      pass: delta <= allowedDelta,
    });

    if (delta > allowedDelta) {
      failures.push(
        `[aggregate_regression] ${metricKey} delta=${delta.toFixed(6)} > allowed=${allowedDelta.toFixed(6)}`,
      );
    }
  });

  return {
    failures,
    deltas,
  };
}

function compareDirectionalRegression(
  currentDirectionalScores,
  baselineDirectionalScores,
  regressionThresholds,
) {
  const failures = [];
  const comparisons = [];
  const maxDrop = regressionThresholds?.max_directional_score_drop;

  if (typeof maxDrop !== "number") {
    return {
      failures,
      comparisons,
    };
  }

  const currentByAxis = new Map(
    currentDirectionalScores.map((score) => [score.axis, score]),
  );

  baselineDirectionalScores.forEach((baselineScore) => {
    const currentScore = currentByAxis.get(baselineScore.axis);
    if (!currentScore) {
      failures.push(
        `[directional_regression] axis=${baselineScore.axis} missing in current run`,
      );
      return;
    }

    const scoreDrop = baselineScore.score - currentScore.score;
    comparisons.push({
      axis: baselineScore.axis,
      baseline: baselineScore.score,
      current: currentScore.score,
      score_drop: scoreDrop,
      allowed_drop: maxDrop,
      pass: scoreDrop <= maxDrop,
    });

    if (scoreDrop > maxDrop) {
      failures.push(
        `[directional_regression] axis=${baselineScore.axis} drop=${scoreDrop.toFixed(6)} > allowed=${maxDrop.toFixed(6)}`,
      );
    }
  });

  return {
    failures,
    comparisons,
  };
}

function buildBaselineComparison(
  currentRun,
  baselineRun,
  regressionThresholds,
  baselineMetricsPathRelative,
) {
  if (!baselineRun || typeof baselineRun !== "object") {
    return {
      baseline_metrics_path: baselineMetricsPathRelative,
      pass: false,
      failures: ["[baseline] baseline metrics payload is invalid"],
      aggregate: {
        deltas: [],
      },
      directional: {
        comparisons: [],
      },
    };
  }

  const aggregateComparison = compareAggregateRegression(
    currentRun.aggregate,
    baselineRun.aggregate,
    regressionThresholds,
  );
  const directionalComparison = compareDirectionalRegression(
    currentRun.directional_scores,
    baselineRun.directional_scores ?? [],
    regressionThresholds,
  );

  const failures = [
    ...aggregateComparison.failures,
    ...directionalComparison.failures,
  ];

  return {
    baseline_metrics_path: baselineMetricsPathRelative,
    baseline_timestamp: baselineRun.timestamp ?? null,
    pass: failures.length === 0,
    failures,
    aggregate: {
      deltas: aggregateComparison.deltas,
    },
    directional: {
      comparisons: directionalComparison.comparisons,
    },
  };
}

function renderSummaryMarkdown(run) {
  const frameRows = run.frame_metrics
    .slice(0, 15)
    .map(
      (frame) =>
        `| ${frame.scene_id} | ${frame.case_id} | ${frame.metrics.mean_delta_e00.toFixed(3)} | ${frame.metrics.p95_delta_e00.toFixed(3)} | ${frame.metrics.luma_rmse.toFixed(4)} | ${frame.metrics.mean_chroma_error.toFixed(3)} | ${frame.metrics.mean_hue_drift_deg.toFixed(3)} | ${frame.pass ? "pass" : "fail"} |`,
    )
    .join("\n");

  const directionalRows = run.directional_scores
    .map(
      (axis) =>
        `| ${axis.axis} | ${axis.classification} | ${axis.correct}/${axis.samples} | ${axis.score.toFixed(3)} | ${axis.threshold.toFixed(3)} | ${axis.pass ? "pass" : "fail"} |`,
    )
    .join("\n");

  const failureLines = run.failures.length
    ? run.failures.map((failure) => `- ${failure}`).join("\n")
    : "- none";
  const baselineLines = run.baseline_comparison
    ? run.baseline_comparison.failures.length > 0
      ? run.baseline_comparison.failures.map((failure) => `- ${failure}`).join("\n")
      : "- none"
    : "- not requested";
  const baselineHeader = run.baseline_comparison
    ? `path: ${run.baseline_comparison.baseline_metrics_path}
status: ${run.baseline_comparison.pass ? "PASS" : "FAIL"}`
    : "baseline comparison disabled";
  const oracleIndexValidationLine = run.oracle_index_validation
    ? `${run.oracle_index_validation.pass ? "PASS" : "FAIL"} (${run.oracle_index_validation.failures} issues)`
    : "index not available";

  return `# Calibration Harness Summary

Date: ${run.timestamp}
Mode: ${run.mode}
Commit: ${run.commit_sha}
Result: ${run.pass ? "PASS" : "FAIL"}

## Aggregate

- frames: ${run.frame_metrics.length}
- directional axes: ${run.directional_scores.length}
- oracle index: ${run.oracle_index_path ?? "none"}
- oracle source policy: ${run.oracle_source_policy}
- oracle index validation: ${oracleIndexValidationLine}
- mean DeltaE00: ${run.aggregate.mean_delta_e00.toFixed(4)}
- p95 DeltaE00: ${run.aggregate.p95_delta_e00.toFixed(4)}
- mean DeltaE76 (legacy diagnostic): ${run.aggregate.mean_delta_e76.toFixed(4)}
- p95 DeltaE76 (legacy diagnostic): ${run.aggregate.p95_delta_e76.toFixed(4)}
- luma RMSE: ${run.aggregate.luma_rmse.toFixed(6)}
- mean chroma error: ${run.aggregate.mean_chroma_error.toFixed(4)}
- mean hue drift: ${run.aggregate.mean_hue_drift_deg.toFixed(4)}

## Directional Scores

| Axis | Class | Correct | Score | Threshold | Status |
|---|---|---:|---:|---:|---|
${directionalRows || "| n/a | n/a | 0/0 | 0.000 | 0.000 | n/a |"}

## Frame Metrics (first 15)

| Scene | Case | Mean dE00 | p95 dE00 | Luma RMSE | Chroma Err | Hue Drift | Status |
|---|---|---:|---:|---:|---:|---:|---|
${frameRows || "| n/a | n/a | 0 | 0 | 0 | 0 | 0 | n/a |"}

## Baseline Comparison

${baselineHeader}

${baselineLines}

## Failures

${failureLines}
`;
}

function mean(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, {
    recursive: true,
  });
}

async function run() {
  const options = parseArgs(process.argv);
  const timestampToken = buildTimestampToken(options.mode);

  const manifestPath = resolveFromRoot(options.manifestPath);
  const thresholdsPath = resolveFromRoot(options.thresholdsPath);
  const oracleDir = resolveFromRoot(options.oracleDir);
  const oracleIndexPath = options.oracleIndexPath
    ? resolveFromRoot(options.oracleIndexPath)
    : path.join(oracleDir, "index.v1.json");
  const outputDir = options.outputDir
    ? resolveFromRoot(options.outputDir)
    : resolveFromRoot(path.join("artifacts/calibration/runs", timestampToken));
  const renderedDir = path.join(outputDir, "rendered");
  const diffDir = path.join(outputDir, "diff");

  const manifest = await readJson(manifestPath);
  const thresholds = await readJson(thresholdsPath);
  assertManifestShape(manifest);
  assertThresholdShape(thresholds);

  await ensureDirectory(outputDir);
  await ensureDirectory(renderedDir);
  await ensureDirectory(diffDir);
  if (options.mode === "record") {
    await ensureDirectory(oracleDir);
  }

  const frameResults = [];
  const directionalRecords = [];
  const failures = [];
  const recordedOracleEntries = [];

  const frameBySceneAndCase = new Map();
  let oracleIndexValidation = null;
  let oracleEntryByKey = new Map();
  if (options.mode === "evaluate") {
    const oracleIndexExists = await fileExists(oracleIndexPath);
    if (oracleIndexExists) {
      oracleIndexValidation = await validateOracleIndexContract({
        rootDir: ROOT_DIR,
        manifest,
        oracleDirPath: oracleDir,
        oracleIndexPath,
        requireOracleSource: options.requireOracleSource,
        verifyHashes: true,
      });
      oracleEntryByKey = oracleIndexValidation.entryByKey;
      oracleIndexValidation.failures.forEach((failure) => failures.push(failure));
    } else if (options.requireOracleSource === "camera_engine") {
      failures.push(
        `[oracle_source_policy] require-oracle-source=camera_engine requires oracle index at ${path.relative(ROOT_DIR, oracleIndexPath)}`,
      );
    }
  }

  for (const scene of manifest.scenes) {
    const sourcePath = resolveFromRoot(scene.source_path);
    const sourceRaw = await fs.readFile(sourcePath);
    const decodedSource = decodeJpeg(sourceRaw);
    const normalizedSource = resizeNearest(decodedSource, manifest.max_dimension);

    for (const calibrationCase of manifest.cases) {
      const mergedParams = mergeParams(manifest.base_params, calibrationCase.overrides ?? {});
      const renderedFrame = renderCaseImage(normalizedSource, mergedParams);
      const encodedFrame = jpeg.encode(renderedFrame, manifest.jpeg_quality ?? 98).data;
      const candidateDecoded = decodeJpeg(encodedFrame);

      const frameFileName = `${scene.id}__${calibrationCase.id}.jpg`;
      const renderedPath = path.join(renderedDir, frameFileName);
      await fs.writeFile(renderedPath, encodedFrame);

      const oraclePath = path.join(oracleDir, frameFileName);
      let oracleDecoded;
      if (options.mode === "record") {
        await fs.writeFile(oraclePath, encodedFrame);
        oracleDecoded = decodeJpeg(encodedFrame);
        recordedOracleEntries.push({
          scene_id: scene.id,
          case_id: calibrationCase.id,
          file_path: path.relative(ROOT_DIR, oraclePath),
          sha256: sha256Hex(encodedFrame),
          source_type: "bootstrap_cpu_record",
        });
      } else {
        try {
          const oracleRaw = await fs.readFile(oraclePath);
          oracleDecoded = decodeJpeg(oracleRaw);
        } catch (error) {
          failures.push(
            `[missing_oracle] ${scene.id}/${calibrationCase.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }
      }

      const metrics = computeFrameMetrics(
        candidateDecoded,
        oracleDecoded,
        manifest.metric_sample_stride ?? 1,
      );
      const diffFrame = buildDifferenceVisualization(candidateDecoded, oracleDecoded);
      const diffEncoded = jpeg.encode(diffFrame, 90).data;
      const diffPath = path.join(diffDir, frameFileName);
      await fs.writeFile(diffPath, diffEncoded);
      const thresholdFailures = frameThresholdFailures(metrics, thresholds.frame);
      const pass = thresholdFailures.length === 0;

      if (!pass) {
        thresholdFailures.forEach((failure) => {
          failures.push(`[frame] ${scene.id}/${calibrationCase.id}: ${failure}`);
        });
      }

      const result = {
        scene_id: scene.id,
        case_id: calibrationCase.id,
        axis: calibrationCase.axis,
        baseline_case_id: calibrationCase.baseline_case_id,
        rendered_path: path.relative(ROOT_DIR, renderedPath),
        oracle_path: path.relative(ROOT_DIR, oraclePath),
        oracle_source:
          options.mode === "record"
            ? "bootstrap_cpu_record"
            : oracleEntryByKey.get(`${scene.id}::${calibrationCase.id}`)?.source_type ??
              "unspecified",
        diff_path: path.relative(ROOT_DIR, diffPath),
        pass,
        threshold_failures: thresholdFailures,
        metrics,
      };

      frameResults.push(result);
      frameBySceneAndCase.set(`${scene.id}::${calibrationCase.id}`, result);
    }
  }

  for (const frame of frameResults) {
    if (!frame.axis || !frame.baseline_case_id) {
      continue;
    }

    const baseline = frameBySceneAndCase.get(`${frame.scene_id}::${frame.baseline_case_id}`);
    if (!baseline) {
      failures.push(
        `[directional_missing_baseline] ${frame.scene_id}/${frame.case_id} baseline=${frame.baseline_case_id}`,
      );
      continue;
    }

    const referenceDelta =
      frame.metrics.mean_luma_oracle - baseline.metrics.mean_luma_oracle;
    const candidateDelta =
      frame.metrics.mean_luma_candidate - baseline.metrics.mean_luma_candidate;
    directionalRecords.push({
      scene_id: frame.scene_id,
      axis: frame.axis,
      case_id: frame.case_id,
      baseline_case_id: frame.baseline_case_id,
      reference_delta: referenceDelta,
      candidate_delta: candidateDelta,
      correct: directionalCorrectness(referenceDelta, candidateDelta, 1e-5),
    });
  }

  const directionalScores = aggregateDirectionalScores(
    directionalRecords,
    thresholds.directional,
  );
  directionalScores
    .filter((axis) => !axis.pass)
    .forEach((axis) => {
      failures.push(
        `[directional] axis=${axis.axis} score=${axis.score.toFixed(4)} threshold=${axis.threshold.toFixed(4)}`,
      );
    });

  const aggregate = {
    mean_delta_e00: mean(frameResults.map((frame) => frame.metrics.mean_delta_e00)),
    p95_delta_e00: mean(frameResults.map((frame) => frame.metrics.p95_delta_e00)),
    mean_delta_e76: mean(frameResults.map((frame) => frame.metrics.mean_delta_e76)),
    p95_delta_e76: mean(frameResults.map((frame) => frame.metrics.p95_delta_e76)),
    luma_rmse: mean(frameResults.map((frame) => frame.metrics.luma_rmse)),
    mean_chroma_error: mean(frameResults.map((frame) => frame.metrics.mean_chroma_error)),
    mean_hue_drift_deg: mean(frameResults.map((frame) => frame.metrics.mean_hue_drift_deg)),
  };

  let baselineComparison = null;
  if (options.mode === "evaluate" && options.baselineMetricsPath) {
    const baselineMetricsPath = resolveFromRoot(options.baselineMetricsPath);
    try {
      const baselineRun = await readJson(baselineMetricsPath);
      baselineComparison = buildBaselineComparison(
        {
          aggregate,
          directional_scores: directionalScores,
        },
        baselineRun,
        thresholds.regression ?? null,
        path.relative(ROOT_DIR, baselineMetricsPath),
      );
      baselineComparison.failures.forEach((failure) => failures.push(failure));
    } catch (error) {
      failures.push(
        `[baseline_load] ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const run = {
    version: 1,
    harness_version: "1.2.0",
    mode: options.mode,
    timestamp: new Date().toISOString(),
    commit_sha: resolveCommitSha(),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    manifest_path: path.relative(ROOT_DIR, manifestPath),
    thresholds_path: path.relative(ROOT_DIR, thresholdsPath),
    oracle_dir: path.relative(ROOT_DIR, oracleDir),
    oracle_index_path: path.relative(ROOT_DIR, oracleIndexPath),
    oracle_source_policy: options.requireOracleSource,
    oracle_index_validation: oracleIndexValidation
      ? {
          pass: oracleIndexValidation.pass,
          failures: oracleIndexValidation.failures.length,
          expected_entries: oracleIndexValidation.expected_entry_count,
          indexed_entries: oracleIndexValidation.indexed_entry_count,
          validated_entries: oracleIndexValidation.validated_entry_count,
        }
      : null,
    output_dir: path.relative(ROOT_DIR, outputDir),
    frame_metrics: frameResults,
    directional_records: directionalRecords,
    directional_scores: directionalScores,
    baseline_comparison: baselineComparison,
    aggregate,
    failures,
    pass: failures.length === 0,
  };

  const metricsPath = path.join(outputDir, "metrics.json");
  const summaryPath = path.join(outputDir, "summary.md");
  await fs.writeFile(metricsPath, `${JSON.stringify(run, null, 2)}\n`);
  await fs.writeFile(summaryPath, renderSummaryMarkdown(run));
  if (options.mode === "record") {
    const indexPayload = {
      version: 1,
      generated_at: new Date().toISOString(),
      generator: "scripts/run-calibration-harness.mjs",
      source_type: "bootstrap_cpu_record",
      oracle_dir: path.relative(ROOT_DIR, oracleDir),
      entries: recordedOracleEntries,
    };
    await fs.writeFile(oracleIndexPath, `${JSON.stringify(indexPayload, null, 2)}\n`);
  }

  console.log(
    JSON.stringify(
      {
        pass: run.pass,
        mode: run.mode,
        frame_count: run.frame_metrics.length,
        directional_axis_count: run.directional_scores.length,
        oracle_source_policy: run.oracle_source_policy,
        oracle_index_validated: Boolean(run.oracle_index_validation),
        oracle_index_pass: run.oracle_index_validation?.pass ?? null,
        baseline_compared: Boolean(run.baseline_comparison),
        baseline_pass: run.baseline_comparison?.pass ?? null,
        failures: run.failures.length,
        output_dir: run.output_dir,
        metrics_path: path.relative(ROOT_DIR, metricsPath),
        summary_path: path.relative(ROOT_DIR, summaryPath),
      },
      null,
      2,
    ),
  );

  if (options.mode === "evaluate" && !run.pass) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        pass: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
