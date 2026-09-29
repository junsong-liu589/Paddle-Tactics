import type { Stage as CatalogStage } from "@paddle-tactics/game-data";
import { GameRuleError } from "./errors.js";
import {
  calculateLoadoutStats,
  calculateProjectBattleValues,
} from "./loadout.js";
import { getServerForNextPoint } from "./serve.js";
import type {
  Allocation,
  ApplyResult,
  ComparisonValues,
  CreateMatchInput,
  CurrentGame,
  CandidateV3Settings,
  CandidateV4Settings,
  DomainEvent,
  GameCommand,
  InternalPlayer,
  MatchPoint,
  MatchState,
  PlayerId,
  Role,
  StageRules,
} from "./types.js";

type EventDraft = DomainEvent extends infer Event
  ? Event extends { seq: number }
    ? Omit<Event, "seq">
    : never
  : never;

function oppositePlayer(state: MatchState, playerId: PlayerId): PlayerId {
  return state.playerOrder.find((candidate) => candidate !== playerId)!;
}

function cloneState(state: MatchState): MatchState {
  return {
    ...state,
    playerOrder: [...state.playerOrder],
    // Player snapshots and rules are immutable after createMatch. Sharing these
    // read-only subtrees avoids copying the catalog-sized rules and stats on
    // every reducer command.
    players: state.players,
    rules: state.rules,
    reservePoints: { ...state.reservePoints },
    gamesWon: { ...state.gamesWon },
    currentGame: {
      ...state.currentGame,
      score: { ...state.currentGame.score },
    },
    currentPoint: {
      ...state.currentPoint,
      allocations: Object.fromEntries(
        Object.entries(state.currentPoint.allocations).map(
          ([id, allocation]) => [id, allocation ? { ...allocation } : null],
        ),
      ),
      lockedByPlayerIds: [...state.currentPoint.lockedByPlayerIds],
      rallyAdvantagesFromA: [...state.currentPoint.rallyAdvantagesFromA],
    },
    // Events are appended but never mutated. The history array is copied so a
    // reducer command cannot append to its input state.
    history: [...state.history],
  };
}

function appendEvent(
  state: MatchState,
  draft: EventDraft,
  emitted: DomainEvent[],
): void {
  const event = { ...draft, seq: state.history.length + 1 } as DomainEvent;
  state.history.push(event);
  emitted.push(event);
}

function makeCurrentPoint(
  state: Pick<MatchState, "playerOrder" | "currentGame" | "rules">,
  number: number,
): MatchPoint {
  const serverPlayerId = getServerForNextPoint(
    state.currentGame,
    state.rules.scoring,
    state.playerOrder,
  );
  const receiverPlayerId = state.playerOrder.find(
    (id) => id !== serverPlayerId,
  )!;
  const allocations: MatchPoint["allocations"] = {
    [state.playerOrder[0]]: null,
    [state.playerOrder[1]]: null,
  };
  const lockedByPlayerIds: PlayerId[] = [];
  if (state.rules.rulesetId === "candidate_v3") {
    allocations[serverPlayerId] = {};
    lockedByPlayerIds.push(serverPlayerId);
  }
  return {
    number,
    serverPlayerId,
    receiverPlayerId,
    stage: "service",
    attackerPlayerId: serverPlayerId,
    allocations,
    lockedByPlayerIds,
    rallyRound: 1,
    rallyAdvantagesFromA: [],
  };
}

function phaseFor(
  stage: CatalogStage,
  action: "allocating" | "selecting",
): MatchState["phase"] {
  const stageName = stage.toUpperCase();
  return `${stageName}_${action.toUpperCase()}` as MatchState["phase"];
}

function setAllocationStage(
  state: MatchState,
  stage: CatalogStage,
  attackerPlayerId: PlayerId,
): void {
  state.phase = phaseFor(stage, "allocating");
  state.currentPoint.stage = stage;
  state.currentPoint.attackerPlayerId = attackerPlayerId;
  state.currentPoint.allocations = {
    [state.playerOrder[0]]: null,
    [state.playerOrder[1]]: null,
  };
  state.currentPoint.lockedByPlayerIds = [];
  if (state.rules.rulesetId === "candidate_v3" && stage !== "rally") {
    state.currentPoint.allocations[attackerPlayerId] = {};
    state.currentPoint.lockedByPlayerIds.push(attackerPlayerId);
  }
  if (stage === "rally") {
    state.currentPoint.rallyRound = 1;
    state.currentPoint.rallyAdvantagesFromA = [];
  }
}

export function allocationSkillKey(pairId: string, role: Role): string {
  return `${pairId}.${role}`;
}

