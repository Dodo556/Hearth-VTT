// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { Actor, TokenCommand } from "@hearth/protocol";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { Actors } from "./Actors";

beforeEach(() => {
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
});
afterEach(cleanup);
const actor: Actor = {
  id: "12345678-1234-4234-8234-123456789abc",
  name: "Guard",
  version: 1,
  kind: "npc",
  assetId: "token-warden",
  biography: "Biography",
  dmNotes: "Private notes",
  hp: 6,
  maxHp: 20,
  attributes: { Armor: "12" },
  visibility: "shared",
  canEdit: true,
  permissions: [],
};
const props = {
  campaignId: actor.id,
  actors: [actor],
  dm: true,
  disabled: false,
  members: [],
  send: async (_: TokenCommand) => {},
  selectedId: actor.id,
  onSelect: (_: string) => {},
};
it("retains a failed actor copy name and requires explicit source reload", async () => {
  const sent: TokenCommand[] = [];
  const values = {
    ...props,
    send: async (c: TokenCommand) => {
      sent.push(c);
      throw new Error("Copy failed");
    },
  };
  const { rerender } = render(createElement(Actors, values));
  fireEvent.click(screen.getByRole("button", { name: "Use as template" }));
  fireEvent.change(screen.getByLabelText("Copy name"), { target: { value: "Private guard" } });
  rerender(createElement(Actors, { ...values, actors: [{ ...actor, version: 2 }] }));
  expect(screen.getByRole("button", { name: "Create private copy" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reload template" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create private copy" }));
  });
  expect(sent[0]).toEqual({
    type: "actor.copy",
    payload: {
      sourceActorId: actor.id,
      expectedVersion: 2,
      actorId: expect.any(String),
      name: "Private guard",
    },
  });
  expect(screen.getByLabelText("Copy name")).toHaveValue("Private guard");
  expect(screen.getByRole("alert")).toHaveTextContent("Copy failed");
});
it("recovers a saved actor copy without sending a second create", async () => {
  const sent: TokenCommand[] = [];
  const selected: string[] = [];
  const values = {
    ...props,
    onSelect: (id: string) => selected.push(id),
    send: async (c: TokenCommand) => {
      sent.push(c);
      throw new Error("Confirmation timed out");
    },
  };
  const { rerender } = render(createElement(Actors, values));
  fireEvent.click(screen.getByRole("button", { name: "Use as template" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create private copy" }));
  });
  const command = sent[0];
  if (command?.type !== "actor.copy") throw new Error("Expected copy");
  const copy = { ...actor, id: command.payload.actorId };
  rerender(createElement(Actors, { ...values, actors: [copy], disabled: true }));
  expect(screen.getByRole("button", { name: "Create private copy" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Open saved copy" }));
  expect(sent).toHaveLength(1);
  expect(selected).toEqual([copy.id]);
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("offers copies only to GMs with available capacity and an online host", () => {
  const { rerender } = render(createElement(Actors, { ...props, dm: false }));
  expect(screen.queryByRole("button", { name: "Use as template" })).toBeNull();
  rerender(createElement(Actors, { ...props, disabled: true }));
  expect(screen.getByRole("button", { name: "Use as template" })).toBeDisabled();
  rerender(
    createElement(Actors, {
      ...props,
      actors: Array.from({ length: 16 }, (_, i) => ({ ...actor, id: `${i}` })),
    }),
  );
  expect(screen.getByRole("button", { name: "Use as template" })).toBeDisabled();
});
