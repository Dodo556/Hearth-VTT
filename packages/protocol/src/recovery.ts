import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const time = z.number().int().min(0).max(253402300799);
export const BackupSummarySchema = z
  .object({
    formatVersion: z.literal(1),
    schemaVersion: z.union([
      z.literal(10),
      z.literal(11),
      z.literal(12),
      z.literal(13),
      z.literal(14),
      z.literal(15),
      z.literal(16),
      z.literal(17),
      z.literal(18),
    ]),
    appVersion: z.string().min(1).max(32),
    createdAt: time,
    counts: z
      .object({
        users: count,
        campaigns: count,
        scenes: count,
        tokens: count,
        actors: count,
        journals: count,
        messages: count,
        rolls: count,
        encounters: count,
        assets: count,
      })
      .strict(),
  })
  .strict();
const receipt = {
  id: z.uuid(),
  byteSize: z.number().int().positive().max(536870912),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  summary: BackupSummarySchema,
};
export const BackupInfoSchema = z.object(receipt).strict();
export const VerificationInfoSchema = z.object({ ...receipt, expiresAt: time }).strict();
export const RestoreInfoSchema = z
  .object({
    directoryName: z.string().regex(/^hearth-restored-[A-Za-z0-9]+$/),
    createdAt: time,
    summary: BackupSummarySchema,
  })
  .strict();
export const RecoveryResponse = z
  .object({
    schemaVersion: z.literal(1),
    dataDirectory: z.string().min(1).max(4096),
    prepared: BackupInfoSchema.nullable(),
    verified: VerificationInfoSchema.nullable(),
    lastRestore: RestoreInfoSchema.nullable(),
  })
  .strict();
export const BackupResponse = z
  .object({ schemaVersion: z.literal(1), backup: BackupInfoSchema })
  .strict();
export const VerificationResponse = z
  .object({ schemaVersion: z.literal(1), verification: VerificationInfoSchema })
  .strict();
export const RestoreResponse = z
  .object({ schemaVersion: z.literal(1), restore: RestoreInfoSchema })
  .strict();
export type BackupInfo = z.infer<typeof BackupInfoSchema>;
export type VerificationInfo = z.infer<typeof VerificationInfoSchema>;
export type RestoreInfo = z.infer<typeof RestoreInfoSchema>;
export type BackupSummary = z.infer<typeof BackupSummarySchema>;
