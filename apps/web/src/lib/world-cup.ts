import {
  applyCommand,
  calculateLoadoutStats,
  calculateProjectBattleValues,
  createMatch,
  DEFAULT_CANDIDATE_V4_SETTINGS,
  derivePublicView,
} from "@paddle-tactics/game-core";
import type {
  DomainEvent,
  Loadout,
  MatchPublicView,
  MatchState,
  PlayerId,
  ProjectBattleValues,
} from "@paddle-tactics/game-core";
import { chooseAiAllocation, chooseAiAttack } from "@paddle-tactics/ai";
import type { AiStrategyVariant } from "@paddle-tactics/ai";
import { browserCatalog } from "./catalog.js";
import type { PublicCatalog } from "./catalog.js";

type ComparisonEvent = Extract<DomainEvent, { type: "COMPARISON_REVEALED" }>;

export type CupRound = 0 | 1 | 2 | 3 | 4;
export type CupMatchStatus = "pending" | "playback" | "human" | "complete";
export type CupSetScore = {
  a: number;
  b: number;
  winnerPlayerId: string;
  endingAction?: {
    stage: "service" | "receive" | "rally";
    pairId: string;
    winnerRole: "attack" | "defense";
  };
};
export type CupMatch = {
  id: string;
  round: CupRound;
  index: number;
  playerIds: [string | null, string | null];
  status: CupMatchStatus;
  games: CupSetScore[];
  visibleGameCount: number;
  pendingWinnerId: string | null;
  winnerId: string | null;
};
export type CupParticipant = {
  playerId: string;
  loadout: Loadout;
  controller: "player" | "ai";
};
export type WorldCup = {
  version: 1;
  id: string;
  seed: number;
  mode: "spectator" | "player";
  humanPlayerId: string | null;
  favoritePlayerId: string | null;
  participants: Record<string, CupParticipant>;
  draw: string[];
  matches: CupMatch[];
  phase:
    | "ready"
    | "cpu-playback"
    | "human-match"
    | "awaiting-choice"
    | "complete"
    | "exited";
  activeMatchId: string | null;
  activeGameId: string | null;
  championId: string | null;
  createdAt: number;
  eventType?: "world-cup" | "olympics";
  seedTierByPlayer?: Record<string, number>;
};

const WORLD_CUP_STORAGE_KEY = "paddle-tactics-world-cup-v1";
const OLYMPICS_STORAGE_KEY = "paddle-tactics-olympics-v1";
const ROUND_NAMES = ["四分之一决赛", "半决赛", "决赛"] as const;
const OLYMPIC_ROUND_NAMES = [
  "十六分之一决赛",
  "八分之一决赛",
  "四分之一决赛",
  "半决赛",
  "决赛",
] as const;

export type WorldCupAssistPolicy = {
  /** Extra points on each of Harimoto's 30 comparison abilities. */
  harimotoBaseBonus: number;
  /** Temporary points on each ability while he trails within a game. */
  harimotoGapBonus: number;
  harimotoGapThreshold: number;
  harimotoSignatureBonus?: number;
  /** Total one-game bonus for a player trailing 0–2 or 0–3. */
  atTwoZero: number;
  atThreeZero: number;
  spread: "all" | "ten";
};

export const WORLD_CUP_V43_POLICY: WorldCupAssistPolicy = {
  harimotoBaseBonus: 0.93,
  harimotoGapBonus: 2,
  harimotoGapThreshold: 5,
  harimotoSignatureBonus: 0.12,
  atTwoZero: 30,
  atThreeZero: 60,
  spread: "ten",
};

function adjustedBattleValues(
  base: ProjectBattleValues,
  allBonus: number,
  selectedBonus: number,
  seed: number,
  spread: WorldCupAssistPolicy["spread"],
): ProjectBattleValues {
  const values = structuredClone(base);
  const cells = Object.entries(values).flatMap(([pairId]) =>
    (["attack", "defense"] as const).map((role) => ({ pairId, role })),
  );
  for (const { pairId, role } of cells) values[pairId]![role] += allBonus;
  if (selectedBonus === 0) return values;
  if (spread === "all") {
    for (const { pairId, role } of cells)
      values[pairId]![role] += selectedBonus / cells.length;
  } else {
    const chosen = shuffled(cells, seed).slice(0, 10);
    for (const { pairId, role } of chosen)
      values[pairId]![role] += selectedBonus / chosen.length;
  }
  return values;
}

