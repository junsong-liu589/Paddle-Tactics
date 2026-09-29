import { Server as SocketIOServer } from "socket.io";
import { buildApp } from "./app.js";
import { prisma } from "./db/client.js";

const app = await buildApp();
const io = new SocketIOServer(app.server, {
  cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" },
});

io.of("/game").on("connection", (socket) => {
  app.log.info({ socketId: socket.id }, "Game namespace client connected");
});

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
