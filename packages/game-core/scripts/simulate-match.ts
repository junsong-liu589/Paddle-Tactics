import { loadCatalog } from "@paddle-tactics/game-data";
import {
  applyCommand,
  createMatch,
  getAllocationSkillKeys,
} from "../src/index.js";
import type {
  Allocation,
  GameCommand,
  MatchState,
  Stage,
} from "../src/index.js";

const catalog = loadCatalog();
const first = catalog.players[0]!;
const second = catalog.players[1]!;
const blade = catalog.blades[0]!;
const rubber = catalog.rubbers[0]!;
let state = createMatch({
  id: "deterministic-cli-match",
  bestOf: 1,
  firstServerPlayerId: first.id,
  playerA: {
    id: first.id,
    loadout: {
      playerId: first.id,
      bladeId: blade.id,
      forehandRubberId: rubber.id,
      backhandRubberId: rubber.id,
    },
  },
  playerB: {
    id: second.id,
    loadout: {
      playerId: second.id,
      bladeId: blade.id,
      forehandRubberId: rubber.id,
      backhandRubberId: rubber.id,
    },
  },
  catalog,
});

function send(
  actorId: string,
  command: Omit<GameCommand, "expectedVersion">,
): void {
  state = applyCommand(state, actorId, {
    ...command,
    expectedVersion: state.version,
  } as GameCommand).state;
}

function makeAllocation(stage: Stage, playerId: string): Allocation {
  const keys = getAllocationSkillKeys(state, stage, playerId);
  const { budget, perItemCap } = state.rules.stages[stage];
  const result: Allocation = {};
  let remaining = budget;
  for (const key of keys) {
    const points = Math.min(perItemCap, remaining);
    result[key] = points;
    remaining -= points;
    if (remaining === 0) break;
  }
  if (remaining !== 0)
    throw new Error(`Stage ${stage} allocation budget cannot be distributed`);
  return result;
}

let commandCount = 0;
while (state.status === "ACTIVE") {
  if (++commandCount > 250_000)
    throw new Error("Simulation exceeded its deterministic safety limit");
  if (state.phase.endsWith("_ALLOCATING")) {
    const stage = state.currentPoint.stage;
    for (const playerId of state.playerOrder) {
      send(playerId, {
        type: "ALLOCATE",
        stage,
        allocations: makeAllocation(stage, playerId),
      });
      send(playerId, { type: "LOCK_ALLOCATION", stage });
    }
  } else if (state.phase.endsWith("_SELECTING")) {
    const stage = state.currentPoint.stage;
    const pairs = state.rules.stages[stage].pairs;
    const pair =
      pairs[
        (state.currentPoint.number + state.currentPoint.rallyRound - 1) %
          pairs.length
      ]!;
    send(state.currentPoint.attackerPlayerId, {
      type: "CHOOSE_ATTACK",
      pairId: pair.id,
    });
  } else {
    send(state.playerOrder[0], { type: "ADVANCE" });
  }
}

const points = state.history.filter(
  (event) => event.type === "POINT_ENDED",
).length;
console.log(
  JSON.stringify(
    {
      matchId: state.id,
      status: state.status,
      winnerPlayerId: state.winnerPlayerId,
      gamesWon: state.gamesWon,
      finalScore: state.currentGame.score,
      pointCount: points,
      commandCount,
      deterministic: true,
    },
    null,
    2,
  ),
);

// Keep the compiler checking the reducer's immutable return type in this executable path.
const finalState: MatchState = state;
if (finalState.winnerPlayerId === null)
  throw new Error("Completed simulation did not produce a winner");
