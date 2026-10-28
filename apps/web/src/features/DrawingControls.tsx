import type { Drawing } from "@hearth/protocol";
import { Eye, LockKeyhole, Minus, PencilLine, Square, Type, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ToolButton } from "../workspace/ToolButton";
import { validDrawingText } from "./textDrawings";

export type DrawingSettings = Pick<Drawing, "shape" | "visibility" | "color" | "text">;
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
}: {
  settings: DrawingSettings;
  onChange: (settings: DrawingSettings) => void;
  onUndo: () => void;
  onClose: () => void;
  disabled: boolean;
  empty: boolean;
  full: boolean;
}) {
  const [colorsOpen, setColorsOpen] = useState(false);
  const root = useRef<HTMLFieldSetElement>(null);
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
          if (colorsOpen) setColorsOpen(false);
          else onClose();
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
              label={`Draw ${shape}`}
              icon={icon}
              pressed={settings.shape === shape}
              onClick={() => {
                onChange({ ...settings, shape });
                setColorsOpen(false);
              }}
            />
          ))}
        </fieldset>
        <span className="tool-divider" />
        <fieldset aria-label="Drawing layer" className="drawing-tool-group">
          <ToolButton
            label="Shared drawings"
            title="Shared · visible in revealed areas"
            icon={Eye}
            pressed={settings.visibility === "shared"}
            onClick={() => onChange({ ...settings, visibility: "shared" })}
          />
          <ToolButton
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
      {settings.shape === "text" && !colorsOpen && (
        <fieldset className="drawing-options drawing-text-options">
          <legend className="sr-only">Text drawing options</legend>
          <div className="drawing-options-heading">
            <strong>Text</strong>
            <span>{visibility}</span>
          </div>
          <label>
            Drawing text
            <textarea
              aria-label="Drawing text"
              aria-describedby="drawing-text-help"
              aria-invalid={!!settings.text && !validDrawingText(settings.text)}
              value={settings.text ?? ""}
              maxLength={240}
              rows={3}
              placeholder="Add a label…"
              onChange={(e) => onChange({ ...settings, text: e.target.value })}
            />
          </label>
          <small id="drawing-text-help">
            {[...(settings.text ?? "")].length}/120 · up to 4 lines
          </small>
          <p>Drag a box on the map to place your label.</p>
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
                label={`${name} drawing color`}
                pressed={settings.color === color}
                onClick={() => {
                  onChange({ ...settings, color });
                  setColorsOpen(false);
                }}
              >
                <span className="drawing-swatch" style={{ background: color }} />
              </ToolButton>
            ))}
          </div>
        </fieldset>
      )}
    </fieldset>
  );
}
