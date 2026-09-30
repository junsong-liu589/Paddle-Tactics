import type { Server as SocketIOServer, Socket } from "socket.io";
import { z } from "zod";
import type { Loadout } from "@paddle-tactics/game-core";
import type {
  GuestSessionService,
  OnlineGameCommand,
  OnlineRoomService,
} from "./online.js";
import { OnlineRoomError } from "./online.js";

const LoadoutSchema = z.object({
  playerId: z.string().min(1).max(80),
  bladeId: z.string().min(1).max(80),
  forehandRubberId: z.string().min(1).max(80),
  backhandRubberId: z.string().min(1).max(80),
});
const RoomCreateSchema = z.object({
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  loadout: LoadoutSchema,
});
const RoomJoinSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[2-9A-HJ-NP-Z]{6}$/),
  loadout: LoadoutSchema,
});
const ReadySchema = z.object({ ready: z.boolean() });
const MatchCommandSchema = z.object({
  clientCommandId: z.string().min(8).max(100),
  expectedVersion: z.number().int().nonnegative(),
  command: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("ALLOCATE"),
      stage: z.enum(["service", "receive", "rally"]),
      allocations: z.record(z.string(), z.number().int().nonnegative()),
    }),
    z.object({
      type: z.literal("LOCK_ALLOCATION"),
      stage: z.enum(["service", "receive", "rally"]),
    }),
    z.object({
      type: z.literal("CHOOSE_ATTACK"),
      pairId: z.string().min(1).max(100),
    }),
    z.object({ type: z.literal("ADVANCE") }),
  ]),
});
type Ack = (payload: Record<string, unknown>) => void;
type AuthSocket = Socket & { data: { sessionId: string } };

