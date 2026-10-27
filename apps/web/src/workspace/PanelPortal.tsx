import { type ReactNode, type RefObject, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
// The portal target itself stays constant. Moving its host between docks preserves
// feature component state, unlike changing the React portal destination.
export function PanelPortal({
  target,
  children,
}: {
  target: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.className = "workspace-panel-host";
    return el;
  });
  useLayoutEffect(() => {
    target.current?.appendChild(host);
    return () => host.remove();
  }, [target, host]);
  return createPortal(children, host);
}
