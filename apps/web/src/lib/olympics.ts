import type { Loadout } from "@paddle-tactics/game-core";
import { createWorldCup, type WorldCup } from "./world-cup.js";
import type { PublicCatalog } from "./catalog.js";
import {
  olympicsCatalog,
  olympicsSeedTierByPlayer,
} from "./olympics-catalog.js";

function randomSeed(): number {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues)
    globalThis.crypto.getRandomValues(values);
  else values[0] = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  return values[0]!;
}

function shuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

export function drawOlympicBracket(seed: number): string[] {
  const tiers = [1, 2, 3, 4].map((tier) =>
    shuffle(
      olympicsCatalog.players
        .filter((player) => olympicsSeedTierByPlayer[player.id] === tier)
        .map((player) => player.id),
      seed ^ Math.imul(tier + 1, 0x9e3779b1),
    ),
  );
  if (tiers.some((players) => players.length !== 8))
    throw new Error(
      "The Olympic draw requires exactly eight players per seed tier",
    );

  const draw: string[] = [];
  for (let pod = 0; pod < 8; pod += 1) {
    const top = tiers[0]![pod]!;
    const second = tiers[1]![pod]!;
    const third = tiers[2]![pod]!;
    const fourth = tiers[3]![pod]!;
    const orientation = shuffle([0, 1], seed ^ Math.imul(pod + 1, 0x85ebca6b));
    const openingA = orientation[0] === 0 ? [top, fourth] : [fourth, top];
    const openingB = orientation[1] === 0 ? [second, third] : [third, second];
    draw.push(...openingA, ...openingB);
  }
  return draw;
}

export function createOlympics(
  options: {
    humanPlayerId?: string;
    humanLoadout?: Loadout;
    favoritePlayerId?: string;
    seed?: number;
    catalog?: PublicCatalog;
  } = {},
): WorldCup {
  const seed = options.seed ?? randomSeed();
  const catalog = options.catalog ?? olympicsCatalog;
  const expectedIds = olympicsCatalog.players.map((player) => player.id);
  if (
    catalog.players.length !== 32 ||
    expectedIds.some((id) => !catalog.players.some((p) => p.id === id))
  )
    throw new Error("Olympics requires the complete 32-player Olympic catalog");
  return createWorldCup({
    ...options,
    seed,
    catalog,
    drawOrder: drawOlympicBracket(seed),
    eventType: "olympics",
    seedTierByPlayer: olympicsSeedTierByPlayer,
  });
}
