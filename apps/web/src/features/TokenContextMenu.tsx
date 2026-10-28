import type { Token } from "@hearth/protocol";
import { Eye, EyeOff, Paintbrush, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
export type TokenAction = "inspect" | "sheet" | "appearance" | "visibility" | "delete";
export function TokenContextMenu({
  token,
  dm,
  disabled,
  x,
  y,
  onAction,
  onClose,
}: {
  token: Token;
  dm: boolean;
  disabled: boolean;
  x: number;
  y: number;
  onAction: (action: TokenAction) => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y, maxHeight: window.innerHeight - 16 });
  const items = [
    { id: "inspect" as const, label: "Token controls", Icon: SlidersHorizontal, disabled: false },
    ...(token.actorId
      ? [{ id: "sheet" as const, label: "Open character sheet", Icon: UserRound, disabled: false }]
      : []),
    ...(dm
      ? [
          { id: "appearance" as const, label: "Edit appearance", Icon: Paintbrush, disabled },
          {
            id: "visibility" as const,
            label: token.visibility === "shared" ? "Make GM-only" : "Show to players",
            Icon: token.visibility === "shared" ? EyeOff : Eye,
            disabled,
          },
          { id: "delete" as const, label: "Delete token…", Icon: Trash2, disabled },
        ]
      : []),
  ];
  const count = items.length;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stage = document.querySelector(".workspace-stage")?.getBoundingClientRect();
    const sidebar = document.querySelector(".vtt-sidebar")?.getBoundingClientRect();
    const left = stage?.left ?? 0;
    const right = Math.min(stage?.right ?? window.innerWidth, sidebar?.left ?? window.innerWidth);
    const top = Math.max(0, stage?.top ?? 0) + 8;
    const bottom = Math.min(window.innerHeight, stage?.bottom ?? window.innerHeight) - 8;
    const maxHeight = Math.max(36, bottom - top);
    const width = el.offsetWidth || 208,
      height = Math.min(el.offsetHeight || count * 36 + 34, maxHeight);
    setPosition({
      x: Math.max(left + 8, Math.min(x, right - width - 8)),
      y: Math.max(top, Math.min(y, bottom - height)),
      maxHeight,
    });
    el.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [x, y, count]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) onClose(false);
    };
    const resize = () => onClose(false);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="token-context-menu"
      role="menu"
      aria-label={`Actions for ${token.name}`}
      style={{
        left: position.x,
        top: position.y,
        maxHeight: position.maxHeight,
        overflowY: "auto",
      }}
      onKeyDown={(e) => {
        const buttons = [
          ...(ref.current?.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)',
          ) ?? []),
        ];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          onClose(true);
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        }
      }}
    >
      <div className="token-context-name">{token.name}</div>
      {items.map((item) => (
        <button
          type="button"
          role="menuitem"
          key={item.id}
          disabled={item.disabled}
          className={item.id === "delete" ? "danger" : ""}
          onClick={() => {
            onClose(false);
            onAction(item.id);
          }}
        >
          <item.Icon size={16} aria-hidden="true" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
