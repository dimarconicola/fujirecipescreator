import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ApproxCpuRenderer,
  ApproxWebglRenderer,
  type LutStageConfig,
} from "@fuji/engine-webgl";
import type { Profile, RecipeParams } from "@fuji/domain";
import type { CanonicalImage } from "../data/images";
import { buildRenderCacheKey, RenderFrameCache } from "../renderCache";
import { toApproxRenderParams } from "../renderParams";
import type { CompareMode, ViewerTransform } from "../state/viewerStore";

type ImageViewerProps = {
  images: CanonicalImage[];
  selectedImageId: string;
  profileId: string;
  profileStrengthScalars: Profile["strength_scalars"];
  transform: ViewerTransform;
  params: RecipeParams;
  compareMode: CompareMode;
  splitPosition: number;
  onSelectImage: (imageId: string) => void;
  onZoomBy: (factor: number) => void;
  onSetPan: (offsetX: number, offsetY: number) => void;
  onResetView: () => void;
  onSetSplitPosition: (position: number) => void;
  onRenderStatusChange?: (status: string) => void;
  onRendererModeChange?: (mode: RendererMode) => void;
  lutStage?: LutStageConfig;
  lutCacheKey?: string;
};

type DragState = {
  mode: "pan" | "split";
  pointerId: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
};

type SettleSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap;
type SettleSourceLabel = "preview" | "full" | "full_resampled";

type RendererMode = "webgl2" | "cpu_fallback";
type RendererAdapter = {
  mode: RendererMode;
  render: (
    image: SettleSource,
    params: ReturnType<typeof toApproxRenderParams>,
    options?: { resolutionScale?: number; lutStage?: LutStageConfig },
  ) => void;
};

const rootStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  gridTemplateRows: "var(--workspace-thumb-strip-height, 44px) minmax(0, 1fr)",
  alignSelf: "start",
  border: "1px solid var(--ui-border-soft)",
  borderRadius: "var(--ui-radius-lg)",
  padding: "10px",
  background:
    "linear-gradient(180deg, rgba(20, 30, 43, 0.98), rgba(14, 21, 31, 0.98))",
  boxShadow: "0 20px 42px rgba(0, 0, 0, 0.38)",
  height: "var(--workspace-panel-height, 680px)",
  maxHeight: "var(--workspace-panel-height, 680px)",
};

const tabsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "nowrap",
  alignItems: "stretch",
  gap: "4px",
  height: "var(--workspace-thumb-strip-height, 44px)",
  overflowX: "auto",
  overflowY: "hidden",
};

const viewportStyle: CSSProperties = {
  position: "relative",
  height: "100%",
  minHeight: 0,
  border: "1px solid var(--ui-border-soft)",
  borderRadius: "12px",
  overflow: "hidden",
  background:
    "radial-gradient(600px 220px at 50% -5%, rgba(79, 209, 255, 0.12), transparent 68%), #090e14",
  touchAction: "none",
};

const layerStyleBase: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  maxWidth: "none",
  maxHeight: "none",
  userSelect: "none",
  pointerEvents: "none",
  willChange: "transform, opacity",
};

const tabButtonStyle: CSSProperties = {
  border: "1px solid transparent",
  borderRadius: "6px",
  backgroundColor: "rgba(15, 22, 32, 0.95)",
  padding: "3px",
  display: "grid",
  width: "64px",
  height: "100%",
  textAlign: "left",
  overflow: "hidden",
};

const activeTabStyle: CSSProperties = {
  ...tabButtonStyle,
  borderColor: "rgba(79, 209, 255, 0.85)",
  boxShadow: "0 0 0 1px rgba(79, 209, 255, 0.42) inset",
};

const tabImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  borderRadius: "3px",
};

const splitDividerStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: "2px",
  backgroundColor: "rgba(79, 209, 255, 0.92)",
  boxShadow: "0 0 0 1px rgba(8, 25, 35, 0.72)",
  cursor: "col-resize",
  pointerEvents: "auto",
};

const splitAfterMaskBaseStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  overflow: "hidden",
  pointerEvents: "none",
};

const zoomOverlayStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "14px",
  transform: "translateX(-50%)",
  zIndex: 6,
  borderRadius: "999px",
  border: "1px solid rgba(79, 209, 255, 0.45)",
  backgroundColor: "rgba(8, 14, 20, 0.84)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 8px",
  transition: "opacity 120ms ease",
};

const zoomButtonStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  border: "1px solid rgba(79, 209, 255, 0.35)",
  backgroundColor: "rgba(79, 209, 255, 0.09)",
  color: "#fff",
  fontWeight: 700,
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const zoomResetButtonStyle: CSSProperties = {
  ...zoomButtonStyle,
  width: "auto",
  padding: "0 10px",
  fontWeight: 600,
  fontSize: "12px",
};

const zoomLabelStyle: CSSProperties = {
  minWidth: "52px",
  textAlign: "center",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.02em",
};

const loaderOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 7,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none",
  background:
    "linear-gradient(180deg, rgba(8, 13, 19, 0.14), rgba(8, 13, 19, 0.34))",
};

const loaderPillStyle: CSSProperties = {
  borderRadius: "999px",
  border: "1px solid rgba(129, 205, 236, 0.52)",
  backgroundColor: "rgba(10, 18, 26, 0.84)",
  color: "var(--ui-text-0)",
  padding: "6px 12px",
  fontSize: "0.78rem",
  letterSpacing: "0.02em",
};

const settleProgressBadgeStyle: CSSProperties = {
  position: "absolute",
  left: "10px",
  bottom: "10px",
  zIndex: 6,
  borderRadius: "999px",
  border: "1px solid rgba(79, 209, 255, 0.45)",
  backgroundColor: "rgba(8, 13, 19, 0.88)",
  color: "var(--ui-text-0)",
  padding: "4px 10px",
  fontSize: "0.72rem",
  letterSpacing: "0.02em",
  pointerEvents: "none",
};

const INTERACTIVE_RESOLUTION_SCALE = 0.6;
const SETTLE_RENDER_DELAY_MS = 260;
const DEFAULT_MAX_SETTLE_RENDER_DIMENSION = 3200;
const LOW_RESOURCE_MAX_SETTLE_RENDER_DIMENSION = 2400;

type NavigatorWithDeviceMemory = Navigator & {
  deviceMemory?: number;
};

function resolveMaxSettleRenderDimension(): number {
  if (typeof navigator === "undefined") {
    return DEFAULT_MAX_SETTLE_RENDER_DIMENSION;
  }
  const nav = navigator as NavigatorWithDeviceMemory;
  const deviceMemory = nav.deviceMemory;
  const cpuCores = navigator.hardwareConcurrency;
  const hasLowMemory = typeof deviceMemory === "number" && deviceMemory > 0 && deviceMemory <= 4;
  const hasLowCpu = typeof cpuCores === "number" && cpuCores > 0 && cpuCores <= 4;
  if (hasLowMemory || hasLowCpu) {
    return LOW_RESOURCE_MAX_SETTLE_RENDER_DIMENSION;
  }
  return DEFAULT_MAX_SETTLE_RENDER_DIMENSION;
}

const MAX_SETTLE_RENDER_DIMENSION = resolveMaxSettleRenderDimension();

type RenderQuality = "interactive" | "settle";

function isFromViewerControls(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-viewer-controls="true"]') !== null;
}

function computeSettleResolutionScale(width: number, height: number): number {
  const maxDimension = Math.max(width, height);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    return 1;
  }
  return Math.min(1, MAX_SETTLE_RENDER_DIMENSION / maxDimension);
}

function resolveSettleSourceDimensions(source: SettleSource): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }
  return {
    width: source.width,
    height: source.height,
  };
}

function disposeSettleSource(source: SettleSource | null): void {
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    source.close();
  }
}

