import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  applyCommand,
  createMatch,
  DEFAULT_CANDIDATE_V4_SETTINGS,
  derivePublicView,
} from "@paddle-tactics/game-core";
import type {
  GameCommand,
  Loadout,
  MatchPublicView,
  MatchState,
  PlayerId,
} from "@paddle-tactics/game-core";
import type { GameCatalog } from "@paddle-tactics/game-data";

export type GuestIdentity = { id: string; token: string; expiresAt: Date };
export type SessionRecord = { id: string; tokenHash: string; expiresAt: Date };
export type OnlineGameCommand = GameCommand extends infer Command
  ? Command extends GameCommand
    ? Omit<Command, "expectedVersion">
    : never
  : never;
export interface GuestSessionRepository {
  create(record: SessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
}

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7;
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const ROOM_CODE_PATTERN = /^[2-9A-HJ-NP-Z]{6}$/;

export class GuestSessionService {
  constructor(private readonly repository: GuestSessionRepository) {}

  async create(): Promise<GuestIdentity> {
    const token = randomBytes(32).toString("base64url");
    const identity = {
      id: randomUUID(),
      token,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
    };
    await this.repository.create({
      id: identity.id,
      tokenHash: hashToken(token),
      expiresAt: identity.expiresAt,
    });
    return identity;
  }

  async authenticate(token: unknown): Promise<SessionRecord | null> {
    if (typeof token !== "string" || token.length < 40 || token.length > 100)
      return null;
    const record = await this.repository.findByTokenHash(hashToken(token));
    return record && record.expiresAt.getTime() > Date.now() ? record : null;
  }
}

export type OnlineLoadout = Loadout;
export type RoomPublicPlayer = {
  seat: "A" | "B";
  loadout: Loadout | null;
  ready: boolean;
  connected: boolean;
};
export type RoomPublicSnapshot = {
  roomCode: string;
  bestOf: 1 | 3 | 5;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "CLOSED";
  players: [RoomPublicPlayer, RoomPublicPlayer];
};
type RoomPlayer = {
  sessionId: string;
  socketId: string | null;
  loadout: Loadout;
  ready: boolean;
  disconnectedAt: number | null;
  timeout?: ReturnType<typeof setTimeout>;
};
type Room = {
  code: string;
  bestOf: 1 | 3 | 5;
  status: RoomPublicSnapshot["status"];
  players: [RoomPlayer, RoomPlayer | null];
  state: MatchState | null;
  allocationEpoch: string | null;
  allocationEpochVersion: number;
  commandResults: Map<string, { version: number; view: MatchPublicView }>;
};

export class OnlineRoomError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OnlineRoomError";
  }
}

