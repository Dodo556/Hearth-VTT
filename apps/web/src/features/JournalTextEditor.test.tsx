// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, expect, it } from "vitest";
import { JournalTextEditor } from "./JournalTextEditor";

afterEach(cleanup);
function Harness() {
  const [body, setBody] = useState("Hello world"),
    [format, setFormat] = useState<"plain" | "markdown">("markdown");
  return (
    <JournalTextEditor
      body={body}
      format={format}
      disabled={false}
      onChange={(b, f) => {
        setBody(b);
        setFormat(f);
      }}
    />
  );
}
it("inserts formatting around selection, returns typing focus, and previews safely", () => {
  render(createElement(Harness));
  const area = screen.getByLabelText("Page text") as HTMLTextAreaElement;
  area.setSelectionRange(0, 5);
  fireEvent.click(screen.getByRole("button", { name: "Bold" }));
  expect(area).toHaveValue("**Hello** world");
  expect(area).toHaveFocus();
  expect(area.selectionStart).toBe(2);
  expect(area.selectionEnd).toBe(7);
  fireEvent.click(screen.getByRole("button", { name: "Preview formatting" }));
  expect(
    screen.getByRole("region", { name: "Journal preview" }).querySelector("strong"),
  ).toHaveTextContent("Hello");
  fireEvent.change(screen.getByLabelText("Text format"), { target: { value: "plain" } });
  expect(
    screen.getByRole("region", { name: "Journal preview" }).querySelector("strong"),
  ).toBeNull();
  expect(screen.getByRole("region", { name: "Journal preview" })).toHaveTextContent(
    "**Hello** world",
  );
});
it("accepts 1000 Unicode scalars and refuses excess formatting without altering text", () => {
  render(createElement(Harness));
  const area = screen.getByLabelText("Page text") as HTMLTextAreaElement;
  const source = "🧙".repeat(1000);
  fireEvent.change(area, { target: { value: source } });
  expect(area).toHaveValue(source);
  area.setSelectionRange(0, 2000);
  fireEvent.click(screen.getByRole("button", { name: "Bold" }));
  expect(area).toHaveValue(source);
  expect(screen.getByRole("status")).toHaveTextContent("exceed 1000");
});