async function prepareFullResolutionSettleSource(
  image: HTMLImageElement,
): Promise<{
  source: SettleSource;
  sourceLabel: Exclude<SettleSourceLabel, "preview">;
  scale: number;
}> {
  const dimensions = resolveSettleSourceDimensions(image);
  const scale = computeSettleResolutionScale(dimensions.width, dimensions.height);
  if (scale >= 1) {
    return {
      source: image,
      sourceLabel: "full",
      scale: 1,
    };
  }

  const targetWidth = Math.max(1, Math.round(dimensions.width * scale));
  const targetHeight = Math.max(1, Math.round(dimensions.height * scale));
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(image, {
        resizeWidth: targetWidth,
        resizeHeight: targetHeight,
        resizeQuality: "high",
      });
      return {
        source: bitmap,
        sourceLabel: "full_resampled",
        scale,
      };
    } catch {
      // Safari and older engines may reject resize options; fallback to canvas path.
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return {
      source: image,
      sourceLabel: "full",
      scale: 1,
    };
  }
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return {
    source: canvas,
    sourceLabel: "full_resampled",
    scale,
  };
}

export function ImageViewer({
  images,
  selectedImageId,
  profileId,
  profileStrengthScalars,
  transform,
  params,
  compareMode,
  splitPosition,
  onSelectImage,
  onZoomBy,
  onSetPan,
  onResetView,
  onSetSplitPosition,
  onRenderStatusChange,
  onRendererModeChange,
  lutStage,
  lutCacheKey,
}: ImageViewerProps) {
  const dragRef = useRef<DragState | null>(null);
  const rendererRef = useRef<RendererAdapter | null>(null);
  const renderCacheRef = useRef(new RenderFrameCache(32));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [fullResImage, setFullResImage] = useState<HTMLImageElement | null>(null);
  const [preparedFullResSource, setPreparedFullResSource] = useState<SettleSource | null>(null);
  const [preparedFullResLabel, setPreparedFullResLabel] = useState<
    Exclude<SettleSourceLabel, "preview"> | null
  >(null);
  const [preparedFullResScale, setPreparedFullResScale] = useState(1);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [rendererWarning, setRendererWarning] = useState<string | null>(null);
  const [rendererMode, setRendererMode] = useState<RendererMode>("webgl2");
  const [rendererReady, setRendererReady] = useState(0);
  const [isPreparingFullResSource, setIsPreparingFullResSource] = useState(false);
  const [renderQuality, setRenderQuality] = useState<RenderQuality>("settle");
  const [cachedFrameSrc, setCachedFrameSrc] = useState<string | null>(null);
  const [isMouseHoveringViewer, setIsMouseHoveringViewer] = useState(false);
  const [isViewerFocused, setIsViewerFocused] = useState(false);
  const [isBeforeHoldActive, setIsBeforeHoldActive] = useState(false);
  const [isSourceImageLoading, setIsSourceImageLoading] = useState(false);
  const [settleSourceUsed, setSettleSourceUsed] = useState<SettleSourceLabel>("preview");
  const [settleScaleUsed, setSettleScaleUsed] = useState(1);

  const activeImage = useMemo(
    () => images.find((image) => image.id === selectedImageId) ?? images[0],
    [images, selectedImageId],
  );
  const activeImageId = activeImage?.id ?? selectedImageId;
  const previewImageSource = activeImage?.previewSrc ?? "";
  const fullImageSource = activeImage?.fullSrc ?? previewImageSource;
  const hasDistinctFullSource =
    Boolean(fullImageSource) && fullImageSource !== previewImageSource;

  const transformedLayerStyle: CSSProperties = {
    ...layerStyleBase,
    transform: `translate(calc(-50% + ${transform.offsetX}px), calc(-50% + ${transform.offsetY}px)) scale(${transform.scale})`,
    transformOrigin: "center center",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  useEffect(() => {
    if (!previewImageSource) {
      setSourceImage(null);
      setFullResImage(null);
      setCachedFrameSrc(null);
      setIsPreparingFullResSource(false);
      setIsSourceImageLoading(false);
      return;
    }

    setCachedFrameSrc(null);
    setFullResImage(null);
    setPreparedFullResSource(null);
    setPreparedFullResLabel(null);
    setPreparedFullResScale(1);
    setIsPreparingFullResSource(false);
    setIsSourceImageLoading(true);
    setSettleSourceUsed("preview");
    setSettleScaleUsed(1);
    let cancelled = false;
    const previewImage = new Image();
    previewImage.decoding = "async";
    previewImage.src = previewImageSource;
    previewImage.onload = () => {
      if (cancelled) {
        return;
      }
      setSourceImage(previewImage);
      setIsSourceImageLoading(false);
      setRendererError(null);
    };
    previewImage.onerror = () => {
      if (cancelled) {
        return;
      }
      setSourceImage(null);
      setFullResImage(null);
      setIsSourceImageLoading(false);
      setRendererError("Unable to load preview image");
    };

    if (hasDistinctFullSource) {
      const image = new Image();
      image.decoding = "async";
      image.src = fullImageSource;
      image.onload = () => {
        if (cancelled) {
          return;
        }
        setFullResImage(image);
      };
      image.onerror = () => {
        if (cancelled) {
          return;
        }
        setFullResImage(null);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [hasDistinctFullSource, fullImageSource, previewImageSource]);

  useEffect(() => {
    if (!fullResImage) {
      setPreparedFullResSource(null);
      setPreparedFullResLabel(null);
      setPreparedFullResScale(1);
      setIsPreparingFullResSource(false);
      return;
    }

    let cancelled = false;
    setIsPreparingFullResSource(true);
    void (async () => {
      try {
        const prepared = await prepareFullResolutionSettleSource(fullResImage);
        if (cancelled) {
          disposeSettleSource(prepared.source);
          return;
        }
        setPreparedFullResSource(prepared.source);
        setPreparedFullResLabel(prepared.sourceLabel);
        setPreparedFullResScale(prepared.scale);
        setIsPreparingFullResSource(false);
      } catch {
        if (!cancelled) {
          setPreparedFullResSource(fullResImage);
          setPreparedFullResLabel("full");
          setPreparedFullResScale(1);
          setIsPreparingFullResSource(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fullResImage]);

  useEffect(() => {
    return () => {
      disposeSettleSource(preparedFullResSource);
    };
  }, [preparedFullResSource]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    try {
      const webglRenderer = new ApproxWebglRenderer(canvas);
      rendererRef.current = {
        mode: "webgl2",
        render: webglRenderer.render.bind(webglRenderer),
      };
      setRendererMode("webgl2");
      setRendererWarning(null);
      setRendererError(null);
      setRendererReady((current) => current + 1);
    } catch (error) {
      try {
        const cpuRenderer = new ApproxCpuRenderer(canvas);
        rendererRef.current = {
          mode: "cpu_fallback",
          render: cpuRenderer.render.bind(cpuRenderer),
        };
        setRendererMode("cpu_fallback");
        setRendererWarning("WebGL2 unavailable. Using CPU fallback mode.");
        setRendererError(null);
        setRendererReady((current) => current + 1);
      } catch (cpuError) {
        const webglMessage =
          error instanceof Error ? error.message : "WebGL2 renderer initialization failed";
        const cpuMessage =
          cpuError instanceof Error ? cpuError.message : "CPU renderer initialization failed";
        rendererRef.current = null;
        setRendererWarning(null);
        setRendererError(`${webglMessage}; ${cpuMessage}`);
      }
    }
  }, []);

  useEffect(() => {
    if (!sourceImage || !rendererRef.current) {
      return;
    }

    const settleSourceImage = preparedFullResSource ?? sourceImage;
    const settleSourceKey = preparedFullResLabel ?? "preview";
    const settleResolutionScale = preparedFullResSource
      ? 1
      : computeSettleResolutionScale(sourceImage.naturalWidth || sourceImage.width, sourceImage.naturalHeight || sourceImage.height);
    const settleReportedScale = preparedFullResSource
      ? preparedFullResScale
      : settleResolutionScale;
    const settleCacheKey = buildRenderCacheKey({
      imageId: activeImageId,
      profileId,
      params,
      mode: "settle",
      renderVariant: `${lutCacheKey ?? "lut:off"};source=${settleSourceKey}`,
    });
    const cachedSettleFrame = renderCacheRef.current.get(settleCacheKey);
    if (cachedSettleFrame) {
      setCachedFrameSrc(cachedSettleFrame.src);
      setRendererError(null);
      setRenderQuality("settle");
      setSettleSourceUsed(settleSourceKey);
      setSettleScaleUsed(settleReportedScale);
      return;
    }

    setCachedFrameSrc(null);

    const renderer = rendererRef.current;
    const renderParams = toApproxRenderParams(params, profileStrengthScalars);
    let cancelled = false;

    const renderAtScale = (
      image: SettleSource,
      resolutionScale: number,
      quality: RenderQuality,
      reportedScale = resolutionScale,
    ) => {
      if (cancelled) {
        return;
      }

      try {
        renderer.render(image, renderParams, {
          resolutionScale,
          lutStage,
        });

        if (quality === "settle") {
          setSettleSourceUsed(settleSourceKey);
          setSettleScaleUsed(reportedScale);
          if (canvasRef.current) {
            const cachedSrc = canvasRef.current.toDataURL("image/png");
            renderCacheRef.current.set(settleCacheKey, cachedSrc);
          }
        }

        setRendererError(null);
        setRenderQuality(quality);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Render failed";
        setRendererError(message);
      }
    };

    renderAtScale(sourceImage, INTERACTIVE_RESOLUTION_SCALE, "interactive");
    const settleTimer = window.setTimeout(() => {
      renderAtScale(settleSourceImage, settleResolutionScale, "settle", settleReportedScale);
    }, SETTLE_RENDER_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(settleTimer);
    };
  }, [
    activeImageId,
    lutCacheKey,
    lutStage,
    params,
    profileId,
    profileStrengthScalars,
    preparedFullResLabel,
    preparedFullResScale,
    preparedFullResSource,
    rendererReady,
    sourceImage,
  ]);

  const handlePointerDownPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isFromViewerControls(event.target)) {
      return;
    }

    if (compareMode !== "split") {
      setIsBeforeHoldActive(true);
    }

    if (transform.scale <= 1) {
      return;
    }

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: transform.offsetX,
      startOffsetY: transform.offsetY,
    };
  };

  const handlePointerDownSplit = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: "split",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: transform.offsetX,
      startOffsetY: transform.offsetY,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (dragState.mode === "split") {
      const viewportRect = event.currentTarget.getBoundingClientRect();
      const position = (event.clientX - viewportRect.left) / viewportRect.width;
      onSetSplitPosition(position);
      return;
    }

    if (dragState.mode === "pan") {
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      onSetPan(dragState.startOffsetX + deltaX, dragState.startOffsetY + deltaY);
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    setIsBeforeHoldActive(false);
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const handleViewerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      onZoomBy(1.1);
      return;
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      onZoomBy(0.9);
      return;
    }

    if (event.key === "0") {
      event.preventDefault();
      onResetView();
      return;
    }

    if ((event.key === " " || event.key === "Enter") && compareMode !== "split") {
      event.preventDefault();
      setIsBeforeHoldActive(true);
      return;
    }

    const panStep = 24;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onSetPan(transform.offsetX - panStep, transform.offsetY);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onSetPan(transform.offsetX + panStep, transform.offsetY);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onSetPan(transform.offsetX, transform.offsetY - panStep);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onSetPan(transform.offsetX, transform.offsetY + panStep);
    }
  };

  const handleViewerKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === " " || event.key === "Enter") {
      setIsBeforeHoldActive(false);
    }
  };

  const isSplitMode = compareMode === "split";
  const beforeLayerVisible = isSplitMode || isBeforeHoldActive;
  const afterLayerVisible = isSplitMode || !isBeforeHoldActive;
  const showCachedAfterLayer = afterLayerVisible && !rendererError && !!cachedFrameSrc;
  const showRenderedAfterLayer = afterLayerVisible && !rendererError && !cachedFrameSrc;
  const showFallbackAfterLayer = afterLayerVisible && !!rendererError;
  const showViewerLoader = isSourceImageLoading || (!sourceImage && !rendererError);
  const rendererModeLabel = rendererMode === "cpu_fallback" ? "CPU fallback" : "WebGL2";
  const lutStageLabel = lutStage ? "LUT on" : "LUT off";
  const splitPercent = `${(splitPosition * 100).toFixed(2)}%`;
  const settleSourceLabel = settleSourceUsed;
  const isHighResSettleReady =
    hasDistinctFullSource &&
    renderQuality === "settle" &&
    (settleSourceLabel === "full" || settleSourceLabel === "full_resampled");
  const fullSourceStatus = !hasDistinctFullSource
    ? "none"
    : !fullResImage
      ? "loading"
      : isPreparingFullResSource
        ? "preparing"
        : isHighResSettleReady
          ? "ready"
          : "settling";
  const showSettleProgressBadge = !showViewerLoader && hasDistinctFullSource && !isHighResSettleReady;
  const settleProgressLabel = !fullResImage
    ? "Loading full source..."
    : isPreparingFullResSource
      ? "Preparing high-res settle..."
      : renderQuality === "interactive"
        ? "Refining detail..."
        : "Applying high-res settle...";
  const settleQualityLabel =
    settleSourceLabel === "full"
      ? "settled full resolution"
      : settleSourceLabel === "full_resampled"
        ? "settled high resolution"
        : "settled preview resolution";
  const renderStatusText = rendererError
    ? `Render status: ${rendererError}. Showing fallback preview.`
    : showCachedAfterLayer
      ? `${rendererModeLabel}: restored settled frame from cache (source=${settleSourceLabel}; scale=${settleScaleUsed.toFixed(3)}; full_source=${fullSourceStatus}; max_settle_dim=${MAX_SETTLE_RENDER_DIMENSION}).`
    : renderQuality === "interactive"
      ? `${rendererModeLabel}: interactive preview (${Math.round(INTERACTIVE_RESOLUTION_SCALE * 100)}%) (${lutStageLabel}; full_source=${fullSourceStatus}).`
      : `${rendererModeLabel}: ${settleQualityLabel} (${lutStageLabel}; source=${settleSourceLabel}; scale=${settleScaleUsed.toFixed(3)}; full_source=${fullSourceStatus}; max_settle_dim=${MAX_SETTLE_RENDER_DIMENSION}).`;
  const renderStatusWithWarning = rendererWarning
    ? `${renderStatusText} ${rendererWarning}`
    : renderStatusText;
  const beforeLayerSrc = fullResImage ? activeImage.fullSrc : activeImage.previewSrc;

  const beforeLayerStyle: CSSProperties = {
    ...transformedLayerStyle,
    opacity: beforeLayerVisible ? 1 : 0,
  };

  const afterLayerStyle: CSSProperties = {
    ...transformedLayerStyle,
    opacity: afterLayerVisible ? 1 : 0,
  };
  const splitAfterMaskStyle: CSSProperties = {
    ...splitAfterMaskBaseStyle,
    left: splitPercent,
  };

  useEffect(() => {
    onRenderStatusChange?.(renderStatusWithWarning);
  }, [onRenderStatusChange, renderStatusWithWarning]);

  useEffect(() => {
    onRendererModeChange?.(rendererMode);
  }, [onRendererModeChange, rendererMode]);

  if (!activeImage) {
    return null;
  }

  return (
    <section
      style={rootStyle}
      onMouseEnter={() => setIsMouseHoveringViewer(true)}
      onMouseLeave={() => {
        setIsMouseHoveringViewer(false);
        setIsBeforeHoldActive(false);
      }}
    >
      <div style={tabsStyle}>
        {images.map((image) => {
          const isActive = image.id === activeImage.id;
          return (
            <button
              key={image.id}
              type="button"
              onClick={() => onSelectImage(image.id)}
              style={isActive ? activeTabStyle : tabButtonStyle}
              aria-label={image.title}
            >
              <img src={image.previewSrc} alt={image.title} style={tabImageStyle} />
            </button>
          );
        })}
      </div>

      <div
        style={viewportStyle}
        data-testid="viewer-viewport"
        data-render-quality={renderQuality}
        data-settle-source={settleSourceLabel}
        data-settle-scale={settleScaleUsed.toFixed(4)}
        data-settle-max-dimension={MAX_SETTLE_RENDER_DIMENSION}
        data-has-full-source={hasDistinctFullSource ? "true" : "false"}
        data-full-source-ready={fullResImage ? "true" : "false"}
        data-full-source-preparing={isPreparingFullResSource ? "true" : "false"}
        data-full-source-status={fullSourceStatus}
        tabIndex={0}
        aria-label="Recipe viewer viewport"
        onPointerDown={handlePointerDownPan}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={() => setIsBeforeHoldActive(false)}
        onFocus={() => setIsViewerFocused(true)}
        onBlur={() => {
          setIsViewerFocused(false);
          setIsBeforeHoldActive(false);
        }}
        onKeyDown={handleViewerKeyDown}
        onKeyUp={handleViewerKeyUp}
      >
        {beforeLayerVisible ? (
          <img
            src={beforeLayerSrc}
            alt={activeImage.title}
            style={beforeLayerStyle}
            data-testid="viewer-before-layer"
          />
        ) : null}
        {isSplitMode ? (
          <div style={splitAfterMaskStyle}>
            <canvas
              aria-label={`${activeImage.title} after render`}
              ref={canvasRef}
              data-testid="viewer-after-canvas"
              style={{
                ...afterLayerStyle,
                opacity: showRenderedAfterLayer ? 1 : 0,
              }}
            />
            {showCachedAfterLayer ? (
              <img
                src={cachedFrameSrc ?? undefined}
                alt={`${activeImage.title} cached render`}
                style={afterLayerStyle}
              />
            ) : null}
            {showFallbackAfterLayer ? (
              <img
                src={beforeLayerSrc}
                alt={`${activeImage.title} fallback`}
                style={afterLayerStyle}
              />
            ) : null}
          </div>
        ) : (
          <>
            <canvas
              aria-label={`${activeImage.title} after render`}
              ref={canvasRef}
              data-testid="viewer-after-canvas"
              style={{
                ...afterLayerStyle,
                opacity: showRenderedAfterLayer ? 1 : 0,
              }}
            />
            {showCachedAfterLayer ? (
              <img
                src={cachedFrameSrc ?? undefined}
                alt={`${activeImage.title} cached render`}
                style={afterLayerStyle}
              />
            ) : null}
            {showFallbackAfterLayer ? (
              <img
                src={beforeLayerSrc}
                alt={`${activeImage.title} fallback`}
                style={afterLayerStyle}
              />
            ) : null}
          </>
        )}
        {isSplitMode ? (
          <div
            style={{
              ...splitDividerStyle,
              left: splitPercent,
            }}
            data-testid="viewer-split-divider"
            onPointerDown={handlePointerDownSplit}
          />
        ) : null}
        {showViewerLoader ? (
          <div style={loaderOverlayStyle} data-testid="viewer-loader">
            <span style={loaderPillStyle}>Loading image...</span>
          </div>
        ) : null}
        {showSettleProgressBadge ? (
          <div style={settleProgressBadgeStyle} data-testid="viewer-settle-progress">
            {settleProgressLabel}
          </div>
        ) : null}
        <div
          data-viewer-controls="true"
          data-testid="viewer-zoom-controls"
          style={{
            ...zoomOverlayStyle,
            opacity: isMouseHoveringViewer || isViewerFocused ? 1 : 0,
            pointerEvents: isMouseHoveringViewer || isViewerFocused ? "auto" : "none",
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            data-testid="viewer-zoom-in"
            style={zoomButtonStyle}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onZoomBy(1.1)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            data-testid="viewer-zoom-out"
            style={zoomButtonStyle}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onZoomBy(0.9)}
            aria-label="Zoom out"
          >
            -
          </button>
          <span style={zoomLabelStyle} data-testid="viewer-zoom-value">
            {transform.scale.toFixed(2)}x
          </span>
          <button
            type="button"
            data-testid="viewer-zoom-reset"
            style={zoomResetButtonStyle}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onResetView}
            aria-label="Reset zoom"
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
