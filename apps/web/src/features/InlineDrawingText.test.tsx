// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import type { TextDraft } from "./drawingEditing";
import { InlineDrawingText } from "./InlineDrawingText";

afterEach(cleanup);
function Editor() {
  const [draft, setDraft] = useState<TextDraft>({
    start: { x: 20, y: 30 },
    end: { x: 260, y: 126 },
    text: "Gate",
    fontSize: 32,
    color: "#abcdef",
    visibility: "shared",
  });
  const [saved, setSaved] = useState("");
  const [open, setOpen] = useState(true);
  return (
    <>
      <output aria-label="Saved text">{saved}</output>
      <output aria-label="Kept draft">{draft.text}</output>
      {open && (
        <InlineDrawingText
          draft={draft}
          camera={{ x: 10, y: 20, scale: 1.5 }}
          width={400}
          height={300}
          disabled={false}
          onChange={setDraft}
          onSave={() => setSaved(draft.text)}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
it("types in a scene-positioned box with explicit font size and saves with Ctrl+Enter", () => {
  render(<Editor />);
  const input = screen.getByLabelText("Drawing text") as HTMLTextAreaElement;
  expect(document.activeElement).toBe(input);
  const editor = screen.getByRole("group", { name: "On-map text editor" });
  expect(editor.style.left).toBe("40px");
  expect(editor.style.top).toBe("65px");
  expect(input.style.fontSize).toBe("48px");
  fireEvent.change(input, { target: { value: "North gate" } });
  fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
  expect(screen.getByLabelText("Saved text").textContent).toBe("North gate");
});
it("resizes with keyboard in scene units and cancels without discarding typed text", () => {
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Drawing text"), { target: { value: "Draft remains" } });
  fireEvent.keyDown(screen.getByRole("button", { name: "Resize text box" }), {
    key: "ArrowRight",
    shiftKey: true,
  });
  expect(screen.getByRole("group", { name: "On-map text editor" }).style.width).toBe("375px");
  fireEvent.keyDown(screen.getByLabelText("Drawing text"), { key: "Escape" });
  expect(screen.queryByRole("group", { name: "On-map text editor" })).toBeNull();
  expect(screen.getByLabelText("Kept draft").textContent).toBe("Draft remains");
});