export function getAllocationSkillKeys(
  state: MatchState,
  stage: CatalogStage,
  playerId: PlayerId,
): string[] {
  if (!state.players[playerId])
    throw new GameRuleError("UNKNOWN_PLAYER", `Unknown player ${playerId}`);
  const stageRules = state.rules.stages[stage];
  if (stage === "rally") {
    if (state.rules.rulesetId === "candidate_v3")
      return stageRules.pairs.map((pair) =>
        allocationSkillKey(pair.id, "defense"),
      );
    return stageRules.pairs.flatMap((pair) => [
      allocationSkillKey(pair.id, "attack"),
      allocationSkillKey(pair.id, "defense"),
    ]);
  }
  const attackingPlayerId =
    stage === "service"
      ? state.currentPoint.serverPlayerId
      : state.currentPoint.receiverPlayerId;
  const role: Role = playerId === attackingPlayerId ? "attack" : "defense";
  if (state.rules.rulesetId === "candidate_v3") {
    if (role === "attack") return [];
    return stageRules.pairs.map((pair) =>
      allocationSkillKey(pair.id, "defense"),
    );
  }
  if (state.rules.rulesetId === "candidate_v4") {
    return stageRules.pairs.map((pair) => allocationSkillKey(pair.id, role));
  }
  return stageRules.pairs.map((pair) => allocationSkillKey(pair.id, role));
}

function availableBudget(state: MatchState, playerId: PlayerId): number {
  const settings = state.rules.candidateV4;
  if (!settings) return state.rules.stages[state.currentPoint.stage].budget;
  const stage = state.currentPoint.stage;
  if (stage === "rally")
    return settings.rallyBudget + state.reservePoints[playerId]!;
  const attacker = playerId === state.currentPoint.attackerPlayerId;
  const base =
    stage === "service"
      ? attacker
        ? settings.serviceAttackBudget
        : settings.serviceDefenseBudget
      : attacker
        ? settings.counterAttackBudget
        : settings.counterDefenseBudget;
  return base + state.reservePoints[playerId]!;
}

function validateAllocation(
  state: MatchState,
  actorId: PlayerId,
  allocations: Allocation,
): void {
  const stage = state.currentPoint.stage;
  const legalKeys = new Set(getAllocationSkillKeys(state, stage, actorId));
  const stageRules = state.rules.stages[stage];
  let total = 0;
  for (const [key, points] of Object.entries(allocations)) {
    if (!legalKeys.has(key)) {
      throw new GameRuleError(
        "INVALID_ALLOCATION",
        `${key} is not available for ${stage} allocation`,
      );
    }
    const v4AttackCap =
      state.rules.rulesetId === "candidate_v4" && key.endsWith(".attack")
        ? state.rules.candidateV4!.attackCap
        : null;
    if (
      !Number.isInteger(points) ||
      points < 0 ||
      (stageRules.perItemCap !== null && points > stageRules.perItemCap) ||
      (v4AttackCap !== null && points > v4AttackCap)
    ) {
      throw new GameRuleError(
        "INVALID_ALLOCATION",
        `${key} must be an integer from 0${v4AttackCap !== null ? ` to ${v4AttackCap} (attack cap)` : stageRules.perItemCap === null ? " upward" : ` to ${stageRules.perItemCap}`}`,
      );
    }
    total += points;
  }
  if (state.rules.rulesetId === "candidate_v4") {
    const budget = availableBudget(state, actorId);
    if (total > budget)
      throw new GameRuleError(
        "INVALID_ALLOCATION",
        `${stage} allocation exceeds available budget ${budget}`,
      );
    if (stage !== "rally" && actorId === state.currentPoint.attackerPlayerId) {
      if (Object.values(allocations).filter((points) => points > 0).length > 1)
        throw new GameRuleError(
          "INVALID_ALLOCATION",
          "Attack allocation may invest in only one skill",
        );
      if (total > state.rules.candidateV4!.attackCap)
        throw new GameRuleError(
          "INVALID_ALLOCATION",
          "Attack allocation exceeds the per-skill cap",
        );
    }
    return;
  }
  if (total !== stageRules.budget) {
    throw new GameRuleError(
      "INVALID_ALLOCATION",
      `${stage} allocation must use exactly ${stageRules.budget} points`,
    );
  }
}

function currentStageForPhase(
  phase: MatchState["phase"],
  action: "allocating" | "selecting",
): CatalogStage | null {
  if (!phase.endsWith(`_${action.toUpperCase()}`)) return null;
  const stage = phase.slice(0, phase.indexOf("_"));
  return stage.toLowerCase() as CatalogStage;
}

