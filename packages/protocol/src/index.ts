import { z } from "zod";

const version = { schemaVersion: z.literal(1) };
export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  isOwner: z.boolean(),
});
export const CampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  role: z.enum(["dm", "player"]),
  archived: z.boolean(),
  createdAt: z.number().int(),
  sceneCount: z.number().int().nonnegative(),
});
export const TokenSchema = z.object({
  actorId: z.string().nullable().default(null),
  id: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  size: z.number().positive(),
  color: z.string(),
  assetId: z.string(),
  controllerUserId: z.string().nullable(),
  canMove: z.boolean(),
  visibility: z.enum(["shared", "dm"]),
});
export const DrawingTextSchema = z.string().refine(
  (text) =>
    text.trim().length > 0 &&
    [...text].length <= 120 &&
    text.split("\n").length <= 4 &&
    [...text].every((character) => {
      const code = character.codePointAt(0) ?? 0;
      return character === "\n" || (code >= 32 && !(code >= 127 && code <= 159));
    }),
);
const DrawingFields = z
  .object({
    id: z.uuid(),
    shape: z.enum(["line", "rectangle", "freehand", "text"]),
    text: DrawingTextSchema.optional(),
    points: z
      .array(z.object({ x: z.number().finite(), y: z.number().finite() }).strict())
      .max(128)
      .optional(),
    visibility: z.enum(["shared", "dm"]),
    color: z.string().regex(/^#[0-9a-f]{6}$/),
    startX: z.number().finite(),
    startY: z.number().finite(),
    endX: z.number().finite(),
    endY: z.number().finite(),
  })
  .strict();
const validDrawingPoints = (drawing: {
  shape: string;
  text?: string;
  points?: { x: number; y: number }[];
}) =>
  (drawing.shape === "freehand" ? (drawing.points?.length ?? 0) >= 2 : !drawing.points?.length) &&
  (drawing.shape === "text" ? drawing.text !== undefined : drawing.text === undefined);
export const DrawingSchema = DrawingFields.refine(validDrawingPoints);
export type Drawing = z.infer<typeof DrawingSchema>;
export const FogSchema = z
  .object({
    enabled: z.boolean(),
    columns: z.number().int().min(1).max(256),
    rows: z.number().int().min(1).max(256),
    revealed: z
      .string()
      .max(16384)
      .regex(/^(?:[0-9a-f]{2})+$/),
  })
  .strict()
  .refine((f) => f.revealed.length === Math.ceil((f.columns * f.rows) / 8) * 2);
export const SceneSchema = z.object({
  fog: FogSchema,
  id: z.string(),
  campaignId: z.string(),
  name: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  gridSize: z.number().positive(),
  backgroundAssetId: z.string(),
  visibility: z.enum(["shared", "dm"]),
  active: z.boolean(),
  tokens: z.array(TokenSchema),
  drawings: z.array(DrawingSchema).max(64).optional(),
});
export const JournalSchema = z.object({
  version: z.number().int().positive(),
  id: z.string(),
  title: z.string(),
  body: z.string(),
  visibility: z.enum(["shared", "dm"]),
});
export const MemberSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  username: z.string(),
  role: z.enum(["dm", "player"]),
});
export const HealthResponse = z.object({
  ...version,
  status: z.literal("ok"),
  version: z.string(),
  setupRequired: z.boolean(),
});
export const AuthResponse = z.object({ ...version, user: UserSchema });
export const MeResponse = z.object({ ...version, user: UserSchema.nullable() });
export const JoinResponse = z.object({ ...version, user: UserSchema, campaignId: z.string() });
export const CampaignResponse = z.object({ ...version, campaign: CampaignSchema });
export const CampaignsResponse = z.object({ ...version, campaigns: z.array(CampaignSchema) });
export const ScenesResponse = z.object({ ...version, scenes: z.array(SceneSchema) });
export const JournalsResponse = z.object({ ...version, journals: z.array(JournalSchema) });
export const MembersResponse = z.object({ ...version, members: z.array(MemberSchema) });
export const InviteResponse = z.object({
  ...version,
  invite: z.object({ id: z.string(), code: z.string().length(64), expiresAt: z.number().int() }),
});
export const OkResponse = z.object({ ...version, ok: z.literal(true) });
export const ErrorResponse = z.object({
  ...version,
  error: z.object({ code: z.string(), message: z.string() }),
});
export type User = z.infer<typeof UserSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Journal = z.infer<typeof JournalSchema>;

