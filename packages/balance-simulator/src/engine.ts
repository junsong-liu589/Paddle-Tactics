import {
  applyCommand,
  createMatch,
  DEFAULT_CANDIDATE_V3_SETTINGS,
  DEFAULT_CANDIDATE_V4_SETTINGS,
  derivePublicView,
  resolveBattleComparison,
  resolveGamePoint,
  resolveRallyTieBreak,
  type GameRulesCatalog,
  type CandidateV3Settings,
  type CandidateV4Settings,
  type Loadout,
  type MatchPublicView,
  type MatchState,
  type PlayerId,
  type Stage,
} from "@paddle-tactics/game-core";
import type { BotPolicy, RevealedDefense } from "./bots.js";
import {
  allocateDefense,
  allocateForCore,
  choosePair,
  defenseSkillKey,
} from "./bots.js";
import type { BalanceParameters } from "./parameters.js";
import type { Random } from "./random.js";

export type MatchOutcome = {
  winner: PlayerId | null;
  result: "win" | "deuce_censored";
  firstServerWin: boolean | null;
  firstRallyAttackerEntries: number;
  firstRallyAttackerPointWins: number;
  tieBreakStarterEntries: number;
  tieBreakStarterWins: number;
  attackTop1Choices: number;
  attackTop3Choices: number;
  attackOffTop3Choices: number;
  defenseTop3Points: number;
  defenseOffTop3Points: number;
  deuceReached: boolean;
  points: Record<PlayerId, number>;
  games: Record<PlayerId, number>;
  stageComparisons: Record<Stage, number>;
  stageEnds: Record<Stage, number>;
  rallyRounds: number;
  rallyFifthRound: number;
  rallyTieBreaks: number;
  deuceCycleDetected: boolean;
  comparisons: number;
  attackChoices: Record<string, number>;
  defenseAllocations: Record<string, number>;
  topAttackChoices: Record<string, number>;
  topAttackConversions: Record<string, number>;
  pairMetrics: Record<string, PairMetric>;
  defensePatterns: Record<string, number>;
  initiative: Record<Stage, { eligible: number; attackerWins: number }>;
  policyA: BotPolicy;
  policyB: BotPolicy;
  resourceMetrics?: ResourceMetrics;
};

export type ResourceMetrics = {
  attackSpend: Record<"service" | "receive", number[]>;
  defenseSpend: Record<"service" | "receive", number[]>;
  defenseUnspent: Record<"service" | "receive", number[]>;
  reserveAtCounter: number[];
  reserveAtRally: number[];
  rallyBudget: number[];
  defenseConcentration: number[];
  rallyAttackAllocation: Record<string, number>;
  rallyAttackUsage: Record<string, number>;
  rallyCarryPointOutcomes: Array<{ reserve: number; won: boolean }>;
};

export type PairMetric = {
  comparisons: number;
  attackerConversions: number;
  defenseHolds: number;
  marginTotal: number;
  defenseAllocationTotal: number;
  marginalDefenseHolds: number;
  bonusAssistedConversions: number;
};

export type MatchSetup = {
  catalog: GameRulesCatalog;
  loadoutA: Loadout;
  loadoutB: Loadout;
  policyA: BotPolicy;
  policyB: BotPolicy;
  firstServerA: boolean;
  random: Random;
};

type OutcomeCounters = Omit<
  MatchOutcome,
  | "winner"
  | "result"
  | "firstServerWin"
  | "deuceReached"
  | "points"
  | "games"
  | "policyA"
  | "policyB"
>;

function viewFor(state: MatchState, playerId: PlayerId): MatchPublicView {
  return derivePublicView(state, playerId, { includeEvents: false });
}

function command(
  state: MatchState,
  playerId: PlayerId,
  payload: Parameters<typeof applyCommand>[2],
): MatchState {
  return applyCommand(state, playerId, payload).state;
}

function bump(record: Record<string, number>, key: string, amount = 1): void {
  record[key] = (record[key] ?? 0) + amount;
}

