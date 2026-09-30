import {
  applyCommand,
  createMatch,
  DEFAULT_CANDIDATE_V4_SETTINGS,
  derivePublicView,
} from "@paddle-tactics/game-core";
import { chooseAiAllocation, chooseAiAttack } from "@paddle-tactics/ai";
import type { AiDifficulty } from "@paddle-tactics/ai";
import { randomUUID } from "node:crypto";
import type {
  GameCommand,
  MatchPlayerSetup,
  MatchState,
  MatchPublicView,
  PlayerId,
} from "@paddle-tactics/game-core";
import type { GameCatalog } from "@paddle-tactics/game-data";

export type NewSandboxMatch = {
  bestOf: number;
  firstServerPlayerId: PlayerId;
  playerA: MatchPlayerSetup;
  playerB: MatchPlayerSetup;
};

export type NewAiMatch = NewSandboxMatch & { difficulty: AiDifficulty };

export class SandboxNotFoundError extends Error {
  constructor() {
    super("Sandbox match was not found");
    this.name = "SandboxNotFoundError";
  }
}

export class SandboxAccessError extends Error {
  constructor() {
    super("This match is controlled by the AI opponent");
    this.name = "SandboxAccessError";
  }
}

/** Development-only in-memory room. The full state never leaves this service. */
export class SandboxService {
  private readonly matches = new Map<string, MatchState>();
  private readonly aiMatches = new Map<
    string,
    { difficulty: AiDifficulty; seed: number }
  >();

  constructor(private readonly catalog: GameCatalog) {}

  create(input: NewSandboxMatch): { matchId: string; view: MatchPublicView } {
    const state = this.createState(input);
    this.matches.set(state.id, state);
    return {
      matchId: state.id,
      view: derivePublicView(state, input.playerA.id),
    };
  }

  createAi(input: NewAiMatch): { matchId: string; view: MatchPublicView } {
    const state = this.createState(input);
    this.matches.set(state.id, state);
    this.aiMatches.set(state.id, {
      difficulty: input.difficulty,
      seed: seedFromMatchId(state.id),
    });
    this.runAiTurns(state.id);
    return {
      matchId: state.id,
      view: derivePublicView(this.matches.get(state.id)!, "A"),
    };
  }

  get(matchId: string, viewerId: PlayerId): MatchPublicView {
    const state = this.matches.get(matchId);
    if (!state) throw new SandboxNotFoundError();
    if (this.aiMatches.has(matchId) && viewerId !== "A")
      throw new SandboxAccessError();
    return derivePublicView(state, viewerId);
  }

  command(
    matchId: string,
    actorId: PlayerId,
    command: GameCommand,
  ): MatchPublicView {
    const state = this.matches.get(matchId);
    if (!state) throw new SandboxNotFoundError();
    if (this.aiMatches.has(matchId) && actorId !== "A")
      throw new SandboxAccessError();
    const result = applyCommand(state, actorId, command);
    this.matches.set(matchId, result.state);
    if (this.aiMatches.has(matchId)) this.runAiTurns(matchId);
    const finalState = this.matches.get(matchId)!;
    return derivePublicView(finalState, actorId);
  }

  private createState(input: NewSandboxMatch): MatchState {
    return createMatch({
      ...input,
      id: randomUUID(),
      catalog: this.catalog,
      candidateV4: DEFAULT_CANDIDATE_V4_SETTINGS,
    });
  }

  private runAiTurns(matchId: string): void {
    const ai = this.aiMatches.get(matchId);
    if (!ai) return;

    // Every AI decision receives only the same viewer-specific DTO a human gets.
    // A bounded loop guards against an accidental non-advancing state transition.
    for (let step = 0; step < 8; step += 1) {
      const state = this.matches.get(matchId);
      if (!state || state.status !== "ACTIVE") return;
      const view = derivePublicView(state, "B");
      const decision = {
        view,
        skills: this.catalog.skills,
        difficulty: ai.difficulty,
        seed: (ai.seed + view.version * 31 + step) >>> 0,
      };

      if (view.phase.endsWith("_ALLOCATING")) {
        if (view.self.allocationLocked) return;
        const allocation = chooseAiAllocation(decision);
        const allocated = applyCommand(state, "B", {
          type: "ALLOCATE",
          expectedVersion: state.version,
          stage: view.point.stage,
          allocations: allocation,
        }).state;
        const locked = applyCommand(allocated, "B", {
          type: "LOCK_ALLOCATION",
          expectedVersion: allocated.version,
          stage: view.point.stage,
        }).state;
        this.matches.set(matchId, locked);
        continue;
      }

      if (
        view.phase.endsWith("_SELECTING") &&
        view.point.attackerPlayerId === "B"
      ) {
        const pairId = chooseAiAttack(decision);
        const next = applyCommand(state, "B", {
          type: "CHOOSE_ATTACK",
          expectedVersion: state.version,
          pairId,
        }).state;
        this.matches.set(matchId, next);
        continue;
      }

      return;
    }
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
