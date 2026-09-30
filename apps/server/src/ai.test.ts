import { afterEach, describe, expect, it } from "vitest";
import { chooseAiAllocation, chooseAiAttack } from "@paddle-tactics/ai";
import type { AiDifficulty } from "@paddle-tactics/ai";
import type { GameCommand, MatchPublicView } from "@paddle-tactics/game-core";
import { loadCatalog } from "@paddle-tactics/game-data";
import { buildApp } from "./app.js";

const catalog = loadCatalog();
const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

function setup() {
  const gear = {
    bladeId: catalog.blades[0]!.id,
    forehandRubberId: catalog.rubbers[0]!.id,
    backhandRubberId: catalog.rubbers[0]!.id,
  };
  return {
    bestOf: 1 as const,
    firstServerPlayerId: "A" as const,
    playerA: {
      id: "A" as const,
      loadout: { playerId: catalog.players[0]!.id, ...gear },
    },
    playerB: {
      id: "B" as const,
      loadout: { playerId: catalog.players[1]!.id, ...gear },
    },
  };
}

function aiInput(
  view: MatchPublicView,
  difficulty: AiDifficulty,
  seed: number,
) {
  return { view, skills: catalog.skills, difficulty, seed };
}

describe("AI single-player API", () => {
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it.each(["easy", "normal", "hard"] as const)(
    "%s completes a BO1 through server-only AI commands without exposing its allocation",
    async (difficulty) => {
      const app = await buildApp({ logger: false });
      apps.push(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/ai/matches",
        payload: { ...setup(), difficulty },
      });
      expect(created.statusCode).toBe(200);
      const createdBody = created.json<{
        matchId: string;
        view: MatchPublicView;
      }>();
      const matchId = createdBody.matchId;
      expect(createdBody.view.opponent.allocationLocked).toBe(true);
      expect(createdBody.view.opponent).not.toHaveProperty("allocation");

      const forbiddenView = await app.inject({
        method: "GET",
        url: `/api/sandbox/matches/${matchId}?viewerId=B`,
      });
      expect(forbiddenView.statusCode).toBe(403);
      const forbiddenCommand = await app.inject({
        method: "POST",
        url: `/api/sandbox/matches/${matchId}/commands`,
        payload: {
          actorId: "B",
          command: {
            type: "ADVANCE",
            expectedVersion: createdBody.view.version,
          },
        },
      });
      expect(forbiddenCommand.statusCode).toBe(403);

      for (let step = 0; step < 400; step += 1) {
        const snapshot = await app.inject({
          method: "GET",
          url: `/api/sandbox/matches/${matchId}?viewerId=A`,
        });
        const view = snapshot.json<{ view: MatchPublicView }>().view;
        expect(view.opponent).not.toHaveProperty("allocation");
        if (view.status === "COMPLETED") break;

        let command: GameCommand;
        if (view.phase.endsWith("_ALLOCATING")) {
          const allocation = chooseAiAllocation(
            aiInput(view, difficulty, step + 101),
          );
          const allocate = await app.inject({
            method: "POST",
            url: `/api/sandbox/matches/${matchId}/commands`,
            payload: {
              actorId: "A",
              command: {
                type: "ALLOCATE",
                expectedVersion: view.version,
                stage: view.point.stage,
                allocations: allocation,
              },
            },
          });
          expect(allocate.statusCode).toBe(200);
          const allocatedView = allocate.json<{ view: MatchPublicView }>().view;
          command = {
            type: "LOCK_ALLOCATION",
            expectedVersion: allocatedView.version,
            stage: view.point.stage,
          };
        } else if (view.phase.endsWith("_SELECTING")) {
          expect(view.point.attackerPlayerId).toBe("A");
          command = {
            type: "CHOOSE_ATTACK",
            expectedVersion: view.version,
            pairId: chooseAiAttack(aiInput(view, difficulty, step + 103)),
          };
        } else {
          expect(["POINT_END", "GAME_END"]).toContain(view.phase);
          command = { type: "ADVANCE", expectedVersion: view.version };
        }

        const response = await app.inject({
          method: "POST",
          url: `/api/sandbox/matches/${matchId}/commands`,
          payload: { actorId: "A", command },
        });
        expect(response.statusCode).toBe(200);
      }

      const final = await app.inject({
        method: "GET",
        url: `/api/sandbox/matches/${matchId}?viewerId=A`,
      });
      expect(final.json<{ view: MatchPublicView }>().view.status).toBe(
        "COMPLETED",
      );
    },
  );
});