export class OnlineRoomService {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly catalog: GameCatalog,
    private readonly graceSeconds = 60,
    private readonly onForfeit: (
      roomCode: string,
      winnerSessionId: string,
    ) => void = () => undefined,
  ) {}

  createRoom(
    sessionId: string,
    bestOf: 1 | 3 | 5,
    loadout: Loadout,
  ): RoomPublicSnapshot {
    this.assertLoadout(loadout);
    this.prepareNewRoom(sessionId);
    const code = this.newRoomCode();
    const room: Room = {
      code,
      bestOf,
      status: "WAITING",
      players: [
        {
          sessionId,
          socketId: null,
          loadout,
          ready: false,
          disconnectedAt: null,
        },
        null,
      ],
      state: null,
      allocationEpoch: null,
      allocationEpochVersion: 0,
      commandResults: new Map(),
    };
    this.rooms.set(code, room);
    return this.snapshot(room);
  }

  joinRoom(
    sessionId: string,
    roomCode: string,
    loadout: Loadout,
  ): RoomPublicSnapshot {
    this.assertLoadout(loadout);
    const room = this.requireRoom(roomCode);
    const existing = this.roomFor(sessionId);
    if (existing && existing !== room)
      throw new OnlineRoomError("ALREADY_IN_ROOM", "你已经在另一个房间中");
    if (room.status !== "WAITING")
      throw new OnlineRoomError("ROOM_NOT_JOINABLE", "该房间已开始或关闭");
    if (room.players[0].sessionId === sessionId) return this.snapshot(room);
    if (room.players[1] && room.players[1].sessionId !== sessionId)
      throw new OnlineRoomError("ROOM_FULL", "该房间已满");
    room.players[1] = {
      sessionId,
      socketId: null,
      loadout,
      ready: false,
      disconnectedAt: null,
    };
    return this.snapshot(room);
  }

  setReady(sessionId: string, roomCode: string, ready: boolean) {
    const room = this.requireRoom(roomCode);
    const player = this.requirePlayer(room, sessionId);
    if (room.status !== "WAITING")
      throw new OnlineRoomError("ROOM_NOT_WAITING", "房间已不在准备阶段");
    player.ready = ready;
    if (room.players[0].ready && room.players[1]?.ready) {
      const second = room.players[1]!;
      room.state = createMatch({
        id: randomUUID(),
        bestOf: room.bestOf,
        firstServerPlayerId: randomInt(2) === 0 ? "A" : "B",
        playerA: { id: "A", loadout: room.players[0].loadout },
        playerB: { id: "B", loadout: second.loadout },
        catalog: this.catalog,
        candidateV4: DEFAULT_CANDIDATE_V4_SETTINGS,
      });
      room.status = "ACTIVE";
      room.allocationEpoch = getAllocationEpoch(room.state);
      room.allocationEpochVersion = room.state.version;
    }
    return this.snapshot(room);
  }

  attach(sessionId: string, socketId: string): string | null {
    const room = this.roomFor(sessionId);
    if (!room) return null;
    const player = this.requirePlayer(room, sessionId);
    player.socketId = socketId;
    player.disconnectedAt = null;
    if (player.timeout) clearTimeout(player.timeout);
    delete player.timeout;
    return room.code;
  }

  detach(sessionId: string, socketId: string): string | null {
    const room = this.roomFor(sessionId);
    if (!room) return null;
    const player = this.requirePlayer(room, sessionId);
    if (player.socketId !== socketId) return null;
    player.socketId = null;
    player.disconnectedAt = Date.now();
    player.timeout = setTimeout(() => {
      if (player.socketId || room.status === "CLOSED") return;
      const opponent = room.players.find(
        (candidate) => candidate && candidate.sessionId !== sessionId,
      );
      if (opponent?.socketId && room.status === "ACTIVE") {
        room.status = "COMPLETED";
        this.onForfeit(room.code, opponent.sessionId);
      } else {
        room.status = "CLOSED";
      }
    }, this.graceSeconds * 1000);
    player.timeout.unref?.();
    return room.code;
  }

  snapshotByCode(roomCode: string): RoomPublicSnapshot {
    return this.snapshot(this.requireRoom(roomCode));
  }

  roomFor(sessionId: string): Room | null {
    for (const room of this.rooms.values())
      if (room.players.some((player) => player?.sessionId === sessionId))
        return room;
    return null;
  }

  socketFor(sessionId: string): string | null {
    return (
      this.roomFor(sessionId)?.players.find(
        (player) => player?.sessionId === sessionId,
      )?.socketId ?? null
    );
  }

  seatFor(sessionId: string, roomCode: string): "A" | "B" {
    const room = this.requireRoom(roomCode);
    return this.requirePlayer(room, sessionId) === room.players[0] ? "A" : "B";
  }

  sessionIds(roomCode: string): string[] {
    return this.requireRoom(roomCode).players.flatMap((player) =>
      player ? [player.sessionId] : [],
    );
  }

  getView(sessionId: string, roomCode: string): MatchPublicView {
    const room = this.requireRoom(roomCode);
    const player = this.requirePlayer(room, sessionId);
    if (!room.state)
      throw new OnlineRoomError("MATCH_NOT_STARTED", "等待双方准备后开始");
    return derivePublicView(room.state, player === room.players[0] ? "A" : "B");
  }

  command(
    sessionId: string,
    roomCode: string,
    clientCommandId: string,
    expectedVersion: number,
    command: OnlineGameCommand,
  ): MatchPublicView {
    const room = this.requireRoom(roomCode);
    const player = this.requirePlayer(room, sessionId);
    if (room.status !== "ACTIVE" || !room.state)
      throw new OnlineRoomError("MATCH_NOT_ACTIVE", "对局当前不可操作");
    if (!/^[\w-]{8,100}$/.test(clientCommandId))
      throw new OnlineRoomError("INVALID_COMMAND_ID", "命令编号无效");
    const cacheKey = `${sessionId}:${clientCommandId}`;
    const previous = room.commandResults.get(cacheKey);
    if (previous) return previous.view;
    const actorId: PlayerId = player === room.players[0] ? "A" : "B";
    const currentStage = room.state.currentPoint.stage;
    const isParallelAllocation =
      expectedVersion < room.state.version &&
      expectedVersion >= room.allocationEpochVersion &&
      (command.type === "ALLOCATE" || command.type === "LOCK_ALLOCATION") &&
      command.stage === currentStage &&
      room.state.phase.endsWith("_ALLOCATING") &&
      !room.state.currentPoint.lockedByPlayerIds.includes(actorId);
    if (expectedVersion !== room.state.version && !isParallelAllocation)
      throw new OnlineRoomError("STALE_VERSION", "比赛状态已更新，请重新载入");
    // Allocation is simultaneous and private. An opponent's allocation/lock may advance
    // the global version without invalidating this player's still-open allocation turn.
    const acceptedVersion = isParallelAllocation
      ? room.state.version
      : expectedVersion;
    const result = applyCommand(room.state, actorId, {
      ...command,
      expectedVersion: acceptedVersion,
    } as GameCommand);
    room.state = result.state;
    const nextAllocationEpoch = getAllocationEpoch(room.state);
    if (nextAllocationEpoch !== room.allocationEpoch) {
      room.allocationEpoch = nextAllocationEpoch;
      room.allocationEpochVersion = room.state.version;
    }
    if (room.state.status === "COMPLETED") room.status = "COMPLETED";
    const view = derivePublicView(room.state, actorId);
    room.commandResults.set(cacheKey, { version: view.version, view });
    if (room.commandResults.size > 2000) {
      const oldest = room.commandResults.keys().next().value;
      if (oldest) room.commandResults.delete(oldest);
    }
    return view;
  }

  getPlayerViews(roomCode: string) {
    const room = this.requireRoom(roomCode);
    if (!room.state) return [];
    return room.players.flatMap((player, index) =>
      player
        ? [
            {
              sessionId: player.sessionId,
              socketId: player.socketId,
              view: derivePublicView(room.state!, index === 0 ? "A" : "B"),
            },
          ]
        : [],
    );
  }

  private assertLoadout(loadout: Loadout) {
    const known =
      this.catalog.players.some((item) => item.id === loadout.playerId) &&
      this.catalog.blades.some((item) => item.id === loadout.bladeId) &&
      this.catalog.rubbers.some(
        (item) => item.id === loadout.forehandRubberId,
      ) &&
      this.catalog.rubbers.some((item) => item.id === loadout.backhandRubberId);
    if (!known)
      throw new OnlineRoomError("INVALID_LOADOUT", "球员或装备配置无效");
  }

  private requireRoom(code: string): Room {
    const normalized = code.trim().toUpperCase();
    if (!ROOM_CODE_PATTERN.test(normalized))
      throw new OnlineRoomError("INVALID_ROOM_CODE", "房间码格式无效");
    const room = this.rooms.get(normalized);
    if (!room) throw new OnlineRoomError("ROOM_NOT_FOUND", "找不到这个房间");
    return room;
  }

  private requirePlayer(room: Room, sessionId: string): RoomPlayer {
    const player = room.players.find(
      (candidate) => candidate?.sessionId === sessionId,
    );
    if (!player)
      throw new OnlineRoomError("NOT_ROOM_MEMBER", "你不是这个房间的成员");
    return player;
  }

  private snapshot(room: Room): RoomPublicSnapshot {
    return {
      roomCode: room.code,
      bestOf: room.bestOf,
      status: room.status,
      players: room.players.map((player, index) => ({
        seat: index === 0 ? "A" : "B",
        loadout: player?.loadout ?? null,
        ready: player?.ready ?? false,
        connected: Boolean(player?.socketId),
      })) as RoomPublicSnapshot["players"],
    };
  }

  private prepareNewRoom(sessionId: string) {
    for (const [code, room] of this.rooms) {
      if (!room.players.some((p) => p?.sessionId === sessionId)) continue;
      if (room.status === "WAITING" && room.players[1] === null)
        this.rooms.delete(code);
      else if (room.status === "CLOSED" || room.status === "COMPLETED") {
        for (const player of room.players)
          if (player?.timeout) clearTimeout(player.timeout);
        this.rooms.delete(code);
      } else
        throw new OnlineRoomError("ALREADY_IN_ROOM", "你已经在进行中的房间里");
    }
  }

  private newRoomCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let code = "";
      for (let index = 0; index < ROOM_CODE_LENGTH; index += 1)
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new OnlineRoomError("ROOMS_BUSY", "暂时无法分配房间码，请重试");
  }
}

function getAllocationEpoch(state: MatchState): string {
  return `${state.phase}:${state.currentPoint.number}:${state.currentPoint.stage}:${state.currentPoint.rallyRound}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
