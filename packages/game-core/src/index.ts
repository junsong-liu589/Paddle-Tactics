export { GameRuleError } from "./errors.js";
export {
  allocationSkillKey,
  applyCommand,
  createMatch,
  DEFAULT_CANDIDATE_V3_SETTINGS,
  DEFAULT_CANDIDATE_V4_SETTINGS,
  getAllocationSkillKeys,
  resolveBattleComparison,
  resolveCandidateV3Comparison,
  resolveCandidateV4RallyTieBreak,
  resolveGamePoint,
  resolveRallyTieBreak,
} from "./match.js";
export {
  calculateLoadoutStats,
  calculateProjectBattleValues,
} from "./loadout.js";
export { derivePublicView } from "./public-view.js";
export { getServerForNextPoint, isDeuceScore } from "./serve.js";
export type * from "./types.js";

/** Stable package identifier retained for the Phase 0 health response. */
export const GAME_CORE_PACKAGE = "@paddle-tactics/game-core";
