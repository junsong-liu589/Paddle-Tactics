import { describe, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import baselineRoster from "../../../../data/olympics-roster-v4.json";
import { PlayerSchema, type Player } from "@paddle-tactics/game-data/schema";
import { browserCatalog } from "./catalog.js";
import { olympicsSeedTierByPlayer } from "./olympics-catalog.js";
import { createOlympics } from "./olympics.js";
import {
  chooseStyleLoadout,
  simulateCupMatch,
  type CupMatch,
} from "./world-cup.js";

const enabled = process.env.RUN_OLYMPICS_V43_EXPERIMENT === "1";
const target = process.env.OLYMPICS_V43_TARGET ?? "harimoto";
const phase = process.env.OLYMPICS_V43_PHASE ?? "pilot";
const harimoto = "tomokazu-harimoto";
const maLin = "ma-lin";
const baselineCatalog = {
  ...browserCatalog,
  players: PlayerSchema.array().parse(baselineRoster.players),
};

function editRoster(
  playerId: string,
  delta: number,
  profile:
    | "low"
    | "defense"
    | "backhand"
    | "high"
    | "mix10"
    | "mix2"
    | "mix3"
    | "mix4"
    | "mix6"
    | "mix15"
    | "mix20" = "low",
) {
  const catalog = structuredClone(baselineCatalog);
  const player = catalog.players.find((item) => item.id === playerId)!;
  const cells = Object.entries(player.stats).flatMap(([pairId, values]) =>
    (["attack", "defense"] as const).flatMap((role) =>
      (["forehand", "backhand"] as const).map((side) => ({
        pairId,
        role,
        side,
        value: values[role][side],
      })),
    ),
  );
  if (delta > 0) {
    const eligible = cells.filter((cell) => cell.value < 8);
    const defenseFirst = [...eligible].sort(
      (a, b) =>
        Number(b.role === "defense") - Number(a.role === "defense") ||
        a.value - b.value ||
        a.pairId.localeCompare(b.pairId),
    );
    eligible.sort(
      (a, b) =>
        (profile === "defense"
          ? Number(b.role === "defense") - Number(a.role === "defense")
          : profile === "backhand"
            ? Number(b.side === "backhand") - Number(a.side === "backhand")
            : 0) ||
        (profile === "high" ? b.value - a.value : a.value - b.value) ||
        Number(b.side === "backhand") - Number(a.side === "backhand") ||
        Number(b.role === "attack") - Number(a.role === "attack") ||
        a.pairId.localeCompare(b.pairId),
    );
    const defenseCount =
      profile === "mix2"
        ? 2
        : profile === "mix3"
          ? 3
          : profile === "mix4"
            ? 4
            : profile === "mix6"
              ? 6
              : profile === "mix10"
                ? 10
                : profile === "mix15"
                  ? 15
                  : profile === "mix20"
                    ? 20
                    : 0;
    const first = defenseFirst.slice(0, defenseCount);
    const selected = [
      ...first,
      ...eligible
        .filter(
          (cell) =>
            !first.some(
              (item) =>
                item.pairId === cell.pairId &&
                item.role === cell.role &&
                item.side === cell.side,
            ),
        )
        .slice(0, delta - defenseCount),
    ];
    for (const cell of selected) {
      if (cell.value >= 8) throw new Error("No legal cell remains to raise");
      player.stats[cell.pairId]![cell.role][cell.side] += 1;
    }
  } else {
    cells.sort(
      (a, b) =>
        Number(b.value === 9) - Number(a.value === 9) ||
        b.value - a.value ||
        Number(b.role === "attack") - Number(a.role === "attack") ||
        a.pairId.localeCompare(b.pairId),
    );
    for (const cell of cells.slice(0, -delta)) {
      if (cell.value <= 5) throw new Error("No legal cell remains to lower");
      player.stats[cell.pairId]![cell.role][cell.side] -= 1;
    }
  }
  player.baseTotal += delta;
  return catalog;
}

function measure(
  playerId: string,
  delta: number,
  profile:
    | "low"
    | "defense"
    | "backhand"
    | "high"
    | "mix10"
    | "mix2"
    | "mix3"
    | "mix4"
    | "mix6"
    | "mix15"
    | "mix20" = "low",
) {
  const catalog =
    delta === 0 ? baselineCatalog : editRoster(playerId, delta, profile);
  const cup = createOlympics({ seed: 20261001, catalog });
  const opponents = catalog.players.filter((player) =>
    playerId === harimoto
      ? (olympicsSeedTierByPlayer[player.id] === 2 ||
          olympicsSeedTierByPlayer[player.id] === 3) &&
        player.id !== playerId
      : olympicsSeedTierByPlayer[player.id] === 1 && player.id !== playerId,
  );
  const summary = {
    playerId,
    delta,
    profile,
    newTotal: catalog.players.find((item) => item.id === playerId)!.baseTotal,
    loadout: chooseStyleLoadout(playerId, catalog),
    matches: 0,
    wins: 0,
    sweeps: 0,
    games: 0,
    lowScoreGames: 0,
    opponents: {} as Record<string, { wins: number; matches: number }>,
  };
  for (const [index, opponent] of opponents.entries()) {
    for (const swap of [false, true]) {
      const [a, b] = swap ? [opponent.id, playerId] : [playerId, opponent.id];
      const match: CupMatch = {
        id: `olympics-v43-${index}`,
        round: 0,
        index,
        playerIds: [a, b],
        status: "pending",
        games: [],
        visibleGameCount: 0,
        pendingWinnerId: null,
        winnerId: null,
      };
      const games = simulateCupMatch(
        cup,
        match,
        catalog,
        "wide-varied",
        swap ? "B" : "A",
      );
      const won =
        games.filter((game) => game.winnerPlayerId === playerId).length >= 4;
      summary.matches += 1;
      summary.wins += Number(won);
      summary.sweeps += Number(games.length === 4);
      summary.games += games.length;
      const opponentRow = (summary.opponents[opponent.id] ??= {
        wins: 0,
        matches: 0,
      });
      opponentRow.matches += 1;
      opponentRow.wins += Number(won);
      for (const game of games) {
        const points = a === playerId ? game.a : game.b;
        summary.lowScoreGames += Number(points < 3);
      }
    }
  }
  return summary;
}

describe.skipIf(!enabled)("Olympics V4.3 targeted roster experiment", () => {
  it("compares only the requested player with seeded peer matchups", async () => {
    const candidates: Array<{
      delta: number;
      profile:
        | "low"
        | "defense"
        | "backhand"
        | "high"
        | "mix10"
        | "mix2"
        | "mix3"
        | "mix4"
        | "mix6"
        | "mix15"
        | "mix20";
    }> =
      target === "harimoto"
        ? phase === "mix"
          ? (["mix2", "mix3", "mix4"] as const).map((profile) => ({
              delta: 30,
              profile,
            }))
          : phase === "profiles"
            ? (["low", "defense", "backhand", "high"] as const).map(
                (profile) => ({ delta: 30, profile }),
              )
            : [0, 20, 30, 40].map((delta) => ({ delta, profile: "low" }))
        : (phase === "fine" ? [0, -5, -8, -10] : [0, -10, -20, -30]).map(
            (delta) => ({ delta, profile: "low" }),
          );
    const id = target === "harimoto" ? harimoto : maLin;
    const results = candidates.map(({ delta, profile }) => {
      const result = measure(id, delta, profile);
      console.log(JSON.stringify(result));
      return result;
    });
    const directory = resolve(process.cwd(), "reports/world-cup-v4.3");
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, `olympics-${target}-${phase}.json`),
      `${JSON.stringify(results, null, 2)}\n`,
    );
  }, 900_000);
});