/** Pure World Cup-only overlay; the game-core reducer still decides every point. */
export function withWorldCupAssists(
  state: MatchState,
  baseValues: Record<PlayerId, ProjectBattleValues>,
  policy: WorldCupAssistPolicy,
  seed: number,
  harimotoSeat: PlayerId | null,
): MatchState {
  const [a, b] = state.playerOrder;
  const players = { ...state.players };
  for (const actorId of [a, b]) {
    const opponentId = actorId === a ? b : a;
    const wins = state.gamesWon[actorId] ?? 0;
    const opponentWins = state.gamesWon[opponentId] ?? 0;
    const seriesBonus =
      wins === 0 && opponentWins === 2
        ? policy.atTwoZero
        : wins === 0 && opponentWins === 3
          ? policy.atThreeZero
          : 0;
    const gap =
      (state.currentGame.score[opponentId] ?? 0) -
      (state.currentGame.score[actorId] ?? 0);
    const gapBonus =
      actorId === harimotoSeat && gap >= policy.harimotoGapThreshold
        ? policy.harimotoGapBonus
        : 0;
    const adjusted = adjustedBattleValues(
      baseValues[actorId]!,
      (actorId === harimotoSeat ? policy.harimotoBaseBonus : 0) + gapBonus,
      seriesBonus,
      (seed ^
        Math.imul(state.currentGame.number, 0x9e3779b1) ^
        (actorId === a ? 0 : 0x85ebca6b)) >>>
        0,
      policy.spread,
    );
    if (actorId === harimotoSeat && policy.harimotoSignatureBonus) {
      for (const pairId of [
        "flick",
        "flip",
        "rally_exchange",
        "continuous_attack",
      ])
        adjusted[pairId]!.attack += policy.harimotoSignatureBonus;
    }
    players[actorId] = {
      ...state.players[actorId]!,
      projectBattleValues: adjusted,
    };
  }
  return { ...state, players };
}

function randomSeed(): number {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues)
    globalThis.crypto.getRandomValues(values);
  else values[0] = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  return values[0]!;
}

function randomId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `cup-${randomSeed().toString(16)}`
  );
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

/** Chooses equipment that amplifies the player's strongest existing abilities. */
export function chooseStyleLoadout(
  playerId: string,
  catalog: PublicCatalog = browserCatalog,
): Loadout {
  const player = catalog.players.find((item) => item.id === playerId);
  if (!player) throw new Error(`Unknown cup player: ${playerId}`);
  const base = Object.entries(player.stats).flatMap(([pairId, roles]) =>
    (["attack", "defense"] as const).map((role) => ({
      key: `${pairId}:${role}`,
      value: (roles[role].forehand + roles[role].backhand) / 2,
    })),
  );
  const mean = base.reduce((sum, value) => sum + value.value, 0) / base.length;
  const weights = new Map(
    base.map((item) => [item.key, 1 + Math.max(0, item.value - mean) / 12]),
  );
  let best: { loadout: Loadout; score: number } | null = null;
  for (const blade of catalog.blades) {
    for (const forehandRubber of catalog.rubbers) {
      for (const backhandRubber of catalog.rubbers) {
        const loadout = {
          playerId,
          bladeId: blade.id,
          forehandRubberId: forehandRubber.id,
          backhandRubberId: backhandRubber.id,
        };
        const values = calculateProjectBattleValues(
          calculateLoadoutStats(loadout, catalog),
        );
        const score = base.reduce((total, item) => {
          const [pairId, role] = item.key.split(":") as [
            string,
            "attack" | "defense",
          ];
          return total + values[pairId]![role] * weights.get(item.key)!;
        }, 0);
        const tieBreak = [blade.id, forehandRubber.id, backhandRubber.id].join(
          "/",
        );
        const bestTieBreak = best
          ? [
              best.loadout.bladeId,
              best.loadout.forehandRubberId,
              best.loadout.backhandRubberId,
            ].join("/")
          : "";
        if (
          best === null ||
          score > best.score ||
          (score === best.score && tieBreak < bestTieBreak)
        ) {
          best = { loadout, score };
        }
      }
    }
  }
  if (!best) throw new Error("No legal cup equipment combination was found");
  return best.loadout;
}

