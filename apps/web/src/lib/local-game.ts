import {
  applyCommand,
  createMatch,
  DEFAULT_CANDIDATE_V4_SETTINGS,
  derivePublicView,
} from "@paddle-tactics/game-core";
import type {
  GameCommand,
  MatchPlayerSetup,
  MatchPublicView,
  MatchState,
  PlayerId,
  ProjectBattleValues,
} from "@paddle-tactics/game-core";
import { chooseAiAllocation, chooseAiAttack } from "@paddle-tactics/ai";
import type { AiDifficulty } from "@paddle-tactics/ai";
import { browserCatalog } from "./catalog.js";
import type { PublicCatalog } from "./catalog.js";
import { WORLD_CUP_V43_POLICY, withWorldCupAssists } from "./world-cup.js";

export type LocalMatchSetup = {
  bestOf: 1 | 3 | 5;
  firstServerPlayerId: "A" | "B";
  playerA: MatchPlayerSetup;
  playerB: MatchPlayerSetup;
  catalog?: PublicCatalog;
  worldCupV43?: { harimotoSeat: PlayerId | null; seed: number };
};

type LocalAiMatch = { difficulty: AiDifficulty; seed: number };
type LocalMatchRecord = {
  state: MatchState;
  ai: LocalAiMatch | null;
  catalog: PublicCatalog;
  worldCupV43: LocalMatchSetup["worldCupV43"];
  baseValues: Record<PlayerId, ProjectBattleValues> | null;
};

const matches = new Map<string, LocalMatchRecord>();

export class LocalMatchNotFoundError extends Error {
  constructor() {
    super("本地比赛已失效，请重新开始");
    this.name = "LocalMatchNotFoundError";
  }
}

export class LocalMatchAccessError extends Error {
  constructor() {
    super("AI 对局由 AI 控制另一方选手");
    this.name = "LocalMatchAccessError";
  }
}

export function createLocalMatch(setup: LocalMatchSetup): {
  matchId: string;
  view: MatchPublicView;
} {
  const { catalog = browserCatalog, worldCupV43, ...matchSetup } = setup;
  let state = createMatch({
    ...matchSetup,
    id: globalThis.crypto.randomUUID(),
    catalog,
    candidateV4: DEFAULT_CANDIDATE_V4_SETTINGS,
  });
  const baseValues = worldCupV43
    ? {
        A: structuredClone(state.players.A!.projectBattleValues),
        B: structuredClone(state.players.B!.projectBattleValues),
      }
    : null;
  if (worldCupV43 && baseValues)
    state = withWorldCupAssists(
      state,
      baseValues,
      WORLD_CUP_V43_POLICY,
      worldCupV43.seed,
      worldCupV43.harimotoSeat,
    );
  matches.set(state.id, {
    state,
    ai: null,
    catalog,
    worldCupV43,
    baseValues,
  });
  return { matchId: state.id, view: getLocalMatchView(state.id, "A").view };
}

export function createLocalAiMatch(
  setup: LocalMatchSetup & { difficulty: AiDifficulty },
): { matchId: string; view: MatchPublicView } {
  const created = createLocalMatch(setup);
  const record = matches.get(created.matchId);
  if (!record) throw new LocalMatchNotFoundError();
  record.ai = {
    difficulty: setup.difficulty,
    seed: seedFromMatchId(created.matchId),
  };
  runAiTurns(created.matchId);
  return getLocalMatchView(created.matchId, "A");
}

export function getLocalMatchView(
  matchId: string,
  viewerId: PlayerId,
): { matchId: string; view: MatchPublicView } {
  const record = matches.get(matchId);
  if (!record) throw new LocalMatchNotFoundError();
  if (record.ai && viewerId !== "A") throw new LocalMatchAccessError();
  return { matchId, view: localPublicView(record, viewerId) };
}

export function sendLocalMatchCommand(
  matchId: string,
  actorId: PlayerId,
  command: GameCommand,
): MatchPublicView {
  const record = matches.get(matchId);
  if (!record) throw new LocalMatchNotFoundError();
  if (record.ai && actorId !== "A") throw new LocalMatchAccessError();

  record.state = applyCommand(record.state, actorId, command).state;
  if (
    command.type === "ADVANCE" &&
    record.worldCupV43 &&
    record.baseValues &&
    record.state.status === "ACTIVE"
  )
    record.state = withWorldCupAssists(
      record.state,
      record.baseValues,
      WORLD_CUP_V43_POLICY,
      record.worldCupV43.seed,
      record.worldCupV43.harimotoSeat,
    );
  if (record.ai) runAiTurns(matchId);
  return localPublicView(record, actorId);
}

function localPublicView(
  record: LocalMatchRecord,
  viewerId: PlayerId,
): MatchPublicView {
  const view = derivePublicView(record.state, viewerId);
  if (record.baseValues) {
    const opponentId = view.opponent.id;
    view.opponent.projectBattleValues = structuredClone(
      record.baseValues[opponentId]!,
    );
    if (view.visibleAttackTop)
      view.visibleAttackTop = record.state.rules.stages[view.point.stage].pairs
        .map((pair) => ({
          pairId: pair.id,
          base: record.baseValues![opponentId]![pair.id]!.attack,
        }))
        .sort((a, b) => b.base - a.base || a.pairId.localeCompare(b.pairId))
        .slice(0, record.state.rules.defenderVisibleTopK);
  }
  return view;
}

function runAiTurns(matchId: string): void {
  const record = matches.get(matchId);
  if (!record?.ai) return;

  // The browser AI is deliberately given only the same viewer-specific view
  // available to a player; hidden allocations stay inside the match state.
  for (let step = 0; step < 8; step += 1) {
    const { state, ai } = record;
    if (state.status !== "ACTIVE") return;
    const view = localPublicView(record, "B");
    const decision = {
      view,
      skills: record.catalog.skills,
      difficulty: ai.difficulty,
      seed: (ai.seed + view.version * 31 + step) >>> 0,
      ...(ai.difficulty === "normal"
        ? { strategy: "wide-varied" as const }
        : {}),
    };

    if (view.phase.endsWith("_ALLOCATING")) {
      if (view.self.allocationLocked) return;
      const allocated = applyCommand(state, "B", {
        type: "ALLOCATE",
        expectedVersion: state.version,
        stage: view.point.stage,
        allocations: chooseAiAllocation(decision),
      }).state;
      record.state = applyCommand(allocated, "B", {
        type: "LOCK_ALLOCATION",
        expectedVersion: allocated.version,
        stage: view.point.stage,
      }).state;
      continue;
    }

    if (
      view.phase.endsWith("_SELECTING") &&
      view.point.attackerPlayerId === "B"
    ) {
      record.state = applyCommand(state, "B", {
        type: "CHOOSE_ATTACK",
        expectedVersion: state.version,
        pairId: chooseAiAttack(decision),
      }).state;
      continue;
    }
    return;
  }
}

function seedFromMatchId(matchId: string): number {
  let seed = 2166136261;
  for (const character of matchId) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}
