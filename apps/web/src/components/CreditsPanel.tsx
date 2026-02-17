import type { CSSProperties } from "react";
import { imageCredits, lutCredits } from "../data/credits";

const panelStyle: CSSProperties = {
  border: "1px solid #d8d8d8",
  borderRadius: "12px",
  marginTop: "16px",
  overflow: "hidden",
};

const summaryStyle: CSSProperties = {
  padding: "12px 14px",
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: "#fafafa",
};

const bodyStyle: CSSProperties = {
  padding: "12px 14px",
  display: "grid",
  gap: "14px",
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: "18px",
  display: "grid",
  gap: "8px",
};

function renderLink(url: string) {
  if (!url) {
    return "n/a";
  }

  return (
    <a href={url} target="_blank" rel="noreferrer">
      {url}
    </a>
  );
}

export function CreditsPanel() {
  return (
    <details style={panelStyle}>
      <summary style={summaryStyle}>Credits & Attribution</summary>
      <div style={bodyStyle}>
        <section style={sectionStyle}>
          <strong>Reference Images</strong>
          <ul style={listStyle}>
            {imageCredits.map((image) => (
              <li key={image.id}>
                <div>
                  <strong>{image.title}</strong> ({image.id})
                </div>
                <div>Author: {image.author}</div>
                <div>
                  License: {image.license} ({renderLink(image.licenseUrl)})
                </div>
                <div>Source: {renderLink(image.sourceUrl)}</div>
                <div>Attribution: {image.requiredAttribution}</div>
                <div>Approval: {image.approvalStatus}</div>
              </li>
            ))}
          </ul>
        </section>

        <section style={sectionStyle}>
          <strong>LUT Assets</strong>
          <ul style={listStyle}>
            {lutCredits.map((lut) => (
              <li key={lut.id}>
                <div>
                  <strong>{lut.id}</strong> ({lut.family})
                </div>
                <div>Source: {lut.source} ({renderLink(lut.sourceUrl)})</div>
                <div>
                  License: {lut.licenseName}
                  {lut.licenseUrl ? ` (` : ""}
                  {lut.licenseUrl ? renderLink(lut.licenseUrl) : ""}
                  {lut.licenseUrl ? `)` : ""}
                </div>
                <div>Approval: {lut.approvalStatus}</div>
                <div>Notes: {lut.notes || "n/a"}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}
