// @vitest-environment jsdom
import type { Participant, TokenCommand } from "@hearth/protocol";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { Chat } from "./Chat";

const aid = "cbff59be-bf0b-4ce0-b25c-44eea113961d",
  bid = "12345678-1234-4234-8234-123456789abc";
const participants: Participant[] = [
  { id: aid, displayName: "Alice", role: "player" },
  { id: bid, displayName: "Bob", role: "player" },
];
afterEach(cleanup);
it("blocks a whisper when its recipient leaves and preserves private draft/scope", () => {
  const props = {
    userId: aid,
    participants,
    messages: [],
    rolls: [],
    disabled: false,
    send: async (_: TokenCommand) => {},
  };
  const { rerender } = render(createElement(Chat, props));
  fireEvent.change(screen.getByLabelText("Message visibility"), { target: { value: "whisper" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Bob" }));
  fireEvent.change(screen.getByLabelText("Message text"), { target: { value: "Secret for Bob" } });
  expect(screen.getByRole("button", { name: "Send whisper" }).hasAttribute("disabled")).toBe(false);
  rerender(createElement(Chat, { ...props, participants: [participants[0] as Participant] }));
  expect((screen.getByLabelText("Message visibility") as HTMLSelectElement).value).toBe("whisper");
  expect((screen.getByLabelText("Message text") as HTMLTextAreaElement).value).toBe(
    "Secret for Bob",
  );
  expect(screen.getByRole("button", { name: "Send whisper" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText(/no longer available/).textContent).toContain("no longer available");
});
it("keeps failed drafts and renders markup as literal text", async () => {
  const send = async (_: TokenCommand) => {
    throw new Error("Host unavailable");
  };
  const message = {
    id: aid,
    senderId: aid,
    senderName: "Alice",
    body: "<script>secret()</script>",
    visibility: "public" as const,
    recipientIds: [],
    createdAt: 1,
    revision: 1,
  };
  const { container } = render(
    createElement(Chat, {
      userId: aid,
      participants,
      messages: [message],
      rolls: [],
      disabled: false,
      send,
    }),
  );
  expect(container.querySelector("script")).toBeNull();
  fireEvent.change(screen.getByLabelText("Message text"), { target: { value: "Keep my draft" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send to everyone" }));
  });
  expect((screen.getByLabelText("Message text") as HTMLTextAreaElement).value).toBe(
    "Keep my draft",
  );
  expect(screen.getByRole("alert").textContent).toContain("Host unavailable");
});

it("disambiguates duplicate recipient names and sends to the chosen account", async () => {
  const first = "12345678-1234-4234-8234-123456789abc",
    second = "12345678-9999-4234-8234-123456789abc";
  const roster: Participant[] = [
    { id: aid, displayName: "Sender", role: "player" },
    { id: first, displayName: "Alex", role: "player" },
    { id: second, displayName: "Alex", role: "player" },
  ];
  const commands: TokenCommand[] = [];
  const send = async (c: TokenCommand) => {
    commands.push(c);
  };
  const message = {
    id: aid,
    senderId: aid,
    senderName: "Sender",
    body: "Earlier private message",
    visibility: "whisper" as const,
    recipientIds: [second],
    createdAt: 1,
    revision: 1,
  };
  render(
    createElement(Chat, {
      userId: aid,
      participants: roster,
      messages: [
        message,
        {
          ...message,
          id: second,
          senderId: first,
          senderName: "Alex",
          body: "Public from first Alex",
          visibility: "public",
          recipientIds: [],
          revision: 2,
        },
      ],
      rolls: [
        {
          id: first,
          rollerId: first,
          rollerName: "Alex",
          expression: "d1",
          normalizedExpression: "1d1",
          visibility: "public",
          recipientIds: [],
          createdAt: 1,
          revision: 3,
          total: 1,
          dice: [{ count: 1, sides: 1, faces: [1], subtotal: 1 }],
        },
      ],
      disabled: false,
      send,
    }),
  );
  expect(
    screen
      .getAllByTestId("chat-message")
      .find((m) => m.textContent?.includes("Public from first Alex"))
      ?.querySelector("strong")?.textContent,
  ).toBe("Alex · 12345678-1");
  expect(screen.getByTestId("chat-roll-card").querySelector("strong")?.textContent).toBe(
    "Alex · 12345678-1",
  );
  fireEvent.change(screen.getByLabelText("Message visibility"), { target: { value: "whisper" } });
  expect(screen.getByRole("checkbox", { name: "Alex · 12345678-1" })).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: "Alex · 12345678-9" }));
  expect(screen.getByText("To Alex · 12345678-9 + sender")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Message text"), {
    target: { value: "Only to the second Alex" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send whisper" }));
  });
  expect(commands[0]).toMatchObject({
    type: "chat.send",
    payload: { recipientIds: [second], visibility: "whisper" },
  });
});
