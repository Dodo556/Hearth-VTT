import { describe, expect, it } from "vitest";
import {
  applyEvent,
  CampaignResponse,
  CommandFrameSchema,
  HealthResponse,
  newRequestId,
  ServerFrameSchema,
} from "./index";

describe("wire contract validation", () => {
  it("refuses incompatible schema versions", () => {
    expect(
      HealthResponse.safeParse({
        schemaVersion: 99,
        status: "ok",
        setupRequired: false,
        version: "0.0.1",
      }).success,
    ).toBe(false);
  });
  it("refuses forged campaign roles", () => {
    expect(
      CampaignResponse.safeParse({
        schemaVersion: 1,
        campaign: {
          id: "opaque",
          name: "Keep",
          role: "administrator",
          description: "",
          archived: false,
          createdAt: 1,
          sceneCount: 0,
        },
      }).success,
    ).toBe(false);
  });
  it("refuses missing onboarding state", () => {
    expect(
      HealthResponse.safeParse({ schemaVersion: 1, status: "ok", version: "0.0.1" }).success,
    ).toBe(false);
  });
});

describe("live commands", () => {
  const id = "8f834642-e1a2-42f2-9c5b-a80b91991344";
  const move = {
    schemaVersion: 1,
    kind: "command",
    requestId: id,
    baseRevision: 3,
    command: { type: "token.move", payload: { tokenId: id, x: 630, y: 690 } },
  };
  it("rejects forged authority fields, unknown actions and unsafe coordinates", () => {
    for (const frame of [
      { ...move, role: "dm" },
      { ...move, baseRevision: -1 },
      { ...move, baseRevision: Number.MAX_SAFE_INTEGER + 1 },
      { ...move, requestId: "same" },
      { ...move, command: { type: "scene.delete", payload: {} } },
      { ...move, command: { type: "token.move", payload: { tokenId: id, x: Infinity, y: 1 } } },
      {
        ...move,
        command: { type: "token.move", payload: { tokenId: id, x: 1, y: 1, role: "dm" } },
      },
    ])
      expect(CommandFrameSchema.safeParse(frame).success).toBe(false);
    expect(CommandFrameSchema.safeParse(move).success).toBe(true);
  });
  it("rejects private data on an invisible cursor event", () => {
    const event = {
      kind: "event",
      schemaVersion: 1,
      streamId: id,
      eventId: id,
      revision: 1,
      serverTime: 0,
      type: "sync.cursor",
      payload: { tokenId: "secret" },
    };
    expect(ServerFrameSchema.safeParse(event).success).toBe(false);
  });
  it("removes concealed tokens from local state and handles reveal without duplication", () => {
    const token = {
      id,
      name: "Hero",
      x: 30,
      y: 30,
      size: 60,
      color: "gold",
      assetId: "hero",
      visibility: "shared" as const,
      canMove: true,
      controllerUserId: null,
      actorId: null,
    };
    const scene = {
      id: "scene",
      campaignId: id,
      name: "Map",
      width: 600,
      height: 600,
      gridSize: 60,
      backgroundAssetId: "map",
      fog: { enabled: false, columns: 10, rows: 10, revealed: "00".repeat(13) },
      visibility: "shared" as const,
      active: true,
      tokens: [token],
    };
    const base = {
      kind: "event" as const,
      schemaVersion: 1 as const,
      streamId: id,
      eventId: id,
      revision: 1,
      serverTime: 0,
    };
    const hidden = applyEvent([scene], {
      ...base,
      type: "token.removed",
      payload: { sceneId: "scene", tokenId: id },
    });
    expect(hidden[0]?.tokens).toEqual([]);
    const reveal = {
      ...base,
      type: "token.upsert" as const,
      payload: { sceneId: "scene", token: { ...token, x: 90 } },
    };
    expect(applyEvent(applyEvent(hidden, reveal), reveal)[0]?.tokens).toEqual([
      { ...token, x: 90 },
    ]);
    expect(scene.tokens).toEqual([token]);
  });
});

it("creates random v4 request IDs without requiring secure-context randomUUID", () => {
  const ids = new Set(Array.from({ length: 100 }, () => newRequestId()));
  expect(ids.size).toBe(100);
  for (const id of ids)
    expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

it("accepts bounded scene and token authoring while rejecting forged authoring fields", () => {
  const id = "8f834642-e1a2-42f2-9c5b-a80b91991344";
  const create = {
    type: "scene.create",
    payload: { sceneId: id, name: "Cavern", assetId: id, gridSize: 60 },
  };
  expect(
    CommandFrameSchema.safeParse({
      kind: "command",
      schemaVersion: 1,
      requestId: id,
      baseRevision: 0,
      command: create,
    }).success,
  ).toBe(true);
  for (const command of [
    { ...create, payload: { ...create.payload, visibility: "shared" } },
    { ...create, payload: { ...create.payload, gridSize: 0 } },
    { ...create, payload: { ...create.payload, name: " " } },
    {
      type: "token.create",
      payload: {
        tokenId: id,
        sceneId: id,
        name: "Hero",
        assetId: "token-warden",
        size: Infinity,
        x: 30,
        y: 30,
        visibility: "shared",
      },
    },
  ])
    expect(
      CommandFrameSchema.safeParse({
        kind: "command",
        schemaVersion: 1,
        requestId: id,
        baseRevision: 0,
        command,
      }).success,
    ).toBe(false);
});

it("validates actors and ownership without accepting authority claims", () => {
  const actorId = newRequestId();
  const input = {
    type: "actor.create",
    payload: {
      actorId,
      name: "Mira",
      kind: "character",
      assetId: "token-warden",
      biography: "Scholar",
      dmNotes: "Private",
      hp: 12,
      maxHp: 20,
      attributes: { Strength: "14" },
    },
  };
  expect(
    CommandFrameSchema.safeParse({
      kind: "command",
      schemaVersion: 1,
      requestId: newRequestId(),
      baseRevision: 0,
      command: input,
    }).success,
  ).toBe(true);
  expect(
    CommandFrameSchema.safeParse({
      kind: "command",
      schemaVersion: 1,
      requestId: newRequestId(),
      baseRevision: 0,
      command: { ...input, payload: { ...input.payload, canEdit: true } },
    }).success,
  ).toBe(false);
});

it("accepts a bounded transient map ping without a campaign revision", () => {
  const frame = {
    kind: "ping",
    schemaVersion: 1,
    pingId: "8f834642-e1a2-42f2-9c5b-a80b91991344",
    sceneId: "8f834642-e1a2-42f2-9c5b-a80b91991344",
    senderId: "8f834642-e1a2-42f2-9c5b-a80b91991344",
    x: 121,
    y: 181,
  };
  expect(ServerFrameSchema.safeParse(frame).success).toBe(true);
  expect(ServerFrameSchema.safeParse({ ...frame, x: Number.POSITIVE_INFINITY }).success).toBe(
    false,
  );
  expect(ServerFrameSchema.safeParse({ ...frame, revision: 1 }).success).toBe(false);
});
