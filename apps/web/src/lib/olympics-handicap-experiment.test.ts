import { describe, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  applyCommand,
  createMatch,
  DEFAULT_CANDIDATE_V4_SETTINGS,
  derivePublicView,
} from "@paddle-tactics/game-core";
import type {
  MatchState,
  PlayerId,
  ProjectBattleValues,
} from "@paddle-tactics/game-core";
import { chooseAiAllocation, chooseAiAttack } from "@paddle-tactics/ai";
import type { AiStrategyVariant } from "@paddle-tactics/ai";
import {
  olympicsCatalog,
  olympicsSeedTierByPlayer,
} from "./olympics-catalog.js";
import { createOlympics } from "./olympics.js";

type Policy = { atTwoZero: number; atThreeZero: number };
type Aggregate = {
  series: number;
  games: number;
  winsA: number;
  winsB: number;
  gameCounts: Record<number, number>;
};

const ENABLED = process.env.RUN_OLYMPICS_HANDICAP_EXPERIMENT === "1";
const POLICY = process.env.OLYMPICS_HANDICAP_POLICY ?? "10-20";
const REPETITIONS = Number(process.env.OLYMPICS_HANDICAP_REPEATS ?? 3);
const SCOPE = process.env.OLYMPICS_HANDICAP_SCOPE ?? "pilot";
const STRATEGY: AiStrategyVariant = "wide-varied";
const POLICIES: Record<string, Policy> = {
  "10-20": { atTwoZero: 10, atThreeZero: 20 },
  "20-30": { atTwoZero: 20, atThreeZero: 30 },
  "30-40": { atTwoZero: 30, atThreeZero: 40 },
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function cloneValues(values: ProjectBattleValues): ProjectBattleValues {
  return structuredClone(values);
}

function addRandomBonus(
  values: ProjectBattleValues,
  points: number,
  seed: number,
): ProjectBattleValues {
  const result = cloneValues(values);
  const cells = Object.entries(result).flatMap(([pairId]) =>
    (["attack", "defense"] as const).map((role) => ({ pairId, role })),
  );
  const random = seededRandom(seed);
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [cells[index], cells[other]] = [cells[other]!, cells[index]!];
  }
  // Experimental interpretation: distribute the full budget evenly across
  // ten randomly selected comparison abilities. These values can exceed the
  // normal stat ceiling only inside this isolated simulation.
  for (const { pairId, role } of cells.slice(0, 10))
    result[pairId]![role] += points / 10;
  return result;
}

function maskedAiView(
  state: MatchState,
  viewerId: PlayerId,
  baseValues: Record<PlayerId, ProjectBattleValues>,
) {
  const view = derivePublicView(state, viewerId);
  // Keep the hypothetical catch-up bonus concealed from both AIs until the
  // ordinary comparison event reveals an affected ability.
  view.self.projectBattleValues = cloneValues(baseValues[viewerId]!);
  const opponentId = view.opponent.id;
  view.opponent.projectBattleValues = cloneValues(baseValues[opponentId]!);
  if (view.visibleAttackTop)
    view.visibleAttackTop = view.visibleAttackTop.map((item) => ({
      ...item,
      base: baseValues[opponentId]![item.pairId]!.attack,
    }));
  return view;
}

