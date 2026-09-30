import {
  calculateLoadoutStats,
  calculateProjectBattleValues,
} from "@paddle-tactics/game-core";
import type { Loadout } from "@paddle-tactics/game-core";
import type { PublicCatalog } from "./catalog.js";

export type ShowcaseDimension = {
  id: string;
  label: string;
  score: number;
};

/** Map display scores onto a linear 3–13 radar radius without changing stats. */
export function radarFillRatio(score: number): number {
  return Math.max(0, Math.min(1, (score - 3) / 10));
}

const stageLabels = ["发球", "反制", "相持"] as const;
const roleLabels = ["attack", "defense"] as const;

/** Presentation-only ratings derived from current loadout battle values. */
export function getShowcaseDimensions(
  loadout: Loadout,
  catalog: PublicCatalog,
): ShowcaseDimension[] {
  const values = calculateProjectBattleValues(
    calculateLoadoutStats(loadout, catalog),
  );
  return stageLabels.flatMap((stageLabel, stageIndex) => {
    const stageId = (["service", "receive", "rally"] as const)[stageIndex]!;
    return roleLabels.map((role) => {
      const keys = catalog.skills.stages[stageId].pairs.map((pair) => pair.id);
      const average =
        keys.reduce((total, key) => total + values[key]![role], 0) /
        keys.length;
      return {
        id: `${stageId}-${role}`,
        label: `${stageLabel}${role === "attack" ? "攻击" : "防守"}`,
        score:
          Math.round((average / catalog.balance.constantStatMax) * 20 * 10) /
          10,
      };
    });
  });
}
