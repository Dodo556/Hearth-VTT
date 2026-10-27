import { expect, it } from "vitest";
import { ServerFrameSchema, TokenCommandSchema } from "./index";

const a = "cbff59be-bf0b-4ce0-b25c-44eea113961d",
  b = "12345678-1234-4234-8234-123456789abc";
it("validates explicit whisper and selected-roll recipients without accepting sender claims", () => {
  const payload = {
    clientMessageId: a,
    body: "Secret\ntext",
    visibility: "whisper",
    recipientIds: [b],
  };
  expect(TokenCommandSchema.safeParse({ type: "chat.send", payload }).success).toBe(true);
  for (const bad of [
    { ...payload, senderId: b },
    { ...payload, recipientIds: [] },
    { ...payload, recipientIds: [b, b] },
    { ...payload, visibility: "public" },
    { ...payload, body: " " },
    { ...payload, body: "x".repeat(1001) },
  ]) {
    expect(TokenCommandSchema.safeParse({ type: "chat.send", payload: bad }).success).toBe(false);
  }
  const roll = { clientRollId: a, expression: "d6", visibility: "selected", recipientIds: [b] };
  expect(TokenCommandSchema.safeParse({ type: "dice.roll", payload: roll }).success).toBe(true);
  expect(
    TokenCommandSchema.safeParse({ type: "dice.roll", payload: { ...roll, visibility: "public" } })
      .success,
  ).toBe(false);
  expect(
    TokenCommandSchema.safeParse({
      type: "chat.send",
      payload: { ...payload, body: "🧙".repeat(1000) },
    }).success,
  ).toBe(true);
});
it("accepts authorized chat projections in snapshots", () => {
  expect(
    ServerFrameSchema.safeParse({
      kind: "snapshot",
      schemaVersion: 1,
      streamId: a,
      revision: 1,
      role: "player",
      scenes: [],
      journals: [],
      actors: [],
      rolls: [],
      messages: [
        {
          id: a,
          senderId: a,
          senderName: "Alice",
          body: "A clue",
          visibility: "whisper",
          recipientIds: [b],
          createdAt: 1,
          revision: 1,
        },
      ],
      serverTime: 1,
    }).success,
  ).toBe(true);
});
