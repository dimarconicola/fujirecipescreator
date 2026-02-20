import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = {
  metricsPath: null,
  outputPath: null,
  thresholdsPath: "calibration/thresholds.v1.json",
  requireOracleSource: null,
  failOnLowSignal: false,
};

const AXIS_TARGETS = {
  highlight: "tone_curve highlight response",
  shadow: "tone_curve shadow response",
  dynamic_range: "tone_curve dynamic-range compression",
  chrome: "color_chrome saturation response",
  chrome_blue: "color_chrome blue-channel response",
  film_sim: "film_sim transfer/channel mix",
  grain: "grain amplitude/blend",
};

function parseArgs(argv) {
  const options = {
    ...DEFAULTS,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--metrics") {
      options.metricsPath = argv[index + 1] ?? options.metricsPath;
      index += 1;
      continue;
    }
    if (token === "--output") {
      options.outputPath = argv[index + 1] ?? options.outputPath;
      index += 1;
      continue;
    }
    if (token === "--thresholds") {
      options.thresholdsPath = argv[index + 1] ?? options.thresholdsPath;
      index += 1;
      continue;
    }
    if (token === "--require-oracle-source") {
      options.requireOracleSource = argv[index + 1] ?? options.requireOracleSource;
      index += 1;
      continue;
    }
    if (token === "--fail-on-low-signal") {
      options.failOnLowSignal = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (
    options.requireOracleSource !== null &&
    options.requireOracleSource !== "any" &&
    options.requireOracleSource !== "camera_engine"
  ) {
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

function relativeToRoot(absolutePath) {
  return path.relative(ROOT_DIR, absolutePath);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function mean(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeDivision(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function directionalSignMismatch(referenceDelta, candidateDelta, epsilon = 1e-6) {
  if (Math.abs(referenceDelta) <= epsilon && Math.abs(candidateDelta) <= epsilon) {
    return false;
  }
  return Math.sign(referenceDelta) !== Math.sign(candidateDelta);
}

function detectSignalQuality(metrics) {
  const aggregate = metrics.aggregate ?? {};
  const frameMetrics = Array.isArray(metrics.frame_metrics) ? metrics.frame_metrics : [];
  const directionalRecords = Array.isArray(metrics.directional_records)
    ? metrics.directional_records
    : [];

  const aggregateNearZero =
    Math.abs(aggregate.mean_delta_e00 ?? 0) <= 1e-8 &&
    Math.abs(aggregate.p95_delta_e00 ?? 0) <= 1e-8 &&
    Math.abs(aggregate.luma_rmse ?? 0) <= 1e-10 &&
    Math.abs(aggregate.mean_chroma_error ?? 0) <= 1e-8 &&
    Math.abs(aggregate.mean_hue_drift_deg ?? 0) <= 1e-8;

  const directionalNearZero =
    directionalRecords.length > 0 &&
    directionalRecords.every(
      (record) =>
        Math.abs(record.reference_delta ?? 0) <= 1e-8 &&
        Math.abs(record.candidate_delta ?? 0) <= 1e-8,
    );

  const bootstrapOnly =
    frameMetrics.length > 0 &&
    frameMetrics.every(
      (frame) =>
        typeof frame.oracle_source === "string" && /bootstrap/i.test(frame.oracle_source),
    );

  const reasons = [];
  if (aggregateNearZero) {
    reasons.push(
      "Aggregate frame metrics are effectively zero; the run does not provide calibration drift signal.",
    );
  }
  if (directionalNearZero) {
    reasons.push(
      "Directional records are near-zero for both oracle and candidate shifts; axis response cannot be tuned from this run.",
    );
  }
  if (bootstrapOnly) {
    reasons.push(
      "Oracle sources are bootstrap-tagged; tuning should use true camera-engine exports before changing mapping constants.",
    );
  }

  return {
    lowSignal: reasons.length > 0,
    reasons,
    aggregateNearZero,
    directionalNearZero,
    bootstrapOnly,
  };
}

function buildAxisDiagnostics(metrics, thresholds) {
  const directionalRecords = Array.isArray(metrics.directional_records)
    ? metrics.directional_records
    : [];
  const directionalScoreByAxis = new Map(
    (Array.isArray(metrics.directional_scores) ? metrics.directional_scores : []).map(
      (scoreRow) => [scoreRow.axis, scoreRow],
    ),
  );
  const grouped = new Map();

  directionalRecords.forEach((record) => {
    if (!record?.axis || typeof record.axis !== "string") {
      return;
    }
    if (!grouped.has(record.axis)) {
      grouped.set(record.axis, []);
    }
    grouped.get(record.axis).push(record);
  });

  return Array.from(grouped.entries())
    .map(([axis, records]) => {
      const referenceDeltas = records.map((record) => Number(record.reference_delta) || 0);
      const candidateDeltas = records.map((record) => Number(record.candidate_delta) || 0);
      const meanReferenceDelta = mean(referenceDeltas);
      const meanCandidateDelta = mean(candidateDeltas);
      const meanShiftError = mean(
        records.map((record) =>
          Math.abs((Number(record.reference_delta) || 0) - (Number(record.candidate_delta) || 0)),
        ),
      );
      const signMismatchCount = records.filter((record) =>
        directionalSignMismatch(
          Number(record.reference_delta) || 0,
          Number(record.candidate_delta) || 0,
        ),
      ).length;

      const frameRows = (Array.isArray(metrics.frame_metrics) ? metrics.frame_metrics : []).filter(
        (frame) => frame?.axis === axis,
      );
      const meanFrameDeltaE00 = mean(
        frameRows.map((frame) => Number(frame?.metrics?.mean_delta_e00) || 0),
      );
      const meanFrameLumaRmse = mean(
        frameRows.map((frame) => Number(frame?.metrics?.luma_rmse) || 0),
      );
      const meanFrameChromaError = mean(
        frameRows.map((frame) => Number(frame?.metrics?.mean_chroma_error) || 0),
      );

      const scoreRow = directionalScoreByAxis.get(axis) ?? null;
      const thresholdClassification =
        scoreRow?.classification ??
        thresholds?.directional?.axis_classification?.[axis] ??
        "secondary";
      const thresholdValue =
        typeof scoreRow?.threshold === "number"
          ? scoreRow.threshold
          : thresholdClassification === "critical"
            ? Number(thresholds?.directional?.critical_min_score) || 1
            : Number(thresholds?.directional?.secondary_min_score) || 0.95;
      const directionalScore =
        typeof scoreRow?.score === "number"
          ? scoreRow.score
          : safeDivision(records.filter((record) => record.correct).length, records.length);

      return {
        axis,
        target: AXIS_TARGETS[axis] ?? "mapping constants",
        classification: thresholdClassification,
        threshold: thresholdValue,
        directionalScore,
        samples: records.length,
        meanReferenceDelta,
        meanCandidateDelta,
        meanShiftError,
        signMismatchCount,
        meanFrameDeltaE00,
        meanFrameLumaRmse,
        meanFrameChromaError,
      };
    })
    .sort((a, b) => a.axis.localeCompare(b.axis));
}

function buildAxisAction(axisDiagnostic, lowSignal) {
  if (lowSignal) {
    return {
      status: "blocked",
      recommendation:
        "Blocked by low-signal oracle data. Import non-bootstrap camera-engine exports before tuning constants.",
    };
  }

  const lumaAxes = new Set(["highlight", "shadow", "dynamic_range"]);
  if (lumaAxes.has(axisDiagnostic.axis)) {
    const reference = axisDiagnostic.meanReferenceDelta;
    const candidate = axisDiagnostic.meanCandidateDelta;
    if (Math.abs(reference) <= 1e-4) {
      return {
        status: "review",
        recommendation:
          "Oracle shift is too small to tune confidently for this axis. Increase sweep intensity/cases first.",
      };
    }
    if (directionalSignMismatch(reference, candidate, 1e-5)) {
      return {
        status: "reverse",
        recommendation: `Reverse ${axisDiagnostic.target} direction to match oracle delta sign.`,
      };
    }

    const ratio = safeDivision(candidate, reference);
    if (ratio < 0.85) {
      const suggestedScale = Math.min(Math.max(safeDivision(1, ratio), 1.1), 3);
      return {
        status: "increase",
        recommendation: `Increase ${axisDiagnostic.target} strength (suggested scale ~${suggestedScale.toFixed(2)}x).`,
      };
    }
    if (ratio > 1.15) {
      const suggestedScale = Math.min(Math.max(safeDivision(1, ratio), 0.33), 0.9);
      return {
        status: "decrease",
        recommendation: `Decrease ${axisDiagnostic.target} strength (suggested scale ~${suggestedScale.toFixed(2)}x).`,
      };
    }
    return {
      status: "aligned",
      recommendation:
        "Luma-direction response is aligned. Prioritize reducing residual frame-level perceptual error.",
    };
  }

  if (axisDiagnostic.directionalScore + 1e-6 < axisDiagnostic.threshold) {
    return {
      status: "review",
      recommendation:
        "Directional score is below threshold; fix sign/coupling behavior for this axis before amplitude tuning.",
    };
  }
  if (axisDiagnostic.meanFrameDeltaE00 >= 1.5) {
    return {
      status: "review",
      recommendation: `Perceptual error remains elevated; tune ${axisDiagnostic.target} constants and re-run camera calibration.`,
    };
  }
  return {
    status: "aligned",
    recommendation:
      "Axis is directionally aligned and within current perceptual envelope; keep constants unless qualitative review disagrees.",
  };
}

function renderMarkdown(runMetadata) {
  const axisRows = runMetadata.axes
    .map((axis) => {
      return `| ${axis.axis} | ${axis.target} | ${axis.classification} | ${axis.directionalScore.toFixed(3)} | ${axis.threshold.toFixed(3)} | ${axis.meanReferenceDelta.toFixed(5)} | ${axis.meanCandidateDelta.toFixed(5)} | ${axis.meanShiftError.toFixed(5)} | ${axis.meanFrameDeltaE00.toFixed(3)} | ${axis.action.recommendation} |`;
    })
    .join("\n");

  const reasonLines =
    runMetadata.signal.reasons.length === 0
      ? "- none"
      : runMetadata.signal.reasons.map((reason) => `- ${reason}`).join("\n");

  const nextSteps = runMetadata.signal.lowSignal
    ? [
        "1. Import true camera-engine exports (`npm run calibration:camera:oracle:import`).",
        "2. Re-run strict camera evaluate (`npm run calibration:camera:run`).",
        "3. Re-run tuning report with low-signal fail gate (`npm run calibration:camera:tune:report`).",
      ].join("\n")
    : [
        "1. Apply constant updates only for axes marked `increase`, `decrease`, `reverse`, or `review`.",
        "2. Re-run `npm run calibration:camera:baseline:check` and compare against current baseline.",
        "3. If accepted, refresh camera baseline and keep directional scores at/above thresholds.",
      ].join("\n");

  return `# Calibration Tuning Report

Date: ${runMetadata.timestamp}
Run: ${runMetadata.metricsPath}
Oracle policy: ${runMetadata.oracleSourcePolicy ?? "unknown"}
Signal quality: ${runMetadata.signal.lowSignal ? "LOW (not tunable)" : "USABLE"}

## Signal Diagnostics

${reasonLines}

## Axis Diagnostics

| Axis | Target | Class | Score | Threshold | Ref Shift | Cand Shift | Shift Err | Mean dE00 | Recommendation |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
${axisRows || "| n/a | n/a | n/a | 0.000 | 0.000 | 0.00000 | 0.00000 | 0.00000 | 0.000 | No directional records present. |"}

## Next Steps

${nextSteps}
`;
}

function assertMetricsShape(metrics) {
  if (!metrics || typeof metrics !== "object") {
    throw new Error("Metrics payload must be an object.");
  }
  if (!Array.isArray(metrics.frame_metrics)) {
    throw new Error("Metrics payload missing frame_metrics array.");
  }
  if (!Array.isArray(metrics.directional_scores)) {
    throw new Error("Metrics payload missing directional_scores array.");
  }
  if (!Array.isArray(metrics.directional_records)) {
    throw new Error("Metrics payload missing directional_records array.");
  }
  if (!metrics.aggregate || typeof metrics.aggregate !== "object") {
    throw new Error("Metrics payload missing aggregate object.");
  }
}

async function findLatestRunMetricsPath(requireOracleSource = null) {
  const runsRoot = resolveFromRoot("artifacts/calibration/runs");
  const entries = await fs.readdir(runsRoot, {
    withFileTypes: true,
  });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const metricsPath = path.join(runsRoot, entry.name, "metrics.json");
    try {
      const stats = await fs.stat(metricsPath);
      if (requireOracleSource && requireOracleSource !== "any") {
        const metrics = await readJson(metricsPath);
        if (metrics?.oracle_source_policy !== requireOracleSource) {
          continue;
        }
      }
      candidates.push({
        metricsPath,
        mtimeMs: stats.mtimeMs,
      });
    } catch {
      // ignore
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      requireOracleSource && requireOracleSource !== "any"
        ? `No calibration metrics found with oracle_source_policy=${requireOracleSource}.`
        : "No calibration metrics found under artifacts/calibration/runs.",
    );
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0].metricsPath;
}

async function run() {
  const options = parseArgs(process.argv);
  const metricsPath = options.metricsPath
    ? resolveFromRoot(options.metricsPath)
    : await findLatestRunMetricsPath(options.requireOracleSource);
  const metrics = await readJson(metricsPath);
  assertMetricsShape(metrics);

  let thresholds = null;
  const thresholdsPath = resolveFromRoot(options.thresholdsPath);
  try {
    thresholds = await readJson(thresholdsPath);
  } catch {
    thresholds = null;
  }

  const signal = detectSignalQuality(metrics);
  const axes = buildAxisDiagnostics(metrics, thresholds).map((axisDiagnostic) => ({
    ...axisDiagnostic,
    action: buildAxisAction(axisDiagnostic, signal.lowSignal),
  }));

  const outputPath = options.outputPath
    ? resolveFromRoot(options.outputPath)
    : path.join(path.dirname(metricsPath), "tuning-report.md");
  const markdown = renderMarkdown({
    timestamp: new Date().toISOString(),
    metricsPath: relativeToRoot(metricsPath),
    oracleSourcePolicy: metrics.oracle_source_policy ?? null,
    signal,
    axes,
  });
  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });
  await fs.writeFile(outputPath, markdown);

  const actionSummary = {
    blocked: 0,
    reverse: 0,
    increase: 0,
    decrease: 0,
    review: 0,
    aligned: 0,
  };
  axes.forEach((axis) => {
    actionSummary[axis.action.status] += 1;
  });

  const payload = {
    pass: !(options.failOnLowSignal && signal.lowSignal),
    signal_quality: signal.lowSignal ? "low_signal" : "usable",
    low_signal_reasons: signal.reasons,
    metrics_path: relativeToRoot(metricsPath),
    report_path: relativeToRoot(outputPath),
    axis_count: axes.length,
    action_summary: actionSummary,
  };
  console.log(JSON.stringify(payload, null, 2));

  if (options.failOnLowSignal && signal.lowSignal) {
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
