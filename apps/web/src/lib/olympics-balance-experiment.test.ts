import { describe, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  olympicsCatalog,
  olympicsSeedTierByPlayer,
} from "./olympics-catalog.js";
import { createOlympics } from "./olympics.js";
import { simulateCupMatch } from "./world-cup.js";

const runExperiment = process.env.RUN_OLYMPICS_BALANCE === "1";
const strategy =
  process.env.OLYMPICS_BALANCE_STRATEGY === "mixed"
    ? "mixed"
    : process.env.OLYMPICS_BALANCE_STRATEGY === "wide-varied"
      ? "wide-varied"
      : "balanced-varied";
const scope =
  process.env.OLYMPICS_BALANCE_SCOPE === "same-tier" ? "same-tier" : "all";
const crossTierRepetitions = Number(process.env.OLYMPICS_CROSS_REPEATS ?? 10);

describe.skipIf(!runExperiment)("Olympics balance experiment", () => {
  it("measures tier matchups and checks same-tier counters over ten simulations", async () => {
    const cup = createOlympics({ seed: 20260930 });
    const baseMatch = cup.matches[0]!;
    const matchupWins = new Map<
      string,
      {
        a: number;
        b: number;
        series: number;
        games: number;
        gameCounts: Record<number, number>;
      }
    >();
    let simulationIndex = 0;
    const runPair = (
      playerA: string,
      playerB: string,
      label: string,
      repetitions = 10,
    ) => {
      const result = matchupWins.get(label) ?? {
        a: 0,
        b: 0,
        series: 0,
        games: 0,
        gameCounts: {},
      };
      for (let sample = 0; sample < repetitions; sample += 1) {
        const forward = {
          ...baseMatch,
          id: `experiment-${simulationIndex}`,
          index: simulationIndex++,
          playerIds: [playerA, playerB] as [string, string],
        };
        const sampleStrategy =
          strategy === "mixed"
            ? (["balanced", "balanced-varied", "wide-varied"] as const)[
                sample % 3
              ]!
            : strategy;
        const games = simulateCupMatch(
          cup,
          forward,
          olympicsCatalog,
          sampleStrategy,
        );
        const aWins = games.filter(
          (game) => game.winnerPlayerId === playerA,
        ).length;
        result.a += Number(aWins > games.length / 2);
        result.b += Number(aWins < games.length / 2);
        result.games += games.length;
        result.series += 1;
        result.gameCounts[games.length] =
          (result.gameCounts[games.length] ?? 0) + 1;
      }
      matchupWins.set(label, result);
    };
    const tiers = [1, 2, 3, 4].map((tier) =>
      olympicsCatalog.players.filter(
        (player) => olympicsSeedTierByPlayer[player.id] === tier,
      ),
    );

    const tierNames = [
      "",
      "超级种子",
      "冠军级种子",
      "世界顶尖级",
      "强力挑战者",
    ];
    if (scope === "all")
      for (const [higher, lower] of [
        [0, 3],
        [1, 2],
      ] as const) {
        for (const playerA of tiers[higher]!)
          for (const playerB of tiers[lower]!)
            runPair(
              playerA.id,
              playerB.id,
              `${tierNames[higher + 1]} vs ${tierNames[lower + 1]}`,
              crossTierRepetitions,
            );
      }
    for (const tier of tiers) {
      for (let first = 0; first < tier.length; first += 1) {
        for (let second = first + 1; second < tier.length; second += 1) {
          runPair(
            tier[first]!.id,
            tier[second]!.id,
            `${tier[first]!.id} vs ${tier[second]!.id}`,
          );
        }
      }
    }

    const report = Object.fromEntries(
      [...matchupWins].map(([label, value]) => [
        label,
        {
          aWins: value.a,
          bWins: value.b,
          seriesCount: value.a + value.b,
          averageGames: Number((value.games / value.series).toFixed(2)),
          gameCounts: value.gameCounts,
          series: value.series,
        },
      ]),
    );
    const crossTier = Object.fromEntries(
      [...matchupWins].filter(([label]) => label.includes("种子 vs ")),
    );
    const sameTier = [...matchupWins].filter(
      ([label]) => label.includes(" vs ") && !label.includes("种子 vs "),
    );
    const failedPairs = sameTier
      .filter(([, value]) => value.a === 0 || value.b === 0)
      .map(([label, value]) => ({ label, aWins: value.a, bWins: value.b }));
    const outputDir = resolve(
      process.cwd(),
      "reports/world-cup-balance-2026-09-30",
    );
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      resolve(outputDir, `olympics-${strategy}-screening.json`),
      `${JSON.stringify({ seed: 20260930, strategy, scope, crossTierRepetitions, sameTierRepetitions: 10, report, failedSameTierPairs: failedPairs }, null, 2)}\n`,
    );
    console.log(
      JSON.stringify(
        {
          crossTier,
          sameTierPairCount: sameTier.length,
          failedSameTierPairs: failedPairs,
        },
        null,
        2,
      ),
    );
  }, 900_000);
});
