import { Grip, Maximize2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { changeTextBox, type TextDraft } from "./drawingEditing";

export function InlineDrawingText({
  draft,
  camera,
  width,
  height,
  onChange,
  onSave,
  onCancel,
  disabled,
}: {
  draft: TextDraft;
  camera: { x: number; y: number; scale: number };
  width: number;
  height: number;
  onChange: (draft: TextDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    box: TextDraft;
    resize: boolean;
    pointer: number;
  } | null>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const handle = (resize: boolean) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      drag.current = { x: e.clientX, y: e.clientY, box: draft, resize, pointer: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const started = drag.current;
      if (!started || started.pointer !== e.pointerId || disabled) return;
      onChange({
        ...draft,
        ...changeTextBox(
          started.box,
          (e.clientX - started.x) / camera.scale,
          (e.clientY - started.y) / camera.scale,
          width,
          height,
          resize,
        ),
      });
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    },
    onPointerCancel: () => {
      drag.current = null;
    },
    onLostPointerCapture: () => {
      drag.current = null;
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const step = e.shiftKey ? 10 : 1;
      const directions: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const move = directions[e.key];
      if (move && !disabled) {
        e.preventDefault();
        onChange({ ...draft, ...changeTextBox(draft, move[0], move[1], width, height, resize) });
      }
    },
  });
  return (
    <fieldset
      className="inline-drawing-text"
      aria-label="On-map text editor"
      style={{
        left: camera.x + draft.start.x * camera.scale,
        top: camera.y + draft.start.y * camera.scale,
        width: (draft.end.x - draft.start.x) * camera.scale,
        height: (draft.end.y - draft.start.y) * camera.scale,
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
          e.preventDefault();
          if (!disabled) onSave();
        }
      }}
    >
      <textarea
        readOnly={disabled}
        ref={input}
        aria-label="Drawing text"
        aria-describedby="inline-text-help"
        value={draft.text}
        maxLength={240}
        spellCheck={false}
        placeholder="Type here…"
        onChange={(e) => onChange({ ...draft, text: e.target.value })}
        style={{
          color: draft.color,
          fontSize: draft.fontSize * camera.scale,
          lineHeight: 1.25,
          padding: 4 * camera.scale,
        }}
      />
      <button
        type="button"
        className="inline-text-move"
        aria-label="Move text box"
        title="Move text box · drag or arrow keys"
        disabled={disabled}
        {...handle(false)}
      >
        <Grip size={14} />
      </button>
      <button
        type="button"
        className="inline-text-resize"
        aria-label="Resize text box"
        title="Resize text box · drag or arrow keys"
        disabled={disabled}
        {...handle(true)}
      >
        <Maximize2 size={14} />
      </button>
      <span id="inline-text-help" className="sr-only">
        Type on the map. Control or Command+Enter saves. Escape cancels. Move and resize handles
        support arrow keys, Shift for larger steps.
      </span>
    </fieldset>
  );
}
