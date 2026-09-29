import {
  applyCommand,
  createMatch,
  derivePublicView,
} from "@paddle-tactics/game-core";
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

export class SandboxNotFoundError extends Error {
  constructor() {
    super("Sandbox match was not found");
    this.name = "SandboxNotFoundError";
  }
}

/** Development-only in-memory room. The full state never leaves this service. */
export class SandboxService {
  private readonly matches = new Map<string, MatchState>();

  constructor(private readonly catalog: GameCatalog) {}

  create(input: NewSandboxMatch): { matchId: string; view: MatchPublicView } {
    const state = createMatch({
      ...input,
      id: randomUUID(),
      catalog: this.catalog,
    });
    this.matches.set(state.id, state);
    return {
      matchId: state.id,
      view: derivePublicView(state, input.playerA.id),
    };
  }

  get(matchId: string, viewerId: PlayerId): MatchPublicView {
    const state = this.matches.get(matchId);
    if (!state) throw new SandboxNotFoundError();
    return derivePublicView(state, viewerId);
  }

  command(
    matchId: string,
    actorId: PlayerId,
    command: GameCommand,
  ): MatchPublicView {
    const state = this.matches.get(matchId);
    if (!state) throw new SandboxNotFoundError();
    const result = applyCommand(state, actorId, command);
    this.matches.set(matchId, result.state);
    return derivePublicView(result.state, actorId);
  }
}
