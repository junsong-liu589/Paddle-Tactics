import cors from "@fastify/cors";
import Fastify from "fastify";
import { GAME_CORE_PACKAGE, GameRuleError } from "@paddle-tactics/game-core";
import { loadCatalog } from "@paddle-tactics/game-data";
import { z } from "zod";
import { prisma } from "./db/client.js";
import {
  SandboxAccessError,
  SandboxNotFoundError,
  SandboxService,
} from "./sandbox.js";
import { OnlineRoomService } from "./online.js";
import type { GuestSessionService } from "./online.js";

const StageSchema = z.enum(["service", "receive", "rally"]);
const GameCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ALLOCATE"),
    expectedVersion: z.number().int().nonnegative(),
    stage: StageSchema,
    allocations: z.record(z.string(), z.number().int().nonnegative()),
  }),
  z.object({
    type: z.literal("LOCK_ALLOCATION"),
    expectedVersion: z.number().int().nonnegative(),
    stage: StageSchema,
  }),
  z.object({
    type: z.literal("CHOOSE_ATTACK"),
    expectedVersion: z.number().int().nonnegative(),
    pairId: z.string().min(1),
  }),
  z.object({
    type: z.literal("ADVANCE"),
    expectedVersion: z.number().int().nonnegative(),
  }),
]);
const LoadoutSchema = z.object({
  playerId: z.string().min(1),
  bladeId: z.string().min(1),
  forehandRubberId: z.string().min(1),
  backhandRubberId: z.string().min(1),
});
const CreateSandboxSchema = z.object({
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  firstServerPlayerId: z.enum(["A", "B"]),
  playerA: z.object({ id: z.literal("A"), loadout: LoadoutSchema }),
  playerB: z.object({ id: z.literal("B"), loadout: LoadoutSchema }),
});
const CreateAiMatchSchema = CreateSandboxSchema.extend({
  difficulty: z.enum(["easy", "normal", "hard"]),
});
const MatchParamsSchema = z.object({ matchId: z.string().uuid() });
const ViewerQuerySchema = z.object({ viewerId: z.enum(["A", "B"]) });
const CommandBodySchema = z.object({
  actorId: z.enum(["A", "B"]),
  command: GameCommandSchema,
});

export async function buildApp(
  options: {
    sandbox?: SandboxService;
    logger?: boolean;
    guestSessions?: GuestSessionService;
    onlineRooms?: OnlineRoomService;
  } = {},
) {
  const app = Fastify({ logger: options.logger ?? true });
  const catalog = loadCatalog();
  const sandbox = options.sandbox ?? new SandboxService(catalog);
  const guestSessions = options.guestSessions;
  const onlineRooms = options.onlineRooms ?? new OnlineRoomService(catalog);
  const rateLimits = new Map<string, { startedAt: number; count: number }>();
  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    return payload;
  });

  const withinRateLimit = (key: string, limit: number, windowMs: number) => {
    const now = Date.now();
    if (rateLimits.size > 5000) {
      for (const [existingKey, bucket] of rateLimits)
        if (now - bucket.startedAt >= windowMs) rateLimits.delete(existingKey);
    }
    const bucket = rateLimits.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      rateLimits.set(key, { startedAt: now, count: 1 });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
  };

  app.get("/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        service: "paddle-tactics-server",
        database: "connected",
        gameCore: GAME_CORE_PACKAGE,
      };
    } catch {
      return reply.code(503).send({
        status: "error",
        service: "paddle-tactics-server",
        database: "unavailable",
      });
    }
  });

  app.get("/api/catalog", async () => ({
    version: catalog.balance.version,
    players: catalog.players,
    blades: catalog.blades,
    rubbers: catalog.rubbers,
    skills: catalog.skills,
    balance: catalog.balance,
  }));

  app.post("/api/guest-session", async (_request, reply) => {
    if (!withinRateLimit(`guest:${_request.ip}`, 15, 60_000))
      return reply.code(429).send({ error: "RATE_LIMITED" });
    if (!guestSessions)
      return reply.code(503).send({ error: "SESSION_SERVICE_UNAVAILABLE" });
    const identity = await guestSessions.create();
    return reply.code(201).send(identity);
  });

  app.get<{ Params: { roomCode: string } }>(
    "/api/rooms/:roomCode",
    async (request, reply) => {
      if (!withinRateLimit(`room:${request.ip}`, 90, 60_000))
        return reply.code(429).send({ error: "RATE_LIMITED" });
      try {
        return onlineRooms.snapshotByCode(request.params.roomCode);
      } catch (error) {
        if (error instanceof Error && "code" in error)
          return reply.code(404).send({ error: error.code });
        throw error;
      }
    },
  );

  app.post("/api/sandbox/matches", async (request, reply) => {
    const parsed = CreateSandboxSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: parsed.error.issues[0]?.message,
      });
    }
    try {
      return sandbox.create(parsed.data);
    } catch (error) {
      if (error instanceof Error) {
        return reply.code(400).send({
          error: "INVALID_MATCH_CONFIGURATION",
          message: error.message,
        });
      }
      throw error;
    }
  });

  app.post("/api/ai/matches", async (request, reply) => {
    const parsed = CreateAiMatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: parsed.error.issues[0]?.message,
      });
    }
    try {
      return sandbox.createAi(parsed.data);
    } catch (error) {
      if (error instanceof Error) {
        return reply.code(400).send({
          error: "INVALID_MATCH_CONFIGURATION",
          message: error.message,
        });
      }
      throw error;
    }
  });

  app.get<{
    Params: { matchId: string };
    Querystring: { viewerId: "A" | "B" };
  }>("/api/sandbox/matches/:matchId", async (request, reply) => {
    const params = MatchParamsSchema.safeParse(request.params);
    const query = ViewerQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(400).send({ error: "INVALID_REQUEST" });
    }
    try {
      return { view: sandbox.get(params.data.matchId, query.data.viewerId) };
    } catch (error) {
      if (error instanceof SandboxNotFoundError) {
        return reply.code(404).send({ error: "MATCH_NOT_FOUND" });
      }
      if (error instanceof SandboxAccessError) {
        return reply.code(403).send({ error: "VIEWER_FORBIDDEN" });
      }
      if (error instanceof Error) {
        return reply
          .code(400)
          .send({ error: "INVALID_VIEWER", message: error.message });
      }
      throw error;
    }
  });

  app.post<{
    Params: { matchId: string };
    Body: { actorId: "A" | "B"; command: z.infer<typeof GameCommandSchema> };
  }>("/api/sandbox/matches/:matchId/commands", async (request, reply) => {
    const params = MatchParamsSchema.safeParse(request.params);
    const body = CommandBodySchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "INVALID_REQUEST" });
    }
    try {
      return {
        view: sandbox.command(
          params.data.matchId,
          body.data.actorId,
          body.data.command,
        ),
      };
    } catch (error) {
      if (error instanceof SandboxNotFoundError) {
        return reply.code(404).send({ error: "MATCH_NOT_FOUND" });
      }
      if (error instanceof SandboxAccessError) {
        return reply.code(403).send({ error: "ACTOR_FORBIDDEN" });
      }
      if (error instanceof GameRuleError) {
        return reply
          .code(error.code === "STALE_VERSION" ? 409 : 400)
          .send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  return app;
}