function buildOutcome(
  state: MatchState,
  policyA: BotPolicy,
  policyB: BotPolicy,
  counters: OutcomeCounters,
  firstServerA: boolean,
): MatchOutcome {
  const firstServerId = firstServerA ? "A" : "B";
  return {
    winner: state.winnerPlayerId,
    result: state.winnerPlayerId ? "win" : "deuce_censored",
    firstServerWin: state.winnerPlayerId
      ? state.winnerPlayerId === firstServerId
      : null,
    points: { ...state.currentGame.score },
    games: { ...state.gamesWon },
    policyA,
    policyB,
    ...counters,
    deuceReached: state.currentGame.isDeuce,
  };
}

function runReducerMatch(
  setup: MatchSetup,
  candidateV3?: CandidateV3Settings,
  candidateV4?: CandidateV4Settings,
): MatchOutcome {
  const { catalog, loadoutA, loadoutB, policyA, policyB, random } = setup;
  const playerA = "A";
  const playerB = "B";
  const defenderVisibleTopK =
    candidateV4?.defenderVisibleTopK ?? candidateV3?.defenderVisibleTopK ?? 0;
  let state = createMatch({
    id: "balance-legacy",
    bestOf: 1,
    firstServerPlayerId: setup.firstServerA ? playerA : playerB,
    playerA: { id: playerA, loadout: loadoutA },
    playerB: { id: playerB, loadout: loadoutB },
    catalog,
    ...(candidateV4 ? { candidateV4 } : {}),
    ...(candidateV3 ? { candidateV3 } : {}),
  });
  const counters = {
    stageComparisons: { service: 0, receive: 0, rally: 0 },
    stageEnds: { service: 0, receive: 0, rally: 0 },
    rallyRounds: 0,
    rallyFifthRound: 0,
    rallyTieBreaks: 0,
    firstRallyAttackerEntries: 0,
    firstRallyAttackerPointWins: 0,
    tieBreakStarterEntries: 0,
    tieBreakStarterWins: 0,
    attackTop1Choices: 0,
    attackTop3Choices: 0,
    attackOffTop3Choices: 0,
    defenseTop3Points: 0,
    defenseOffTop3Points: 0,
    deuceCycleDetected: false,
    comparisons: 0,
    attackChoices: {} as Record<string, number>,
    defenseAllocations: {} as Record<string, number>,
    topAttackChoices: {} as Record<string, number>,
    topAttackConversions: {} as Record<string, number>,
    pairMetrics: {} as Record<string, PairMetric>,
    defensePatterns: {} as Record<string, number>,
    initiative: emptyInitiative(),
  };
  const reveals: Record<PlayerId, RevealedDefense> = {
    A: new Map(),
    B: new Map(),
  };
  const resourceMetrics: ResourceMetrics = {
    attackSpend: { service: [], receive: [] },
    defenseSpend: { service: [], receive: [] },
    defenseUnspent: { service: [], receive: [] },
    reserveAtCounter: [],
    reserveAtRally: [],
    rallyBudget: [],
    defenseConcentration: [],
    rallyAttackAllocation: {},
    rallyAttackUsage: {},
    rallyCarryPointOutcomes: [],
  };
  const rallyCarryByPoint = new Map<number, Record<PlayerId, number>>();
  let lastResourceStage: Stage | null = null;
  const firstRallyAttackerByPoint = new Map<number, PlayerId>();
  const lastRallyAttackerByPoint = new Map<number, PlayerId>();
  let maxActions = 0;
  while (state.status === "ACTIVE") {
    if (++maxActions > 20000)
      throw new Error("Core match exceeded action guard");
    if (state.currentGame.pointsPlayed >= 250) {
      state.status = "COMPLETED";
      state.phase = "MATCH_END";
      state.winnerPlayerId = null;
      break;
    }
    if (
      state.currentGame.isDeuce &&
      hasStablePointCycle(
        state.history
          .filter((event) => event.type === "POINT_ENDED")
          .map((event) => event.winnerPlayerId),
      )
    ) {
      state.status = "COMPLETED";
      state.phase = "MATCH_END";
      state.winnerPlayerId = null;
      counters.deuceCycleDetected = true;
      break;
    }
    if (state.phase.endsWith("_ALLOCATING")) {
      const stage = state.currentPoint.stage;
      if (candidateV4 && lastResourceStage !== stage) {
        lastResourceStage = stage;
        if (stage === "receive")
          resourceMetrics.reserveAtCounter.push(
            ...Object.values(state.reservePoints),
          );
        if (stage === "rally") {
          resourceMetrics.reserveAtRally.push(
            ...Object.values(state.reservePoints),
          );
          resourceMetrics.rallyBudget.push(
            ...Object.values(state.reservePoints).map(
              (reserve) => candidateV4.rallyBudget + reserve,
            ),
          );
          rallyCarryByPoint.set(state.currentPoint.number, {
            ...state.reservePoints,
          });
        }
      }
      for (const playerId of [playerA, playerB]) {
        if (state.currentPoint.lockedByPlayerIds.includes(playerId)) continue;
        const policy = playerId === playerA ? policyA : policyB;
        const allocationView = viewFor(state, playerId);
        const allocation = allocateForCore(
          policy,
          allocationView,
          catalog,
          stage,
          reveals[playerId]!,
          random,
        );
        if (
          (candidateV3 || candidateV4) &&
          playerId !== state.currentPoint.attackerPlayerId &&
          policy === "FortressBot"
        ) {
          const shape = Object.values(allocation)
            .sort((a, b) => b - a)
            .join("/");
          bump(counters.defensePatterns, `${policy}:${stage}:${shape}`);
        }
        if (playerId !== state.currentPoint.attackerPlayerId) {
          for (const [key, value] of Object.entries(allocation))
            bump(counters.defenseAllocations, `${stage}:${key}`, value);
          if ((candidateV3 || candidateV4) && allocationView.visibleAttackTop) {
            const visible = new Set(
              allocationView.visibleAttackTop.map((item) => item.pairId),
            );
            for (const [key, value] of Object.entries(allocation)) {
              if (visible.has(key.split(".")[0]!))
                counters.defenseTop3Points += value;
              else counters.defenseOffTop3Points += value;
            }
          }
        }
        state = command(state, playerId, {
          type: "ALLOCATE",
          expectedVersion: state.version,
          stage,
          allocations: allocation,
        });
        state = command(state, playerId, {
          type: "LOCK_ALLOCATION",
          expectedVersion: state.version,
          stage,
        });
      }
      if (candidateV4 && stage !== "rally") {
        for (const playerId of [playerA, playerB]) {
          const allocation = state.currentPoint.allocations[playerId] ?? {};
          const spend = Object.values(allocation).reduce(
            (sum, value) => sum + value,
            0,
          );
          const attacker = playerId === state.currentPoint.attackerPlayerId;
          const series = attacker
            ? resourceMetrics.attackSpend[stage]
            : resourceMetrics.defenseSpend[stage];
          series.push(spend);
          if (!attacker) {
            const base =
              stage === "service"
                ? candidateV4.serviceDefenseBudget
                : candidateV4.counterDefenseBudget;
            const available = base + state.reservePoints[playerId]!;
            resourceMetrics.defenseUnspent[stage].push(available - spend);
            const values = Object.values(allocation);
            const total = Math.max(1, spend);
            resourceMetrics.defenseConcentration.push(
              values.reduce((sum, value) => sum + (value / total) ** 2, 0),
            );
          }
        }
      }
      if (candidateV4 && stage === "rally") {
        for (const playerId of [playerA, playerB]) {
          const allocation = state.currentPoint.allocations[playerId] ?? {};
          for (const [key, value] of Object.entries(allocation)) {
            if (key.endsWith(".attack")) {
              bump(resourceMetrics.rallyAttackAllocation, key, value);
              bump(resourceMetrics.rallyAttackUsage, key, Number(value > 0));
            }
          }
        }
      }
    } else if (state.phase.endsWith("_SELECTING")) {
      let attackRankCategory: string | null = null;
      const stage = state.currentPoint.stage;
      const attackerId = state.currentPoint.attackerPlayerId;
      const policy = attackerId === playerA ? policyA : policyB;
      const pairId = choosePair(
        policy,
        viewFor(state, attackerId),
        catalog,
        reveals[attackerId]!,
        random,
      );
      if (candidateV3 || candidateV4) {
        const ranked = state.rules.stages[stage].pairs
          .map((pair) => ({
            id: pair.id,
            value:
              state.players[attackerId]!.projectBattleValues[pair.id]!.attack,
          }))
          .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
        const rank = ranked.findIndex((item) => item.id === pairId);
        attackRankCategory =
          rank < defenderVisibleTopK ? `top${rank + 1}` : "offTopK";
        bump(counters.topAttackChoices, attackRankCategory);
        if (rank === 0) counters.attackTop1Choices += 1;
        else if (rank < defenderVisibleTopK) counters.attackTop3Choices += 1;
        else counters.attackOffTop3Choices += 1;
      }
      const previousHistoryLength = state.history.length;
      state = command(state, attackerId, {
        type: "CHOOSE_ATTACK",
        expectedVersion: state.version,
        pairId,
      });
      bump(counters.attackChoices, `${stage}:${pairId}`);
      counters.stageComparisons[stage] = counters.stageComparisons[stage]! + 1;
      counters.comparisons += 1;
      const event = state.history
        .slice(previousHistoryLength)
        .find((item) => item.type === "COMPARISON_REVEALED");
      for (const item of state.history.slice(previousHistoryLength)) {
        if (
          item.type === "COMPARISON_REVEALED" &&
          item.stage === "rally" &&
          !firstRallyAttackerByPoint.has(state.currentPoint.number)
        ) {
          firstRallyAttackerByPoint.set(
            state.currentPoint.number,
            item.attackerPlayerId,
          );
          counters.firstRallyAttackerEntries += 1;
        }
        if (item.type === "COMPARISON_REVEALED" && item.stage === "rally")
          lastRallyAttackerByPoint.set(
            state.currentPoint.number,
            item.attackerPlayerId,
          );
        if (item.type === "POINT_ENDED") {
          const rallyCarries = rallyCarryByPoint.get(item.pointNumber);
          if (candidateV4 && rallyCarries) {
            for (const [playerId, reserve] of Object.entries(rallyCarries))
              resourceMetrics.rallyCarryPointOutcomes.push({
                reserve,
                won: item.winnerPlayerId === playerId,
              });
            rallyCarryByPoint.delete(item.pointNumber);
          }
          const starter = firstRallyAttackerByPoint.get(item.pointNumber);
          if (starter) {
            counters.firstRallyAttackerPointWins += Number(
              starter === item.winnerPlayerId,
            );
            if (item.reason === "rally_tie_break") {
              const tieBreakStarter = lastRallyAttackerByPoint.get(
                item.pointNumber,
              );
              counters.tieBreakStarterEntries += 1;
              counters.tieBreakStarterWins += Number(
                tieBreakStarter === item.winnerPlayerId,
              );
            }
            firstRallyAttackerByPoint.delete(item.pointNumber);
            lastRallyAttackerByPoint.delete(item.pointNumber);
          }
        }
        if (item.type === "POINT_ENDED" && item.reason === "rally_tie_break")
          counters.rallyTieBreaks += 1;
      }
      if (event?.type === "COMPARISON_REVEALED") {
        const pairMetric = (counters.pairMetrics[`${stage}:${pairId}`] ??= {
          comparisons: 0,
          attackerConversions: 0,
          defenseHolds: 0,
          marginTotal: 0,
          defenseAllocationTotal: 0,
          marginalDefenseHolds: 0,
          bonusAssistedConversions: 0,
        });
        const threshold = state.rules.stages[stage].directWinThreshold;
        pairMetric.comparisons += 1;
        pairMetric.attackerConversions += Number(
          event.outcome === "attacker_wins",
        );
        pairMetric.defenseHolds += Number(event.outcome === "continue");
        pairMetric.marginTotal += event.delta;
        pairMetric.defenseAllocationTotal += event.defense.temporary;
        pairMetric.marginalDefenseHolds += Number(
          event.outcome === "continue" &&
            event.delta + event.defense.temporary >= threshold,
        );
        pairMetric.bonusAssistedConversions += Number(
          event.outcome === "attacker_wins" &&
            event.delta - event.attack.bonus < threshold,
        );
        if (
          (candidateV3 || candidateV4) &&
          attackRankCategory &&
          event.outcome === "attacker_wins"
        ) {
          bump(counters.topAttackConversions, attackRankCategory);
        }
        reveals[attackerId]!.set(pairId, event.defense.actual);
        if (stage === "rally") counters.rallyRounds += 1;
        if (stage === "rally" && event.round === 5)
          counters.rallyFifthRound += 1;
        if (event.outcome !== "continue") counters.stageEnds[stage] += 1;
        if (
          Math.abs(event.attack.base - event.defense.base) <= 1 &&
          event.outcome !== "continue"
        ) {
          counters.initiative[stage].eligible += 1;
          counters.initiative[stage].attackerWins += Number(
            event.outcome === "attacker_wins",
          );
        }
      }
    } else if (state.phase === "POINT_END" || state.phase === "GAME_END") {
      const before = state.history.length;
      state = command(state, playerA, {
        type: "ADVANCE",
        expectedVersion: state.version,
      });
      for (const event of state.history.slice(before)) {
        if (event.type === "POINT_ENDED" && event.reason === "rally_tie_break")
          counters.rallyTieBreaks += 1;
      }
    } else throw new Error(`Unexpected core phase ${state.phase}`);
  }
  return {
    ...buildOutcome(state, policyA, policyB, counters, setup.firstServerA),
    resourceMetrics,
  };
}

