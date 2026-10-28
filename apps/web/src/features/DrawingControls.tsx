import type { Drawing } from "@hearth/protocol";
import {
  Check,
  Eraser,
  Eye,
  LockKeyhole,
  Minus,
  PencilLine,
  Square,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ToolButton } from "../workspace/ToolButton";
import { validDrawingText } from "./textDrawings";

export type DrawingSettings = Pick<
  Drawing,
  "shape" | "visibility" | "color" | "text" | "fontSize"
> & { erase?: boolean };
const shapes = [
  { shape: "line", icon: Minus },
  { shape: "rectangle", icon: Square },
  { shape: "freehand", icon: PencilLine },
  { shape: "text", icon: Type },
] as const;
const colors = [
  { color: "#e8bc6a", name: "Gold" },
  { color: "#e65b5b", name: "Red" },
  { color: "#72b7e2", name: "Blue" },
  { color: "#9ad59b", name: "Green" },
];
export function DrawingControls({
  settings,
  onChange,
  onUndo,
  onClose,
  disabled,
  empty,
  full,
  editing = false,
  onSaveText,
  onCancelText,
  textError,
}: {
  settings: DrawingSettings;
  onChange: (settings: DrawingSettings) => void;
  onUndo: () => void;
  onClose: () => void;
  disabled: boolean;
  empty: boolean;
  full: boolean;
  editing?: boolean;
  onSaveText?: () => void;
  onCancelText?: () => void;
  textError?: string | null;
}) {
  const [colorsOpen, setColorsOpen] = useState(false);
  const root = useRef<HTMLFieldSetElement>(null);
  const colorTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!colorsOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setColorsOpen(false);
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [colorsOpen]);
  const visibility = settings.visibility === "shared" ? "Shared" : "GM only";
  return (
    <fieldset
      ref={root}
      className="drawing-tools"
      aria-label="Drawing tools"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (colorsOpen) {
            setColorsOpen(false);
            colorTrigger.current?.focus();
          } else onClose();
        }
      }}
    >
      <fieldset className="drawing-controls">
        <legend className="sr-only">Drawing controls</legend>
        <ToolButton
          label="Close drawing controls"
          icon={X}
          onClick={onClose}
          className="drawing-close"
        />
        <fieldset aria-label="Drawing shape" className="drawing-tool-group">
          {shapes.map(({ shape, icon }) => (
            <ToolButton
              key={shape}
              disabled={disabled}
              label={`Draw ${shape}`}
              icon={icon}
              pressed={!settings.erase && settings.shape === shape}
              onClick={() => {
                onChange({ ...settings, shape, erase: false });
                setColorsOpen(false);
              }}
            />
          ))}
        </fieldset>
        <ToolButton
          disabled={disabled}
          label="Erase drawing"
          title="Erase a whole object · Undo restores it"
          icon={Eraser}
          pressed={!!settings.erase}
          onClick={() => onChange({ ...settings, erase: !settings.erase })}
        />
        <span className="tool-divider" />
        <fieldset aria-label="Drawing layer" className="drawing-tool-group">
          <ToolButton
            disabled={disabled}
            label="Shared drawings"
            title="Shared · visible in revealed areas"
            icon={Eye}
            pressed={settings.visibility === "shared"}
            onClick={() => onChange({ ...settings, visibility: "shared" })}
          />
          <ToolButton
            disabled={disabled}
            label="GM-only drawings"
            title="GM only · hidden from players"
            icon={LockKeyhole}
            pressed={settings.visibility === "dm"}
            onClick={() => onChange({ ...settings, visibility: "dm" })}
          />
        </fieldset>
        <span className="drawing-layer-caption" title={visibility}>
          {settings.visibility === "shared" ? "Shared" : "GM only"}
        </span>
        <span className="tool-divider" />
        <ToolButton
          ref={colorTrigger}
          disabled={disabled}
          label="Drawing color"
          title={`Drawing color · ${colors.find((c) => c.color === settings.color)?.name ?? settings.color}`}
          aria-expanded={colorsOpen}
          aria-controls="drawing-color-options"
          onClick={() => setColorsOpen((s) => !s)}
        >
          <span className="drawing-swatch" style={{ background: settings.color }} />
        </ToolButton>
        <ToolButton
          label="Undo drawing"
          title="Undo drawing change · Ctrl/Command+Z · last 128 changes"
          icon={Undo2}
          disabled={disabled || empty}
          onClick={onUndo}
        />
        {full && (
          <span className="drawing-limit" title="Scene limit reached">
            64/64
          </span>
        )}
      </fieldset>
      {settings.shape === "text" && !settings.erase && !colorsOpen && (
        <fieldset className="drawing-options drawing-text-options">
          <legend className="sr-only">Text drawing options</legend>
          <div className="drawing-options-heading">
            <strong>Text</strong>
            <span>{visibility}</span>
          </div>
          <label>
            Font size
            <input
              type="number"
              disabled={disabled}
              aria-label="Text font size"
              min={8}
              max={96}
              step={1}
              value={settings.fontSize ?? 24}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (Number.isInteger(n) && n >= 8 && n <= 96)
                  onChange({ ...settings, fontSize: n });
              }}
            />
          </label>
          <small>{[...(settings.text ?? "")].length}/120 · up to 4 lines</small>
          <p>
            {editing
              ? "Type in the box. Use its handles to move/resize. Text outside the box is clipped."
              : "Click or drag on the map, then start typing. Click a saved label to edit it."}
          </p>
          {editing && (
            <div className="drawing-edit-actions">
              <button
                type="button"
                className="button"
                disabled={disabled || !validDrawingText(settings.text ?? "")}
                onClick={onSaveText}
              >
                <Check size={14} />
                Save text
              </button>
              <button type="button" className="button secondary" onClick={onCancelText}>
                Cancel
              </button>
            </div>
          )}
          {textError && <p role="alert">{textError}</p>}
        </fieldset>
      )}
      {colorsOpen && (
        <fieldset id="drawing-color-options" className="drawing-options drawing-color-options">
          <legend className="sr-only">Drawing color</legend>
          <strong>Color</strong>
          <div className="drawing-color-swatches">
            {colors.map(({ color, name }) => (
              <ToolButton
                key={color}
                disabled={disabled}
                label={`${name} drawing color`}
                pressed={settings.color === color}
                onClick={() => {
                  onChange({ ...settings, color });
                  setColorsOpen(false);
                  colorTrigger.current?.focus();
                }}
              >
                <span className="drawing-swatch" style={{ background: color }} />
              </ToolButton>
            ))}
          </div>
          <label className="drawing-custom-color">
            Custom color
            <input
              type="color"
              disabled={disabled}
              aria-label="Custom drawing color"
              value={settings.color}
              onChange={(e) => onChange({ ...settings, color: e.target.value })}
            />
          </label>
        </fieldset>
      )}
    </fieldset>
  );
}
