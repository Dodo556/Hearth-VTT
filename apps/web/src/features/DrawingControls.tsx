import type { Drawing } from "@hearth/protocol";
import { validDrawingText } from "./textDrawings";

export type DrawingSettings = Pick<Drawing, "shape" | "visibility" | "color" | "text">;
export function DrawingControls({
  settings,
  onChange,
  onUndo,
  disabled,
  empty,
  full,
}: {
  settings: DrawingSettings;
  onChange: (settings: DrawingSettings) => void;
  onUndo: () => void;
  disabled: boolean;
  empty: boolean;
  full: boolean;
}) {
  return (
    <fieldset className="drawing-controls">
      <legend className="sr-only">Drawing controls</legend>
      <label>
        Shape
        <select
          aria-label="Drawing shape"
          value={settings.shape}
          onChange={(e) =>
            onChange({ ...settings, shape: e.target.value as DrawingSettings["shape"] })
          }
        >
          <option value="line">Line</option>
          <option value="rectangle">Rectangle</option>
          <option value="freehand">Freehand</option>
          <option value="text">Text</option>
        </select>
      </label>
      <label>
        Layer
        <select
          aria-label="Drawing layer"
          value={settings.visibility}
          onChange={(e) =>
            onChange({ ...settings, visibility: e.target.value as DrawingSettings["visibility"] })
          }
        >
          <option value="shared">Shared</option>
          <option value="dm">GM only</option>
        </select>
      </label>
      <label>
        Color
        <select
          aria-label="Drawing color"
          value={settings.color}
          onChange={(e) => onChange({ ...settings, color: e.target.value })}
        >
          <option value="#e8bc6a">Gold</option>
          <option value="#e65b5b">Red</option>
          <option value="#72b7e2">Blue</option>
          <option value="#9ad59b">Green</option>
        </select>
      </label>
      <button type="button" disabled={disabled || empty} onClick={onUndo}>
        Undo drawing
      </button>
      {full && <span>Scene limit reached</span>}
      {settings.shape === "text" && (
        <label className="drawing-text-control">
          Drawing text
          <textarea
            aria-label="Drawing text"
            aria-describedby="drawing-text-help"
            aria-invalid={!!settings.text && !validDrawingText(settings.text)}
            value={settings.text ?? ""}
            maxLength={240}
            rows={2}
            onChange={(e) => onChange({ ...settings, text: e.target.value })}
          />
          <span id="drawing-text-help">
            {[...(settings.text ?? "")].length}/120 characters · up to 4 lines · fitted to your box
          </span>
        </label>
      )}
    </fieldset>
  );
}
