import type { CSSProperties } from "react";

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  borderRadius: "999px",
  border: "1px solid #212121",
  backgroundColor: "#fff",
  color: "#111",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

export function ApproxDisclosureBadge() {
  return (
    <span
      style={badgeStyle}
      title="Approximate visualizer for learning. Output is not camera-accurate JPEG simulation."
      aria-label="Approximate visualizer disclosure"
    >
      Approx
    </span>
  );
}
