import { loadCatalog } from "@paddle-tactics/game-data";
import { Server as SocketIOServer } from "socket.io";
import { buildApp } from "./app.js";
import { prisma } from "./db/client.js";
import {
  GuestSessionService,
  OnlineRoomService,
  type SessionRecord,
} from "./online.js";
import { registerGameSockets } from "./socket.js";

const ioRef: { current?: SocketIOServer } = {};
const guestSessions = new GuestSessionService({
  async create(record: SessionRecord) {
    await prisma.guestSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await prisma.guestSession.create({ data: record });
  },
  async findByTokenHash(tokenHash) {
    return prisma.guestSession.findUnique({ where: { tokenHash } });
  },
});
const onlineRooms = new OnlineRoomService(
  loadCatalog(),
  Math.max(
    1,
    Math.min(600, Number(process.env.DISCONNECT_GRACE_SECONDS ?? 60)),
  ),
  (roomCode, winnerSessionId) => {
    if (!ioRef.current) return;
    const ids = onlineRooms.sessionIds(roomCode);
    const winnerPlayerId = ids[0] === winnerSessionId ? "A" : "B";
    ioRef.current.of("/game").to(roomCode).emit("match:forfeit", {
      roomCode,
      winnerPlayerId,
      reason: "disconnect_timeout",
    });
  },
);
const app = await buildApp({ guestSessions, onlineRooms });
const io = new SocketIOServer(app.server, {
  cors: {
    origin: (process.env.WEB_ORIGIN ?? "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim()),
  },
});
ioRef.current = io;
registerGameSockets(io, guestSessions, onlineRooms);

const port = Number(process.env.PORT ?? 3002);
await app.listen({ port, host: "0.0.0.0" });
app.log.info(`Server listening on port ${port}`);

const shutdown = async () => {
  io.close();
  await app.close();
  await prisma.$disconnect();
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
