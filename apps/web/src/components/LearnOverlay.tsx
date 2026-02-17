import type { CSSProperties } from "react";
import type { RecipeParams } from "@fuji/domain";
import { applyTipPreset, glossaryItems, guidedPresets } from "../learnTips";

type LearnOverlayProps = {
  baseParams: RecipeParams;
  isOpen: boolean;
  onApplyPreset: (params: RecipeParams) => void;
  onClose: () => void;
};

const overlayRootStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 40,
  display: "grid",
  placeItems: "center",
  backgroundColor: "rgba(0, 0, 0, 0.45)",
  padding: "16px",
};

const panelStyle: CSSProperties = {
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
  borderRadius: "14px",
  border: "1px solid #d8d8d8",
  backgroundColor: "#fff",
  padding: "18px",
  display: "grid",
  gap: "16px",
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const cardStyle: CSSProperties = {
  border: "1px solid #ececec",
  borderRadius: "10px",
  padding: "10px",
  display: "grid",
  gap: "6px",
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
};

export function LearnOverlay({
  baseParams,
  isOpen,
  onApplyPreset,
  onClose,
}: LearnOverlayProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={overlayRootStyle} role="dialog" aria-modal="true" aria-label="Learn overlay">
      <div style={panelStyle}>
        <header>
          <h2>Learn</h2>
          <p>
            Use these quick references to understand the major controls, then apply a
            guided preset as a starting point.
          </p>
        </header>

        <section style={sectionStyle}>
          <h3>Glossary</h3>
          {glossaryItems.map((item) => (
            <article key={item.term} style={cardStyle}>
              <strong>{item.term}</strong>
              <p>{item.meaning}</p>
            </article>
          ))}
        </section>

        <section style={sectionStyle}>
          <h3>Guided Presets</h3>
          {guidedPresets.map((preset) => (
            <article key={preset.id} style={cardStyle}>
              <strong>{preset.title}</strong>
              <p>{preset.description}</p>
              <div>
                <button
                  type="button"
                  onClick={() => onApplyPreset(applyTipPreset(baseParams, preset))}
                >
                  Apply Preset
                </button>
              </div>
            </article>
          ))}
        </section>

        <footer style={footerStyle}>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
