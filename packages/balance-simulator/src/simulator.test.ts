import { describe, expect, it } from "vitest";
import {
  createMatch,
  derivePublicView,
  resolveBattleComparison,
  resolveGamePoint,
  resolveRallyTieBreak,
  type GameRulesCatalog,
} from "@paddle-tactics/game-core";
import { loadCatalog } from "@paddle-tactics/game-data";
import {
  runCandidateMatch,
  runCandidateV3Match,
  runCandidateV4Match,
  runLegacyMatch,
} from "./engine.js";
import { seededRandom } from "./random.js";
import { BASELINE_PARAMETERS } from "./parameters.js";
import { wilsonInterval } from "./reports.js";
import { runSimulation } from "./runner.js";
import { allocateForCore } from "./bots.js";

const catalog = loadCatalog() as GameRulesCatalog;
const loadout = {
  playerId: catalog.players[0]!.id,
  bladeId: catalog.blades[0]!.id,
  forehandRubberId: catalog.rubbers[0]!.id,
  backhandRubberId: catalog.rubbers[1]!.id,
};

describe("balance simulator", () => {
  it("uses game-core comparison and score boundary semantics", () => {
    expect(resolveBattleComparison(10, 5, 5, false).outcome).toBe(
      "attacker_wins",
    );
    expect(resolveBattleComparison(10, 14, 4, true).outcome).toBe(
      "defender_wins",
    );
    expect(
      resolveGamePoint({ A: 10, B: 10 }, "A", catalog.balance.scoring),
    ).toMatchObject({ score: { A: 11, B: 10 }, gameWon: false, deuce: true });
    expect(resolveRallyTieBreak([0, 0, 0, 0, 0], ["A", "B"], "A")).toBe("B");
  });

  it("replays the same match outcome under the same seed", () => {
    const common = {
      catalog,
      loadoutA: loadout,
      loadoutB: { ...loadout },
      policyA: "BalancedBot" as const,
      policyB: "RandomBot" as const,
      firstServerA: true,
      random: seededRandom(42),
    };
    const first = runLegacyMatch(common);
    const second = runLegacyMatch({ ...common, random: seededRandom(42) });
    expect(first).toEqual(second);
  });

  it("runs legal fixed-bonus candidate and legacy matches", () => {
    const common = {
      catalog,
      loadoutA: loadout,
      loadoutB: { ...loadout },
      policyA: "AdaptiveBot" as const,
      policyB: "BluffDefenseBot" as const,
      firstServerA: false,
      random: seededRandom(20260928),
    };
    expect(["A", "B", null]).toContain(
      runCandidateMatch(common, BASELINE_PARAMETERS).winner,
    );
    expect(["A", "B", null]).toContain(
      runLegacyMatch({ ...common, random: seededRandom(20260928) }).winner,
    );
  });

  it("runs Candidate V3 through the reducer and is deterministic", () => {
    const common = {
      catalog,
      loadoutA: loadout,
      loadoutB: { ...loadout },
      policyA: "Top3AwareDefenseBot" as const,
      policyB: "FortressBot" as const,
      firstServerA: true,
    };
    const first = runCandidateV3Match({ ...common, random: seededRandom(122) });
    const second = runCandidateV3Match({
      ...common,
      random: seededRandom(122),
    });
    expect(first).toEqual(second);
    expect(["A", "B", null]).toContain(first.winner);
  });

  it("runs V4 resource policies deterministically with legal carry budgets", () => {
    const common = {
      catalog,
      loadoutA: loadout,
      loadoutB: { ...loadout },
      policyA: "SaveForRallyBot" as const,
      policyB: "SaveForRallyBot" as const,
      firstServerA: true,
    };
    const first = runCandidateV4Match({ ...common, random: seededRandom(731) });
    const second = runCandidateV4Match({
      ...common,
      random: seededRandom(731),
    });
    expect(first).toEqual(second);
    expect(["A", "B", null]).toContain(first.winner);
    expect(first.resourceMetrics?.rallyBudget.length).toBeGreaterThan(0);
    expect(
      first.resourceMetrics?.attackSpend.service.every((points) => points <= 4),
    ).toBe(true);
    expect(
      first.resourceMetrics?.defenseSpend.service.every(
        (points) => points <= 10,
      ),
    ).toBe(true);
  });

  it("creates legal player-loadout states through the official rules core", () => {
    expect(
      createMatch({
        id: "sim-test",
        bestOf: 1,
        firstServerPlayerId: "A",
        playerA: { id: "A", loadout },
        playerB: { id: "B", loadout },
        catalog,
      }).rules.version,
    ).toBe(catalog.balance.version);
  });

  it("gives bot allocation policies only a viewer public view", () => {
    const state = createMatch({
      id: "bot-public-view",
      bestOf: 1,
      firstServerPlayerId: "A",
      playerA: { id: "A", loadout },
      playerB: { id: "B", loadout },
      catalog,
    });
    const view = derivePublicView(state, "A");
    expect(view.opponent).not.toHaveProperty("allocation");
    expect(view.opponent).not.toHaveProperty("hiddenAllocations");
    const allocation = allocateForCore(
      "WeaknessHunterBot",
      view,
      catalog,
      "service",
      new Map(),
      seededRandom(9),
    );
    expect(
      Object.values(allocation).reduce((sum, value) => sum + value, 0),
    ).toBe(catalog.balance.service.budget);
    expect(
      Object.values(allocation).every(
        (value) => value <= catalog.balance.service.perItemCap,
      ),
    ).toBe(true);
  });

  it("keeps seeded run data deterministic and confidence intervals bounded", () => {
    const options = {
      preset: "quick" as const,
      seed: 77123,
      matches: 4,
      experimentMatches: 0,
      mode: "equipment" as const,
    };
    const first = runSimulation(catalog, options);
    const second = runSimulation(catalog, options);
    expect(first.modes.legacy.wins).toEqual(second.modes.legacy.wins);
    expect(first.modes.candidate.wins).toEqual(second.modes.candidate.wins);
    expect(first.modes.candidateV4.wins).toEqual(second.modes.candidateV4.wins);
    expect(wilsonInterval(2, 4)).toEqual([
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(wilsonInterval(2, 4)[0]).toBeGreaterThanOrEqual(0);
    expect(wilsonInterval(2, 4)[1]).toBeLessThanOrEqual(1);
  });

  it("counts legacy rally tie-break events revealed by the fifth comparison", () => {
    const result = runSimulation(catalog, {
      preset: "quick",
      seed: 20260928,
      matches: 100,
      experimentMatches: 0,
      mode: "equipment",
    });
    expect(result.modes.legacy.rallyTieBreaks).toBeGreaterThan(0);
  });
});