function ensureActor(state: MatchState, actorId: PlayerId): void {
  if (!state.players[actorId])
    throw new GameRuleError("UNKNOWN_PLAYER", `Unknown player ${actorId}`);
  if (state.status !== "ACTIVE" || state.phase === "MATCH_END") {
    throw new GameRuleError("MATCH_FINISHED", "The match has already finished");
  }
}

function makeComparisonValues(
  state: MatchState,
  playerId: PlayerId,
  pairId: string,
  role: Role,
): ComparisonValues {
  const player = state.players[playerId]!;
  const skillKey = allocationSkillKey(pairId, role);
  const allocation = state.currentPoint.allocations[playerId];
  if (!allocation)
    throw new GameRuleError(
      "ALLOCATION_NOT_LOCKED",
      `Player ${playerId} has no allocation`,
    );
  const base = player.projectBattleValues[pairId]?.[role];
  if (base === undefined)
    throw new GameRuleError(
      "UNKNOWN_SKILL_PAIR",
      `Unknown skill pair ${pairId}`,
    );
  const temporary = allocation[skillKey] ?? 0;
  const bonus = role === "attack" ? state.rules.attackBonus : 0;
  return { skillKey, base, temporary, bonus, actual: base + temporary + bonus };
}

function finishPoint(
  state: MatchState,
  emitted: DomainEvent[],
  winnerPlayerId: PlayerId,
  reason: Extract<DomainEvent, { type: "POINT_ENDED" }>["reason"],
): void {
  if (state.rules.rulesetId === "candidate_v4") {
    state.reservePoints[state.playerOrder[0]] = 0;
    state.reservePoints[state.playerOrder[1]] = 0;
  }
  const pointResult = resolveGamePoint(
    state.currentGame.score,
    winnerPlayerId,
    state.rules.scoring,
  );
  state.currentGame.score = pointResult.score;
  state.currentGame.pointsPlayed += 1;
  state.currentGame.isDeuce = pointResult.deuce;
  appendEvent(
    state,
    {
      type: "POINT_ENDED",
      pointNumber: state.currentPoint.number,
      winnerPlayerId,
      reason,
      score: { ...state.currentGame.score },
    },
    emitted,
  );

  if (!pointResult.gameWon) {
    state.phase = "POINT_END";
    return;
  }

  state.gamesWon[winnerPlayerId] = state.gamesWon[winnerPlayerId]! + 1;
  appendEvent(
    state,
    {
      type: "GAME_ENDED",
      gameNumber: state.currentGame.number,
      winnerPlayerId,
      gamesWon: { ...state.gamesWon },
    },
    emitted,
  );
  const gamesToWin = Math.ceil(state.bestOf / 2);
  if (state.gamesWon[winnerPlayerId]! >= gamesToWin) {
    state.status = "COMPLETED";
    state.phase = "MATCH_END";
    state.winnerPlayerId = winnerPlayerId;
    appendEvent(state, { type: "MATCH_ENDED", winnerPlayerId }, emitted);
  } else {
    state.phase = "GAME_END";
  }
}

function compareForPair(
  state: MatchState,
  pairId: string,
  emitted: DomainEvent[],
): { delta: number; attackerPlayerId: PlayerId; defenderPlayerId: PlayerId } {
  const attackerPlayerId = state.currentPoint.attackerPlayerId;
  const defenderPlayerId = oppositePlayer(state, attackerPlayerId);
  const attack = makeComparisonValues(
    state,
    attackerPlayerId,
    pairId,
    "attack",
  );
  const defense = makeComparisonValues(
    state,
    defenderPlayerId,
    pairId,
    "defense",
  );
  const { delta, outcome } =
    state.rules.rulesetId === "candidate_v3" ||
    state.rules.rulesetId === "candidate_v4"
      ? resolveCandidateV3Comparison(
          attack.actual,
          defense.actual,
          state.rules.stages[state.currentPoint.stage].directWinThreshold,
        )
      : resolveBattleComparison(
          attack.actual,
          defense.actual,
          state.rules.stages[state.currentPoint.stage].directWinThreshold,
          state.currentPoint.stage === "rally",
        );
  appendEvent(
    state,
    {
      type: "COMPARISON_REVEALED",
      stage: state.currentPoint.stage,
      round:
        state.currentPoint.stage === "rally"
          ? state.currentPoint.rallyRound
          : null,
      pairId,
      attackerPlayerId,
      defenderPlayerId,
      attack,
      defense,
      delta,
      outcome,
    },
    emitted,
  );
  return { delta, attackerPlayerId, defenderPlayerId };
}

