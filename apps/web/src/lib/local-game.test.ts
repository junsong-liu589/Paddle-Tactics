import { describe, expect, it } from "vitest";
import type { GameCommand } from "@paddle-tactics/game-core";
import { browserCatalog } from "./catalog.js";
import {
  createLocalAiMatch,
  createLocalMatch,
  getLocalMatchView,
  LocalMatchAccessError,
  sendLocalMatchCommand,
  type LocalMatchSetup,
} from "./local-game.js";

const setup: LocalMatchSetup = {
  bestOf: 1,
  firstServerPlayerId: "A",
  playerA: {
    id: "A",
    loadout: {
      playerId: browserCatalog.players[0]!.id,
      bladeId: browserCatalog.blades[0]!.id,
      forehandRubberId: browserCatalog.rubbers[0]!.id,
      backhandRubberId: browserCatalog.rubbers[0]!.id,
    },
  },
  playerB: {
    id: "B",
    loadout: {
      playerId: browserCatalog.players[1]!.id,
      bladeId: browserCatalog.blades[0]!.id,
      forehandRubberId: browserCatalog.rubbers[0]!.id,
      backhandRubberId: browserCatalog.rubbers[0]!.id,
    },
  },
};

describe("browser-local matches", () => {
  it("creates a Candidate V4 local match without requesting a server", () => {
    const match = createLocalMatch(setup);
    expect(match.view.rulesetId).toBe("candidate_v4");
    expect(match.view.phase).toBe("SERVICE_ALLOCATING");
    expect(match.view.opponent).not.toHaveProperty("allocation");
  });

  it("runs the AI from its own viewer-specific public view", () => {
    const match = createLocalAiMatch({ ...setup, difficulty: "hard" });
    expect(match.view.phase).toBe("SERVICE_ALLOCATING");
    expect(match.view.opponent.allocationLocked).toBe(true);
    expect(match.view.opponent).not.toHaveProperty("allocation");
    expect(() => getLocalMatchView(match.matchId, "B")).toThrow(
      LocalMatchAccessError,
    );
  });

  it("processes commands and keeps hot-seat views isolated", () => {
    const match = createLocalMatch(setup);
    const viewA = match.view;
    const attackKey = `${browserCatalog.skills.stages.service.pairs[0]!.id}.attack`;
    const allocation: Record<string, number> = Object.fromEntries(
      browserCatalog.skills.stages.service.pairs.map((pair) => [
        `${pair.id}.attack`,
        pair.id === attackKey.split(".")[0] ? 4 : 0,
      ]),
    );
    const allocate: GameCommand = {
      type: "ALLOCATE",
      expectedVersion: viewA.version,
      stage: "service",
      allocations: allocation,
    };
    const afterAllocate = sendLocalMatchCommand(match.matchId, "A", allocate);
    const afterLock = sendLocalMatchCommand(match.matchId, "A", {
      type: "LOCK_ALLOCATION",
      expectedVersion: afterAllocate.version,
      stage: "service",
    });

    expect(afterLock.opponent).not.toHaveProperty("allocation");
    const viewB = getLocalMatchView(match.matchId, "B").view;
    expect(viewB.self.allocationLocked).toBe(false);
    expect(viewB.opponent.allocationLocked).toBe(true);
    expect(viewB.opponent).not.toHaveProperty("allocation");
  });
});
