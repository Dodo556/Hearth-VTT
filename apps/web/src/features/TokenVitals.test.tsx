// @vitest-environment jsdom
import type { Token, TokenCommand } from "@hearth/protocol";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TokenVitals } from "./TokenVitals";

afterEach(cleanup);
const token: Token = {
  actorId: null,
  id: "12345678-1234-4234-8234-123456789abc",
  name: "Warden",
  x: 50,
  y: 50,
  size: 40,
  color: "#aabbcc",
  assetId: "art",
  visibility: "shared",
  controllerUserId: null,
  canMove: true,
  statuses: [],
  health: { hp: 8, maxHp: 12 },
  vitals: { version: 3, hp: 8, maxHp: 12, hpVisibility: "controllers" },
};
it("saves explicit HP and manual markers without allowing a player to widen sharing", async () => {
  const commands: TokenCommand[] = [];
  render(
    <TokenVitals
      token={token}
      dm={false}
      disabled={false}
      send={async (c) => {
        commands.push(c);
      }}
    />,
  );
  expect(screen.queryByLabelText("Map HP visibility")).toBeNull();
  fireEvent.change(screen.getByLabelText("Current HP"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "Marked" }));
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Save health & status" })),
  );
  expect(commands).toEqual([
    {
      type: "token.vitals.update",
      payload: {
        tokenId: token.id,
        expectedVersion: 3,
        expectedActorId: null,
        expectedActorVersion: null,
        hp: 5,
        maxHp: 12,
        hpVisibility: "controllers",
        statuses: ["marked"],
      },
    },
  ]);
});
it("keeps failed and changed-source drafts until explicit reload", async () => {
  const props = {
    token: {
      ...token,
      actorId: "22345678-1234-4234-8234-123456789abc",
      vitals: {
        version: 3,
        hp: 8,
        maxHp: 12,
        hpVisibility: "controllers" as const,
        actorVersion: 2,
      },
    },
    dm: true,
    disabled: false,
    send: async (_c: TokenCommand) => {
      throw new Error("Save failed");
    },
  };
  const view = render(<TokenVitals {...props} />);
  fireEvent.change(screen.getByLabelText("Current HP"), { target: { value: "5" } });
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Save health & status" })),
  );
  expect(screen.getByText("Save failed")).toBeTruthy();
  view.rerender(
    <TokenVitals
      {...props}
      token={{ ...props.token, vitals: { ...props.token.vitals, actorVersion: 3, hp: 6 } }}
    />,
  );
  expect((screen.getByLabelText("Current HP") as HTMLInputElement).value).toBe("5");
  expect(
    (screen.getByRole("button", { name: "Save health & status" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload health & status" }));
  expect((screen.getByLabelText("Current HP") as HTMLInputElement).value).toBe("6");
});
it("removes private editors immediately when control is lost", () => {
  const props = { token, dm: false, disabled: false, send: async (_c: TokenCommand) => {} };
  const view = render(<TokenVitals {...props} />);
  fireEvent.change(screen.getByLabelText("Current HP"), { target: { value: "5" } });
  view.rerender(
    <TokenVitals
      {...props}
      token={{
        ...token,
        canMove: false,
        vitals: undefined,
        health: undefined,
        statuses: ["prone"],
      }}
    />,
  );
  expect(screen.queryByRole("spinbutton")).toBeNull();
  expect(screen.queryByDisplayValue("5")).toBeNull();
  expect(screen.getByText("Prone")).toBeTruthy();
});