function emptyMatch(round: CupRound, index: number): CupMatch {
  return {
    id: `r${round}-m${index}`,
    round,
    index,
    playerIds: [null, null],
    status: "pending",
    games: [],
    visibleGameCount: 0,
    pendingWinnerId: null,
    winnerId: null,
  };
}

export function createWorldCup(
  options: {
    humanPlayerId?: string;
    humanLoadout?: Loadout;
    favoritePlayerId?: string;
    /** Deterministic seed reserved for experiments and repeatable tests. */
    seed?: number;
    catalog?: PublicCatalog;
    drawOrder?: string[];
    eventType?: WorldCup["eventType"];
    seedTierByPlayer?: Record<string, number>;
  } = {},
): WorldCup {
  const catalog = options.catalog ?? browserCatalog;
  if (options.humanPlayerId && !options.humanLoadout) {
    throw new Error("A player-controlled cup entry needs a completed loadout");
  }
  if (
    options.favoritePlayerId &&
    !catalog.players.some((p) => p.id === options.favoritePlayerId)
  ) {
    throw new Error("The supported cup player is not in the roster");
  }
  const seed = options.seed ?? randomSeed();
  const playerIds = catalog.players.map((player) => player.id);
  if (playerIds.length < 2 || (playerIds.length & (playerIds.length - 1)) !== 0)
    throw new Error("A knockout cup needs a power-of-two player roster");
  const draw = options.drawOrder
    ? [...options.drawOrder]
    : shuffled(playerIds, seed);
  if (
    draw.length !== playerIds.length ||
    new Set(draw).size !== playerIds.length ||
    draw.some((playerId) => !playerIds.includes(playerId))
  )
    throw new Error("Cup draw must contain every roster player exactly once");
  const participants = Object.fromEntries(
    catalog.players.map((player) => {
      const controlled = player.id === options.humanPlayerId;
      return [
        player.id,
        {
          playerId: player.id,
          loadout: controlled
            ? options.humanLoadout!
            : chooseStyleLoadout(player.id, catalog),
          controller: controlled ? "player" : "ai",
        } satisfies CupParticipant,
      ];
    }),
  );
  const rounds = Math.log2(playerIds.length);
  const matches: CupMatch[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const count = playerIds.length / 2 ** (round + 1);
    for (let index = 0; index < count; index += 1)
      matches.push(emptyMatch(round as CupRound, index));
  }
  matches
    .filter((match) => match.round === 0)
    .forEach((match, index) => {
      match.playerIds = [draw[index * 2]!, draw[index * 2 + 1]!];
    });
  return {
    version: 1,
    id: randomId(),
    seed,
    mode: options.humanPlayerId ? "player" : "spectator",
    humanPlayerId: options.humanPlayerId ?? null,
    favoritePlayerId: options.favoritePlayerId ?? options.humanPlayerId ?? null,
    participants,
    draw,
    matches,
    phase: "ready",
    activeMatchId: null,
    activeGameId: null,
    championId: null,
    createdAt: Date.now(),
    ...(options.eventType ? { eventType: options.eventType } : {}),
    ...(options.seedTierByPlayer
      ? { seedTierByPlayer: options.seedTierByPlayer }
      : {}),
  };
}

export function roundName(
  round: CupRound,
  eventType: WorldCup["eventType"] = "world-cup",
): string {
  return eventType === "olympics"
    ? OLYMPIC_ROUND_NAMES[round]
    : (ROUND_NAMES[round as 0 | 1 | 2] ?? `第 ${round + 1} 轮`);
}

export function nextReadyMatch(cup: WorldCup): CupMatch | null {
  return (
    cup.matches.find(
      (match) =>
        match.status === "pending" &&
        match.playerIds[0] !== null &&
        match.playerIds[1] !== null,
    ) ?? null
  );
}

