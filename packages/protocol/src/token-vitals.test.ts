import { expect, it } from "vitest";
import { TokenCommandSchema } from "./index";

it("requires guarded token/source versions and bounded unique manual markers", () => {
  const payload = {
    tokenId: "12345678-1234-4234-8234-123456789abc",
    expectedVersion: 1,
    expectedActorId: null,
    expectedActorVersion: null,
    hp: 8,
    maxHp: 12,
    hpVisibility: "controllers",
    statuses: ["marked", "prone"],
  };
  const parse = (extra: object = {}) =>
    TokenCommandSchema.safeParse({ type: "token.vitals.update", payload: { ...payload, ...extra } })
      .success;
  expect(parse()).toBe(true);
  expect(parse({ hp: null, maxHp: null })).toBe(true);
  for (const value of [
    { hp: -1 },
    { hp: 13 },
    { maxHp: 0 },
    { hp: null },
    { maxHp: 1000001 },
    { hp: 1.1 },
    { statuses: ["invented"] },
    { statuses: ["marked", "marked"] },
    { expectedVersion: 0 },
    { expectedVersion: Number.MAX_SAFE_INTEGER },
    { expectedActorId: "bad" },
    { extra: true },
  ])
    expect(parse(value)).toBe(false);
  for (const field of ["expectedActorId", "expectedActorVersion", "hp", "maxHp"]) {
    const missing: Record<string, unknown> = { ...payload };
    delete missing[field];
    expect(
      TokenCommandSchema.safeParse({ type: "token.vitals.update", payload: missing }).success,
    ).toBe(false);
  }
});
