import { expect, it } from "vitest";
import { BackupResponse, RestoreResponse, VerificationResponse } from "./recovery";

const summary = {
  formatVersion: 1,
  schemaVersion: 10,
  appVersion: "0.0.10",
  createdAt: 100,
  counts: {
    users: 3,
    campaigns: 1,
    scenes: 2,
    tokens: 3,
    actors: 3,
    journals: 2,
    messages: 4,
    rolls: 1,
    encounters: 1,
    assets: 1,
  },
};
const receipt = {
  id: "cbff59be-bf0b-4ce0-b25c-44eea113961d",
  byteSize: 65536,
  sha256: "a".repeat(64),
  summary,
};
it("accepts bounded non-secret backup receipts and rejects malformed or unexpected fields", () => {
  expect(BackupResponse.safeParse({ schemaVersion: 1, backup: receipt }).success).toBe(true);
  expect(
    BackupResponse.safeParse({
      schemaVersion: 1,
      backup: { ...receipt, summary: { ...summary, schemaVersion: 11 } },
    }).success,
  ).toBe(true);
  expect(
    BackupResponse.safeParse({
      schemaVersion: 1,
      backup: { ...receipt, summary: { ...summary, schemaVersion: 12 } },
    }).success,
  ).toBe(true);
  expect(
    BackupResponse.safeParse({
      schemaVersion: 1,
      backup: { ...receipt, summary: { ...summary, schemaVersion: 13 } },
    }).success,
  ).toBe(true);
  for (const value of [
    { ...receipt, byteSize: 536870913 },
    { ...receipt, sha256: "not a hash" },
    { ...receipt, summary: { ...summary, passwords: [] } },
    { ...receipt, summary: { ...summary, schemaVersion: 15 } },
  ])
    expect(BackupResponse.safeParse({ schemaVersion: 1, backup: value }).success).toBe(false);
  expect(
    VerificationResponse.safeParse({
      schemaVersion: 1,
      verification: { ...receipt, expiresAt: 1000 },
    }).success,
  ).toBe(true);
});
it("never treats a browser supplied filesystem path as a valid recovery directory", () => {
  for (const directoryName of [
    "../live",
    "/existing/store",
    "hearth-restored-../live",
    "hearth-restored-a/b",
  ])
    expect(
      RestoreResponse.safeParse({
        schemaVersion: 1,
        restore: { directoryName, createdAt: 100, summary },
      }).success,
    ).toBe(false);
  expect(
    RestoreResponse.safeParse({
      schemaVersion: 1,
      restore: { directoryName: "hearth-restored-Abc123", createdAt: 100, summary },
    }).success,
  ).toBe(true);
});
