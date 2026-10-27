import { GripHorizontal, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
export function WorkspaceWindow({
  id,
  title,
  onClose,
  children,
  x = 76,
  y = 94,
  width = 332,
  height = 450,
}: {
  id: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const ref = useRef<HTMLElement>(null),
    drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [position, setPosition] = useState({ x, y });
  const clamp = useCallback(
    (left: number, top: number) => {
      const el = ref.current,
        parent = el?.parentElement;
      return {
        x: Math.max(
          8,
          Math.min(
            left,
            (parent?.clientWidth || window.innerWidth) - (el?.offsetWidth || width) - 8,
          ),
        ),
        y: Math.max(
          8,
          Math.min(
            top,
            (parent?.clientHeight || window.innerHeight) - (el?.offsetHeight || height) - 8,
          ),
        ),
      };
    },
    [width, height],
  );
  // Position remains local UI state and never changes the renderer or campaign data.
  useEffect(() => {
    const resize = () => setPosition((p) => clamp(p.x, p.y));
    resize();
    window.addEventListener("resize", resize);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    if (ref.current) {
      observer?.observe(ref.current);
      if (ref.current.parentElement) observer?.observe(ref.current.parentElement);
    }
    return () => {
      window.removeEventListener("resize", resize);
      observer?.disconnect();
    };
  }, [clamp]);
  return (
    <section
      ref={ref}
      aria-label={title}
      data-window-id={id}
      className="workspace-window"
      style={{ left: position.x, top: position.y, width, height }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header>
        <button
          type="button"
          className="window-drag-handle"
          aria-label={`Move ${title}`}
          title="Drag to move · Arrow keys move this window"
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 5;
            const d: Record<string, [number, number]> = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            };
            if (d[e.key]) {
              e.preventDefault();
              const [dx, dy] = d[e.key] as [number, number];
              setPosition((p) => clamp(p.x + dx, p.y + dy));
            }
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            drag.current = { x: e.clientX, y: e.clientY, left: position.x, top: position.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const p = drag.current;
            if (p) setPosition(clamp(p.left + e.clientX - p.x, p.top + e.clientY - p.y));
          }}
          onPointerUp={(e) => {
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <GripHorizontal size={14} />
          <strong>{title}</strong>
        </button>
        <button
          type="button"
          className="window-close"
          aria-label={`Close ${title}`}
          title="Close"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </header>
      <div className="workspace-window-body">{children}</div>
    </section>
  );
}
