import { GameRuleError } from "./errors.js";
import type { GameRulesCatalog } from "./types.js";
import type {
  ConstantStats,
  Loadout,
  ProjectBattleValues,
  Role,
  Side,
  SideValues,
} from "./types.js";

function modifierTotal(
  gear:
    GameRulesCatalog["blades"][number] | GameRulesCatalog["rubbers"][number],
  pairId: string,
  role: Role,
): number {
  return gear.modifiers
    .filter((modifier) => modifier.pairId === pairId && modifier.role === role)
    .reduce((total, modifier) => total + modifier.value, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateLoadoutStats(
  loadout: Loadout,
  catalog: GameRulesCatalog,
): ConstantStats {
  const player = catalog.players.find((entry) => entry.id === loadout.playerId);
  const blade = catalog.blades.find((entry) => entry.id === loadout.bladeId);
  const forehandRubber = catalog.rubbers.find(
    (entry) => entry.id === loadout.forehandRubberId,
  );
  const backhandRubber = catalog.rubbers.find(
    (entry) => entry.id === loadout.backhandRubberId,
  );
  if (!player || !blade || !forehandRubber || !backhandRubber) {
    throw new GameRuleError(
      "INVALID_MATCH_CONFIGURATION",
      "Loadout references an unknown player or piece of equipment",
    );
  }

  const rubbers: Record<Side, typeof forehandRubber> = {
    forehand: forehandRubber,
    backhand: backhandRubber,
  };
  const stats: ConstantStats = {};
  for (const [pairId, pairStats] of Object.entries(player.stats)) {
    stats[pairId] = { attack: {} as SideValues, defense: {} as SideValues };
    for (const role of ["attack", "defense"] as const) {
      for (const side of ["forehand", "backhand"] as const) {
        const base = pairStats[role][side];
        const bladeModifier = modifierTotal(blade, pairId, role);
        const rubberModifier = modifierTotal(rubbers[side], pairId, role);
        stats[pairId][role][side] = clamp(
          base + bladeModifier + rubberModifier,
          catalog.balance.constantStatMin,
          catalog.balance.constantStatMax,
        );
      }
    }
  }
  return stats;
}

export function calculateProjectBattleValues(
  constantStats: ConstantStats,
): ProjectBattleValues {
  const result: ProjectBattleValues = {};
  for (const [pairId, roles] of Object.entries(constantStats)) {
    result[pairId] = {
      attack: (roles.attack.forehand + roles.attack.backhand) / 2,
      defense: (roles.defense.forehand + roles.defense.backhand) / 2,
    };
  }
  return result;
}