function aiDecision(
  state: MatchState,
  actorId: PlayerId,
  seed: number,
  catalog: PublicCatalog,
  strategy: AiStrategyVariant,
  baseValues?: Record<PlayerId, ProjectBattleValues>,
) {
  const view = derivePublicView(state, actorId);
  if (baseValues) {
    const opponentId = view.opponent.id;
    view.opponent.projectBattleValues = structuredClone(
      baseValues[opponentId]!,
    );
    if (view.visibleAttackTop)
      view.visibleAttackTop = state.rules.stages[view.point.stage].pairs
        .map((pair) => ({
          pairId: pair.id,
          base: baseValues[opponentId]![pair.id]!.attack,
        }))
        .sort((a, b) => b.base - a.base || a.pairId.localeCompare(b.pairId))
        .slice(0, state.rules.defenderVisibleTopK);
  }
  return {
    view,
    skills: catalog.skills,
    difficulty: "normal" as const,
    seed: (seed + view.version * 37) >>> 0,
    strategy,
  };
}

function scoreCompletedGames(events: DomainEvent[]): CupSetScore[] {
  const games: CupSetScore[] = [];
  let lastScore: Record<string, number> | null = null;
  let currentPointComparison: ComparisonEvent | null = null;
  let endingAction: CupSetScore["endingAction"];
  for (const event of events) {
    if (event.type === "POINT_STARTED") currentPointComparison = null;
    if (event.type === "COMPARISON_REVEALED") currentPointComparison = event;
    if (event.type === "POINT_ENDED") lastScore = event.score;
    if (event.type === "POINT_ENDED") {
      endingAction = currentPointComparison
        ? {
            stage: currentPointComparison.stage,
            pairId: currentPointComparison.pairId,
            winnerRole:
              event.winnerPlayerId === currentPointComparison.attackerPlayerId
                ? "attack"
                : "defense",
          }
        : undefined;
      currentPointComparison = null;
    }
    if (event.type === "GAME_ENDED" && lastScore) {
      games.push({
        a: lastScore.A ?? 0,
        b: lastScore.B ?? 0,
        winnerPlayerId: event.winnerPlayerId,
        ...(endingAction ? { endingAction } : {}),
      });
      lastScore = null;
      endingAction = undefined;
    }
  }
  return games;
}

export function simulateCupMatch(
  cup: WorldCup,
  match: CupMatch,
  catalog: PublicCatalog = browserCatalog,
  strategy: AiStrategyVariant = "current",
  firstServerOverride?: "A" | "B",
  assistPolicy: WorldCupAssistPolicy | null = cup.eventType === "olympics"
    ? null
    : WORLD_CUP_V43_POLICY,
): CupSetScore[] {
  const [playerAId, playerBId] = match.playerIds;
  if (!playerAId || !playerBId)
    throw new Error("Cup match does not have two players");
  const playerA = cup.participants[playerAId]!;
  const playerB = cup.participants[playerBId]!;
  const seed = (cup.seed ^ (match.round * 7919) ^ (match.index * 104729)) >>> 0;
  let state = createMatch({
    id: `${cup.id}-${match.id}`,
    bestOf: 7,
    allowBestOfSeven: true,
    firstServerPlayerId: firstServerOverride ?? (seed % 2 === 0 ? "A" : "B"),
    playerA: { id: "A", loadout: playerA.loadout },
    playerB: { id: "B", loadout: playerB.loadout },
    catalog,
    candidateV4: DEFAULT_CANDIDATE_V4_SETTINGS,
  });
  const baseValues: Record<PlayerId, ProjectBattleValues> = {
    A: structuredClone(state.players.A!.projectBattleValues),
    B: structuredClone(state.players.B!.projectBattleValues),
  };
  const harimotoSeat =
    playerAId === "tomokazu-harimoto"
      ? "A"
      : playerBId === "tomokazu-harimoto"
        ? "B"
        : null;
  if (cup.eventType !== "olympics" && assistPolicy)
    state = withWorldCupAssists(
      state,
      baseValues,
      assistPolicy,
      seed,
      harimotoSeat,
    );
  for (
    let step = 0;
    state.status !== "COMPLETED" && step < 100_000;
    step += 1
  ) {
    if (state.phase.endsWith("_ALLOCATING")) {
      for (const actorId of ["A", "B"] as const) {
        let view = derivePublicView(state, actorId);
        if (view.self.allocationLocked) continue;
        state = applyCommand(state, actorId, {
          type: "ALLOCATE",
          expectedVersion: state.version,
          stage: view.point.stage,
          allocations: chooseAiAllocation(
            aiDecision(
              state,
              actorId,
              seed + step,
              catalog,
              strategy,
              assistPolicy ? baseValues : undefined,
            ),
          ),
        }).state;
        view = derivePublicView(state, actorId);
        state = applyCommand(state, actorId, {
          type: "LOCK_ALLOCATION",
          expectedVersion: state.version,
          stage: view.point.stage,
        }).state;
      }
      continue;
    }
    if (state.phase.endsWith("_SELECTING")) {
      const actorId = state.currentPoint.attackerPlayerId as "A" | "B";
      state = applyCommand(state, actorId, {
        type: "CHOOSE_ATTACK",
        expectedVersion: state.version,
        pairId: chooseAiAttack(
          aiDecision(
            state,
            actorId,
            seed + step,
            catalog,
            strategy,
            assistPolicy ? baseValues : undefined,
          ),
        ),
      }).state;
      continue;
    }
    if (state.phase === "POINT_END" || state.phase === "GAME_END") {
      state = applyCommand(state, "A", {
        type: "ADVANCE",
        expectedVersion: state.version,
      }).state;
      if (cup.eventType !== "olympics" && assistPolicy)
        state = withWorldCupAssists(
          state,
          baseValues,
          assistPolicy,
          seed,
          harimotoSeat,
        );
      continue;
    }
    throw new Error(`Cup simulation reached unsupported phase ${state.phase}`);
  }
  if (state.status !== "COMPLETED")
    throw new Error("Cup match exceeded the simulation safety limit");
  return scoreCompletedGames(state.history).map((game) => ({
    ...game,
    winnerPlayerId: game.winnerPlayerId === "A" ? playerAId : playerBId,
  }));
}

