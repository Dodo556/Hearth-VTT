// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { JournalBody } from "./JournalBody";

afterEach(cleanup);
it("keeps legacy plain pages literal instead of interpreting markup", () => {
  const body = "# Header\n**Literal**\n<script>window.bad=1</script>";
  const { container } = render(createElement(JournalBody, { body }));
  expect(container.textContent).toBe(body);
  expect(container.querySelector("h3,strong,script")).toBeNull();
});
it("renders bounded headings and inline emphasis as safe React elements", () => {
  const { container } = render(
    createElement(JournalBody, {
      format: "markdown",
      body: "# Header\n## Details\n### Aside\n\n**Bold** and *italic* and `literal <code>`",
    }),
  );
  expect(screen.getByRole("heading", { name: "Header", level: 3 })).toBeVisible();
  expect(container.querySelector("h4")).toHaveTextContent("Details");
  expect(container.querySelector("h5")).toHaveTextContent("Aside");
  expect(container.querySelector("strong")).toHaveTextContent("Bold");
  expect(container.querySelector("em")).toHaveTextContent("italic");
  expect(container.querySelector("code")).toHaveTextContent("literal <code>");
});
it("renders flat lists and read-only checklists without player mutations", () => {
  const { container } = render(
    createElement(JournalBody, {
      format: "markdown",
      body: "- One\n- Two\n\n1. First\n2. Second\n\n- [x] Done\n- [ ] Later",
    }),
  );
  expect(container.querySelectorAll("ul")).toHaveLength(2);
  expect(container.querySelectorAll("ol")).toHaveLength(1);
  const boxes = screen.getAllByRole("checkbox");
  expect(boxes[0]).toBeChecked();
  expect(boxes[1]).not.toBeChecked();
  for (const box of boxes) expect(box).toBeDisabled();
});
it("never creates HTML links images embeds or event handlers from journal source", () => {
  const body =
    "<script>window.bad=1</script>\n<img src=x onerror=bad()>\n[click](javascript:bad()) ![track](https://bad.invalid/x) <iframe src=x>\n**<b>still text</b>**";
  const { container } = render(createElement(JournalBody, { format: "markdown", body }));
  expect(container.querySelector("script,img,a,iframe,b")).toBeNull();
  expect(container.textContent).toContain("<script>");
  expect(container.querySelector("strong")).toHaveTextContent("<b>still text</b>");
});
it("handles unmatched markers and maximum Unicode source without recursion", () => {
  const body = "*".repeat(500) + "🧙".repeat(500);
  const { container } = render(createElement(JournalBody, { format: "markdown", body }));
  expect(container.textContent).toBe(body);
});
