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
} from "@paddle-tactics/game-core";
import { chooseAiAllocation, chooseAiAttack } from "@paddle-tactics/ai";
import type { AiDifficulty } from "@paddle-tactics/ai";
import { browserCatalog } from "./catalog.js";

export type LocalMatchSetup = {
  bestOf: 1 | 3 | 5;
  firstServerPlayerId: "A" | "B";
  playerA: MatchPlayerSetup;
  playerB: MatchPlayerSetup;
};

type LocalAiMatch = { difficulty: AiDifficulty; seed: number };
type LocalMatchRecord = { state: MatchState; ai: LocalAiMatch | null };

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
  const state = createMatch({
    ...setup,
    id: globalThis.crypto.randomUUID(),
    catalog: browserCatalog,
    candidateV4: DEFAULT_CANDIDATE_V4_SETTINGS,
  });
  matches.set(state.id, { state, ai: null });
  return { matchId: state.id, view: derivePublicView(state, "A") };
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
  return { matchId, view: derivePublicView(record.state, viewerId) };
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
  if (record.ai) runAiTurns(matchId);
  return derivePublicView(record.state, actorId);
}

function runAiTurns(matchId: string): void {
  const record = matches.get(matchId);
  if (!record?.ai) return;

  // The browser AI is deliberately given only the same viewer-specific view
  // available to a player; hidden allocations stay inside the match state.
  for (let step = 0; step < 8; step += 1) {
    const { state, ai } = record;
    if (state.status !== "ACTIVE") return;
    const view = derivePublicView(state, "B");
    const decision = {
      view,
      skills: browserCatalog.skills,
      difficulty: ai.difficulty,
      seed: (ai.seed + view.version * 31 + step) >>> 0,
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
