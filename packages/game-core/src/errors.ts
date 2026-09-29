export type GameRuleErrorCode =
  | "INVALID_MATCH_CONFIGURATION"
  | "UNKNOWN_PLAYER"
  | "STALE_VERSION"
  | "MATCH_FINISHED"
  | "INVALID_PHASE"
  | "INVALID_STAGE"
  | "INVALID_ALLOCATION"
  | "ALLOCATION_ALREADY_LOCKED"
  | "ALLOCATION_NOT_LOCKED"
  | "NOT_CURRENT_ATTACKER"
  | "UNKNOWN_SKILL_PAIR"
  | "NOT_READY_TO_ADVANCE";

export class GameRuleError extends Error {
  constructor(
    readonly code: GameRuleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GameRuleError";
  }
}
