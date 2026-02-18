import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RecipeParams } from "@fuji/domain";
import { applyCpuApproxPixel, buildApproxUniforms } from "@fuji/engine-webgl";
import { canonicalImages } from "../data/images";
import { curatedPresets } from "../data/presets";
import { toApproxRenderParams } from "../renderParams";

type PresetGalleryProps = {
  onApplyPreset: (params: RecipeParams) => void;
  onSelectImage: (imageId: string) => void;
};

type PreviewRenderTelemetry = {
  phase: "idle" | "rendering" | "ready";
  renderedCount: number;
  totalCount: number;
  chunkCount: number;
  avgChunkMs: number;
  maxChunkMs: number;
  totalMs: number;
};

const rootStyle: CSSProperties = {
  border: "1px solid #d8d8d8",
  borderRadius: "12px",
  marginTop: "16px",
  overflow: "hidden",
};

const summaryStyle: CSSProperties = {
  padding: "12px 14px",
  backgroundColor: "#fafafa",
  cursor: "pointer",
  fontWeight: 600,
};

const contentStyle: CSSProperties = {
  padding: "12px 14px",
  display: "grid",
  gap: "10px",
};

const controlsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center",
};

const telemetryStyle: CSSProperties = {
  color: "#5a5a5a",
  fontSize: "12px",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
};

const cardStyle: CSSProperties = {
  border: "1px solid #ececec",
  borderRadius: "10px",
  padding: "10px",
  display: "grid",
  gap: "8px",
};

const previewStyle: CSSProperties = {
  width: "100%",
  height: "110px",
  objectFit: "cover",
  borderRadius: "8px",
  border: "1px solid #e6e6e6",
};

const CHUNK_TIME_BUDGET_MS = 8;

function formatTelemetryValue(value: number): string {
  return value.toFixed(1);
}

