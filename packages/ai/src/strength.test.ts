import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createMatch,
  DEFAULT_CANDIDATE_V4_SETTINGS,
  derivePublicView,
} from "@paddle-tactics/game-core";
import type { MatchState } from "@paddle-tactics/game-core";
import { loadCatalog } from "@paddle-tactics/game-data";
import {
  chooseAiAllocation,
  chooseAiAttack,
  type AiDifficulty,
} from "./index.js";

const catalog = loadCatalog();

function runBotMatch(
  difficultyA: AiDifficulty,
  difficultyB: AiDifficulty,
  firstServer: "A" | "B",
  seed: number,
): "A" | "B" | null {
  const gear = {
    bladeId: catalog.blades[0]!.id,
    forehandRubberId: catalog.rubbers[0]!.id,
    backhandRubberId: catalog.rubbers[0]!.id,
  };
  let state: MatchState = createMatch({
    id: `difficulty-${seed}`,
    bestOf: 1,
    firstServerPlayerId: firstServer,
    playerA: {
      id: "A",
      loadout: {
        playerId: catalog.players[seed % catalog.players.length]!.id,
        ...gear,
      },
    },
    playerB: {
      id: "B",
      loadout: {
        playerId: catalog.players[(seed * 5 + 1) % catalog.players.length]!.id,
        ...gear,
      },
    },
    catalog,
    candidateV4: DEFAULT_CANDIDATE_V4_SETTINGS,
  });

  for (let step = 0; state.status !== "COMPLETED" && step < 500; step += 1) {
    const publicView = derivePublicView(state, "A");
    if (publicView.phase.endsWith("_ALLOCATING")) {
      for (const playerId of ["A", "B"] as const) {
        const view = derivePublicView(state, playerId);
        if (view.self.allocationLocked) continue;
        const input = {
          view,
          skills: catalog.skills,
          difficulty: playerId === "A" ? difficultyA : difficultyB,
          seed: seed + step * 7 + playerId.charCodeAt(0),
        };
        const allocated = applyCommand(state, playerId, {
          type: "ALLOCATE",
          expectedVersion: state.version,
          stage: view.point.stage,
          allocations: chooseAiAllocation(input),
        });
        state = applyCommand(allocated.state, playerId, {
          type: "LOCK_ALLOCATION",
          expectedVersion: allocated.state.version,
          stage: view.point.stage,
        }).state;
      }
    } else if (publicView.phase.endsWith("_SELECTING")) {
      const playerId = publicView.point.attackerPlayerId;
      const view = derivePublicView(state, playerId);
      state = applyCommand(state, playerId, {
        type: "CHOOSE_ATTACK",
        expectedVersion: state.version,
        pairId: chooseAiAttack({
          view,
          skills: catalog.skills,
          difficulty: playerId === "A" ? difficultyA : difficultyB,
          seed: seed + step * 11,
        }),
      }).state;
    } else {
      state = applyCommand(state, "A", {
        type: "ADVANCE",
        expectedVersion: state.version,
      }).state;
    }
  }
  return state.winnerPlayerId === "A" || state.winnerPlayerId === "B"
    ? state.winnerPlayerId
    : null;
}

describe("difficulty matchup sanity check", () => {
  it("stronger policy tiers win more often with mirrored seats and first servers", () => {
    for (const [higher, lower] of [
      ["hard", "normal"],
      ["normal", "easy"],
      ["hard", "easy"],
    ] as const) {
      let higherWins = 0;
      for (let index = 0; index < 60; index += 1) {
        const higherId = index % 2 === 0 ? "B" : "A";
        const firstServer = Math.floor(index / 2) % 2 === 0 ? "A" : "B";
        const winner = runBotMatch(
          higherId === "A" ? higher : lower,
          higherId === "B" ? higher : lower,
          firstServer,
          1500 + index,
        );
        if (winner === higherId) higherWins += 1;
      }
      expect(higherWins, `${higher} vs ${lower}`).toBeGreaterThan(30);
    }
  });
});
