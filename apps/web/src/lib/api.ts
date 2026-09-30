import type { Loadout } from "@paddle-tactics/game-core";
import { browserCatalog } from "./catalog.js";
import type { PublicCatalog } from "./catalog.js";

export type { PublicCatalog } from "./catalog.js";

export type SandboxSetup = {
  bestOf: 1 | 3 | 5;
  firstServerPlayerId: "A" | "B";
  playerA: { id: "A"; loadout: Loadout };
  playerB: { id: "B"; loadout: Loadout };
};

/** Load the bundled, validated catalog without making a network request. */
export async function fetchCatalog(): Promise<PublicCatalog> {
  return browserCatalog;
}
