// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { DrawingControls, type DrawingSettings } from "./DrawingControls";

afterEach(cleanup);
it("dismisses the temporary color picker on an outside pointer action", () => {
  render(<Example />);
  fireEvent.click(screen.getByRole("button", { name: "Drawing color" }));
  expect(screen.getByRole("button", { name: "Blue drawing color" })).toBeTruthy();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("button", { name: "Blue drawing color" })).toBeNull();
});
function Example() {
  const [settings, setSettings] = useState<DrawingSettings>({
    shape: "line",
    visibility: "shared",
    color: "#e8bc6a",
    text: "Keep this draft",
  });
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open drawings
      </button>
      {open && (
        <DrawingControls
          settings={settings}
          onChange={setSettings}
          onUndo={() => {}}
          disabled={false}
          empty={true}
          full={false}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
it("uses named icon buttons for shapes, layer choices and color swatches while keeping the text draft", () => {
  render(<Example />);
  expect(screen.queryByRole("combobox", { name: "Drawing shape" })).toBeNull();
  const rectangle = screen.getByRole("button", { name: "Draw rectangle" });
  expect(rectangle.querySelector("svg")).not.toBeNull();
  expect(rectangle.textContent).toBe("");
  fireEvent.click(rectangle);
  expect(rectangle.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "GM-only drawings" }));
  expect(
    screen.getByRole("button", { name: "GM-only drawings" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Drawing color" }));
  fireEvent.click(screen.getByRole("button", { name: "Blue drawing color" }));
  expect(screen.getByRole("button", { name: "Drawing color" }).title).toContain("Blue");
  fireEvent.click(screen.getByRole("button", { name: "Draw text" }));
  expect(
    (screen.getByLabelText("Drawing text", { exact: true }) as HTMLTextAreaElement).value,
  ).toBe("Keep this draft");
  expect((screen.getByRole("button", { name: "Undo drawing" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});
it("closes with Escape without clearing the editor draft", () => {
  render(<Example />);
  fireEvent.click(screen.getByRole("button", { name: "Draw text" }));
  const editor = screen.getByLabelText("Drawing text", { exact: true });
  fireEvent.change(editor, { target: { value: "Changed draft" } });
  fireEvent.keyDown(editor, { key: "Escape" });
  expect(screen.queryByRole("group", { name: "Drawing controls" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open drawings" }));
  expect(
    (screen.getByLabelText("Drawing text", { exact: true }) as HTMLTextAreaElement).value,
  ).toBe("Changed draft");
  expect(
    within(screen.getByRole("group", { name: "Drawing shape" })).getAllByRole("button"),
  ).toHaveLength(4);
});