function finishCupMatch(
  cup: WorldCup,
  matchId: string,
  games: CupSetScore[],
): WorldCup {
  const matches = cup.matches.map((item) => ({
    ...item,
    playerIds: [...item.playerIds] as [string | null, string | null],
    games: [...item.games],
  }));
  const current = matches.find((item) => item.id === matchId);
  if (!current || current.status === "complete") return cup;
  const wins = new Map<string, number>();
  games.forEach((game) =>
    wins.set(game.winnerPlayerId, (wins.get(game.winnerPlayerId) ?? 0) + 1),
  );
  const winnerId = [...wins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!winnerId) throw new Error("Cup match result has no winner");
  current.games = games;
  current.visibleGameCount = games.length;
  current.pendingWinnerId = null;
  current.winnerId = winnerId;
  current.status = "complete";
  let championId = cup.championId;
  const finalRound = Math.max(...matches.map((item) => item.round));
  if (current.round < finalRound) {
    const next = matches.find(
      (item) =>
        item.round === current.round + 1 &&
        item.index === Math.floor(current.index / 2),
    );
    if (!next) throw new Error("Cup bracket is missing its next-round match");
    next.playerIds[current.index % 2] = winnerId;
  } else championId = winnerId;
  return {
    ...cup,
    matches,
    phase: championId ? "complete" : "ready",
    activeMatchId: null,
    championId,
  };
}

export function startCpuPlayback(
  cup: WorldCup,
  strategy: AiStrategyVariant = "current",
  catalog: PublicCatalog = browserCatalog,
): WorldCup {
  const match = nextReadyMatch(cup);
  if (!match) return cup.championId ? { ...cup, phase: "complete" } : cup;
  const playerControlled = match.playerIds.includes(cup.humanPlayerId);
  if (playerControlled)
    return { ...cup, phase: "ready", activeMatchId: match.id };
  const games = simulateCupMatch(cup, match, catalog, strategy);
  const matches = cup.matches.map((item) =>
    item.id === match.id
      ? {
          ...item,
          status: "playback" as const,
          games,
          visibleGameCount: 0,
          pendingWinnerId: games[games.length - 1]?.winnerPlayerId ?? null,
        }
      : item,
  );
  return { ...cup, matches, phase: "cpu-playback", activeMatchId: match.id };
}