export function runLegacyMatch(setup: MatchSetup): MatchOutcome {
  return runReducerMatch(setup);
}

export function runCandidateV3Match(
  setup: MatchSetup,
  overrides: Partial<CandidateV3Settings> = {},
): MatchOutcome {
  return runReducerMatch(setup, {
    ...DEFAULT_CANDIDATE_V3_SETTINGS,
    ...overrides,
  });
}

export function runCandidateV4Match(
  setup: MatchSetup,
  overrides: Partial<CandidateV4Settings> = {},
): MatchOutcome {
  return runReducerMatch(setup, undefined, {
    ...DEFAULT_CANDIDATE_V4_SETTINGS,
    ...overrides,
  });
}

function rulesCatalog(
  catalog: GameRulesCatalog,
  parameters: BalanceParameters,
): GameRulesCatalog {
  return {
    ...catalog,
    skills: {
      ...catalog.skills,
      stages: {
        ...catalog.skills.stages,
        service: {
          ...catalog.skills.stages.service,
          directWinThreshold: parameters.serveThreshold,
          maxRounds: undefined,
        },
        receive: {
          ...catalog.skills.stages.receive,
          directWinThreshold: parameters.counterThreshold,
          maxRounds: undefined,
        },
        rally: {
          ...catalog.skills.stages.rally,
          budget: parameters.defensePool,
          perItemCap: parameters.defenseCap,
          directWinThreshold: parameters.rallyThreshold,
          maxRounds: parameters.rallyMaxRounds,
        },
      },
    },
    balance: {
      ...catalog.balance,
      service: {
        ...catalog.balance.service,
        budget: parameters.defensePool,
        perItemCap: parameters.defenseCap,
        threshold: parameters.serveThreshold,
      },
      receive: {
        ...catalog.balance.receive,
        budget: parameters.defensePool,
        perItemCap: parameters.defenseCap,
        threshold: parameters.counterThreshold,
      },
      rally: {
        ...catalog.balance.rally,
        budget: parameters.defensePool,
        perItemCap: parameters.defenseCap,
        threshold: parameters.rallyThreshold,
        maxRounds: parameters.rallyMaxRounds,
      },
    },
  };
}

