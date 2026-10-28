import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

/** Shared canvas tool: native button semantics, named icon, tooltip and selected state. */
export function ToolButton({
  label,
  icon: Icon,
  children,
  pressed,
  className = "",
  title,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  ref?: Ref<HTMLButtonElement>;
  label: string;
  icon?: LucideIcon;
  children?: ReactNode;
  pressed?: boolean;
}) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed ?? props["aria-pressed"]}
      className={`workspace-tool-button ${pressed ? "active" : ""} ${className}`}
    >
      <span aria-hidden="true">{Icon ? <Icon size={18} strokeWidth={1.75} /> : children}</span>
    </button>
  );
}
