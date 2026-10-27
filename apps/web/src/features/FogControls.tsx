import type { Scene, TokenCommand } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { useState } from "react";
import type { FogTool } from "./fog";
export function FogControls({
  scene,
  disabled,
  tool,
  onTool,
  send,
}: {
  scene: Pick<Scene, "id" | "fog">;
  disabled: boolean;
  tool: FogTool;
  onTool: (tool: FogTool) => void;
  send: (c: TokenCommand) => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState<"disable" | "reveal" | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [rectangle, setRectangle] = useState({ column: 0, row: 0, width: 1, height: 1 });
  const fog = scene.fog;
  const submit = (command: TokenCommand) => {
    setError(null);
    void send(command)
      .then(() => setConfirmation(null))
      .catch((e: Error) => setError(e));
  };
  return (
    <section className="fog-controls" aria-label="Manual fog">
      <h3>Manual fog</h3>
      <p className="muted">
        Shared exploration for the party. Reveal a token’s whole footprint to show it. Actor sheets
        keep their own sharing permissions.
      </p>
      <Button
        disabled={disabled}
        aria-pressed={fog.enabled}
        onClick={() =>
          fog.enabled
            ? setConfirmation("disable")
            : submit({ type: "fog.configure", payload: { sceneId: scene.id, enabled: true } })
        }
      >
        {fog.enabled ? "Disable fog" : "Enable fog"}
      </Button>
      <div className="token-author-actions">
        <Button
          disabled={disabled}
          onClick={() =>
            submit({ type: "fog.reset", payload: { sceneId: scene.id, mode: "hide" } })
          }
        >
          Cover all
        </Button>
        <Button disabled={disabled} onClick={() => setConfirmation("reveal")}>
          Reveal all
        </Button>
      </div>
      <fieldset disabled={disabled || !fog.enabled}>
        <legend>Map tool</legend>
        <div className="fog-tools">
          {(["select", "reveal", "hide"] as const).map((mode) => (
            <Button key={mode} aria-pressed={tool === mode} onClick={() => onTool(mode)}>
              {mode === "select" ? "Pan / select" : mode === "reveal" ? "Reveal area" : "Hide area"}
            </Button>
          ))}
        </div>
        <p className="muted">
          Drag a rectangle on the map. Middle-drag pans. Grid coordinates start at 0.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const mode =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "hide"
                ? "hide"
                : "reveal";
            submit({ type: "fog.paint", payload: { sceneId: scene.id, ...rectangle, mode } });
          }}
        >
          <div className="fog-fields">
            {(["column", "row", "width", "height"] as const).map((key) => (
              <label key={key}>
                {key === "column"
                  ? "Column"
                  : key === "row"
                    ? "Row"
                    : key === "width"
                      ? "Width"
                      : "Height"}
                <input
                  aria-label={`Rectangle ${key}`}
                  type="number"
                  required
                  min={key === "column" || key === "row" ? 0 : 1}
                  max={
                    key === "column"
                      ? fog.columns - 1
                      : key === "row"
                        ? fog.rows - 1
                        : key === "width"
                          ? fog.columns - rectangle.column
                          : fog.rows - rectangle.row
                  }
                  step={1}
                  value={rectangle[key]}
                  onChange={(e) => setRectangle({ ...rectangle, [key]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <div className="token-author-actions">
            <Button type="submit" value="reveal">
              Reveal rectangle
            </Button>
            <Button type="submit" value="hide">
              Hide rectangle
            </Button>
          </div>
        </form>
      </fieldset>
      <p className="muted">
        {fog.columns} × {fog.rows} cells · Manual only; walls and automatic vision are pending.
      </p>
      <ErrorMessage error={error} />
      {confirmation && (
        <Dialog title="Reveal covered areas?" onClose={() => setConfirmation(null)}>
          <p>
            This exposes every shared token in this scene to players when the scene is active.
            Background images can already be downloaded in full.
          </p>
          <div className="dialog-actions">
            <Button onClick={() => setConfirmation(null)}>Cancel</Button>
            <Button
              className="primary"
              disabled={disabled}
              onClick={() =>
                submit(
                  confirmation === "disable"
                    ? { type: "fog.configure", payload: { sceneId: scene.id, enabled: false } }
                    : { type: "fog.reset", payload: { sceneId: scene.id, mode: "reveal" } },
                )
              }
            >
              Confirm reveal
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
