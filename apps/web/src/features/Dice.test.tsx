// @vitest-environment jsdom
import type { TokenCommand } from "@hearth/protocol";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Dice } from "./Dice";

afterEach(cleanup);
it("labels blind acceptance without inventing a visible result and preserves scope on quick rolls", async () => {
  const send = vi.fn(async (_command: TokenCommand) => {});
  const props = { rolls: [], disabled: false, send };
  const { rerender } = render(createElement(Dice, props));
  fireEvent.change(screen.getByLabelText("Roll visibility"), { target: { value: "blind" } });
  fireEvent.change(screen.getByLabelText("Dice expression"), { target: { value: "2d6+3" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Roll blind" }));
  });
  expect(send.mock.calls[0]?.[0]).toMatchObject({
    type: "dice.roll",
    payload: { expression: "2d6+3", visibility: "blind" },
  });
  expect(screen.getByRole("status").textContent).toContain("Only the DM receives the result");
  expect(screen.queryByTestId("roll-result")).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Quick roll d20" }));
  });
  expect(send.mock.calls[1]?.[0]).toMatchObject({
    payload: { expression: "1d20", visibility: "blind" },
  });
  rerender(createElement(Dice, { ...props, disabled: true }));
  expect(screen.getByRole("button", { name: "Roll blind" }).hasAttribute("disabled")).toBe(true);
});

it("keeps selected roll recipients explicit and blocks a departed participant", async () => {
  const aid = "cbff59be-bf0b-4ce0-b25c-44eea113961d",
    bid = "12345678-1234-4234-8234-123456789abc";
  const commands: TokenCommand[] = [];
  const props = {
    rolls: [],
    disabled: false,
    userId: aid,
    participants: [{ id: bid, displayName: "Bob", role: "player" as const }],
    send: async (c: TokenCommand) => {
      commands.push(c);
    },
  };
  const { rerender } = render(createElement(Dice, props));
  fireEvent.change(screen.getByLabelText("Roll visibility"), { target: { value: "selected" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Bob" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Quick roll d20" }));
  });
  expect(commands[0]).toMatchObject({
    type: "dice.roll",
    payload: { visibility: "selected", recipientIds: [bid] },
  });
  rerender(createElement(Dice, { ...props, participants: [] }));
  expect((screen.getByLabelText("Roll visibility") as HTMLSelectElement).value).toBe("selected");
  expect(
    screen.getByRole("button", { name: "Roll to selected participants" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.getByRole("button", { name: "Quick roll d20" }).hasAttribute("disabled")).toBe(
    true,
  );
});