export function resolveRallyTieBreak(
  advantages: number[],
  playerOrder: [PlayerId, PlayerId],
  lastAttackerPlayerId: PlayerId,
): PlayerId {
  const [playerA, playerB] = playerOrder;
  const cumulativeAdvantage = advantages.reduce((sum, value) => sum + value, 0);
  if (cumulativeAdvantage !== 0)
    return cumulativeAdvantage > 0 ? playerA : playerB;

  const positiveRoundsA = advantages.filter((value) => value > 0).length;
  const positiveRoundsB = advantages.filter((value) => value < 0).length;
  if (positiveRoundsA !== positiveRoundsB)
    return positiveRoundsA > positiveRoundsB ? playerA : playerB;

  const largestAdvantageA = Math.max(
    0,
    ...advantages.filter((value) => value > 0),
  );
  const largestAdvantageB = Math.max(
    0,
    ...advantages.filter((value) => value < 0).map((value) => -value),
  );
  if (largestAdvantageA !== largestAdvantageB) {
    return largestAdvantageA > largestAdvantageB ? playerA : playerB;
  }
  return playerOrder.find((id) => id !== lastAttackerPlayerId)!;
}

/** Shared stage comparison used by the match reducer and balance experiments. */
export function resolveBattleComparison(
  attack: number,
  defense: number,
  threshold: number,
  rally: boolean,
): { delta: number; outcome: "continue" | "attacker_wins" | "defender_wins" } {
  const delta = attack - defense;
  const outcome = rally
    ? Math.abs(delta) >= threshold
      ? delta > 0
        ? "attacker_wins"
        : "defender_wins"
      : "continue"
    : delta >= threshold
      ? "attacker_wins"
      : delta <= -threshold
        ? "defender_wins"
        : "continue";
  return { delta, outcome };
}

/** Candidate V3 is one-way: only the active attacker can win a comparison. */
export function resolveCandidateV3Comparison(
  attack: number,
  defense: number,
  threshold: number,
): { delta: number; outcome: "continue" | "attacker_wins" } {
  const delta = attack - defense;
  return {
    delta,
    outcome: delta >= threshold ? "attacker_wins" : "continue",
  };
}

export function resolveGamePoint(
  score: Record<PlayerId, number>,
  winnerPlayerId: PlayerId,
  scoring: StageRules["scoring"],
): { score: Record<PlayerId, number>; gameWon: boolean; deuce: boolean } {
  const nextScore = {
    ...score,
    [winnerPlayerId]: (score[winnerPlayerId] ?? 0) + 1,
  };
  const opponentId = Object.keys(nextScore).find(
    (id) => id !== winnerPlayerId,
  )!;
  return {
    score: nextScore,
    gameWon:
      nextScore[winnerPlayerId]! >= scoring.pointsToWinGame &&
      nextScore[winnerPlayerId]! - nextScore[opponentId]! >= scoring.winBy,
    deuce:
      nextScore[Object.keys(nextScore)[0]!]! >= scoring.pointsToWinGame - 1 &&
      nextScore[Object.keys(nextScore)[1]!]! >= scoring.pointsToWinGame - 1,
  };
}

export const DEFAULT_CANDIDATE_V3_SETTINGS: CandidateV3Settings = {
  attackBonus: 4,
  defensePool: 8,
  defenderVisibleTopK: 3,
  serviceThreshold: 5,
  counterThreshold: 5,
  rallyThreshold: 4,
  rallyMaxComparisons: 5,
  explorationEpsilon: 0.05,
};

export const DEFAULT_CANDIDATE_V4_SETTINGS: CandidateV4Settings = {
  serviceAttackBudget: 4,
  serviceDefenseBudget: 10,
  counterAttackBudget: 4,
  counterDefenseBudget: 10,
  rallyBudget: 20,
  attackCap: 4,
  serviceThreshold: 5,
  counterThreshold: 5,
  defenderVisibleTopK: 3,
  rallyThreshold: 4,
  rallyMaxComparisons: 4,
  carryRatePercent: 100,
  explorationEpsilon: 0.05,
};

