import type {
  BalanceConfig,
  GameCatalog,
  Role,
  Side,
  SkillCatalog,
  Stage,
} from "@paddle-tactics/game-data";

export type { Role, Side, Stage };
/** Runtime catalog data needed by the game engine; validation metadata is not required. */
export type GameRulesCatalog = Pick<
  GameCatalog,
  "players" | "blades" | "rubbers" | "skills" | "balance"
>;
export type PlayerId = string;
export type Loadout = {
  playerId: string;
  bladeId: string;
  forehandRubberId: string;
  backhandRubberId: string;
};
export type Allocation = Record<string, number>;
export type SideValues = Record<Side, number>;
export type RoleValues = Record<Role, SideValues>;
export type ConstantStats = Record<string, RoleValues>;
export type ProjectBattleValues = Record<string, Record<Role, number>>;

export type MatchPhase =
  | "SERVICE_ALLOCATING"
  | "SERVICE_SELECTING"
  | "RECEIVE_ALLOCATING"
  | "RECEIVE_SELECTING"
  | "RALLY_ALLOCATING"
  | "RALLY_SELECTING"
  | "POINT_END"
  | "GAME_END"
  | "MATCH_END";

export type CandidateV3Settings = {
  attackBonus: number;
  defensePool: number;
  defenderVisibleTopK: number;
  serviceThreshold: number;
  counterThreshold: number;
  rallyThreshold: number;
  rallyMaxComparisons: number;
  explorationEpsilon: number;
};

export type CandidateV4Settings = {
  serviceAttackBudget: number;
  serviceDefenseBudget: number;
  counterAttackBudget: number;
  counterDefenseBudget: number;
  rallyBudget: number;
  attackCap: number;
  serviceThreshold: number;
  counterThreshold: number;
  defenderVisibleTopK: number;
  rallyThreshold: number;
  rallyMaxComparisons: number;
  carryRatePercent: number;
  explorationEpsilon: number;
};

export type MatchRulesetId = "legacy_v1" | "candidate_v3" | "candidate_v4";
type MatchStageConfig = Omit<SkillCatalog["stages"][Stage], "perItemCap"> & {
  perItemCap: number | null;
};
export type MatchStageConfigs = Record<Stage, MatchStageConfig>;

export type StageRules = {
  rulesetId: MatchRulesetId;
  version: string;
  stages: MatchStageConfigs;
  scoring: BalanceConfig["scoring"];
  constantStatMin: number;
  constantStatMax: number;
  rallyTieBreak: BalanceConfig["rallyTieBreak"];
  attackBonus: number;
  defenderVisibleTopK: number;
  explorationEpsilon: number;
  candidateV4?: CandidateV4Settings;
};

export type MatchPlayerSetup = { id: PlayerId; loadout: Loadout };
export type InternalPlayer = {
  id: PlayerId;
  loadout: Loadout;
  constantStats: ConstantStats;
  projectBattleValues: ProjectBattleValues;
};

export type CurrentGame = {
  number: number;
  initialServerPlayerId: PlayerId;
  score: Record<PlayerId, number>;
  pointsPlayed: number;
  isDeuce: boolean;
};

export type MatchPoint = {
  number: number;
  serverPlayerId: PlayerId;
  receiverPlayerId: PlayerId;
  stage: Stage;
  attackerPlayerId: PlayerId;
  allocations: Record<PlayerId, Allocation | null>;
  lockedByPlayerIds: PlayerId[];
  rallyRound: number;
  /** Signed from player A's perspective: positive favors A, negative favors B. */
  rallyAdvantagesFromA: number[];
};

export type ComparisonValues = {
  skillKey: string;
  base: number;
  temporary: number;
  bonus: number;
  actual: number;
};

export type VisibleAttackOption = { pairId: string; base: number };

