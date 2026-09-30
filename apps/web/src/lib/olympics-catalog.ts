import rosterData from "../../../../data/olympics-roster-v4.3.json";
import { PlayerSchema } from "@paddle-tactics/game-data/schema";
import type { Player } from "@paddle-tactics/game-data/schema";
import { browserCatalog } from "./catalog.js";
import type { PublicCatalog } from "./catalog.js";

export type OlympicSeedTier = 1 | 2 | 3 | 4;
export type OlympicRosterPlayer = Player & {
  country: string;
  seedTier: OlympicSeedTier;
  seedLabel: string;
  exclusiveToOlympics: boolean;
};

const olympicPlayers = (rosterData.players as OlympicRosterPlayer[]).map(
  (entry) => ({
    ...PlayerSchema.parse(entry),
    country: entry.country,
    seedTier: entry.seedTier,
    seedLabel: entry.seedLabel,
    exclusiveToOlympics: entry.exclusiveToOlympics,
  }),
);

export const olympicsCatalog: PublicCatalog = {
  ...browserCatalog,
  players: olympicPlayers,
};

export const olympicsSeedTierByPlayer = Object.fromEntries(
  olympicPlayers.map((player) => [player.id, player.seedTier]),
) as Record<string, OlympicSeedTier>;

export function olympicTierLabel(playerId: string): string {
  return (
    olympicPlayers.find((player) => player.id === playerId)?.seedLabel ??
    "种子待定"
  );
}