function createStageRules(
  catalog: CreateMatchInput["catalog"],
  candidateV3?: CandidateV3Settings,
  candidateV4?: CandidateV4Settings,
): StageRules {
  const stages = structuredClone(catalog.skills.stages) as StageRules["stages"];
  if (candidateV3) {
    const { defensePool, serviceThreshold, counterThreshold, rallyThreshold } =
      candidateV3;
    stages.service.budget = defensePool;
    stages.service.perItemCap = null;
    stages.service.directWinThreshold = serviceThreshold;
    stages.receive.budget = defensePool;
    stages.receive.perItemCap = null;
    stages.receive.directWinThreshold = counterThreshold;
    stages.rally.budget = defensePool;
    stages.rally.perItemCap = null;
    stages.rally.directWinThreshold = rallyThreshold;
    stages.rally.maxRounds = candidateV3.rallyMaxComparisons;
  }
  if (candidateV4) {
    stages.service.budget = candidateV4.serviceDefenseBudget;
    stages.service.perItemCap = null;
    stages.service.directWinThreshold = candidateV4.serviceThreshold;
    stages.receive.budget = candidateV4.counterDefenseBudget;
    stages.receive.perItemCap = null;
    stages.receive.directWinThreshold = candidateV4.counterThreshold;
    stages.rally.budget = candidateV4.rallyBudget;
    stages.rally.perItemCap = null;
    stages.rally.directWinThreshold = candidateV4.rallyThreshold;
    stages.rally.maxRounds = candidateV4.rallyMaxComparisons;
  }
  return {
    rulesetId: candidateV4
      ? "candidate_v4"
      : candidateV3
        ? "candidate_v3"
        : "legacy_v1",
    version: catalog.balance.version,
    stages,
    scoring: structuredClone(catalog.balance.scoring),
    constantStatMin: catalog.balance.constantStatMin,
    constantStatMax: catalog.balance.constantStatMax,
    rallyTieBreak: [...catalog.balance.rallyTieBreak],
    attackBonus: candidateV3?.attackBonus ?? 0,
    defenderVisibleTopK:
      candidateV4?.defenderVisibleTopK ?? candidateV3?.defenderVisibleTopK ?? 0,
    explorationEpsilon:
      candidateV4?.explorationEpsilon ?? candidateV3?.explorationEpsilon ?? 0,
    ...(candidateV4 ? { candidateV4: { ...candidateV4 } } : {}),
  };
}

function validateCandidateV3Settings(settings: CandidateV3Settings): void {
  const positive = [
    settings.attackBonus,
    settings.defensePool,
    settings.defenderVisibleTopK,
    settings.serviceThreshold,
    settings.counterThreshold,
    settings.rallyThreshold,
    settings.rallyMaxComparisons,
  ];
  if (
    positive.some((value) => !Number.isInteger(value) || value < 1) ||
    settings.defenderVisibleTopK > 5 ||
    !Number.isFinite(settings.explorationEpsilon) ||
    settings.explorationEpsilon < 0 ||
    settings.explorationEpsilon > 1
  ) {
    throw new GameRuleError(
      "INVALID_MATCH_CONFIGURATION",
      "Candidate V3 settings contain invalid values",
    );
  }
}

function validateCandidateV4Settings(settings: CandidateV4Settings): void {
  const integerValues = [
    settings.serviceAttackBudget,
    settings.serviceDefenseBudget,
    settings.counterAttackBudget,
    settings.counterDefenseBudget,
    settings.rallyBudget,
    settings.attackCap,
    settings.serviceThreshold,
    settings.counterThreshold,
    settings.defenderVisibleTopK,
    settings.rallyThreshold,
    settings.rallyMaxComparisons,
    settings.carryRatePercent,
  ];
  if (
    integerValues.some((value) => !Number.isInteger(value) || value < 0) ||
    settings.attackCap > 4 ||
    settings.defenderVisibleTopK > 5 ||
    settings.rallyMaxComparisons !== 4 ||
    settings.carryRatePercent > 100 ||
    !Number.isFinite(settings.explorationEpsilon) ||
    settings.explorationEpsilon < 0 ||
    settings.explorationEpsilon > 1
  )
    throw new GameRuleError(
      "INVALID_MATCH_CONFIGURATION",
      "Candidate V4 settings contain invalid values",
    );
}

function advanceToRallyRound(state: MatchState, emitted: DomainEvent[]): void {
  const advantageFromA = state.currentPoint.rallyAdvantagesFromA.at(-1)!;
  appendEvent(
    state,
    {
      type: "RALLY_ROUND_CONTINUES",
      round: state.currentPoint.rallyRound,
      advantageFromA,
      attackerPlayerId: state.currentPoint.attackerPlayerId,
    },
    emitted,
  );
  const maxRounds = state.rules.stages.rally.maxRounds ?? 5;
  if (state.currentPoint.rallyRound >= maxRounds) {
    const tieWinner =
      state.rules.rulesetId === "candidate_v4"
        ? resolveCandidateV4RallyTieBreak(
            state.currentPoint.rallyAdvantagesFromA,
            state.playerOrder,
            state.currentPoint.number,
          )
        : resolveRallyTieBreak(
            state.currentPoint.rallyAdvantagesFromA,
            state.playerOrder,
            state.currentPoint.attackerPlayerId,
          );
    finishPoint(state, emitted, tieWinner, "rally_tie_break");
    return;
  }

  state.currentPoint.rallyRound += 1;
  state.currentPoint.attackerPlayerId = oppositePlayer(
    state,
    state.currentPoint.attackerPlayerId,
  );
  state.phase = "RALLY_SELECTING";
  appendEvent(
    state,
    {
      type: "STAGE_CHANGED",
      stage: "rally",
      attackerPlayerId: state.currentPoint.attackerPlayerId,
    },
    emitted,
  );
}