const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Move = z
  .object({ tokenId: z.uuid(), x: z.number().finite(), y: z.number().finite() })
  .strict();
const objectName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) =>
    [...value].every((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 && !(code >= 127 && code <= 159);
    }),
  );
const sceneRef = z.object({ sceneId: z.uuid() }).strict();
const tokenRef = z.object({ tokenId: z.uuid() }).strict();
const actorFields = {
  name: objectName,
  biography: z.string().max(1000),
  hp: z.number().int().min(0).max(1000000),
  maxHp: z.number().int().min(1).max(1000000),
  attributes: z
    .record(z.string().min(1).max(40), z.string().max(120))
    .refine((v) => Object.keys(v).length <= 8),
};
export const ActorSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  name: z.string(),
  kind: z.enum(["character", "npc"]),
  assetId: z.string(),
  biography: z.string(),
  hp: z.number().int(),
  maxHp: z.number().int(),
  attributes: z.record(z.string(), z.string()),
  visibility: z.enum(["dm", "shared"]),
  canEdit: z.boolean(),
  dmNotes: z.string().optional(),
  permissions: z
    .array(z.object({ userId: z.string(), permission: z.enum(["observer", "owner"]) }))
    .optional(),
});
export const ActorsResponse = z.object({ ...version, actors: z.array(ActorSchema) });
export type Actor = z.infer<typeof ActorSchema>;
const fogMode = z.enum(["reveal", "hide"]);
export const RollVisibilitySchema = z.enum(["public", "gm", "self", "blind", "selected"]);
export const RollSchema = z.object({
  id: z.string(),
  rollerId: z.string(),
  rollerName: z.string(),
  expression: z.string().max(120),
  normalizedExpression: z.string(),
  visibility: RollVisibilitySchema,
  recipientIds: z.array(z.uuid()).max(8).default([]),
  createdAt: z.number().int(),
  revision: z.number().int().positive(),
  total: z.number().finite().min(-1000000000).max(1000000000),
  dice: z
    .array(
      z.object({
        count: z.number().int().min(1).max(100),
        sides: z.number().int().min(1).max(1000000),
        faces: z.array(z.number().int().positive()).max(100),
        subtotal: z.number().int().nonnegative(),
      }),
    )
    .max(32),
});
export type Roll = z.infer<typeof RollSchema>;
export const RollsResponse = z.object({ ...version, rolls: z.array(RollSchema).max(20) });
export const RollResponse = z.object({ ...version, roll: RollSchema });
const journalFields = {
  title: z
    .string()
    .trim()
    .refine((s) => Array.from(s).length >= 1 && Array.from(s).length <= 80 && !/\p{Cc}/u.test(s)),
  body: z
    .string()
    .refine(
      (s) =>
        Array.from(s).length <= 1000 &&
        !/\p{Cc}/u.test(s.replaceAll("\n", "").replaceAll("\t", "")),
    ),
};
const recipientIds = z.array(z.uuid()).max(8).default([]);
const recipientSelection = (p: { visibility: string; recipientIds: string[] }) =>
  new Set(p.recipientIds).size === p.recipientIds.length &&
  (p.visibility === "whisper" || p.visibility === "selected"
    ? p.recipientIds.length > 0
    : p.recipientIds.length === 0);
