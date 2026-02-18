import { useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  List,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconBook2,
  IconRestore,
} from "@tabler/icons-react";
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
    <main className="app-main">
      <Paper className="app-header panel-surface" component="header">
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Title order={1}>Fuji Recipe Lab</Title>
          <Group className="app-header-actions" gap="xs">
            <Button
              variant="light"
              color="cyan"
              leftSection={<IconBook2 size={16} />}
              onClick={() => setIsLearnOpen(true)}
            >
              Learn
            </Button>
            <ApproxDisclosureBadge />
          </Group>
        </Group>
      </Paper>

      <Text className="landscape-hint">
        This workspace is optimized for landscape desktop and iPad layout.
      </Text>

      {shareLoadStatus ? (
        <Alert
          className="app-notice"
          variant="light"
          color="cyan"
          title="Share Restore"
          icon={<IconRestore size={16} />}
        >
          <Stack gap="xs">
            <Text size="sm">{shareLoadStatus}</Text>
            <Group className="app-notice__actions">
              <Button type="button" size="xs" onClick={recoverState}>
                Recover Safe Defaults
              </Button>
            </Group>
          </Stack>
        </Alert>
      ) : null}

      {compatibilityIssues.length > 0 ? (
        <Alert
          className="app-notice"
          variant="light"
          color="red"
          title="State Compatibility Warning"
          icon={<IconAlertTriangle size={16} />}
        >
          <Stack gap="xs">
            <List spacing={4} size="sm">
              {compatibilityIssues.slice(0, 3).map((issue) => (
                <List.Item key={issue}>{issue}</List.Item>
              ))}
            </List>
            <Group className="app-notice__actions">
              <Button type="button" size="xs" color="red" onClick={recoverState}>
                Reset Invalid State
              </Button>
            </Group>
          </Stack>
        </Alert>
      ) : null}

      <section className="workspace-grid">
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

      <Paper className="app-footer panel-surface" component="footer" p="sm">
        <Text size="xs">
          Educational, approximate visualizer for recipe exploration. It does not emulate
          Fujifilm camera JPEG output.
        </Text>
        <Text size="xs">
          <strong>Approx Disclosure:</strong> This app is an approximate visualizer for
          learning and does not emulate camera JPEG output.
        </Text>
        <Text size="xs">
          <strong>LUT Legal Gate:</strong> {lutLegalGateText}
        </Text>
        <Text size="xs">
          <strong>Render Status:</strong> {renderStatus}
        </Text>
        <Text size="xs">
          <strong>QA Diagnostics:</strong> {qaDiagnostics}
        </Text>
      </Paper>
    </main>
  );
}

