import {
  ActorsResponse,
  AssetResponse,
  AssetsResponse,
  AuthResponse,
  BackupResponse,
  CampaignResponse,
  CampaignsResponse,
  ChatResponse,
  CombatResponse,
  ErrorResponse,
  HealthResponse,
  InviteResponse,
  JoinResponse,
  JournalsResponse,
  MembersResponse,
  MeResponse,
  OkResponse,
  ParticipantsResponse,
  RecoveryResponse,
  RestoreResponse,
  RollResponse,
  RollsResponse,
  ScenesResponse,
  VerificationResponse,
} from "@hearth/protocol";
import type { z } from "zod";

export class ApiFailure extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
async function request<T>(
  schema: z.ZodType<T>,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    const binary = body instanceof Blob;
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": binary ? "application/octet-stream" : "application/json",
        "X-Hearth-Request": "1",
      },
      ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }),
    });
  } catch {
    throw new ApiFailure(
      0,
      "HOST_OFFLINE",
      "The host is unavailable. Check the connection and try again.",
    );
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ErrorResponse.safeParse(json);
    throw new ApiFailure(
      response.status,
      error.success ? error.data.error.code : "INVALID_RESPONSE",
      error.success ? error.data.error.message : "The host returned an unexpected response.",
    );
  }
  const result = schema.safeParse(json);
  if (!result.success)
    throw new ApiFailure(
      0,
      "INCOMPATIBLE_PROTOCOL",
      "This app and host use incompatible data formats. Reload after updating both.",
    );
  return result.data;
}
type Credentials = { username: string; displayName: string; password: string };
export const api = {
  recoveryStatus: () => request(RecoveryResponse, "/host/recovery"),
  prepareBackup: () => request(BackupResponse, "/host/backups", "POST", {}),
  verifyBackup: (file: File) =>
    request(VerificationResponse, "/host/restores/verify", "POST", file),
  restoreBackup: (verificationId: string) =>
    request(RestoreResponse, "/host/restores", "POST", { verificationId }),
  backupDownload: (id: string) => `/api/host/backups/${encodeURIComponent(id)}`,
  health: () => request(HealthResponse, "/health"),
  me: () => request(MeResponse, "/auth/me"),
  setup: (body: Credentials & { createDemo: boolean }) =>
    request(AuthResponse, "/setup/owner", "POST", body),
  login: (body: { username: string; password: string }) =>
    request(AuthResponse, "/auth/login", "POST", body),
  join: (body: Credentials & { code: string }) =>
    request(JoinResponse, "/invites/redeem", "POST", body),
  logout: () => request(OkResponse, "/auth/logout", "POST", {}),
  campaigns: () => request(CampaignsResponse, "/campaigns"),
  campaign: (id: string) => request(CampaignResponse, `/campaigns/${id}`),
  createCampaign: (body: { name: string; description: string; createDemo: boolean }) =>
    request(CampaignResponse, "/campaigns", "POST", body),
  updateCampaign: (id: string, body: { name: string; description: string; archived: boolean }) =>
    request(CampaignResponse, `/campaigns/${id}`, "PATCH", body),
  invite: (id: string) =>
    request(InviteResponse, `/campaigns/${id}/invites`, "POST", { expiresInHours: 24 }),
  revokeInvite: (id: string, inviteId: string) =>
    request(OkResponse, `/campaigns/${id}/invites/${inviteId}/revoke`, "POST", {}),
  combat: (id: string) => request(CombatResponse, `/campaigns/${id}/combat`),
  chat: (id: string) => request(ChatResponse, `/campaigns/${id}/chat`),
  participants: (id: string) => request(ParticipantsResponse, `/campaigns/${id}/participants`),
  rolls: (id: string) => request(RollsResponse, `/campaigns/${id}/rolls`),
  roll: (id: string, roll: string) => request(RollResponse, `/campaigns/${id}/rolls/${roll}`),
  actors: (id: string) => request(ActorsResponse, `/campaigns/${id}/actors`),
  scenes: (id: string) => request(ScenesResponse, `/campaigns/${id}/scenes`),
  journals: (id: string) => request(JournalsResponse, `/campaigns/${id}/journals`),
  members: (id: string) => request(MembersResponse, `/campaigns/${id}/members`),
  revokeMember: (id: string, userId: string) =>
    request(OkResponse, `/campaigns/${id}/members/${userId}/revoke`, "POST", {}),
  assets: (id: string) => request(AssetsResponse, `/campaigns/${id}/assets`),
  uploadAsset: async (id: string, file: File) => {
    if (
      !file.size ||
      file.size > 8 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      throw new Error("Choose a PNG, JPEG or WebP up to 8 MiB.");
    const response = await fetch(`/api/campaigns/${id}/assets`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": file.type, "X-Hearth-Request": "1" },
      body: file,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ErrorResponse.safeParse(body);
      throw new Error(
        error.success ? error.data.error.message : "Artwork upload failed. Try again.",
      );
    }
    return AssetResponse.parse(body);
  },
  asset: (id: string, assetId: string) =>
    `/api/campaigns/${encodeURIComponent(id)}/assets/${encodeURIComponent(assetId)}`,
};