function runMatch(
  cup: ReturnType<typeof createOlympics>,
  matchIndex: number,
  playerAId: string,
  playerBId: string,
  policy: Policy | null,
  seed: number,
): { winner: string; games: number } {
  const participantA = cup.participants[playerAId]!;
  const participantB = cup.participants[playerBId]!;
  let state = createMatch({
    id: `handicap-${seed}-${matchIndex}`,
    bestOf: 7,
    allowBestOfSeven: true,
    firstServerPlayerId: seed % 2 === 0 ? "A" : "B",
    playerA: { id: "A", loadout: participantA.loadout },
    playerB: { id: "B", loadout: participantB.loadout },
    catalog: olympicsCatalog,
    candidateV4: DEFAULT_CANDIDATE_V4_SETTINGS,
  });
  const baseValues: Record<PlayerId, ProjectBattleValues> = {
    A: cloneValues(state.players.A!.projectBattleValues),
    B: cloneValues(state.players.B!.projectBattleValues),
  };
  let activeBonus: PlayerId | null = null;
  let bonusSequence = 0;
  for (
    let step = 0;
    state.status !== "COMPLETED" && step < 100_000;
    step += 1
  ) {
    if (state.phase.endsWith("_ALLOCATING")) {
      for (const actorId of ["A", "B"] as const) {
        if (
          state.players[actorId] &&
          state.currentPoint.lockedByPlayerIds.includes(actorId)
        )
          continue;
        const view = maskedAiView(state, actorId, baseValues);
        state = applyCommand(state, actorId, {
          type: "ALLOCATE",
          expectedVersion: state.version,
          stage: view.point.stage,
          allocations: chooseAiAllocation({
            view,
            skills: olympicsCatalog.skills,
            difficulty: "normal",
            seed: (seed + step * 37) >>> 0,
            strategy: STRATEGY,
          }),
        }).state;
        const updatedView = maskedAiView(state, actorId, baseValues);
        state = applyCommand(state, actorId, {
          type: "LOCK_ALLOCATION",
          expectedVersion: state.version,
          stage: updatedView.point.stage,
        }).state;
      }
      continue;
    }
    if (state.phase.endsWith("_SELECTING")) {
      const actorId = state.currentPoint.attackerPlayerId as PlayerId;
      const view = maskedAiView(state, actorId, baseValues);
      state = applyCommand(state, actorId, {
        type: "CHOOSE_ATTACK",
        expectedVersion: state.version,
        pairId: chooseAiAttack({
          view,
          skills: olympicsCatalog.skills,
          difficulty: "normal",
          seed: (seed + step * 37) >>> 0,
          strategy: STRATEGY,
        }),
      }).state;
      continue;
    }
    if (state.phase === "POINT_END") {
      state = applyCommand(state, "A", {
        type: "ADVANCE",
        expectedVersion: state.version,
      }).state;
      continue;
    }
    if (state.phase === "GAME_END") {
      if (activeBonus) {
        state.players[activeBonus]!.projectBattleValues = cloneValues(
          baseValues[activeBonus]!,
        );
        activeBonus = null;
      }
      if (state.winnerPlayerId === null) {
        state = applyCommand(state, "A", {
          type: "ADVANCE",
          expectedVersion: state.version,
        }).state;
        const aWins = state.gamesWon.A ?? 0;
        const bWins = state.gamesWon.B ?? 0;
        const trailing: PlayerId | null =
          aWins === 0 && (bWins === 2 || bWins === 3)
            ? "A"
            : bWins === 0 && (aWins === 2 || aWins === 3)
              ? "B"
              : null;
        if (trailing && policy) {
          const bonus =
            aWins + bWins === 2 ? policy.atTwoZero : policy.atThreeZero;
          state.players[trailing]!.projectBattleValues = addRandomBonus(
            baseValues[trailing]!,
            bonus,
            seed + 7919 * ++bonusSequence,
          );
          activeBonus = trailing;
        }
      }
      continue;
    }
    throw new Error(
      `Handicap simulation reached unsupported phase ${state.phase}`,
    );
  }
  if (state.status !== "COMPLETED")
    throw new Error("Handicap simulation exceeded its safety limit");
  const winnerId = state.winnerPlayerId === "A" ? playerAId : playerBId;
  return {
    winner: winnerId,
    games: state.history.filter((event) => event.type === "GAME_ENDED").length,
  };
}