export function runCandidateMatch(
  setup: MatchSetup,
  parameters: BalanceParameters,
): MatchOutcome {
  const { catalog, loadoutA, loadoutB, policyA, policyB, random } = setup;
  const effectiveCatalog = rulesCatalog(catalog, parameters);
  let state = createMatch({
    id: "balance-candidate",
    bestOf: 1,
    firstServerPlayerId: setup.firstServerA ? "A" : "B",
    playerA: { id: "A", loadout: loadoutA },
    playerB: { id: "B", loadout: loadoutB },
    catalog: effectiveCatalog,
  });
  const counters = {
    stageComparisons: { service: 0, receive: 0, rally: 0 },
    stageEnds: { service: 0, receive: 0, rally: 0 },
    rallyRounds: 0,
    rallyFifthRound: 0,
    rallyTieBreaks: 0,
    firstRallyAttackerEntries: 0,
    firstRallyAttackerPointWins: 0,
    tieBreakStarterEntries: 0,
    tieBreakStarterWins: 0,
    attackTop1Choices: 0,
    attackTop3Choices: 0,
    attackOffTop3Choices: 0,
    defenseTop3Points: 0,
    defenseOffTop3Points: 0,
    deuceCycleDetected: false,
    comparisons: 0,
    attackChoices: {} as Record<string, number>,
    defenseAllocations: {} as Record<string, number>,
    topAttackChoices: {} as Record<string, number>,
    topAttackConversions: {} as Record<string, number>,
    pairMetrics: {} as Record<string, PairMetric>,
    defensePatterns: {} as Record<string, number>,
    initiative: emptyInitiative(),
  };
  const stats = {
    A: state.players.A!.projectBattleValues,
    B: state.players.B!.projectBattleValues,
  };
  const revealed: Record<PlayerId, RevealedDefense> = {
    A: new Map(),
    B: new Map(),
  };
  const pointWinners: PlayerId[] = [];
  let actionGuard = 0;
  const pointsToWinGame = catalog.balance.scoring.pointsToWinGame;
  const winBy = catalog.balance.scoring.winBy;
  while (state.status === "ACTIVE") {
    if (++actionGuard > 1000)
      throw new Error(
        `Candidate match exceeded action guard in ${state.phase} at ${JSON.stringify(state.currentGame.score)}`,
      );
    if (state.currentGame.pointsPlayed >= 250) {
      state.status = "COMPLETED";
      state.phase = "MATCH_END";
      state.winnerPlayerId = null;
      break;
    }
    if (state.currentGame.isDeuce && hasStablePointCycle(pointWinners)) {
      state.status = "COMPLETED";
      state.phase = "MATCH_END";
      state.winnerPlayerId = null;
      counters.deuceCycleDetected = true;
      break;
    }
    if (state.phase === "SERVICE_ALLOCATING") {
      const pointServer = state.currentPoint.serverPlayerId;
      const defender = pointServer === "A" ? "B" : "A";
      state = runCandidatePoint(
        state,
        effectiveCatalog,
        parameters,
        policyA,
        policyB,
        pointServer,
        defender,
        stats,
        revealed,
        counters,
        random,
        pointWinners,
      );
    } else if (state.phase === "POINT_END" || state.phase === "GAME_END") {
      state = command(state, "A", {
        type: "ADVANCE",
        expectedVersion: state.version,
      });
    } else throw new Error(`Unexpected candidate phase ${state.phase}`);
    if (state.status === "COMPLETED") break;
    const a = state.currentGame.score.A!;
    const b = state.currentGame.score.B!;
    const winner =
      a >= pointsToWinGame && a - b >= winBy
        ? "A"
        : b >= pointsToWinGame && b - a >= winBy
          ? "B"
          : null;
    if (winner) {
      state = {
        ...state,
        status: "COMPLETED",
        phase: "MATCH_END",
        winnerPlayerId: winner,
      };
    }
  }
  return buildOutcome(state, policyA, policyB, counters, setup.firstServerA);
}