export function registerGameSockets(
  io: SocketIOServer,
  sessions: GuestSessionService,
  rooms: OnlineRoomService,
) {
  const game = io.of("/game");

  game.use(async (socket, next) => {
    try {
      const identity = await sessions.authenticate(socket.handshake.auth.token);
      if (!identity) return next(new Error("SESSION_INVALID"));
      socket.data.sessionId = identity.id;
      next();
    } catch {
      next(new Error("SESSION_UNAVAILABLE"));
    }
  });

  game.on("connection", (socket) => {
    const current = socket as AuthSocket;
    const sessionId = current.data.sessionId;
    const existingRoom = rooms.attach(sessionId, current.id);
    if (existingRoom) {
      void (async () => {
        await current.join(existingRoom);
        current.emit("room:seat", {
          roomCode: existingRoom,
          seat: rooms.seatFor(sessionId, existingRoom),
        });
        publishRoom(existingRoom);
        sendCurrentView(existingRoom, sessionId);
        emitToOpponent(
          existingRoom,
          sessionId,
          "match:opponent-reconnected",
          {},
        );
      })();
    }

    current.on("room:create", async (raw: unknown, ack?: Ack) => {
      const parsed = RoomCreateSchema.safeParse(raw);
      if (!parsed.success)
        return reject(ack, "INVALID_REQUEST", "创建房间参数无效");
      try {
        const snapshot = rooms.createRoom(
          sessionId,
          parsed.data.bestOf,
          parsed.data.loadout as Loadout,
        );
        rooms.attach(sessionId, current.id);
        await current.join(snapshot.roomCode);
        current.emit("room:seat", { roomCode: snapshot.roomCode, seat: "A" });
        publishRoom(snapshot.roomCode);
        ack?.({ ok: true, room: snapshot, seat: "A" });
      } catch (error) {
        rejectError(ack, error);
      }
    });

    current.on("room:join", async (raw: unknown, ack?: Ack) => {
      const parsed = RoomJoinSchema.safeParse(raw);
      if (!parsed.success)
        return reject(ack, "INVALID_REQUEST", "加入房间参数无效");
      try {
        const snapshot = rooms.joinRoom(
          sessionId,
          parsed.data.roomCode,
          parsed.data.loadout as Loadout,
        );
        rooms.attach(sessionId, current.id);
        await current.join(snapshot.roomCode);
        current.emit("room:seat", { roomCode: snapshot.roomCode, seat: "B" });
        publishRoom(snapshot.roomCode);
        ack?.({ ok: true, room: snapshot, seat: "B" });
      } catch (error) {
        rejectError(ack, error);
      }
    });

    current.on("room:ready", (raw: unknown, ack?: Ack) => {
      const parsed = ReadySchema.safeParse(raw);
      if (!parsed.success)
        return reject(ack, "INVALID_REQUEST", "准备状态无效");
      const roomCode = rooms.roomFor(sessionId)?.code;
      if (!roomCode) return reject(ack, "NOT_IN_ROOM", "你当前不在房间中");
      try {
        const snapshot = rooms.setReady(sessionId, roomCode, parsed.data.ready);
        publishRoom(roomCode);
        publishMatchViews(roomCode);
        ack?.({ ok: true, room: snapshot });
      } catch (error) {
        rejectError(ack, error);
      }
    });

    current.on("match:request-snapshot", (_raw: unknown, ack?: Ack) => {
      const roomCode = rooms.roomFor(sessionId)?.code;
      if (!roomCode) return reject(ack, "NOT_IN_ROOM", "你当前不在房间中");
      try {
        const view = rooms.getView(sessionId, roomCode);
        current.emit("match:snapshot", { view });
        ack?.({ ok: true, view });
      } catch (error) {
        rejectError(ack, error);
      }
    });

    current.on("match:command", (raw: unknown, ack?: Ack) => {
      const parsed = MatchCommandSchema.safeParse(raw);
      if (!parsed.success)
        return reject(ack, "INVALID_REQUEST", "比赛命令参数无效");
      const roomCode = rooms.roomFor(sessionId)?.code;
      if (!roomCode) return reject(ack, "NOT_IN_ROOM", "你当前不在房间中");
      try {
        const view = rooms.command(
          sessionId,
          roomCode,
          parsed.data.clientCommandId,
          parsed.data.expectedVersion,
          parsed.data.command as OnlineGameCommand,
        );
        publishMatchViews(roomCode);
        ack?.({ ok: true, view });
      } catch (error) {
        rejectError(ack, error);
      }
    });

    current.on("disconnect", () => {
      const roomCode = rooms.detach(sessionId, current.id);
      if (roomCode) {
        publishRoom(roomCode);
        emitToOpponent(roomCode, sessionId, "match:opponent-disconnected", {
          graceSeconds: Number(process.env.DISCONNECT_GRACE_SECONDS ?? 60),
        });
      }
    });
  });

  function publishRoom(roomCode: string) {
    try {
      game.to(roomCode).emit("room:snapshot", {
        room: rooms.snapshotByCode(roomCode),
      });
    } catch {
      // A room may have expired between a disconnect and this notification.
    }
  }

  function publishMatchViews(roomCode: string) {
    for (const item of rooms.getPlayerViews(roomCode)) {
      if (item.socketId)
        game.to(item.socketId).emit("match:snapshot", { view: item.view });
    }
  }

  function sendCurrentView(roomCode: string, sessionId: string) {
    const socketId = rooms.socketFor(sessionId);
    if (!socketId) return;
    try {
      game.to(socketId).emit("room:snapshot", {
        room: rooms.snapshotByCode(roomCode),
      });
      if (rooms.snapshotByCode(roomCode).status !== "WAITING") {
        game.to(socketId).emit("match:snapshot", {
          view: rooms.getView(sessionId, roomCode),
        });
      }
    } catch {
      // The session may expire while a reconnect is being authenticated.
    }
  }

  function emitToOpponent(
    roomCode: string,
    sessionId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const opponentId = rooms
      .sessionIds(roomCode)
      .find((id) => id !== sessionId);
    const socketId = opponentId ? rooms.socketFor(opponentId) : null;
    if (socketId) game.to(socketId).emit(event, payload);
  }

  function rejectError(ack: Ack | undefined, error: unknown) {
    if (error instanceof OnlineRoomError)
      return reject(ack, error.code, error.message);
    if (error instanceof Error && "code" in error)
      return reject(ack, String(error.code), error.message);
    return reject(
      ack,
      "COMMAND_REJECTED",
      "命令无法执行，请同步比赛状态后重试",
    );
  }

  function reject(ack: Ack | undefined, code: string, message: string) {
    const result = { ok: false, error: code, message };
    ack?.(result);
    return result;
  }

  return { publishRoom, publishMatchViews };
}
