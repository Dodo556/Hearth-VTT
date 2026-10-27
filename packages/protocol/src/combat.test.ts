import { expect, it } from "vitest";
import { ServerFrameSchema, TokenCommandSchema } from "./index";

const id = "cbff59be-bf0b-4ce0-b25c-44eea113961d";
it("validates versioned encounter commands and nullable initiative without client authority claims", () => {
  expect(
    TokenCommandSchema.safeParse({
      type: "combat.create",
      payload: { clientEncounterId: id, sceneId: id, name: "Vault encounter" },
    }).success,
  ).toBe(true);
  const payload = { combatantId: id, expectedVersion: 2, initiative: null };
  expect(TokenCommandSchema.safeParse({ type: "combat.initiative", payload }).success).toBe(true);
  for (const bad of [
    { ...payload, expectedVersion: 0 },
    { ...payload, initiative: 1001 },
    { ...payload, canEditInitiative: true },
  ])
    expect(TokenCommandSchema.safeParse({ type: "combat.initiative", payload: bad }).success).toBe(
      false,
    );
});
it("accepts a filtered combat projection with omitted unreadable HP", () => {
  expect(
    ServerFrameSchema.safeParse({
      kind: "snapshot",
      schemaVersion: 1,
      streamId: id,
      revision: 1,
      role: "player",
      scenes: [],
      journals: [],
      actors: [],
      rolls: [],
      messages: [],
      encounter: {
        id,
        sceneId: id,
        name: "Encounter",
        version: 1,
        status: "active",
        round: 1,
        activeCombatantId: null,
        combatants: [
          {
            id,
            version: 1,
            tokenId: id,
            name: "Visible token",
            assetId: "token-warden",
            initiative: 12,
            canEditInitiative: false,
            actorId: null,
            canEditHp: false,
          },
        ],
      },
      serverTime: 1,
    }).success,
  ).toBe(true);
});