function normalizeSeed(seed: number): number {
  return seed < 0 ? seed + 1 : seed;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load preset preview source: ${src}`));
  });
}

function renderPresetPreview(image: HTMLImageElement, params: RecipeParams): string {
  const maxWidth = 280;
  const maxHeight = 172;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("2D context unavailable for preset source render");
  }
  sourceContext.drawImage(image, 0, 0, width, height);
  const sourceFrame = sourceContext.getImageData(0, 0, width, height);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) {
    throw new Error("2D context unavailable for preset output render");
  }

  const uniforms = buildApproxUniforms(toApproxRenderParams(params));
  const data = new Uint8ClampedArray(sourceFrame.data);

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index] / 255;
    const g = data[index + 1] / 255;
    const b = data[index + 2] / 255;

    const pixel = index / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const seedRaw = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233 + 17.43) * 43758.5453;
    const seed = normalizeSeed(seedRaw % 1);
    const [nr, ng, nb] = applyCpuApproxPixel(r, g, b, uniforms, seed);

    data[index] = Math.round(nr * 255);
    data[index + 1] = Math.round(ng * 255);
    data[index + 2] = Math.round(nb * 255);
  }

  outputContext.putImageData(new ImageData(data, width, height), 0, 0);
  return outputCanvas.toDataURL("image/jpeg", 0.88);
}

export function PresetGallery({ onApplyPreset, onSelectImage }: PresetGalleryProps) {
  const [filter, setFilter] = useState("");
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [renderedPreviewByPreset, setRenderedPreviewByPreset] = useState<Record<string, string>>(
    {},
  );
  const [previewTelemetry, setPreviewTelemetry] = useState<PreviewRenderTelemetry>({
    phase: "idle",
    renderedCount: 0,
    totalCount: curatedPresets.length,
    chunkCount: 0,
    avgChunkMs: 0,
    maxChunkMs: 0,
    totalMs: 0,
  });
  const renderedPreviewCacheRef = useRef(new Map<string, string>());
  const imageById = useMemo(
    () => new Map(canonicalImages.map((image) => [image.id, image])),
    [],
  );

  const visiblePresets = useMemo(() => {
    if (!filter.trim()) {
      return curatedPresets;
    }

    const normalized = filter.toLowerCase();
    return curatedPresets.filter(
      (preset) =>
        preset.name.toLowerCase().includes(normalized) ||
        preset.description.toLowerCase().includes(normalized) ||
        preset.imageId.toLowerCase().includes(normalized),
    );
  }, [filter]);

  useEffect(() => {
    if (!isGalleryOpen) {
      return;
    }

    let cancelled = false;
    let queueTimer: number | null = null;

    const renderAllPreviewsChunked = async () => {
      try {
        const imageCache = new Map<string, HTMLImageElement>();
        const runStart = performance.now();
        const pendingPresets = curatedPresets.filter(
          (preset) => !renderedPreviewCacheRef.current.has(preset.id),
        );
        const totalCount = curatedPresets.length;
        let maxChunkMs = 0;
        let chunkCount = 0;
        let totalChunkWorkMs = 0;

        setPreviewTelemetry({
          phase: pendingPresets.length > 0 ? "rendering" : "ready",
          renderedCount: totalCount - pendingPresets.length,
          totalCount,
          chunkCount: 0,
          avgChunkMs: 0,
          maxChunkMs: 0,
          totalMs: 0,
        });

        const commitPreviewState = () => {
          if (cancelled) {
            return;
          }
          setRenderedPreviewByPreset(() =>
            Object.fromEntries(renderedPreviewCacheRef.current.entries()),
          );
        };

        const commitTelemetry = (phase: PreviewRenderTelemetry["phase"], chunkDuration: number) => {
          if (cancelled) {
            return;
          }

          if (chunkDuration > 0) {
            chunkCount += 1;
            totalChunkWorkMs += chunkDuration;
          }
          maxChunkMs = Math.max(maxChunkMs, chunkDuration);
          setPreviewTelemetry({
            phase,
            renderedCount: totalCount - pendingPresets.length,
            totalCount,
            chunkCount,
            avgChunkMs: chunkCount > 0 ? totalChunkWorkMs / chunkCount : 0,
            maxChunkMs,
            totalMs: performance.now() - runStart,
          });
        };

        const processQueue = async () => {
          if (cancelled) {
            return;
          }

          let chunkWorkMs = 0;

          while (pendingPresets.length > 0 && !cancelled) {
            const preset = pendingPresets.shift();
            if (!preset) {
              break;
            }

            if (renderedPreviewCacheRef.current.has(preset.id)) {
              continue;
            }

            const sourceImageMeta = imageById.get(preset.imageId);
            if (!sourceImageMeta) {
              continue;
            }

            let sourceImage = imageCache.get(sourceImageMeta.id);
            if (!sourceImage) {
              sourceImage = await loadImage(sourceImageMeta.previewSrc);
              if (cancelled) {
                return;
              }
              imageCache.set(sourceImageMeta.id, sourceImage);
            }

            const renderStartedAt = performance.now();
            const renderedPreview = renderPresetPreview(sourceImage, preset.params);
            const renderCompletedAt = performance.now();
            chunkWorkMs += renderCompletedAt - renderStartedAt;
            renderedPreviewCacheRef.current.set(preset.id, renderedPreview);

            if (chunkWorkMs >= CHUNK_TIME_BUDGET_MS) {
              break;
            }
          }

          commitPreviewState();
          const chunkDuration = chunkWorkMs;
          const phase = pendingPresets.length > 0 ? "rendering" : "ready";
          commitTelemetry(phase, chunkDuration);

          if (pendingPresets.length > 0 && !cancelled) {
            queueTimer = window.setTimeout(() => {
              void processQueue();
            }, 0);
          }
        };

        if (pendingPresets.length === 0) {
          commitPreviewState();
          commitTelemetry("ready", 0);
          return;
        }

        await processQueue();
      } catch {
        // Fail open: keep base image previews if approximation rendering fails.
      }
    };

    void renderAllPreviewsChunked();
    return () => {
      cancelled = true;
      if (queueTimer !== null) {
        window.clearTimeout(queueTimer);
      }
    };
  }, [imageById, isGalleryOpen]);

  return (
    <details
      style={rootStyle}
      onToggle={(event) => setIsGalleryOpen(event.currentTarget.open)}
    >
      <summary style={summaryStyle}>Preset Gallery ({curatedPresets.length})</summary>
      <div style={contentStyle}>
        <div style={controlsStyle}>
          <label htmlFor="preset-filter">Filter</label>
          <input
            id="preset-filter"
            type="search"
            placeholder="Search presets"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <small
            style={telemetryStyle}
            data-testid="preset-render-status"
            data-render-phase={previewTelemetry.phase}
            data-rendered-count={previewTelemetry.renderedCount}
            data-total-count={previewTelemetry.totalCount}
            data-chunk-count={previewTelemetry.chunkCount}
            data-avg-chunk-ms={formatTelemetryValue(previewTelemetry.avgChunkMs)}
            data-max-chunk-ms={formatTelemetryValue(previewTelemetry.maxChunkMs)}
            data-total-ms={formatTelemetryValue(previewTelemetry.totalMs)}
          >
            {previewTelemetry.phase === "idle"
              ? "Preview render idle (opens lazily)."
              : previewTelemetry.phase === "rendering"
                ? `Preview render ${previewTelemetry.renderedCount}/${previewTelemetry.totalCount} · chunks ${previewTelemetry.chunkCount} · avg ${formatTelemetryValue(previewTelemetry.avgChunkMs)}ms · max batch ${formatTelemetryValue(previewTelemetry.maxChunkMs)}ms`
                : `Preview render ready ${previewTelemetry.renderedCount}/${previewTelemetry.totalCount} · chunks ${previewTelemetry.chunkCount} · avg ${formatTelemetryValue(previewTelemetry.avgChunkMs)}ms · max batch ${formatTelemetryValue(previewTelemetry.maxChunkMs)}ms · total ${formatTelemetryValue(previewTelemetry.totalMs)}ms`}
          </small>
        </div>

        <div style={gridStyle}>
          {visiblePresets.map((preset) => {
            const image = imageById.get(preset.imageId);
            return (
              <article key={preset.id} style={cardStyle}>
                {image ? (
                  <img
                    src={renderedPreviewByPreset[preset.id] ?? image.previewSrc}
                    alt={image.title}
                    style={previewStyle}
                  />
                ) : null}
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
                <small>Image: {preset.imageId}</small>
                <button
                  type="button"
                  onClick={() => {
                    onApplyPreset(preset.params);
                    onSelectImage(preset.imageId);
                  }}
                >
                  Apply Preset
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </details>
  );
}