function runCandidatePoint(
  original: MatchState,
  catalog: GameRulesCatalog,
  parameters: BalanceParameters,
  policyA: BotPolicy,
  policyB: BotPolicy,
  firstAttacker: PlayerId,
  firstDefender: PlayerId,
  stats: Record<PlayerId, MatchState["players"][string]["projectBattleValues"]>,
  revealed: Record<PlayerId, RevealedDefense>,
  counters: OutcomeCounters,
  random: Random,
  pointWinners: PlayerId[],
): MatchState {
  const defenseByStage: Record<
    Stage,
    Record<PlayerId, Record<string, number>>
  > = {
    service: { A: {}, B: {} },
    receive: { A: {}, B: {} },
    rally: { A: {}, B: {} },
  };
  const stages: Stage[] = ["service", "receive", "rally"];
  for (const stage of stages) {
    const pool = parameters.defensePool;
    for (const playerId of ["A", "B"] as const) {
      if (
        stage === "service" &&
        playerId !== (firstAttacker === "A" ? "B" : "A")
      )
        continue;
      if (stage === "receive" && playerId !== firstAttacker) continue;
      const policy = playerId === "A" ? policyA : policyB;
      const allocation = allocateDefense(
        policy,
        stage,
        stats[playerId]!,
        stats[playerId === "A" ? "B" : "A"]!,
        catalog,
        pool,
        parameters.defenseCap,
        revealed[playerId]!,
        random,
      );
      defenseByStage[stage][playerId] = allocation;
      for (const [key, value] of Object.entries(allocation))
        bump(counters.defenseAllocations, `${stage}:${key}`, value);
    }
  }
  let attacker: PlayerId;
  let defender: PlayerId;
  const stageAttackers: Record<"service" | "receive", [PlayerId, PlayerId]> = {
    service: [firstAttacker, firstDefender],
    receive: [firstDefender, firstAttacker],
  };
  for (const stage of ["service", "receive"] as const) {
    [attacker, defender] = stageAttackers[stage];
    const policy = attacker === "A" ? policyA : policyB;
    const pairId = choosePair(
      policy,
      viewFor(original, attacker),
      catalog,
      revealed[attacker]!,
      random,
      stage,
    );
    const attackBase = stats[attacker]![pairId]!.attack;
    const defenseBase = stats[defender]![pairId]!.defense;
    const defensePoints =
      defenseByStage[stage][defender]![defenseSkillKey(pairId)] ?? 0;
    const threshold =
      stage === "service"
        ? parameters.serveThreshold
        : parameters.counterThreshold;
    const result = resolveBattleComparison(
      attackBase + parameters.attackBonus,
      defenseBase + defensePoints,
      threshold,
      false,
    );
    recordComparison(
      counters,
      stage,
      pairId,
      result,
      attacker,
      defender,
      defenseBase + defensePoints,
      revealed,
      attackBase,
      defenseBase,
    );
    if (result.outcome !== "continue") {
      finishCorePoint(
        original,
        result.outcome === "attacker_wins" ? attacker : defender,
        pointWinners,
      );
      return original;
    }
  }

  const advantages: number[] = [];
  attacker = firstAttacker;
  defender = firstDefender;
  for (let round = 1; round <= parameters.rallyMaxRounds; round += 1) {
    const policy = attacker === "A" ? policyA : policyB;
    const pairId = choosePair(
      policy,
      viewFor(original, attacker),
      catalog,
      revealed[attacker]!,
      random,
      "rally",
    );
    const attackBase = stats[attacker]![pairId]!.attack;
    const defenseBase = stats[defender]![pairId]!.defense;
    const defensePoints =
      defenseByStage.rally[defender]![defenseSkillKey(pairId)] ?? 0;
    const result = resolveBattleComparison(
      attackBase + parameters.attackBonus,
      defenseBase + defensePoints,
      parameters.rallyThreshold,
      true,
    );
    counters.rallyRounds += 1;
    if (round === 5) counters.rallyFifthRound += 1;
    recordComparison(
      counters,
      "rally",
      pairId,
      result,
      attacker,
      defender,
      defenseBase + defensePoints,
      revealed,
      attackBase,
      defenseBase,
    );
    const signed = attacker === "A" ? result.delta : -result.delta;
    advantages.push(signed);
    if (result.outcome !== "continue") {
      finishCorePoint(
        original,
        result.outcome === "attacker_wins" ? attacker : defender,
        pointWinners,
      );
      return original;
    }
    if (round === parameters.rallyMaxRounds) {
      counters.rallyTieBreaks += 1;
      const winner = resolveRallyTieBreak(advantages, ["A", "B"], attacker);
      finishCorePoint(original, winner, pointWinners);
      return original;
    }
    attacker = defender;
    defender = attacker === "A" ? "B" : "A";
  }
  return original;
}