export function revealNextCupGame(cup: WorldCup): WorldCup {
  const active = cup.matches.find((item) => item.id === cup.activeMatchId);
  if (!active || active.status !== "playback") return cup;
  const count = Math.min(active.games.length, active.visibleGameCount + 1);
  if (count < active.games.length) {
    return {
      ...cup,
      matches: cup.matches.map((item) =>
        item.id === active.id ? { ...item, visibleGameCount: count } : item,
      ),
    };
  }
  const completed = finishCupMatch(cup, active.id, active.games);
  if (
    cup.humanPlayerId &&
    active.games.some((game) => game.winnerPlayerId === cup.humanPlayerId)
  ) {
    const humanWins = active.games.filter(
      (game) => game.winnerPlayerId === cup.humanPlayerId,
    ).length;
    const opponentWins = active.games.length - humanWins;
    if (humanWins < opponentWins)
      return { ...completed, phase: "awaiting-choice" };
  }
  return completed;
}

export function markHumanMatchStarted(
  cup: WorldCup,
  matchId: string,
): WorldCup {
  return {
    ...cup,
    phase: "human-match",
    activeMatchId: matchId,
    activeGameId: null,
    matches: cup.matches.map((item) =>
      item.id === matchId ? { ...item, status: "human" } : item,
    ),
  };
}

export function markHumanGameStarted(
  cup: WorldCup,
  matchId: string,
  gameId: string,
): WorldCup {
  return {
    ...markHumanMatchStarted(cup, matchId),
    activeGameId: gameId,
  };
}

export function recoverHumanMatch(cup: WorldCup, matchId: string): WorldCup {
  return {
    ...cup,
    phase: "ready",
    activeMatchId: null,
    activeGameId: null,
    matches: cup.matches.map((item) =>
      item.id === matchId ? { ...item, status: "pending" } : item,
    ),
  };
}

export function recordHumanMatch(
  cup: WorldCup,
  matchId: string,
  view: MatchPublicView,
): WorldCup {
  const cupMatch = cup.matches.find((item) => item.id === matchId);
  if (!cupMatch) throw new Error("The active cup match could not be found");
  const [a, b] = cupMatch.playerIds;
  if (!a || !b) throw new Error("The active cup match has no assigned players");
  const games = scoreCompletedGames(view.events).map((game) => ({
    ...game,
    winnerPlayerId: game.winnerPlayerId === "A" ? a : b,
  }));
  const completed = finishCupMatch(cup, matchId, games);
  const winner = view.winnerPlayerId === "A" ? a : b;
  if (winner !== cup.humanPlayerId)
    return { ...completed, phase: "awaiting-choice", activeGameId: null };
  if (completed.championId) return { ...completed, activeGameId: null };
  return { ...completed, activeGameId: null };
}

export function continueAsSpectator(cup: WorldCup): WorldCup {
  return { ...cup, phase: nextReadyMatch(cup) ? "ready" : "complete" };
}

export function exitWorldCup(cup: WorldCup): WorldCup {
  return { ...cup, phase: "exited", activeMatchId: null, activeGameId: null };
}

export function saveWorldCup(cup: WorldCup): void {
  try {
    const key =
      cup.eventType === "olympics"
        ? OLYMPICS_STORAGE_KEY
        : WORLD_CUP_STORAGE_KEY;
    window.localStorage.setItem(key, JSON.stringify(cup));
  } catch {
    // The current tournament remains playable in memory if local storage is unavailable.
  }
}

export function loadWorldCup(
  id: string,
  eventType: WorldCup["eventType"] = "world-cup",
): WorldCup | null {
  try {
    const key =
      eventType === "olympics" ? OLYMPICS_STORAGE_KEY : WORLD_CUP_STORAGE_KEY;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const cup = JSON.parse(raw) as WorldCup;
    if (eventType === "olympics")
      return cup.version === 1 && cup.id === id && cup.eventType === "olympics"
        ? cup
        : null;
    return cup.version === 1 && cup.id === id && cup.eventType !== "olympics"
      ? cup
      : null;
  } catch {
    return null;
  }
}

export function saveNewWorldCup(cup: WorldCup): string {
  saveWorldCup(cup);
  return `/world-cup?id=${encodeURIComponent(cup.id)}`;
}

export function completedMatchGames(match: CupMatch): CupSetScore[] {
  return match.games.slice(0, match.visibleGameCount);
}

export function gameWinnerLabel(
  game: CupSetScore,
  cup: WorldCup,
  catalog: PublicCatalog = browserCatalog,
): string {
  return (
    catalog.players.find((player) => player.id === game.winnerPlayerId)?.name ??
    game.winnerPlayerId
  );
}