export type DomainEvent =
  | {
      seq: number;
      type: "MATCH_STARTED";
      matchId: string;
      bestOf: number;
      firstServerPlayerId: PlayerId;
    }
  | { seq: number; type: "ALLOCATION_LOCKED"; stage: Stage; playerId: PlayerId }
  | {
      seq: number;
      type: "STAGE_CHANGED";
      stage: Stage;
      attackerPlayerId: PlayerId;
    }
  | {
      seq: number;
      type: "COMPARISON_REVEALED";
      stage: Stage;
      round: number | null;
      pairId: string;
      attackerPlayerId: PlayerId;
      defenderPlayerId: PlayerId;
      attack: ComparisonValues;
      defense: ComparisonValues;
      delta: number;
      outcome: "continue" | "attacker_wins" | "defender_wins";
    }
  | {
      seq: number;
      type: "RALLY_ROUND_CONTINUES";
      round: number;
      advantageFromA: number;
      attackerPlayerId: PlayerId;
    }
  | {
      seq: number;
      type: "POINT_ENDED";
      pointNumber: number;
      winnerPlayerId: PlayerId;
      reason:
        | "service_direct"
        | "receive_direct"
        | "rally_direct"
        | "rally_tie_break";
      score: Record<PlayerId, number>;
    }
  | {
      seq: number;
      type: "GAME_ENDED";
      gameNumber: number;
      winnerPlayerId: PlayerId;
      gamesWon: Record<PlayerId, number>;
    }
  | { seq: number; type: "MATCH_ENDED"; winnerPlayerId: PlayerId }
  | {
      seq: number;
      type: "POINT_STARTED";
      pointNumber: number;
      serverPlayerId: PlayerId;
      score: Record<PlayerId, number>;
    }
  | {
      seq: number;
      type: "GAME_STARTED";
      gameNumber: number;
      initialServerPlayerId: PlayerId;
    };

export type MatchState = {
  id: string;
  version: number;
  status: "ACTIVE" | "COMPLETED";
  phase: MatchPhase;
  bestOf: 1 | 3 | 5;
  winnerPlayerId: PlayerId | null;
  playerOrder: [PlayerId, PlayerId];
  players: Record<PlayerId, InternalPlayer>;
  gamesWon: Record<PlayerId, number>;
  currentGame: CurrentGame;
  currentPoint: MatchPoint;
  /** Private per-player carry; exposed only to its owner in public views. */
  reservePoints: Record<PlayerId, number>;
  rules: StageRules;
  history: DomainEvent[];
};

export type GameCommand =
  | {
      type: "ALLOCATE";
      expectedVersion: number;
      stage: Stage;
      allocations: Allocation;
    }
  | { type: "LOCK_ALLOCATION"; expectedVersion: number; stage: Stage }
  | { type: "CHOOSE_ATTACK"; expectedVersion: number; pairId: string }
  | { type: "ADVANCE"; expectedVersion: number };

export type ApplyResult = { state: MatchState; events: DomainEvent[] };

export type MatchPublicView = {
  matchId: string;
  version: number;
  status: MatchState["status"];
  phase: MatchPhase;
  bestOf: 1 | 3 | 5;
  winnerPlayerId: PlayerId | null;
  playerOrder: [PlayerId, PlayerId];
  gamesWon: Record<PlayerId, number>;
  currentGame: CurrentGame;
  point: Pick<
    MatchPoint,
    | "number"
    | "serverPlayerId"
    | "receiverPlayerId"
    | "stage"
    | "attackerPlayerId"
    | "rallyRound"
  >;
  rulesetId: MatchRulesetId;
  dataVersion: string;
  attackBonus: number;
  defensePool: number;
  rallyMaxComparisons: number;
  defenderVisibleTopK: number;
  explorationEpsilon: number;
  reservePoints: number;
  availableBudget: number;
  visibleAttackTop: VisibleAttackOption[] | null;
  self: {
    id: PlayerId;
    loadout: Loadout;
    projectBattleValues: ProjectBattleValues;
    allocation: Allocation | null;
    allocationLocked: boolean;
  };
  opponent: {
    id: PlayerId;
    loadout: Loadout;
    projectBattleValues: ProjectBattleValues;
    allocationLocked: boolean;
  };
  events: DomainEvent[];
};

export type CreateMatchInput = {
  id: string;
  bestOf: number;
  firstServerPlayerId: PlayerId;
  playerA: MatchPlayerSetup;
  playerB: MatchPlayerSetup;
  catalog: GameRulesCatalog;
  candidateV3?: CandidateV3Settings;
  candidateV4?: CandidateV4Settings;
};