export const ParticipantSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: z.enum(["dm", "player"]),
});
export type Participant = z.infer<typeof ParticipantSchema>;
export const ParticipantsResponse = z.object({
  ...version,
  participants: z.array(ParticipantSchema),
});
export const ChatMessageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  body: z.string(),
  visibility: z.enum(["public", "whisper"]),
  recipientIds: z.array(z.string()).max(8),
  createdAt: z.number().int(),
  revision: z.number().int().positive(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export const ChatResponse = z.object({ ...version, messages: z.array(ChatMessageSchema).max(20) });
export const MessageResponse = z.object({ ...version, message: ChatMessageSchema });
export const CombatantSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  tokenId: z.string(),
  name: z.string(),
  assetId: z.string(),
  initiative: z.number().int().min(-1000).max(1000).nullable(),
  canEditInitiative: z.boolean(),
  actorId: z.string().nullable(),
  canEditHp: z.boolean(),
  hp: z.number().int().nonnegative().optional(),
  maxHp: z.number().int().positive().optional(),
  actorVersion: z.number().int().positive().optional(),
});
export type Combatant = z.infer<typeof CombatantSchema>;
export const EncounterSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  status: z.enum(["preparing", "active", "ended"]),
  round: z.number().int().nonnegative(),
  activeCombatantId: z.string().nullable(),
  combatants: z.array(CombatantSchema).max(32),
});
export type Encounter = z.infer<typeof EncounterSchema>;
export const CombatResponse = z.object({ ...version, encounter: EncounterSchema.nullable() });
const combatRef = z
  .object({ encounterId: z.uuid(), expectedVersion: z.number().int().positive() })
  .strict();
