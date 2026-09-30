import { beforeEach, describe, expect, it } from "vitest";
import { loadCatalog } from "@paddle-tactics/game-data";
import { buildApp } from "./app.js";

const catalog = loadCatalog();
const sandboxSetup = {
  bestOf: 1 as const,
  firstServerPlayerId: "A" as const,
  playerA: {
    id: "A" as const,
    loadout: {
      playerId: catalog.players[0]!.id,
      bladeId: catalog.blades[0]!.id,
      forehandRubberId: catalog.rubbers[0]!.id,
      backhandRubberId: catalog.rubbers[0]!.id,
    },
  },
  playerB: {
    id: "B" as const,
    loadout: {
      playerId: catalog.players[1]!.id,
      bladeId: catalog.blades[0]!.id,
      forehandRubberId: catalog.rubbers[0]!.id,
      backhandRubberId: catalog.rubbers[0]!.id,
    },
  },
};

describe("local sandbox HTTP API", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("creates a match and returns only the viewer's public allocation", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/sandbox/matches",
      payload: sandboxSetup,
    });
    expect(created.statusCode).toBe(200);
    const { matchId } = created.json<{ matchId: string }>();
    const initialView = created.json<{
      view: {
        version: number;
        rulesetId: string;
        availableBudget: number;
        point: { stage: "service" };
      };
    }>().view;
    expect(initialView.rulesetId).toBe("candidate_v4");
    const keys = catalog.skills.stages.service.pairs.map(
      (pair) => `${pair.id}.attack`,
    );
    const allocation = Object.fromEntries(keys.map((key) => [key, 0]));
    allocation[keys[0]!] = 3;

    const allocated = await app.inject({
      method: "POST",
      url: `/api/sandbox/matches/${matchId}/commands`,
      payload: {
        actorId: "A",
        command: {
          type: "ALLOCATE",
          expectedVersion: initialView.version,
          stage: "service",
          allocations: allocation,
        },
      },
    });
    expect(allocated.statusCode).toBe(200);
    const allocatedView = allocated.json<{ view: { version: number } }>().view;
    const locked = await app.inject({
      method: "POST",
      url: `/api/sandbox/matches/${matchId}/commands`,
      payload: {
        actorId: "A",
        command: {
          type: "LOCK_ALLOCATION",
          expectedVersion: allocatedView.version,
          stage: "service",
        },
      },
    });
    expect(locked.statusCode).toBe(200);
    const bView = await app.inject({
      method: "GET",
      url: `/api/sandbox/matches/${matchId}?viewerId=B`,
    });
    const bPublic = bView.json<{
      view: {
        self: { allocation: Record<string, number> | null };
        opponent: Record<string, unknown>;
      };
    }>().view;
    expect(bPublic.self.allocation).toBeNull();
    expect(bPublic.opponent).not.toHaveProperty("allocation");
    expect(bPublic.opponent).not.toHaveProperty("constantStats");

    const aView = await app.inject({
      method: "GET",
      url: `/api/sandbox/matches/${matchId}?viewerId=A`,
    });
    const aPublic = aView.json<{
      view: {
        self: { allocation: Record<string, number> | null };
        reservePoints: number;
      };
    }>().view;
    expect(aPublic.self.allocation).toEqual(allocation);
    expect(aPublic.reservePoints).toBe(0);
    await app.close();
  });

  it("rejects malformed and stale commands with explicit client errors", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/sandbox/matches",
      payload: sandboxSetup,
    });
    const { matchId, view } = created.json<{
      matchId: string;
      view: { version: number };
    }>();
    const malformed = await app.inject({
      method: "POST",
      url: `/api/sandbox/matches/${matchId}/commands`,
      payload: { actorId: "A", command: { type: "UNKNOWN" } },
    });
    expect(malformed.statusCode).toBe(400);
    const stale = await app.inject({
      method: "POST",
      url: `/api/sandbox/matches/${matchId}/commands`,
      payload: {
        actorId: "A",
        command: {
          type: "ALLOCATE",
          expectedVersion: view.version + 1,
          stage: "service",
          allocations: {},
        },
      },
    });
    expect(stale.statusCode).toBe(409);
    await app.close();
  });

  it("serves the approved catalog snapshot", async () => {
    const response = await app.inject({ method: "GET", url: "/api/catalog" });
    expect(response.statusCode).toBe(200);
    expect(
      response.json<{ players: unknown[]; balance: { version: string } }>()
        .players,
    ).toHaveLength(8);
    expect(
      response.json<{ balance: { version: string } }>().balance.version,
    ).toBe("candidate_v4.1");
    await app.close();
  });
});