export function applyOlympicsV43RosterChanges(
  harimotoDelta: number,
  maLinDelta: number,
): Player[] {
  const withHarimoto = editRoster(harimoto, harimotoDelta);
  const maLinChanged = editRoster(maLin, maLinDelta).players.find(
    (player) => player.id === maLin,
  )!;
  return withHarimoto.players.map((player) =>
    player.id === maLin ? maLinChanged : player,
  );
}

describe.skipIf(process.env.RUN_OLYMPICS_V43_GENERATE !== "1")(
  "Olympics V4.3 versioned roster",
  () => {
    it("changes only Harimoto and Ma Lin while keeping their draw tiers", async () => {
      const players = applyOlympicsV43RosterChanges(30, -8);
      const changed = players
        .filter(
          (player, index) =>
            JSON.stringify(player.stats) !==
            JSON.stringify(baselineRoster.players[index]!.stats),
        )
        .map((player) => player.id);
      if (changed.join(",") !== "ma-lin,tomokazu-harimoto")
        throw new Error(`Unexpected changed players: ${changed.join(",")}`);
      const entries = players.map((player, index) => ({
        ...player,
        country: baselineRoster.players[index]!.country,
        seedTier: baselineRoster.players[index]!.seedTier,
        seedLabel: baselineRoster.players[index]!.seedLabel,
        exclusiveToOlympics: baselineRoster.players[index]!.exclusiveToOlympics,
      }));
      const path = resolve(process.cwd(), "data/olympics-roster-v4.3.json");
      await writeFile(
        path,
        `${JSON.stringify({ ...baselineRoster, players: entries }, null, 2)}\n`,
      );
    });
  },
);
