import { useMemo, type CSSProperties } from "react";
import type { RecipeParams } from "@fuji/domain";
import type { ParamKey } from "../state/parameterStore";
import { useParameterStore } from "../state/parameterStore";
import type { CompareMode } from "../state/viewerStore";
import { buildParameterGroups } from "./parameterPanelConfig";

const panelStyle: CSSProperties = {
  border: "1px solid #d8d8d8",
  borderRadius: "12px",
  padding: "12px",
  backgroundColor: "#f7f7f7",
  display: "grid",
  gap: "12px",
  alignContent: "start",
};

const groupStyle: CSSProperties = {
  border: "1px solid #dfdfdf",
  borderRadius: "10px",
  backgroundColor: "#fff",
  overflow: "hidden",
};

const summaryStyle: CSSProperties = {
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 600,
  backgroundColor: "#fafafa",
};

const groupBodyStyle: CSSProperties = {
  padding: "10px 12px",
  display: "grid",
  gap: "10px",
};

const controlRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr minmax(0, 160px) auto auto",
  gap: "8px",
  alignItems: "center",
};

const sliderHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto auto",
  gap: "8px",
  alignItems: "center",
};

const sliderStackStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
};

const wbShiftCardStyle: CSSProperties = {
  border: "1px solid #efefef",
  borderRadius: "8px",
  padding: "10px",
  display: "grid",
  gap: "8px",
};

const wbAxisRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "8px",
  alignItems: "center",
};

const viewerControlRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center",
};

const activeCompareButtonStyle: CSSProperties = {
  backgroundColor: "#1f1f1f",
  color: "#fff",
};

type ParameterPanelProps = {
  profileId: string;
  profileOptions: Array<{ id: string; label: string }>;
  onProfileChange: (profileId: string) => void;
  compareMode: CompareMode;
  onSetCompareMode: (mode: CompareMode) => void;
};

export function ParameterPanel({
  profileId,
  profileOptions,
  onProfileChange,
  compareMode,
  onSetCompareMode,
}: ParameterPanelProps) {
  const profile = useParameterStore((state) => state.profile);
  const params = useParameterStore((state) => state.params);
  const locks = useParameterStore((state) => state.locks);
  const setParam = useParameterStore((state) => state.setParam);
  const setWbShift = useParameterStore((state) => state.setWbShift);
  const resetParam = useParameterStore((state) => state.resetParam);
  const resetAll = useParameterStore((state) => state.resetAll);
  const toggleLock = useParameterStore((state) => state.toggleLock);

  const groups = useMemo(() => buildParameterGroups(profile, params), [profile, params]);

  const setTypedParam = <K extends ParamKey>(key: K, value: RecipeParams[K]) => {
    setParam(key, value);
  };

  return (
    <aside style={panelStyle}>
      <details open style={groupStyle}>
        <summary style={summaryStyle}>Viewer</summary>
        <div style={groupBodyStyle}>
          <div style={viewerControlRowStyle}>
            <label htmlFor="panel-profile-selector">Camera Model</label>
            <select
              id="panel-profile-selector"
              aria-label="Camera model selector"
              value={profileId}
              onChange={(event) => onProfileChange(event.currentTarget.value)}
            >
              {profileOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={viewerControlRowStyle}>
            <strong>Preview:</strong>
            <button
              type="button"
              onClick={() => onSetCompareMode(compareMode === "split" ? "after" : "split")}
              style={compareMode === "split" ? activeCompareButtonStyle : undefined}
            >
              {compareMode === "split" ? "Split Screen: On" : "Split Screen: Off"}
            </button>
            <small>Press and hold on the image to preview Before.</small>
          </div>
        </div>
      </details>

      {groups.map((group) => (
        <details key={group.id} open style={groupStyle}>
          <summary style={summaryStyle}>{group.label}</summary>
          <div style={groupBodyStyle}>
            {group.controls.map((control) => {
              if ("hidden" in control && control.hidden) {
                return null;
              }

              if (control.kind === "enum") {
                const controlId = `${group.id}-${control.key}`;
                return (
                  <div key={controlId} style={controlRowStyle}>
                    <label htmlFor={controlId}>{control.label}</label>
                    <select
                      id={controlId}
                      value={String(params[control.key])}
                      onChange={(event) =>
                        setTypedParam(
                          control.key,
                          event.target.value as RecipeParams[typeof control.key],
                        )
                      }
                    >
                      {control.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => resetParam(control.key)}>
                      Reset
                    </button>
                    <button type="button" onClick={() => toggleLock(control.key)}>
                      {locks[control.key] ? "Unlock" : "Lock"}
                    </button>
                  </div>
                );
              }

              if (control.kind === "number") {
                const controlId = `${group.id}-${control.key}`;
                const value = params[control.key] as number;

                return (
                  <div key={controlId} style={sliderStackStyle}>
                    <div style={sliderHeaderStyle}>
                      <label htmlFor={controlId}>{control.label}</label>
                      <span>{value}</span>
                      <button type="button" onClick={() => resetParam(control.key)}>
                        Reset
                      </button>
                      <button type="button" onClick={() => toggleLock(control.key)}>
                        {locks[control.key] ? "Unlock" : "Lock"}
                      </button>
                    </div>
                    <input
                      id={controlId}
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step ?? 1}
                      value={value}
                      onChange={(event) =>
                        setTypedParam(
                          control.key,
                          Number(event.target.value) as RecipeParams[typeof control.key],
                        )
                      }
                    />
                  </div>
                );
              }

              return (
                <div key={`${group.id}-${control.key}`} style={wbShiftCardStyle}>
                  <div style={sliderHeaderStyle}>
                    <strong>{control.label}</strong>
                    <span>
                      {params.wb_shift.a_b}/{params.wb_shift.r_b}
                    </span>
                    <button type="button" onClick={() => resetParam("wb_shift")}>
                      Reset
                    </button>
                    <button type="button" onClick={() => toggleLock("wb_shift")}>
                      {locks.wb_shift ? "Unlock" : "Lock"}
                    </button>
                  </div>
                  <div style={wbAxisRowStyle}>
                    <label htmlFor="wb-shift-a">A/B Shift</label>
                    <span>{params.wb_shift.a_b}</span>
                  </div>
                  <input
                    id="wb-shift-a"
                    type="range"
                    min={control.minA}
                    max={control.maxA}
                    value={params.wb_shift.a_b}
                    onChange={(event) => setWbShift("a_b", Number(event.target.value))}
                  />
                  <div style={wbAxisRowStyle}>
                    <label htmlFor="wb-shift-r">R/B Shift</label>
                    <span>{params.wb_shift.r_b}</span>
                  </div>
                  <input
                    id="wb-shift-r"
                    type="range"
                    min={control.minR}
                    max={control.maxR}
                    value={params.wb_shift.r_b}
                    onChange={(event) => setWbShift("r_b", Number(event.target.value))}
                  />
                </div>
              );
            })}
          </div>
        </details>
      ))}

      <button type="button" onClick={resetAll}>
        Reset All
      </button>
    </aside>
  );
}