function recordComparison(
  counters: OutcomeCounters,
  stage: Stage,
  pairId: string,
  result: ReturnType<typeof resolveBattleComparison>,
  attacker: PlayerId,
  defender: PlayerId,
  defensePoints: number,
  revealed: Record<PlayerId, RevealedDefense>,
  attackBase: number,
  defenseBase: number,
): void {
  counters.stageComparisons[stage] = counters.stageComparisons[stage]! + 1;
  counters.comparisons += 1;
  bump(counters.attackChoices, `${stage}:${pairId}`);
  bump(
    counters.defenseAllocations,
    `revealed:${stage}:${pairId}`,
    defensePoints,
  );
  revealed[attacker]!.set(pairId, defensePoints);
  if (
    Math.abs(attackBase - defenseBase) <= 1 &&
    result.outcome !== "continue"
  ) {
    counters.initiative[stage].eligible += 1;
    counters.initiative[stage].attackerWins += Number(
      result.outcome === "attacker_wins",
    );
  }
  if (result.outcome !== "continue") counters.stageEnds[stage] += 1;
  void attacker;
  void defender;
}

function emptyInitiative(): Record<
  Stage,
  { eligible: number; attackerWins: number }
> {
  return {
    service: { eligible: 0, attackerWins: 0 },
    receive: { eligible: 0, attackerWins: 0 },
    rally: { eligible: 0, attackerWins: 0 },
  };
}

