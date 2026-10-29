// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { JournalImage } from "./JournalImage";

afterEach(cleanup);
it("shows image failures and retries the same authorized local asset", () => {
  render(
    createElement(JournalImage, { campaignId: "campaign", assetId: "image", title: "Gate clue" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("alert")).toHaveTextContent("Image unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry image" }));
  const image = screen.getByRole("img", { name: "Gate clue" });
  expect(image).toHaveAttribute("src", "/api/campaigns/campaign/assets/image?attempt=1");
  fireEvent.load(image);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("link", { name: "Open full image" })).toHaveAttribute(
    "href",
    "/api/campaigns/campaign/assets/image",
  );
});
