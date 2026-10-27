// @vitest-environment jsdom
import type { Encounter, TokenCommand } from "@hearth/protocol";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { Combat } from "./Combat";

const id = "cbff59be-bf0b-4ce0-b25c-44eea113961d";
const encounter: Encounter = {
  id,
  sceneId: id,
  name: "Vault encounter",
  version: 1,
  status: "active",
  round: 1,
  activeCombatantId: null,
  combatants: [
    {
      id,
      version: 1,
      tokenId: id,
      name: "Rowan",
      assetId: "token-warden",
      initiative: 12,
      canEditInitiative: true,
      actorId: id,
      canEditHp: true,
      hp: 10,
      maxHp: 20,
      actorVersion: 5,
    },
  ],
};
afterEach(cleanup);
it("preserves a stale HP draft until explicit reload and emits only the guarded HP change", async () => {
  const commands: TokenCommand[] = [];
  const props = {
    encounter,
    scene: undefined,
    dm: true,
    disabled: false,
    send: async (c: TokenCommand) => {
      commands.push(c);
    },
    onFocusToken: () => {},
  };
  const { rerender } = render(createElement(Combat, props));
  fireEvent.change(screen.getByLabelText("HP for Rowan"), { target: { value: "9" } });
  rerender(
    createElement(Combat, {
      ...props,
      encounter: {
        ...encounter,
        combatants: [{ ...encounter.combatants[0], hp: 8, actorVersion: 6 }],
      } as Encounter,
    }),
  );
  expect((screen.getByLabelText("HP for Rowan") as HTMLInputElement).value).toBe("9");
  expect(screen.getByRole("button", { name: "Save HP for Rowan" }).hasAttribute("disabled")).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Reload HP for Rowan" }));
  fireEvent.change(screen.getByLabelText("HP for Rowan"), { target: { value: "7" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save HP for Rowan" }));
  });
  expect(commands[0]).toEqual({
    type: "combat.hp",
    payload: { combatantId: id, expectedActorVersion: 6, expectedActorId: id, hp: 7 },
  });
});
it("shows no hidden turn placeholder or unauthorized HP/management controls", () => {
  const filtered = {
    ...encounter,
    combatants: [
      {
        ...encounter.combatants[0],
        actorId: null,
        hp: undefined,
        maxHp: undefined,
        actorVersion: undefined,
        canEditHp: false,
        canEditInitiative: false,
      },
    ],
  } as Encounter;
  render(
    createElement(Combat, {
      encounter: filtered,
      scene: undefined,
      dm: false,
      disabled: false,
      send: async () => {},
      onFocusToken: () => {},
    }),
  );
  expect(screen.getByText("Awaiting GM")).toBeTruthy();
  expect(screen.queryByLabelText("HP for Rowan")).toBeNull();
  expect(screen.queryByRole("button", { name: "Next turn" })).toBeNull();
  expect(screen.queryByText(/hidden combatant/i)).toBeNull();
});

it("binds an unsaved HP draft to its linked actor even when versions match", () => {
  const props = {
    encounter,
    scene: undefined,
    dm: true,
    disabled: false,
    send: async () => {},
    onFocusToken: () => {},
  };
  const { rerender } = render(createElement(Combat, props));
  fireEvent.change(screen.getByLabelText("HP for Rowan"), { target: { value: "9" } });
  const replacement = "f6371e14-962e-4639-8be0-638258d8cd97";
  rerender(
    createElement(Combat, {
      ...props,
      encounter: {
        ...encounter,
        combatants: [{ ...encounter.combatants[0], actorId: replacement, hp: 17 }],
      } as Encounter,
    }),
  );
  expect((screen.getByLabelText("HP for Rowan") as HTMLInputElement).value).toBe("9");
  expect(screen.getByRole("button", { name: "Save HP for Rowan" }).hasAttribute("disabled")).toBe(
    true,
  );
  expect(screen.getByRole("button", { name: "Reload HP for Rowan" })).toBeTruthy();
});
it("adopts authoritative HP and initiative versions when the snapshot arrives before save acknowledgement", async () => {
  let finish: () => void = () => {};
  const props = {
    encounter,
    scene: undefined,
    dm: true,
    disabled: false,
    send: () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    onFocusToken: () => {},
  };
  const { rerender } = render(createElement(Combat, props));
  fireEvent.change(screen.getByLabelText("HP for Rowan"), { target: { value: "9" } });
  fireEvent.click(screen.getByRole("button", { name: "Save HP for Rowan" }));
  const saved = {
    ...encounter,
    combatants: [{ ...encounter.combatants[0], hp: 9, actorVersion: 6 }],
  } as Encounter;
  rerender(createElement(Combat, { ...props, encounter: saved }));
  await act(async () => finish());
  fireEvent.change(screen.getByLabelText("HP for Rowan"), { target: { value: "8" } });
  expect(screen.getByRole("button", { name: "Save HP for Rowan" }).hasAttribute("disabled")).toBe(
    false,
  );
  fireEvent.change(screen.getByLabelText("Initiative for Rowan"), { target: { value: "15" } });
  fireEvent.click(screen.getByRole("button", { name: "Set initiative for Rowan" }));
  rerender(
    createElement(Combat, {
      ...props,
      encounter: {
        ...saved,
        combatants: [{ ...saved.combatants[0], initiative: 15, version: 2 }],
      } as Encounter,
    }),
  );
  await act(async () => finish());
  fireEvent.change(screen.getByLabelText("Initiative for Rowan"), { target: { value: "16" } });
  expect(
    screen.getByRole("button", { name: "Set initiative for Rowan" }).hasAttribute("disabled"),
  ).toBe(false);
});