function finishCorePoint(
  state: MatchState,
  winner: PlayerId,
  pointWinners: PlayerId[],
): void {
  const pointResult = resolveGamePoint(
    state.currentGame.score,
    winner,
    state.rules.scoring,
  );
  const score = pointResult.score;
  const pointsPlayed = state.currentGame.pointsPlayed + 1;
  const isDeuce = pointResult.deuce;
  const complete = pointResult.gameWon;
  // Commit only the authoritative game-core scoring fields. The candidate stage
  // flow shares game-core comparison and tie-break functions above.
  Object.assign(state.currentGame, { score, pointsPlayed, isDeuce });
  pointWinners.push(winner);
  if (complete) {
    state.gamesWon[winner] = 1;
    state.status = "COMPLETED";
    state.phase = "MATCH_END";
    state.winnerPlayerId = winner;
  } else state.phase = "POINT_END";
}

function hasStablePointCycle(winners: PlayerId[]): boolean {
  if (winners.length < 48) return false;
  for (let period = 1; period <= 8; period += 1) {
    const start = winners.length - period * 6;
    if (start < 0) continue;
    let repeats = true;
    for (let index = start + period; index < winners.length; index += 1) {
      if (winners[index] !== winners[index - period]) {
        repeats = false;
        break;
      }
    }
    if (repeats) return true;
  }
  return false;
}