/** Four V4 attack margins are compared symmetrically; exact ties alternate by point number. */
export function resolveCandidateV4RallyTieBreak(
  advantages: number[],
  playerOrder: [PlayerId, PlayerId],
  pointNumber: number,
): PlayerId {
  const cumulative = advantages.reduce((sum, value) => sum + value, 0);
  if (cumulative !== 0) return cumulative > 0 ? playerOrder[0] : playerOrder[1];
  const winsA = advantages.filter((value) => value > 0).length;
  const winsB = advantages.filter((value) => value < 0).length;
  if (winsA !== winsB) return winsA > winsB ? playerOrder[0] : playerOrder[1];
  const bestA = Math.max(0, ...advantages.filter((value) => value > 0));
  const bestB = Math.max(
    0,
    ...advantages.filter((value) => value < 0).map(Math.abs),
  );
  if (bestA !== bestB) return bestA > bestB ? playerOrder[0] : playerOrder[1];
  return pointNumber % 2 === 1 ? playerOrder[1] : playerOrder[0];
}

function handleComparison(
  state: MatchState,
  pairId: string,
  emitted: DomainEvent[],
): void {
  const stage = state.currentPoint.stage;
  const { delta, attackerPlayerId, defenderPlayerId } = compareForPair(
    state,
    pairId,
    emitted,
  );
  const lastEvent = state.history.at(-1);
  if (lastEvent?.type !== "COMPARISON_REVEALED")
    throw new Error("Comparison event was not recorded");

  if (stage !== "rally" && state.rules.rulesetId === "candidate_v4") {
    const settings = state.rules.candidateV4!;
    for (const playerId of state.playerOrder) {
      const isAttacker = playerId === state.currentPoint.attackerPlayerId;
      const base =
        stage === "service"
          ? isAttacker
            ? settings.serviceAttackBudget
            : settings.serviceDefenseBudget
          : isAttacker
            ? settings.counterAttackBudget
            : settings.counterDefenseBudget;
      const spent = Object.values(
        state.currentPoint.allocations[playerId] ?? {},
      ).reduce((sum, amount) => sum + amount, 0);
      const unused = base + state.reservePoints[playerId]! - spent;
      state.reservePoints[playerId] = Math.floor(
        (unused * settings.carryRatePercent) / 100,
      );
    }
  }

  if (stage === "rally") {
    const advantageFromA =
      state.playerOrder[0] === attackerPlayerId ? delta : -delta;
    state.currentPoint.rallyAdvantagesFromA.push(advantageFromA);
    if (lastEvent.outcome === "attacker_wins")
      finishPoint(state, emitted, attackerPlayerId, "rally_direct");
    else if (lastEvent.outcome === "defender_wins")
      finishPoint(state, emitted, defenderPlayerId, "rally_direct");
    else advanceToRallyRound(state, emitted);
    return;
  }

  if (lastEvent.outcome === "attacker_wins") {
    finishPoint(
      state,
      emitted,
      attackerPlayerId,
      stage === "service" ? "service_direct" : "receive_direct",
    );
    return;
  }
  if (lastEvent.outcome === "defender_wins") {
    finishPoint(
      state,
      emitted,
      defenderPlayerId,
      stage === "service" ? "service_direct" : "receive_direct",
    );
    return;
  }

  const nextStage = stage === "service" ? "receive" : "rally";
  const nextAttacker =
    stage === "service"
      ? state.currentPoint.receiverPlayerId
      : state.currentPoint.serverPlayerId;
  setAllocationStage(state, nextStage, nextAttacker);
  if (state.rules.rulesetId === "candidate_v3" && nextStage !== "rally") {
    appendEvent(
      state,
      { type: "ALLOCATION_LOCKED", stage: nextStage, playerId: nextAttacker },
      emitted,
    );
  }
  appendEvent(
    state,
    { type: "STAGE_CHANGED", stage: nextStage, attackerPlayerId: nextAttacker },
    emitted,
  );
}

