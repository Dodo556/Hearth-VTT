// @vitest-environment jsdom
import type { Scene, TokenCommand } from "@hearth/protocol";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SceneNotes } from "./SceneNotes";

afterEach(cleanup);
const scene: Scene = {
  id: "12345678-1234-4234-8234-123456789abc",
  campaignId: "c",
  name: "North gate",
  width: 1440,
  height: 960,
  gridSize: 60,
  backgroundAssetId: "a",
  visibility: "shared",
  active: true,
  tokens: [],
  fog: { enabled: false, columns: 24, rows: 16, revealed: "ff".repeat(48) },
  notes: { dm: { body: "Secret", version: 2 }, shared: { body: "Read me", version: 1 } },
};
it("keeps drafts through close and scope switches and explicitly shares only the chosen note", async () => {
  const commands: TokenCommand[] = [];
  const props = {
    scene,
    dm: true,
    open: true,
    disabled: false,
    onClose: () => {},
    send: async (c: TokenCommand) => {
      commands.push(c);
    },
  };
  const view = render(<SceneNotes {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit GM notes" }));
  fireEvent.change(screen.getByLabelText("GM note text"), { target: { value: "Private draft" } });
  fireEvent.click(screen.getByRole("tab", { name: "Player briefing" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit player briefing" }));
  fireEvent.change(screen.getByLabelText("Player briefing text"), {
    target: { value: "Public draft" },
  });
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Update player briefing" })),
  );
  expect(commands).toEqual([
    {
      type: "scene.notes.update",
      payload: {
        sceneId: scene.id,
        visibility: "shared",
        body: "Public draft",
        expectedVersion: 1,
      },
    },
  ]);
  fireEvent.click(screen.getByRole("tab", { name: "GM notes" }));
  expect((screen.getByLabelText("GM note text") as HTMLTextAreaElement).value).toBe(
    "Private draft",
  );
  view.rerender(<SceneNotes {...props} open={false} />);
  view.rerender(<SceneNotes {...props} />);
  expect((screen.getByLabelText("GM note text") as HTMLTextAreaElement).value).toBe(
    "Private draft",
  );
});
it("keeps failed and stale drafts, requires explicit reload and counts Unicode scalars", async () => {
  const props = {
    scene,
    dm: true,
    open: true,
    disabled: false,
    onClose: () => {},
    send: async (_c: TokenCommand) => {
      throw new Error("Offline save failed");
    },
  };
  const view = render(<SceneNotes {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit GM notes" }));
  fireEvent.change(screen.getByLabelText("GM note text"), { target: { value: "🐉".repeat(1000) } });
  expect(screen.getByText("1000/1000 characters")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save GM notes" })));
  expect(screen.getByText("Offline save failed")).toBeTruthy();
  view.rerender(
    <SceneNotes
      {...props}
      scene={{ ...scene, notes: { ...scene.notes, dm: { body: "Saved elsewhere", version: 3 } } }}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "Save GM notes" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect((screen.getByLabelText("GM note text") as HTMLTextAreaElement).value).toBe(
    "🐉".repeat(1000),
  );
  fireEvent.click(screen.getByRole("button", { name: "Reload saved note" }));
  expect((screen.getByLabelText("GM note text") as HTMLTextAreaElement).value).toBe(
    "Saved elsewhere",
  );
});
it("shows players only the literal shared briefing and a useful empty state", () => {
  const props = {
    scene,
    dm: false,
    open: true,
    disabled: false,
    onClose: () => {},
    send: async (_c: TokenCommand) => {},
  };
  const view = render(<SceneNotes {...props} />);
  expect(screen.queryByText("Secret")).toBeNull();
  expect(screen.getByText("Read me")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  view.rerender(<SceneNotes {...props} scene={{ ...scene, notes: undefined }} />);
  expect(screen.getByText("The GM hasn’t shared a briefing for this scene yet.")).toBeTruthy();
});

it("completes a pending save without discarding a different scene draft", async () => {
  let complete: (() => void) | undefined;
  const other: Scene = { ...scene, id: "22345678-1234-4234-8234-123456789abc", name: "South gate" };
  const send = (_command: TokenCommand) =>
    new Promise<void>((resolve) => {
      complete = resolve;
    });
  function windows(active: string, disabled = false) {
    return (
      <>
        {[scene, other].map((item) => (
          <SceneNotes
            key={item.id}
            scene={item}
            dm
            open={item.id === active}
            disabled={disabled}
            onClose={() => {}}
            send={send}
          />
        ))}
      </>
    );
  }
  const view = render(windows(other.id));
  fireEvent.click(screen.getByRole("button", { name: "Edit GM notes" }));
  fireEvent.change(screen.getByLabelText("GM note text"), { target: { value: "South draft" } });
  view.rerender(windows(scene.id));
  fireEvent.click(screen.getByRole("button", { name: "Edit GM notes" }));
  fireEvent.change(screen.getByLabelText("GM note text"), { target: { value: "North save" } });
  fireEvent.click(screen.getByRole("button", { name: "Save GM notes" }));
  view.rerender(windows(other.id, true));
  fireEvent.change(screen.getByLabelText("GM note text"), {
    target: { value: "South draft kept" },
  });
  await act(async () => complete?.());
  view.rerender(windows(other.id));
  expect((screen.getByLabelText("GM note text") as HTMLTextAreaElement).value).toBe(
    "South draft kept",
  );
});
