import { describe, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { browserCatalog } from "./catalog.js";
import {
  createWorldCup,
  simulateCupMatch,
  type CupMatch,
  type WorldCupAssistPolicy,
} from "./world-cup.js";

const enabled = process.env.RUN_WORLD_CUP_V43_EXPERIMENT === "1";
const mode = process.env.WORLD_CUP_V43_EXPERIMENT_MODE ?? "harimoto";
const roster = browserCatalog.players.map((player) => player.id);
const harimoto = "tomokazu-harimoto";
const seed = 20261001;

type Summary = {
  policy: string;
  series: number;
  harimotoSeries: number;
  harimotoWins: number;
  harimotoGames: number;
  harimotoLowGames: number;
  harimotoZeroGames: number;
  sweeps: number;
  gameCounts: Record<number, number>;
};

function policy(
  base: number,
  gap: number,
  two: number,
  three: number,
  spread: WorldCupAssistPolicy["spread"] = "ten",
  signature = 0,
): WorldCupAssistPolicy {
  return {
    harimotoBaseBonus: base,
    harimotoGapBonus: gap,
    harimotoGapThreshold: 5,
    atTwoZero: two,
    atThreeZero: three,
    spread,
    harimotoSignatureBonus: signature,
  };
}

const candidates: Array<[string, WorldCupAssistPolicy | null]> =
  mode === "harimoto"
    ? [
        ["baseline", null],
        ["base1-gap1", policy(1, 1, 0, 0)],
        ["base2-gap1", policy(2, 1, 0, 0)],
        ["base3-gap1", policy(3, 1, 0, 0)],
      ]
    : mode === "harimoto-fine"
      ? [
          ["gap1", policy(0, 1, 0, 0)],
          ["base0.5-gap1", policy(0.5, 1, 0, 0)],
          ["base0.75-gap1", policy(0.75, 1, 0, 0)],
          ["base1", policy(1, 0, 0, 0)],
          ["base0.5", policy(0.5, 0, 0, 0)],
        ]
      : mode === "series"
        ? [
            ["baseline", null],
            ["30-60-ten", policy(0, 0, 30, 60)],
            ["30-60-all", policy(0, 0, 30, 60, "all")],
            ["30-90-ten", policy(0, 0, 30, 90)],
          ]
        : mode === "confirm-harimoto" || mode === "confirm-series"
          ? [0, 1, 2, 3].map((index) => [
              `confirm-${index}`,
              policy(0.93, 2, 30, 60, "ten", 0.12),
            ])
          : mode === "fine-combined"
            ? [
                ["signature0.12", policy(0.93, 2, 30, 60, "ten", 0.12)],
                ["signature0.15", policy(0.93, 2, 30, 60, "ten", 0.15)],
                ["signature0.18", policy(0.93, 2, 30, 60, "ten", 0.18)],
              ]
            : [
                ["base0.85-gap1-30-60", policy(0.85, 1, 30, 60)],
                ["base0.9-gap1-30-60", policy(0.9, 1, 30, 60)],
                ["base1-gap1-30-60", policy(1, 1, 30, 60)],
                ["base0.9-gap1.5-30-60", policy(0.9, 1.5, 30, 60)],
              ];

function runCandidate(
  name: string,
  candidate: WorldCupAssistPolicy | null,
): Summary {
  const cupSeed = name.startsWith("confirm-")
    ? seed + Number(name.slice("confirm-".length)) * 1111
    : seed;
  const cup = createWorldCup({ seed: cupSeed });
  const summary: Summary = {
    policy: name,
    series: 0,
    harimotoSeries: 0,
    harimotoWins: 0,
    harimotoGames: 0,
    harimotoLowGames: 0,
    harimotoZeroGames: 0,
    sweeps: 0,
    gameCounts: {},
  };
  const pairs =
    mode !== "series" && mode !== "confirm-series"
      ? roster
          .filter((id) => id !== harimoto)
          .map((id) => [harimoto, id] as const)
      : [
          ["ma-long", "fan-zhendong"],
          ["zhang-jike", "xu-xin"],
          ["wang-chuqin", "lin-gaoyuan"],
          ["truls-moregard", "ma-long"],
          ["fan-zhendong", "wang-chuqin"],
          ["xu-xin", "lin-gaoyuan"],
        ];
  for (const [pairIndex, [first, second]] of pairs.entries()) {
    for (const swap of [false, true]) {
      for (const server of ["A", "B"] as const) {
        const [a, b] = swap ? [second, first] : [first, second];
        const match: CupMatch = {
          id: `v43-${pairIndex}`,
          round: 0,
          index: pairIndex,
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
          browserCatalog,
          "wide-varied",
          server,
          candidate,
        );
        const winsA = games.filter((game) => game.winnerPlayerId === a).length;
        const winner = winsA >= 4 ? a : b;
        summary.series += 1;
        summary.sweeps += Number(games.length === 4);
        summary.gameCounts[games.length] =
          (summary.gameCounts[games.length] ?? 0) + 1;
        if (a === harimoto || b === harimoto) {
          summary.harimotoSeries += 1;
          summary.harimotoWins += Number(winner === harimoto);
          for (const game of games) {
            const points = a === harimoto ? game.a : game.b;
            summary.harimotoGames += 1;
            summary.harimotoLowGames += Number(points < 3);
            summary.harimotoZeroGames += Number(points === 0);
          }
        }
      }
    }
  }
  return summary;
}

describe.skipIf(!enabled)("World Cup V4.3 balance experiment", () => {
  it("compares paired seats and first servers", async () => {
    const results = candidates.map(([name, candidate]) => {
      const result = runCandidate(name, candidate);
      console.log(JSON.stringify(result));
      return result;
    });
    const directory = resolve(process.cwd(), "reports/world-cup-v4.3");
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, `${mode}-pilot.json`),
      `${JSON.stringify({ seed, mode, candidates, results }, null, 2)}\n`,
    );
  }, 900_000);
});
