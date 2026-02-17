import { useEffect, useState, type CSSProperties } from "react";
import { useParameterStore } from "./state/parameterStore";
import { ImageViewer } from "./components/ImageViewer";
import { ParameterPanel } from "./components/ParameterPanel";
import { RecipeToolbar } from "./components/RecipeToolbar";
import { ApproxDisclosureBadge } from "./components/ApproxDisclosureBadge";
import { CreditsPanel } from "./components/CreditsPanel";
import { LearnOverlay } from "./components/LearnOverlay";
import { PresetGallery } from "./components/PresetGallery";
import { canonicalImages } from "./data/images";
import { approvedLuts, blockedLuts, resolveActiveLut } from "./data/luts";
import { resolveProfile } from "./data/profiles";
import { defaultTransform, useViewerStore } from "./state/viewerStore";
import { decodeSharePayloadFromSearch } from "./shareLink";

const containerStyle: CSSProperties = {
  margin: "0 auto",
  width: "100%",
  maxWidth: "1380px",
  boxSizing: "border-box",
  padding: "clamp(12px, 2vw, 24px)",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
  color: "#161616",
};

const noticeStyle: CSSProperties = {
  border: "1px solid #d8d8d8",
  borderRadius: "12px",
  padding: "16px",
  marginTop: "16px",
  backgroundColor: "#fafafa",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const noticeActionsStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "10px",
};

const layoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 7fr) minmax(300px, 3fr)",
  gap: "16px",
  marginTop: "16px",
  alignItems: "start",
};

const compactLayoutStyle: CSSProperties = {
  ...layoutStyle,
  gridTemplateColumns: "minmax(0, 1fr)",
};

const footerStyle: CSSProperties = {
  borderTop: "1px solid #d8d8d8",
  marginTop: "18px",
  paddingTop: "12px",
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  color: "#353535",
  overflowWrap: "anywhere",
};

const MODEL_OPTIONS = [
  { id: "xtrans5", label: "X-T5 / X-H2 / X-S20" },
  { id: "xtrans3", label: "X-T3 / X-T30" },
];

const LEGACY_PROFILE_TO_MODEL_MAP: Record<string, string> = {
  xtrans4: "xtrans5",
};

type ViewerRendererMode = "webgl2" | "cpu_fallback";

function resolveVisibleModelId(profileId: string): string {
  if (MODEL_OPTIONS.some((option) => option.id === profileId)) {
    return profileId;
  }

  return LEGACY_PROFILE_TO_MODEL_MAP[profileId] ?? MODEL_OPTIONS[0].id;
}

function resolveModelLabel(profileId: string): string {
  return MODEL_OPTIONS.find((option) => option.id === profileId)?.label ?? profileId;
}

