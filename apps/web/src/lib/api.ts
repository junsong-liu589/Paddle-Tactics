import type {
  BalanceConfig,
  Blade,
  Player,
  Rubber,
  SkillCatalog,
} from "@paddle-tactics/game-data";
import type {
  GameCommand,
  Loadout,
  MatchPublicView,
  PlayerId,
} from "@paddle-tactics/game-core";

export type PublicCatalog = {
  version: string;
  players: Player[];
  blades: Blade[];
  rubbers: Rubber[];
  skills: SkillCatalog;
  balance: BalanceConfig;
};

export type SandboxSetup = {
  bestOf: 1 | 3 | 5;
  firstServerPlayerId: "A" | "B";
  playerA: { id: "A"; loadout: Loadout };
  playerB: { id: "B"; loadout: Loadout };
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String(body.message)
        : "请求失败，请检查本地服务后重试";
    throw new Error(message);
  }
  return body as T;
}

export function fetchCatalog(): Promise<PublicCatalog> {
  return requestJson("/api/catalog");
}

export function createSandboxMatch(setup: SandboxSetup): Promise<{
  matchId: string;
  view: MatchPublicView;
}> {
  return requestJson("/api/sandbox/matches", {
    method: "POST",
    body: JSON.stringify(setup),
  });
}

export async function getSandboxView(
  matchId: string,
  viewerId: PlayerId,
): Promise<MatchPublicView> {
  const result = await requestJson<{ view: MatchPublicView }>(
    `/api/sandbox/matches/${encodeURIComponent(matchId)}?viewerId=${viewerId}`,
  );
  return result.view;
}

export async function sendSandboxCommand(
  matchId: string,
  actorId: PlayerId,
  command: GameCommand,
): Promise<MatchPublicView> {
  const result = await requestJson<{ view: MatchPublicView }>(
    `/api/sandbox/matches/${encodeURIComponent(matchId)}/commands`,
    { method: "POST", body: JSON.stringify({ actorId, command }) },
  );
  return result.view;
}