export function createMatch(input: CreateMatchInput): MatchState {
  const {
    id,
    bestOf,
    firstServerPlayerId,
    playerA,
    playerB,
    catalog,
    candidateV3,
    candidateV4,
  } = input;
  if (candidateV3 && candidateV4)
    throw new GameRuleError(
      "INVALID_MATCH_CONFIGURATION",
      "Only one candidate ruleset can be selected",
    );
  if (candidateV3) validateCandidateV3Settings(candidateV3);
  if (candidateV4) validateCandidateV4Settings(candidateV4);
  const playerOrder: [PlayerId, PlayerId] = [playerA.id, playerB.id];
  if (
    !id ||
    !Number.isInteger(bestOf) ||
    !catalog.balance.scoring.allowedBestOf.includes(bestOf as 1 | 3 | 5) ||
    !playerA.id ||
    !playerB.id ||
    playerA.id === playerB.id ||
    !playerOrder.includes(firstServerPlayerId)
  ) {
    throw new GameRuleError(
      "INVALID_MATCH_CONFIGURATION",
      "Match ID, bestOf, players, or first server is invalid",
    );
  }

  const makePlayer = (setup: CreateMatchInput["playerA"]): InternalPlayer => {
    const constantStats = calculateLoadoutStats(setup.loadout, catalog);
    return {
      id: setup.id,
      loadout: { ...setup.loadout },
      constantStats,
      projectBattleValues: calculateProjectBattleValues(constantStats),
    };
  };
  const rules = createStageRules(catalog, candidateV3, candidateV4);
  const currentGame: CurrentGame = {
    number: 1,
    initialServerPlayerId: firstServerPlayerId,
    score: { [playerA.id]: 0, [playerB.id]: 0 },
    pointsPlayed: 0,
    isDeuce: false,
  };
  const state: MatchState = {
    id,
    version: 0,
    status: "ACTIVE",
    phase: "SERVICE_ALLOCATING",
    bestOf: bestOf as 1 | 3 | 5,
    winnerPlayerId: null,
    playerOrder,
    players: {
      [playerA.id]: makePlayer(playerA),
      [playerB.id]: makePlayer(playerB),
    },
    gamesWon: { [playerA.id]: 0, [playerB.id]: 0 },
    currentGame,
    currentPoint: makeCurrentPoint({ playerOrder, currentGame, rules }, 1),
    reservePoints: { [playerA.id]: 0, [playerB.id]: 0 },
    rules: structuredClone(rules),
    history: [],
  };
  const emitted: DomainEvent[] = [];
  appendEvent(
    state,
    {
      type: "MATCH_STARTED",
      matchId: id,
      bestOf: state.bestOf,
      firstServerPlayerId,
    },
    emitted,
  );
  appendEvent(
    state,
    {
      type: "POINT_STARTED",
      pointNumber: state.currentPoint.number,
      serverPlayerId: state.currentPoint.serverPlayerId,
      score: { ...state.currentGame.score },
    },
    emitted,
  );
  for (const playerId of state.currentPoint.lockedByPlayerIds) {
    appendEvent(
      state,
      { type: "ALLOCATION_LOCKED", stage: "service", playerId },
      emitted,
    );
  }
  return state;
}

