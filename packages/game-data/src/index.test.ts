import { describe, expect, it } from "vitest";
import { loadCatalog, validateCatalog } from "./index.js";
import { PlayerSchema } from "./schema.js";

const catalog = loadCatalog();

describe("game data validation", () => {
  it("loads the active Candidate V4 catalog", () => {
    expect(catalog.players.map((player) => player.id)).toHaveLength(8);
    expect(catalog.balance.version).toBe("candidate_v4.1");
    expect(catalog.players.map((player) => player.style)).toHaveLength(8);
  });

  it("keeps each player within one 10 and one 9 per stage and hand", () => {
    for (const player of catalog.players) {
      for (const stage of Object.values(catalog.skills.stages)) {
        for (const side of ["forehand", "backhand"] as const) {
          const values = stage.pairs.flatMap((pair) => [
            player.stats[pair.id]!.attack[side],
            player.stats[pair.id]!.defense[side],
          ]);
          expect(values.filter((value) => value === 10)).toHaveLength(1);
          expect(values.filter((value) => value === 9)).toHaveLength(1);
          expect(values.filter((value) => value > 8)).toHaveLength(2);
        }
      }
    }
  });

  it("preserves Lin Gaoyuan's counterplay profile at 480-tier level", () => {
    const sumStage = (playerId: string, stageId: "receive") =>
      catalog.skills.stages[stageId].pairs.reduce((sum, pair) => {
        const stats = catalog.players.find((player) => player.id === playerId)!
          .stats[pair.id]!;
        return (
          sum +
          stats.attack.forehand +
          stats.attack.backhand +
          stats.defense.forehand +
          stats.defense.backhand
        );
      }, 0);
    const linCounter = sumStage("lin-gaoyuan", "receive");
    expect(linCounter).toBeGreaterThanOrEqual(sumStage("ma-long", "receive"));
    expect(linCounter).toBeGreaterThanOrEqual(
      sumStage("fan-zhendong", "receive"),
    );
  });

  it("rejects player stat values outside the source-data schema", () => {
    const player = structuredClone(catalog.players[0]!);
    player.stats[Object.keys(player.stats)[0]!]!.attack.forehand = 11;
    expect(() => PlayerSchema.parse(player)).toThrow();
  });

  it("rejects duplicate player identifiers", () => {
    const bad = structuredClone(catalog);
    bad.players[1]!.id = bad.players[0]!.id;
    expect(() => validateCatalog(bad)).toThrow(/duplicate IDs/);
  });

  it("rejects changed player totals against the approved baseline", () => {
    const bad = structuredClone(catalog);
    bad.players[0]!.baseTotal += 1;
    expect(() => validateCatalog(bad)).toThrow(/baseTotal/);
  });

  it("rejects mismatched balance and skill data versions", () => {
    const bad = structuredClone(catalog);
    bad.balance.version = "other-version";
    expect(() => validateCatalog(bad)).toThrow(/version/);
  });

  it("rejects gear modifiers pointing at an unknown skill pair", () => {
    const bad = structuredClone(catalog);
    bad.blades[0]!.modifiers.push({
      pairId: "unknown",
      role: "attack",
      skillName: "unknown",
      value: 1,
    });
    expect(() => validateCatalog(bad)).toThrow(/unknown pair/);
  });

  it("rejects a tie-break order that changes approved rules", () => {
    const bad = structuredClone(catalog);
    bad.balance.rallyTieBreak.reverse();
    expect(() => validateCatalog(bad)).toThrow(/tie-break order/);
  });
});