export const TokenCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("drawing.create"),
      payload: DrawingFields.omit({ id: true })
        .extend({ sceneId: z.uuid(), clientDrawingId: z.uuid() })
        .strict()
        .refine(validDrawingPoints),
    })
    .strict(),
  z
    .object({ type: z.literal("drawing.undo"), payload: z.object({ sceneId: z.uuid() }).strict() })
    .strict(),
  z
    .object({
      type: z.literal("combat.create"),
      payload: z
        .object({
          clientEncounterId: z.uuid(),
          sceneId: z.uuid(),
          name: z.string().trim().min(1).max(80),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("combat.add"),
      payload: combatRef.extend({ clientCombatantId: z.uuid(), tokenId: z.uuid() }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("combat.remove"),
      payload: z
        .object({ combatantId: z.uuid(), expectedVersion: z.number().int().positive() })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("combat.initiative"),
      payload: z
        .object({
          combatantId: z.uuid(),
          expectedVersion: z.number().int().positive(),
          initiative: z.number().int().min(-1000).max(1000).nullable(),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal("combat.start"), payload: combatRef }).strict(),
  z.object({ type: z.literal("combat.next"), payload: combatRef }).strict(),
  z.object({ type: z.literal("combat.end"), payload: combatRef }).strict(),
  z.object({ type: z.literal("combat.clear"), payload: combatRef }).strict(),
  z
    .object({
      type: z.literal("combat.hp"),
      payload: z
        .object({
          combatantId: z.uuid(),
          expectedActorVersion: z.number().int().positive(),
          expectedActorId: z.uuid(),
          hp: z.number().int().min(0).max(1000000),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("chat.send"),
      payload: z
        .object({
          clientMessageId: z.uuid(),
          body: z
            .string()
            .refine(
              (s) =>
                !!s.trim() &&
                Array.from(s).length <= 1000 &&
                !/\p{Cc}/u.test(s.replaceAll("\n", "").replaceAll("\t", "")),
            ),
          visibility: z.enum(["public", "whisper"]),
          recipientIds,
        })
        .strict()
        .refine(recipientSelection),
    })
    .strict(),
  z
    .object({
      type: z.literal("journal.create"),
      payload: z.object({ journalId: z.uuid(), ...journalFields }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("journal.update"),
      payload: z
        .object({
          journalId: z.uuid(),
          expectedVersion: z.number().int().positive(),
          ...journalFields,
          visibility: z.enum(["dm", "shared"]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("journal.delete"),
      payload: z
        .object({ journalId: z.uuid(), expectedVersion: z.number().int().positive() })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("dice.roll"),
      payload: z
        .object({
          clientRollId: z.uuid(),
          expression: z.string().min(1).max(120),
          visibility: RollVisibilitySchema,
          recipientIds,
        })
        .strict()
        .refine(recipientSelection),
    })
    .strict(),
  z
    .object({
      type: z.literal("fog.configure"),
      payload: z.object({ sceneId: z.uuid(), enabled: z.boolean() }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("fog.reset"),
      payload: z.object({ sceneId: z.uuid(), mode: fogMode }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("fog.paint"),
      payload: z
        .object({
          sceneId: z.uuid(),
          column: z.number().int().min(0).max(255),
          row: z.number().int().min(0).max(255),
          width: z.number().int().min(1).max(256),
          height: z.number().int().min(1).max(256),
          mode: fogMode,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("actor.create"),
      payload: z
        .object({
          actorId: z.uuid(),
          ...actorFields,
          kind: z.enum(["character", "npc"]),
          assetId: z.string().min(1),
          dmNotes: z.string().max(1000),
        })
        .strict()
        .refine((p) => p.hp <= p.maxHp),
    })
    .strict(),
  z
    .object({
      type: z.literal("actor.update"),
      payload: z
        .object({
          actorId: z.uuid(),
          expectedVersion: z.number().int().positive(),
          ...actorFields,
          assetId: z.string().min(1).optional(),
          dmNotes: z.string().max(1000).optional(),
        })
        .strict()
        .refine((p) => p.hp <= p.maxHp),
    })
    .strict(),
  z
    .object({ type: z.literal("actor.delete"), payload: z.object({ actorId: z.uuid() }).strict() })
    .strict(),
  z
    .object({
      type: z.literal("actor.permission"),
      payload: z
        .object({
          actorId: z.uuid(),
          userId: z.uuid(),
          permission: z.enum(["none", "observer", "owner"]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("actor.visibility"),
      payload: z.object({ actorId: z.uuid(), visibility: z.enum(["dm", "shared"]) }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("token.link"),
      payload: z.object({ tokenId: z.uuid(), actorId: z.uuid().nullable() }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("scene.rename"),
      payload: z.object({ sceneId: z.uuid(), expectedName: objectName, name: objectName }).strict(),
    })
    .strict(),
  z.object({ type: z.literal("scene.delete"), payload: sceneRef }).strict(),
  z
    .object({
      type: z.literal("scene.create"),
      payload: z
        .object({
          sceneId: z.uuid(),
          name: objectName,
          assetId: z.string().min(1),
          gridSize: z.number().int().min(20).max(256),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal("scene.activate"), payload: sceneRef }).strict(),
  z.object({ type: z.literal("scene.conceal"), payload: sceneRef }).strict(),
  z
    .object({
      type: z.literal("token.create"),
      payload: z
        .object({
          tokenId: z.uuid(),
          sceneId: z.uuid(),
          name: objectName,
          assetId: z.string().min(1),
          size: z.number().min(16).max(256),
          x: z.number().finite(),
          y: z.number().finite(),
          visibility: z.enum(["shared", "dm"]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("token.update"),
      payload: z
        .object({
          tokenId: z.uuid(),
          name: objectName,
          assetId: z.string().min(1),
          size: z.number().min(16).max(256),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal("token.delete"), payload: tokenRef }).strict(),
  z.object({ type: z.literal("token.move"), payload: Move }).strict(),
  z
    .object({
      type: z.literal("token.assign"),
      payload: z.object({ tokenId: z.uuid(), userId: z.uuid().nullable() }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("token.visibility"),
      payload: z.object({ tokenId: z.uuid(), visibility: z.enum(["shared", "dm"]) }).strict(),
    })
    .strict(),
]);
export const CommandFrameSchema = z
  .object({
    ...version,
    kind: z.literal("command"),
    requestId: z.uuid(),
    baseRevision: revision,
    command: TokenCommandSchema,
  })
  .strict();
export const PingFrameSchema = z
  .object({
    ...version,
    kind: z.literal("ping"),
    sceneId: z.uuid(),
    x: z.number().nonnegative().max(4096),
    y: z.number().nonnegative().max(4096),
  })
  .strict();
export const ReceivedPingSchema = PingFrameSchema.extend({ pingId: z.uuid(), senderId: z.uuid() });
const eventBase = {
  ...version,
  kind: z.literal("event"),
  streamId: z.uuid(),
  eventId: z.uuid(),
  revision,
  serverTime: z.number(),
};
export const LiveEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...eventBase,
      type: z.literal("token.upsert"),
      payload: z.object({ sceneId: z.string(), token: TokenSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("token.removed"),
      payload: z.object({ sceneId: z.string(), tokenId: z.string() }).strict(),
    })
    .strict(),
  z
    .object({ ...eventBase, type: z.literal("sync.cursor"), payload: z.object({}).strict() })
    .strict(),
]);
export const ServerFrameSchema = z.union([
  ReceivedPingSchema,
  z
    .object({
      ...version,
      kind: z.literal("snapshot"),
      streamId: z.uuid(),
      revision,
      role: z.enum(["dm", "player"]),
      scenes: z.array(SceneSchema),
      journals: z.array(JournalSchema),
      actors: z.array(ActorSchema).default([]),
      rolls: z.array(RollSchema).max(20).default([]),
      messages: z.array(ChatMessageSchema).max(20).default([]),
      encounter: EncounterSchema.nullable().default(null),
      serverTime: z.number(),
    })
    .strict(),
  LiveEventSchema,
  z
    .object({
      ...version,
      kind: z.literal("ack"),
      requestId: z.uuid(),
      revision,
      duplicate: z.boolean(),
      serverTime: z.number(),
    })
    .strict(),
  z
    .object({
      ...version,
      kind: z.literal("error"),
      requestId: z.string().nullable(),
      error: z.object({ code: z.string(), message: z.string() }).strict(),
    })
    .strict(),
  z
    .object({
      ...version,
      kind: z.literal("closing"),
      code: z.enum(["ACCESS_REVOKED", "HOST_SHUTTING_DOWN"]),
    })
    .strict(),
]);
export type Token = z.infer<typeof TokenSchema>;
export type MapPing = z.infer<typeof ReceivedPingSchema>;
export type TokenCommand = z.infer<typeof TokenCommandSchema>;
export type LiveEvent = z.infer<typeof LiveEventSchema>;
export function applyEvent(scenes: Scene[], event: LiveEvent): Scene[] {
  if (event.type === "sync.cursor") return scenes;
  const payload = event.payload;
  return scenes.map((scene) => {
    if (scene.id !== payload.sceneId) return scene;
    if (event.type === "token.removed")
      return { ...scene, tokens: scene.tokens.filter((t) => t.id !== event.payload.tokenId) };
    const token = event.payload.token;
    return { ...scene, tokens: [...scene.tokens.filter((t) => t.id !== token.id), token] };
  });
}

// getRandomValues also works on explicitly configured private HTTP LAN hosts.
export function newRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 15) | 64;
  bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const AssetSchema = z.object({
  id: z.uuid(),
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(16 * 1024 * 1024),
});
export const AssetResponse = z.object({ ...version, asset: AssetSchema });
export const AssetsResponse = z.object({ ...version, assets: z.array(AssetSchema) });
export type Asset = z.infer<typeof AssetSchema>;
export * from "./recovery";
