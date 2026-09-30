import { beforeAll, describe, expect, it } from "vitest";
import {
  createMatch,
  DEFAULT_CANDIDATE_V4_SETTINGS,
  derivePublicView,
} from "@paddle-tactics/game-core";
import type { MatchState } from "@paddle-tactics/game-core";
import { loadCatalog } from "@paddle-tactics/game-data";
import {
  chooseAiAllocation,
  chooseAiAttack,
  type AiDecisionInput,
} from "./index.js";

const catalog = loadCatalog();
let match: MatchState;

beforeAll(() => {
  const gear = {
    bladeId: catalog.blades[0]!.id,
    forehandRubberId: catalog.rubbers[0]!.id,
    backhandRubberId: catalog.rubbers[0]!.id,
  };
  match = createMatch({
    id: "phase-4-ai-test",
    bestOf: 1,
    firstServerPlayerId: "A",
    playerA: {
      id: "A",
      loadout: { playerId: catalog.players[0]!.id, ...gear },
    },
    playerB: {
      id: "B",
      loadout: { playerId: catalog.players[1]!.id, ...gear },
    },
    catalog,
    candidateV4: DEFAULT_CANDIDATE_V4_SETTINGS,
  });
});

function input(
  viewer: "A" | "B",
  difficulty: AiDecisionInput["difficulty"],
  seed = 1,
): AiDecisionInput {
  return {
    view: derivePublicView(match, viewer),
    skills: catalog.skills,
    difficulty,
    seed,
  };
}

describe("AI decision policies", () => {
  it.each(["easy", "normal", "hard"] as const)(
    "%s returns a legal, reproducible allocation from its viewer-specific public view",
    (difficulty) => {
      const decision = input("B", difficulty, 456);
      const first = chooseAiAllocation(decision);
      const second = chooseAiAllocation(decision);
      const legalDefenseKeys = new Set(
        catalog.skills.stages.service.pairs.map((pair) => `${pair.id}.defense`),
      );
      expect(first).toEqual(second);
      expect(
        Object.entries(first).every(([key]) => legalDefenseKeys.has(key)),
      ).toBe(true);
      expect(
        Object.values(first).reduce((sum, points) => sum + points, 0),
      ).toBeLessThanOrEqual(decision.view.availableBudget);
      expect(decision.view.opponent).not.toHaveProperty("allocation");
    },
  );

  it("chooses only a valid attack pair when the AI is the attacker", () => {
    const decision = input("A", "hard");
    const selected = chooseAiAttack(decision);
    expect(
      catalog.skills.stages.service.pairs.map((pair) => pair.id),
    ).toContain(selected);
  });

  it("refuses to choose an attack for a player who is not attacking", () => {
    expect(() => chooseAiAttack(input("B", "normal"))).toThrow(
      "AI can only select an attack",
    );
  });
});
