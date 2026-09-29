import { describe, expect, it } from "vitest";
import { loadCatalog, validateCatalog } from "./index.js";
import { PlayerSchema } from "./schema.js";

const catalog = loadCatalog();

describe("game data validation", () => {
  it("loads every baseline data file without modifying it", () => {
    expect(catalog.players.map((player) => player.id)).toHaveLength(8);
    expect(catalog.balance.version).toBe("balance_v1.1");
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