describe.skipIf(!ENABLED)(
  "Olympics hidden one-game catch-up experiment",
  () => {
    it("screens tier rates and same-tier game length", async () => {
      const policy = POLICIES[POLICY];
      if (!policy) throw new Error(`Unknown handicap policy: ${POLICY}`);
      const cup = createOlympics({ seed: 20260930 });
      const byTier = [1, 2, 3, 4].map((tier) =>
        olympicsCatalog.players.filter(
          (player) => olympicsSeedTierByPlayer[player.id] === tier,
        ),
      );
      const sampledTiers =
        SCOPE === "pilot"
          ? byTier.map((tier) => tier.slice(0, 2))
          : SCOPE === "screen"
            ? byTier.map((tier) => tier.slice(0, 4))
            : byTier;
      const outcome = (
        playerIds: string[],
        repeats: number,
        experimentPolicy: Policy | null,
      ): Aggregate => {
        const aggregate: Aggregate = {
          series: 0,
          games: 0,
          winsA: 0,
          winsB: 0,
          gameCounts: {},
        };
        for (let pairIndex = 0; pairIndex < playerIds.length; pairIndex += 2) {
          const a = playerIds[pairIndex]!;
          const b = playerIds[pairIndex + 1]!;
          for (let sample = 0; sample < repeats; sample += 1) {
            const simulation = runMatch(
              cup,
              pairIndex * 100 + sample,
              a,
              b,
              experimentPolicy,
              20260930 + pairIndex * 101 + sample,
            );
            aggregate.series += 1;
            aggregate.games += simulation.games;
            aggregate.winsA += Number(simulation.winner === a);
            aggregate.winsB += Number(simulation.winner === b);
            aggregate.gameCounts[simulation.games] =
              (aggregate.gameCounts[simulation.games] ?? 0) + 1;
          }
        }
        return aggregate;
      };
      const results = [
        {
          matchup: "超级种子 vs 强力挑战者",
          baseline: outcome(
            sampledTiers[0]!
              .flatMap((a) => sampledTiers[3]!.map((b) => [a.id, b.id]))
              .flat(),
            REPETITIONS,
            null,
          ),
          results: outcome(
            sampledTiers[0]!
              .flatMap((a) => sampledTiers[3]!.map((b) => [a.id, b.id]))
              .flat(),
            REPETITIONS,
            policy,
          ),
        },
        {
          matchup: "冠军级种子 vs 世界顶尖级",
          baseline: outcome(
            sampledTiers[1]!
              .flatMap((a) => sampledTiers[2]!.map((b) => [a.id, b.id]))
              .flat(),
            REPETITIONS,
            null,
          ),
          results: outcome(
            sampledTiers[1]!
              .flatMap((a) => sampledTiers[2]!.map((b) => [a.id, b.id]))
              .flat(),
            REPETITIONS,
            policy,
          ),
        },
        ...sampledTiers.map((tier, index) => {
          const pairIds =
            SCOPE === "pilot"
              ? [tier[0]!.id, tier[1]!.id]
              : tier.flatMap((a, i) =>
                  tier.slice(i + 1).flatMap((b) => [a.id, b.id]),
                );
          return {
            matchup: `Tier ${index + 1} 同档`,
            baseline: outcome(
              pairIds,
              Math.max(1, Math.floor(REPETITIONS / 2)),
              null,
            ),
            results: outcome(
              pairIds,
              Math.max(1, Math.floor(REPETITIONS / 2)),
              policy,
            ),
          };
        }),
      ];
      const report = {
        seed: 20260930,
        policyName: POLICY,
        policy,
        strategy: STRATEGY,
        scope: SCOPE,
        repetitions: REPETITIONS,
        results,
      };
      const reportDirectory = resolve(
        process.cwd(),
        "reports/world-cup-balance-2026-09-30",
      );
      await mkdir(reportDirectory, { recursive: true });
      await writeFile(
        resolve(reportDirectory, `olympics-handicap-${POLICY}-${SCOPE}.json`),
        `${JSON.stringify(report, null, 2)}\n`,
      );
      console.log(JSON.stringify(report, null, 2));
    }, 900_000);
  },
);