export function App() {
  const selectedImageId = useViewerStore((state) => state.selectedImageId);
  const selectImage = useViewerStore((state) => state.selectImage);
  const zoomBy = useViewerStore((state) => state.zoomBy);
  const setPan = useViewerStore((state) => state.setPan);
  const resetView = useViewerStore((state) => state.resetView);
  const compareMode = useViewerStore((state) => state.compareMode);
  const splitPosition = useViewerStore((state) => state.splitPosition);
  const setCompareMode = useViewerStore((state) => state.setCompareMode);
  const setSplitPosition = useViewerStore((state) => state.setSplitPosition);
  const applyProfile = useParameterStore((state) => state.applyProfile);
  const profileId = useParameterStore((state) => state.profile.profile_id);
  const profileStrengthScalars = useParameterStore(
    (state) => state.profile.strength_scalars,
  );
  const params = useParameterStore((state) => state.params);
  const compatibilityIssues = useParameterStore((state) => state.compatibilityIssues);
  const replaceParams = useParameterStore((state) => state.replaceParams);
  const randomizeWithinSafeBounds = useParameterStore(
    (state) => state.randomizeWithinSafeBounds,
  );
  const resetAllParams = useParameterStore((state) => state.resetAll);
  const activeTransform = useViewerStore(
    (state) => state.transforms[selectedImageId] ?? defaultTransform,
  );
  const activeLut = resolveActiveLut(profileId);
  const [shareLoadStatus, setShareLoadStatus] = useState<string | null>(null);
  const [isLearnOpen, setIsLearnOpen] = useState(false);
  const [renderStatus, setRenderStatus] = useState("Initializing renderer...");
  const [rendererMode, setRendererMode] = useState<ViewerRendererMode>("webgl2");
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  const handleProfileChange = (
    nextProfileId: string,
    source: "user" | "restore" | "import" = "user",
  ) => {
    const visibleProfileId = resolveVisibleModelId(nextProfileId);
    const nextProfile = resolveProfile(visibleProfileId);
    if (!nextProfile || nextProfile.profile_id === profileId) {
      return;
    }

    applyProfile(nextProfile);
    if (source === "user") {
      setShareLoadStatus(`Model switched to ${resolveModelLabel(visibleProfileId)}.`);
    }
  };

  const handleRenderStatusChange = (status: string) => {
    setRenderStatus((current) => (current === status ? current : status));
  };

  const handleRendererModeChange = (mode: ViewerRendererMode) => {
    setRendererMode((current) => (current === mode ? current : mode));
  };

  const compareModeLabel =
    compareMode === "split"
      ? `split@${Math.round(splitPosition * 100)}%`
      : "after";
  const qaDiagnostics = `renderer=${rendererMode}; model=${resolveModelLabel(profileId)}(${profileId}); compare=${compareModeLabel}; image=${selectedImageId}; zoom=${activeTransform.scale.toFixed(2)}x`;

  const lutLegalGateText = activeLut
    ? `Approved LUT catalog entry: ${activeLut.lut_id} (${activeLut.source}). Runtime rendering remains procedural-only in v1 (LUT files are not applied). ${blockedLuts.length} manifest entries are blocked by legal policy.`
    : `No profile-specific approved LUT entry is available. ${approvedLuts.length} approved fallback manifest entries are currently detected, but runtime rendering remains procedural-only in v1 (LUT files are not applied).`;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1180px)");
    const syncLayoutMode = () => {
      setIsCompactLayout(mediaQuery.matches);
    };

    syncLayoutMode();
    const supportsModernListener = typeof mediaQuery.addEventListener === "function";
    if (supportsModernListener) {
      mediaQuery.addEventListener("change", syncLayoutMode);
    } else {
      mediaQuery.addListener(syncLayoutMode);
    }

    return () => {
      if (supportsModernListener) {
        mediaQuery.removeEventListener("change", syncLayoutMode);
      } else {
        mediaQuery.removeListener(syncLayoutMode);
      }
    };
  }, []);

  useEffect(() => {
    const visibleProfileId = resolveVisibleModelId(profileId);
    if (visibleProfileId === profileId) {
      return;
    }

    const fallbackProfile = resolveProfile(visibleProfileId);
    if (!fallbackProfile) {
      return;
    }

    applyProfile(fallbackProfile);
    setShareLoadStatus(`Model switched to ${resolveModelLabel(visibleProfileId)}.`);
  }, [applyProfile, profileId]);

  const recoverState = () => {
    resetAllParams();
    const fallbackImageId = canonicalImages[0]?.id ?? selectedImageId;
    selectImage(fallbackImageId);
    resetView(fallbackImageId);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("s");
      url.searchParams.delete("v");
      window.history.replaceState({}, "", url.toString());
      window.sessionStorage.removeItem("fuji-viewer-session-v1");
    }

    setShareLoadStatus("State recovered to profile defaults.");
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const payload = decodeSharePayloadFromSearch(window.location.search);
      if (!payload) {
        return;
      }

      const resolvedProfileId = resolveVisibleModelId(payload.profile_id);
      const resolvedProfile = resolveProfile(resolvedProfileId);
      if (resolvedProfile) {
        applyProfile(resolvedProfile);
      }

      replaceParams(payload.params);
      const imageExists = canonicalImages.some((image) => image.id === payload.base_image_id);
      selectImage(imageExists ? payload.base_image_id : canonicalImages[0].id);

      if (!imageExists) {
        setShareLoadStatus(
          `Share link loaded, but image ${payload.base_image_id} is unavailable in this build.`,
        );
        return;
      }

      if (resolvedProfileId !== payload.profile_id) {
        setShareLoadStatus(
          `Share link loaded and mapped to ${resolveModelLabel(resolvedProfileId)}.`,
        );
        return;
      }

      setShareLoadStatus("Share link state loaded.");
    } catch {
      setShareLoadStatus("Share link payload is invalid or unsupported.");
    }
  }, [applyProfile, replaceParams, selectImage]);

  return (
    <main style={containerStyle}>
      <header style={headerStyle}>
        <h1>Fuji Recipe Lab</h1>
        <div style={headerActionsStyle}>
          <button type="button" onClick={() => setIsLearnOpen(true)}>
            Learn
          </button>
          <ApproxDisclosureBadge />
        </div>
      </header>
      {shareLoadStatus ? (
        <section style={noticeStyle}>
          <strong>Share Restore:</strong> {shareLoadStatus}
          <div style={noticeActionsStyle}>
            <button type="button" onClick={recoverState}>
              Recover Safe Defaults
            </button>
          </div>
        </section>
      ) : null}
      {compatibilityIssues.length > 0 ? (
        <section style={noticeStyle}>
          <strong>State Compatibility Warning:</strong>
          <ul>
            {compatibilityIssues.slice(0, 3).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <div style={noticeActionsStyle}>
            <button type="button" onClick={recoverState}>
              Reset Invalid State
            </button>
          </div>
        </section>
      ) : null}

      <section style={isCompactLayout ? compactLayoutStyle : layoutStyle}>
        <ImageViewer
          images={canonicalImages}
          selectedImageId={selectedImageId}
          profileId={profileId}
          profileStrengthScalars={profileStrengthScalars}
          transform={activeTransform}
          params={params}
          compareMode={compareMode}
          splitPosition={splitPosition}
          onSelectImage={selectImage}
          onZoomBy={(factor) => zoomBy(selectedImageId, factor)}
          onSetPan={(offsetX, offsetY) => setPan(selectedImageId, offsetX, offsetY)}
          onResetView={() => resetView(selectedImageId)}
          onSetSplitPosition={setSplitPosition}
          onRenderStatusChange={handleRenderStatusChange}
          onRendererModeChange={handleRendererModeChange}
        />
        <ParameterPanel
          profileId={profileId}
          profileOptions={MODEL_OPTIONS}
          onProfileChange={(nextProfileId) => handleProfileChange(nextProfileId, "user")}
          compareMode={compareMode}
          onSetCompareMode={setCompareMode}
        />
      </section>
      <RecipeToolbar
        profileId={profileId}
        baseImageId={selectedImageId}
        params={params}
        onApplyParams={replaceParams}
        onSelectImage={selectImage}
        onProfileChangeRequest={(nextProfileId) => handleProfileChange(nextProfileId, "import")}
        onResetAllParams={resetAllParams}
        onRandomizeSafe={randomizeWithinSafeBounds}
      />
      <PresetGallery onApplyPreset={replaceParams} onSelectImage={selectImage} />
      <CreditsPanel />
      <LearnOverlay
        isOpen={isLearnOpen}
        baseParams={params}
        onApplyPreset={replaceParams}
        onClose={() => setIsLearnOpen(false)}
      />
      <footer style={footerStyle}>
        <div>
          Educational, approximate visualizer for recipe exploration. It does not emulate
          Fujifilm camera JPEG output.
        </div>
        <div>
          <strong>Approx Disclosure:</strong> This app is an approximate visualizer for
          learning and does not emulate camera JPEG output.
        </div>
        <div>
          <strong>LUT Legal Gate:</strong> {lutLegalGateText}
        </div>
        <div>
          <strong>Render Status:</strong> {renderStatus}
        </div>
        <div>
          <strong>QA Diagnostics:</strong> {qaDiagnostics}
        </div>
      </footer>
    </main>
  );
}