export function applyCommand(
  state: MatchState,
  actorId: PlayerId,
  command: GameCommand,
): ApplyResult {
  ensureActor(state, actorId);
  if (command.expectedVersion !== state.version) {
    throw new GameRuleError(
      "STALE_VERSION",
      `Expected version ${state.version}, received ${command.expectedVersion}`,
    );
  }

  const next = cloneState(state);
  const emitted: DomainEvent[] = [];

  if (command.type === "ALLOCATE") {
    const stage = currentStageForPhase(next.phase, "allocating");
    if (
      !stage ||
      stage !== command.stage ||
      stage !== next.currentPoint.stage
    ) {
      throw new GameRuleError(
        "INVALID_STAGE",
        `Cannot allocate ${command.stage} during ${next.phase}`,
      );
    }
    if (next.currentPoint.lockedByPlayerIds.includes(actorId)) {
      throw new GameRuleError(
        "ALLOCATION_ALREADY_LOCKED",
        "Allocation is locked and cannot be changed",
      );
    }
    validateAllocation(next, actorId, command.allocations);
    next.currentPoint.allocations[actorId] = { ...command.allocations };
  } else if (command.type === "LOCK_ALLOCATION") {
    const stage = currentStageForPhase(next.phase, "allocating");
    if (
      !stage ||
      stage !== command.stage ||
      stage !== next.currentPoint.stage
    ) {
      throw new GameRuleError(
        "INVALID_STAGE",
        `Cannot lock ${command.stage} during ${next.phase}`,
      );
    }
    if (!next.currentPoint.allocations[actorId]) {
      throw new GameRuleError(
        "INVALID_ALLOCATION",
        "Submit a complete allocation before locking",
      );
    }
    if (next.currentPoint.lockedByPlayerIds.includes(actorId)) {
      throw new GameRuleError(
        "ALLOCATION_ALREADY_LOCKED",
        "Allocation is already locked",
      );
    }
    next.currentPoint.lockedByPlayerIds.push(actorId);
    appendEvent(
      next,
      { type: "ALLOCATION_LOCKED", stage, playerId: actorId },
      emitted,
    );
    if (next.currentPoint.lockedByPlayerIds.length === 2) {
      next.phase = phaseFor(stage, "selecting");
      appendEvent(
        next,
        {
          type: "STAGE_CHANGED",
          stage,
          attackerPlayerId: next.currentPoint.attackerPlayerId,
        },
        emitted,
      );
    }
  } else if (command.type === "CHOOSE_ATTACK") {
    const stage = currentStageForPhase(next.phase, "selecting");
    if (!stage || stage !== next.currentPoint.stage) {
      throw new GameRuleError(
        "INVALID_PHASE",
        `Cannot choose an attack during ${next.phase}`,
      );
    }
    if (actorId !== next.currentPoint.attackerPlayerId) {
      throw new GameRuleError(
        "NOT_CURRENT_ATTACKER",
        "Only the current attacker may choose a skill pair",
      );
    }
    if (next.currentPoint.lockedByPlayerIds.length !== 2) {
      throw new GameRuleError(
        "ALLOCATION_NOT_LOCKED",
        "Both allocations must be locked before the attack choice",
      );
    }
    if (
      !next.rules.stages[stage].pairs.some((pair) => pair.id === command.pairId)
    ) {
      throw new GameRuleError(
        "UNKNOWN_SKILL_PAIR",
        `Unknown ${stage} skill pair ${command.pairId}`,
      );
    }
    if (next.rules.rulesetId === "candidate_v4" && stage !== "rally") {
      const allocation = next.currentPoint.allocations[actorId] ?? {};
      const investedPairs = Object.entries(allocation)
        .filter(([, points]) => points > 0)
        .map(([key]) => key.split(".")[0]);
      if (investedPairs.length > 0 && investedPairs[0] !== command.pairId)
        throw new GameRuleError(
          "INVALID_ALLOCATION",
          "Chosen attack must match the skill receiving the attack spend",
        );
    }
    handleComparison(next, command.pairId, emitted);
  } else {
    if (next.phase === "POINT_END") {
      const nextPointNumber = next.currentPoint.number + 1;
      next.currentPoint = makeCurrentPoint(next, nextPointNumber);
      next.phase = "SERVICE_ALLOCATING";
      appendEvent(
        next,
        {
          type: "POINT_STARTED",
          pointNumber: next.currentPoint.number,
          serverPlayerId: next.currentPoint.serverPlayerId,
          score: { ...next.currentGame.score },
        },
        emitted,
      );
      for (const playerId of next.currentPoint.lockedByPlayerIds) {
        appendEvent(
          next,
          { type: "ALLOCATION_LOCKED", stage: "service", playerId },
          emitted,
        );
      }
    } else if (next.phase === "GAME_END") {
      const nextGameNumber = next.currentGame.number + 1;
      const initialServerPlayerId = oppositePlayer(
        next,
        next.currentGame.initialServerPlayerId,
      );
      next.currentGame = {
        number: nextGameNumber,
        initialServerPlayerId,
        score: { [next.playerOrder[0]]: 0, [next.playerOrder[1]]: 0 },
        pointsPlayed: 0,
        isDeuce: false,
      };
      next.currentPoint = makeCurrentPoint(next, next.currentPoint.number + 1);
      next.phase = "SERVICE_ALLOCATING";
      appendEvent(
        next,
        {
          type: "GAME_STARTED",
          gameNumber: nextGameNumber,
          initialServerPlayerId,
        },
        emitted,
      );
      for (const playerId of next.currentPoint.lockedByPlayerIds) {
        appendEvent(
          next,
          { type: "ALLOCATION_LOCKED", stage: "service", playerId },
          emitted,
        );
      }
      appendEvent(
        next,
        {
          type: "POINT_STARTED",
          pointNumber: next.currentPoint.number,
          serverPlayerId: next.currentPoint.serverPlayerId,
          score: { ...next.currentGame.score },
        },
        emitted,
      );
    } else {
      throw new GameRuleError(
        "NOT_READY_TO_ADVANCE",
        `Cannot advance during ${next.phase}`,
      );
    }
  }

  next.version += 1;
  return {
    state: next,
    events: emitted.map((event) => structuredClone(event)),
  };
}
