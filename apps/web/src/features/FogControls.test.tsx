// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { FogControls } from "./FogControls";

afterEach(cleanup);
it("requires review before revealing all and submits bounded keyboard rectangles", () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.open = false;
    },
  });
  const send = vi.fn(async () => {});
  render(
    createElement(FogControls, {
      scene: { id: "s", fog: { enabled: true, columns: 4, rows: 4, revealed: "0000" } },
      disabled: false,
      tool: "select",
      onTool: vi.fn(),
      send,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Reveal all" }));
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm reveal" }));
  expect(send).toHaveBeenCalledWith({
    type: "fog.reset",
    payload: { sceneId: "s", mode: "reveal" },
  });
  fireEvent.change(screen.getByLabelText("Rectangle width"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Reveal rectangle" }));
  expect(send).toHaveBeenLastCalledWith({
    type: "fog.paint",
    payload: { sceneId: "s", column: 0, row: 0, width: 2, height: 1, mode: "reveal" },
  });
});
