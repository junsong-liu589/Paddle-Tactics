import type {
  DomainEvent,
  MatchPublicView,
  MatchState,
  PlayerId,
} from "./types.js";

function cloneEvent(event: DomainEvent): DomainEvent {
  if (event.type === "COMPARISON_REVEALED") {
    return {
      ...event,
      attack: { ...event.attack },
      defense: { ...event.defense },
    };
  }
  if (event.type === "POINT_ENDED")
    return { ...event, score: { ...event.score } };
  if (event.type === "GAME_ENDED")
    return { ...event, gamesWon: { ...event.gamesWon } };
  if (event.type === "POINT_STARTED")
    return { ...event, score: { ...event.score } };
  return { ...event };
}

/** Returns only public state plus the requesting player's own still-private allocation. */
export function derivePublicView(
  state: MatchState,
  viewerId: PlayerId,
  options: { includeEvents?: boolean } = {},
): MatchPublicView {
  const self = state.players[viewerId];
  if (!self) throw new Error(`Unknown viewer ${viewerId}`);
  const opponentId = state.playerOrder.find((id) => id !== viewerId)!;
  const opponent = state.players[opponentId]!;
  const selfAllocation = state.currentPoint.allocations[viewerId];
  const stage = state.currentPoint.stage;
  const v4 = state.rules.candidateV4;
  const availableBudget = v4
    ? stage === "rally"
      ? v4.rallyBudget + state.reservePoints[viewerId]!
      : (stage === "service"
          ? viewerId === state.currentPoint.attackerPlayerId
            ? v4.serviceAttackBudget
            : v4.serviceDefenseBudget
          : viewerId === state.currentPoint.attackerPlayerId
            ? v4.counterAttackBudget
            : v4.counterDefenseBudget) + state.reservePoints[viewerId]!
    : state.rules.stages[stage].budget;
  const isVisibleToViewer =
    (state.rules.rulesetId === "candidate_v3" ||
      state.rules.rulesetId === "candidate_v4") &&
    (stage === "rally" || viewerId !== state.currentPoint.attackerPlayerId);
  const visibleAttackTop = isVisibleToViewer
    ? state.rules.stages[stage].pairs
        .map((pair) => ({
          pairId: pair.id,
          base: opponent.projectBattleValues[pair.id]!.attack,
        }))
        .sort((a, b) => b.base - a.base || a.pairId.localeCompare(b.pairId))
        .slice(0, state.rules.defenderVisibleTopK)
    : null;
  const view: MatchPublicView = {
    matchId: state.id,
    version: state.version,
    status: state.status,
    phase: state.phase,
    bestOf: state.bestOf,
    winnerPlayerId: state.winnerPlayerId,
    playerOrder: [...state.playerOrder],
    gamesWon: { ...state.gamesWon },
    currentGame: {
      ...state.currentGame,
      score: { ...state.currentGame.score },
    },
    point: {
      number: state.currentPoint.number,
      serverPlayerId: state.currentPoint.serverPlayerId,
      receiverPlayerId: state.currentPoint.receiverPlayerId,
      stage: state.currentPoint.stage,
      attackerPlayerId: state.currentPoint.attackerPlayerId,
      rallyRound: state.currentPoint.rallyRound,
    },
    rulesetId: state.rules.rulesetId,
    dataVersion: state.rules.version,
    attackBonus: state.rules.attackBonus,
    defensePool: state.rules.stages[stage].budget,
    rallyMaxComparisons: state.rules.stages.rally.maxRounds ?? 5,
    defenderVisibleTopK: state.rules.defenderVisibleTopK,
    explorationEpsilon: state.rules.explorationEpsilon,
    reservePoints:
      state.rules.rulesetId === "candidate_v4"
        ? state.reservePoints[viewerId]!
        : 0,
    availableBudget,
    visibleAttackTop,
    self: {
      id: self.id,
      loadout: { ...self.loadout },
      projectBattleValues: structuredClone(self.projectBattleValues),
      allocation: selfAllocation ? { ...selfAllocation } : null,
      allocationLocked: state.currentPoint.lockedByPlayerIds.includes(viewerId),
    },
    opponent: {
      id: opponent.id,
      loadout: { ...opponent.loadout },
      projectBattleValues: structuredClone(opponent.projectBattleValues),
      allocationLocked:
        state.currentPoint.lockedByPlayerIds.includes(opponentId),
    },
    events:
      options.includeEvents === false ? [] : state.history.map(cloneEvent),
  };
  return view;
}
