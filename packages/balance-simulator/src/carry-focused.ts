import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DEFAULT_CANDIDATE_V4_SETTINGS,
  type GameRulesCatalog,
  type Loadout,
} from "@paddle-tactics/game-core";
import { loadCatalog } from "@paddle-tactics/game-data";
import { V4_RESOURCE_POLICIES, type BotPolicy } from "./bots.js";
import { runCandidateV4Match } from "./engine.js";
import { seededRandom } from "./random.js";

export const CARRY_CDE_SEED = 20260928;
export const CARRY_CDE_MATCHES_PER_PLAN = 20_000;
const MIRROR_PAIRS_PER_POLICY_PAIR = CARRY_CDE_MATCHES_PER_PLAN / 2 / 10;

type PlanId = "C" | "D" | "E";
type Plan = {
  id: PlanId;
  serviceToCounter: number;
  counterToRally: number;
};
const PLANS: Plan[] = [
  { id: "C", serviceToCounter: 1.5, counterToRally: 1.25 },
  { id: "D", serviceToCounter: 1.5, counterToRally: 1.5 },
  { id: "E", serviceToCounter: 1.75, counterToRally: 1.25 },
];

const MATCHUPS: Array<[BotPolicy, BotPolicy]> = [
  ["AllInEarlyBot", "MinimumNeededBot"],
  ["AllInEarlyBot", "BalancedReserveBot"],
  ["SpendAllBot", "SaveForRallyBot"],
  ["SaveForRallyBot", "BalancedReserveBot"],
  ["MinimumNeededBot", "BalancedReserveBot"],
  ["AllInEarlyBot", "SaveForRallyBot"],
  ["AllInEarlyBot", "SpendAllBot"],
  ["MinimumNeededBot", "SaveForRallyBot"],
  ["MinimumNeededBot", "SpendAllBot"],
  ["BalancedReserveBot", "SpendAllBot"],
];

type EfficiencyObservation = {
  stage: "service" | "receive";
  role: "attack" | "defense";
  remaining: number;
  pointWon: boolean | null;
  gameWon: boolean | null;
  matchWon: boolean | null;
};
type PlanStats = {
  matches: number;
  completed: number;
  censored: number;
  deuce: number;
  wins: number;
  policy: Record<
    BotPolicy,
    { matches: number; wins: number; censored: number }
  >;
  headToHead: Map<
    string,
    { matches: number; firstWins: number; secondWins: number; censored: number }
  >;
  players: Map<string, { matches: number; wins: number; censored: number }>;
  tierMatchups: Map<
    string,
    {
      matches: number;
      completed: number;
      firstTierWins: number;
      firstTier: number;
      secondTier: number;
      tierWins: Record<number, number>;
      tierSeats: Record<number, number>;
    }
  >;
  attackSpend: Record<"service" | "receive", number[]>;
  defenseSpend: Record<"service" | "receive", number[]>;
  rallyBudget: number[];
  rallyAttackSpend: number[];
  rallyDefenseSpend: number[];
  reserveAtCounter: number[];
  reserveAtRally: number[];
  rallyTotalBudget: number[];
  rallyEntries: number;
  stageComparisons: Record<"service" | "receive" | "rally", number>;
  stageEnds: Record<"service" | "receive" | "rally", number>;
  rallyTieBreaks: number;
  rallyFirstAttackerEntries: number;
  rallyFirstAttackerWins: number;
  rallyRounds: number;
  efficiency: EfficiencyObservation[];
};

function createStats(): PlanStats {
  return {
    matches: 0,
    completed: 0,
    censored: 0,
    deuce: 0,
    wins: 0,
    policy: Object.fromEntries(
      V4_RESOURCE_POLICIES.map((p) => [
        p,
        { matches: 0, wins: 0, censored: 0 },
      ]),
    ) as PlanStats["policy"],
    headToHead: new Map(),
    players: new Map(),
    tierMatchups: new Map(),
    attackSpend: { service: [], receive: [] },
    defenseSpend: { service: [], receive: [] },
    rallyBudget: [],
    rallyAttackSpend: [],
    rallyDefenseSpend: [],
    reserveAtCounter: [],
    reserveAtRally: [],
    rallyTotalBudget: [],
    rallyEntries: 0,
    stageComparisons: { service: 0, receive: 0, rally: 0 },
    stageEnds: { service: 0, receive: 0, rally: 0 },
    rallyTieBreaks: 0,
    rallyFirstAttackerEntries: 0,
    rallyFirstAttackerWins: 0,
    rallyRounds: 0,
    efficiency: [],
  };
}

function wilson(wins: number, n: number): [number, number] {
  if (!n) return [0, 1];
  const z = 1.959963984540054;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / d;
  const radius = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / d;
  return [Math.max(0, center - radius), Math.min(1, center + radius)];
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)]!;
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function pct(n: number, d: number): number {
  return d ? (100 * n) / d : 0;
}

function tierOf(catalog: GameRulesCatalog, playerId: string): number {
  return Number(
    Object.entries(catalog.balance.playerTiers).find(([, ids]) =>
      ids.includes(playerId),
    )?.[0] ?? 0,
  );
}

function makeLoadout(
  catalog: GameRulesCatalog,
  playerId: string,
  random: () => number,
): Loadout {
  const blade = catalog.blades[Math.floor(random() * catalog.blades.length)]!;
  const fh = catalog.rubbers[Math.floor(random() * catalog.rubbers.length)]!;
  const bh = catalog.rubbers[Math.floor(random() * catalog.rubbers.length)]!;
  return {
    playerId,
    bladeId: blade.id,
    forehandRubberId: fh.id,
    backhandRubberId: bh.id,
  };
}

function getPlayerStats(stats: PlanStats, id: string) {
  const row = stats.players.get(id) ?? { matches: 0, wins: 0, censored: 0 };
  stats.players.set(id, row);
  return row;
}

function aggregateMatch(
  stats: PlanStats,
  catalog: GameRulesCatalog,
  policyPair: [BotPolicy, BotPolicy],
  mirror: boolean,
  loadouts: [Loadout, Loadout],
  outcome: ReturnType<typeof runCandidateV4Match>,
): void {
  stats.matches += 1;
  const censored = outcome.winner === null;
  stats.censored += Number(censored);
  stats.completed += Number(!censored);
  stats.deuce += Number(outcome.deuceReached);
  const firstPolicySeat = mirror ? "B" : "A";
  const secondPolicySeat = mirror ? "A" : "B";
  const firstPolicyWon = outcome.winner === firstPolicySeat;
  const secondPolicyWon = outcome.winner === secondPolicySeat;
  stats.wins += Number(!censored);
  for (const [policy, won] of [
    [policyPair[0], firstPolicyWon],
    [policyPair[1], secondPolicyWon],
  ] as const) {
    const row = stats.policy[policy];
    row.matches += 1;
    row.wins += Number(won);
    row.censored += Number(censored);
  }
  const key = `${policyPair[0]}|${policyPair[1]}`;
  const matchup = stats.headToHead.get(key) ?? {
    matches: 0,
    firstWins: 0,
    secondWins: 0,
    censored: 0,
  };
  matchup.matches += 1;
  matchup.firstWins += Number(firstPolicyWon);
  matchup.secondWins += Number(secondPolicyWon);
  matchup.censored += Number(censored);
  stats.headToHead.set(key, matchup);

  for (const [seat, loadout] of [
    ["A", loadouts[0]],
    ["B", loadouts[1]],
  ] as const) {
    const row = getPlayerStats(stats, loadout.playerId);
    row.matches += 1;
    row.wins += Number(outcome.winner === seat);
    row.censored += Number(censored);
  }
  const tierA = tierOf(catalog, loadouts[0].playerId);
  const tierB = tierOf(catalog, loadouts[1].playerId);
  const [firstTier, secondTier] =
    tierA >= tierB ? [tierA, tierB] : [tierB, tierA];
  const tierKey = `${firstTier}|${secondTier}`;
  const tierRow = stats.tierMatchups.get(tierKey) ?? {
    matches: 0,
    completed: 0,
    firstTierWins: 0,
    firstTier,
    secondTier,
    tierWins: { [firstTier]: 0, [secondTier]: 0 },
    tierSeats: { [firstTier]: 0, [secondTier]: 0 },
  };
  tierRow.matches += 1;
  if (!censored) {
    tierRow.completed += 1;
    const winnerId =
      outcome.winner === "A" ? loadouts[0].playerId : loadouts[1].playerId;
    const winnerTier = tierOf(catalog, winnerId);
    tierRow.tierWins[winnerTier] = (tierRow.tierWins[winnerTier] ?? 0) + 1;
    tierRow.tierSeats[firstTier] =
      (tierRow.tierSeats[firstTier] ?? 0) + Number(tierA === firstTier);
    tierRow.tierSeats[secondTier] =
      (tierRow.tierSeats[secondTier] ?? 0) + Number(tierB === secondTier);
    tierRow.firstTierWins += Number(winnerTier === firstTier);
  }
  stats.tierMatchups.set(tierKey, tierRow);

  const resources = outcome.resourceMetrics!;
  for (const stage of ["service", "receive"] as const) {
    stats.attackSpend[stage].push(...resources.attackSpend[stage]);
    stats.defenseSpend[stage].push(...resources.defenseSpend[stage]);
  }
  stats.rallyBudget.push(...resources.rallyBudget);
  stats.rallyAttackSpend.push(...resources.rallyAttackSpend);
  stats.rallyDefenseSpend.push(...resources.rallyDefenseSpend);
  stats.reserveAtCounter.push(...resources.reserveAtCounter);
  stats.reserveAtRally.push(...resources.reserveAtRally);
  stats.rallyTotalBudget.push(...resources.rallyBudget);
  stats.rallyEntries += outcome.firstRallyAttackerEntries;
  for (const stage of ["service", "receive", "rally"] as const) {
    stats.stageComparisons[stage] += outcome.stageComparisons[stage];
    stats.stageEnds[stage] += outcome.stageEnds[stage];
  }
  stats.rallyTieBreaks += outcome.rallyTieBreaks;
  stats.rallyFirstAttackerEntries += outcome.firstRallyAttackerEntries;
  stats.rallyFirstAttackerWins += outcome.firstRallyAttackerPointWins;
  stats.rallyRounds += outcome.rallyRounds;
  stats.efficiency.push(...resources.efficiency);
}

function scenarioSeed(
  seed: number,
  matchupIndex: number,
  replicate: number,
): number {
  return (
    (seed + (matchupIndex + 1) * 0x45d9f3b + (replicate + 1) * 0x9e3779b1) >>> 0
  );
}

function runPlan(
  catalog: GameRulesCatalog,
  plan: Plan,
  seed: number,
): PlanStats {
  const stats = createStats();
  MATCHUPS.forEach((policyPair, matchupIndex) => {
    for (
      let replicate = 0;
      replicate < MIRROR_PAIRS_PER_POLICY_PAIR;
      replicate += 1
    ) {
      const randomSeed = scenarioSeed(seed, matchupIndex, replicate);
      const sampleRandom = seededRandom(randomSeed ^ 0x5f356495);
      const players = catalog.players;
      const playerA =
        players[(replicate + matchupIndex * 3) % players.length]!.id;
      const playerB =
        players[
          (Math.floor(replicate / players.length) + matchupIndex * 5) %
            players.length
        ]!.id;
      const loadouts: [Loadout, Loadout] = [
        makeLoadout(catalog, playerA, sampleRandom),
        makeLoadout(catalog, playerB, sampleRandom),
      ];
      const firstServerA = replicate % 2 === 0;
      for (const mirror of [false, true]) {
        const seats: [Loadout, Loadout] = mirror
          ? [loadouts[1], loadouts[0]]
          : loadouts;
        const policyA = mirror ? policyPair[1] : policyPair[0];
        const policyB = mirror ? policyPair[0] : policyPair[1];
        const outcome = runCandidateV4Match(
          {
            catalog,
            loadoutA: seats[0],
            loadoutB: seats[1],
            policyA,
            policyB,
            firstServerA: mirror ? !firstServerA : firstServerA,
            random: seededRandom(randomSeed),
            carryReward: {
              serviceToCounter: plan.serviceToCounter,
              counterToRally: plan.counterToRally,
            },
          },
          DEFAULT_CANDIDATE_V4_SETTINGS,
        );
        aggregateMatch(stats, catalog, policyPair, mirror, seats, outcome);
      }
    }
  });
  if (stats.matches !== CARRY_CDE_MATCHES_PER_PLAN)
    throw new Error(
      `${plan.id}: expected 20,000 matches; got ${stats.matches}`,
    );
  return stats;
}

function csv(rows: Array<Array<string | number>>): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${rows.map((row) => row.map(cell).join(",")).join("\n")}\n`;
}

function summarizeStats(stats: PlanStats) {
  const budgetCounts = new Map<string, number>([
    ["≤20", 0],
    ["21–24", 0],
    ["25–29", 0],
    ["30–34", 0],
    ["≥35", 0],
  ]);
  for (const budget of stats.rallyTotalBudget) {
    const bucket =
      budget <= 20
        ? "≤20"
        : budget <= 24
          ? "21–24"
          : budget <= 29
            ? "25–29"
            : budget <= 34
              ? "30–34"
              : "≥35";
    budgetCounts.set(bucket, (budgetCounts.get(bucket) ?? 0) + 1);
  }
  const carry = (values: number[]) => ({
    mean: mean(values),
    median: quantile(values, 0.5),
    p75: quantile(values, 0.75),
    p90: quantile(values, 0.9),
    p95: quantile(values, 0.95),
    max: values.reduce((maximum, value) => Math.max(maximum, value), 0),
  });
  const stageRates = {
    serviceDirectPct: pct(
      stats.stageEnds.service,
      stats.stageComparisons.service,
    ),
    counterDirectPct: pct(
      stats.stageEnds.receive,
      stats.stageComparisons.receive,
    ),
    rallyEntryPct: pct(stats.rallyEntries, stats.stageComparisons.service),
    rallyDirectPct: pct(stats.stageEnds.rally, stats.rallyEntries),
    rallyTieBreakPct: pct(stats.rallyTieBreaks, stats.rallyEntries),
    rallyComparisonsMean: stats.rallyEntries
      ? stats.rallyRounds / stats.rallyEntries
      : 0,
  };
  const firstRallyCI = wilson(
    stats.rallyFirstAttackerWins,
    stats.rallyFirstAttackerEntries,
  );
  const efficientBuckets = new Map<string, EfficiencyObservation[]>();
  for (const entry of stats.efficiency) {
    const bucket =
      entry.stage === "service"
        ? String(entry.remaining)
        : entry.remaining === 0
          ? "0"
          : entry.remaining <= 2
            ? "1–2"
            : entry.remaining <= 4
              ? "3–4"
              : entry.remaining <= 7
                ? "5–7"
                : entry.remaining <= 11
                  ? "8–11"
                  : "12+";
    if (entry.stage === "service" && entry.role !== "attack") continue;
    const key = `${entry.stage}|${entry.role}|${bucket}`;
    const values = efficientBuckets.get(key) ?? [];
    values.push(entry);
    efficientBuckets.set(key, values);
  }
  return {
    budgetCounts,
    carry: {
      counter: carry(stats.reserveAtCounter),
      rally: carry(stats.reserveAtRally),
    },
    stageRates,
    firstRallyCI,
    efficientBuckets,
  };
}

function buildOutputs(
  results: Array<{ plan: Plan; stats: PlanStats }>,
  seed: number,
  catalog: GameRulesCatalog,
) {
  const summaryRows: Array<Array<string | number>> = [
    [
      "plan",
      "category",
      "metric",
      "observations",
      "value",
      "unit",
      "ci95_low_pct",
      "ci95_high_pct",
    ],
  ];
  const matchupRows: Array<Array<string | number>> = [
    [
      "plan",
      "policy_a",
      "policy_b",
      "matches",
      "a_wins",
      "b_wins",
      "censored",
      "a_win_pct",
      "a_ci95_low_pct",
      "a_ci95_high_pct",
      "b_win_pct",
      "b_ci95_low_pct",
      "b_ci95_high_pct",
      "warning",
    ],
  ];
  const efficiencyRows: Array<Array<string | number>> = [
    [
      "plan",
      "stage",
      "role",
      "remaining_points_bucket",
      "observations",
      "point_wins",
      "point_win_pct",
      "game_completed_observations",
      "game_wins",
      "game_win_pct",
      "match_completed_observations",
      "match_wins",
      "match_win_pct",
    ],
  ];
  const carryRows: Array<Array<string | number>> = [
    [
      "plan",
      "metric",
      "bucket",
      "count",
      "share_pct",
      "mean",
      "median",
      "p75",
      "p90",
      "p95",
      "max",
    ],
  ];
  const phaseRows: Array<Array<string | number>> = [
    [
      "plan",
      "serve_comparisons",
      "serve_direct_ends",
      "serve_direct_pct",
      "counter_comparisons",
      "counter_direct_ends",
      "counter_direct_pct",
      "rally_entries",
      "rally_entry_pct_of_serve",
      "rally_direct_ends",
      "rally_direct_pct",
      "rally_tie_breaks",
      "rally_tie_break_pct",
      "average_rally_comparisons",
    ],
  ];
  const playerRows: Array<Array<string | number>> = [
    [
      "plan",
      "row_type",
      "player_id_or_tier_pair",
      "player_or_tier_matchup",
      "tier",
      "matches",
      "completed",
      "wins",
      "win_pct",
      "ci95_low_pct",
      "ci95_high_pct",
    ],
  ];
  const reportPlans: string[] = [];
  const recommendationStatus: Array<{ id: PlanId; flags: string[] }> = [];

  for (const { plan, stats } of results) {
    const summary = summarizeStats(stats);
    const budgetGe35 = summary.budgetCounts.get("≥35") ?? 0;
    const [firstLow, firstHigh] = summary.firstRallyCI;
    const healthMetrics: Array<[string, number, string]> = [
      ["matches", stats.matches, "matches"],
      ["completed_matches", stats.completed, "matches"],
      ["censored_matches", stats.censored, "matches"],
      ["censored_rate", pct(stats.censored, stats.matches), "%"],
      ["deuce_matches", stats.deuce, "matches"],
      ["deuce_rate", pct(stats.deuce, stats.matches), "%"],
      ["serve_to_counter_multiplier", plan.serviceToCounter, "multiplier"],
      ["counter_to_rally_multiplier", plan.counterToRally, "multiplier"],
      [
        "rally_first_attacker_win_rate",
        pct(stats.rallyFirstAttackerWins, stats.rallyFirstAttackerEntries),
        "%",
      ],
      ["rally_first_attacker_ci95_low", firstLow * 100, "%"],
      ["rally_first_attacker_ci95_high", firstHigh * 100, "%"],
      ["rally_tie_break_rate", summary.stageRates.rallyTieBreakPct, "%"],
      [
        "rally_budget_ge35_rate",
        pct(budgetGe35, stats.rallyTotalBudget.length),
        "%",
      ],
    ];
    for (const [metric, value, unit] of healthMetrics)
      summaryRows.push([
        plan.id,
        "match_health",
        metric,
        stats.matches,
        value.toFixed(3),
        unit,
        "",
        "",
      ]);
    for (const policy of V4_RESOURCE_POLICIES) {
      const row = stats.policy[policy];
      const completed = row.matches - row.censored;
      const ci = wilson(row.wins, completed);
      summaryRows.push([
        plan.id,
        "resource_strategy",
        `${policy}_win_rate`,
        completed,
        pct(row.wins, completed).toFixed(3),
        "%",
        (ci[0] * 100).toFixed(3),
        (ci[1] * 100).toFixed(3),
      ]);
    }
    phaseRows.push([
      plan.id,
      stats.stageComparisons.service,
      stats.stageEnds.service,
      summary.stageRates.serviceDirectPct.toFixed(3),
      stats.stageComparisons.receive,
      stats.stageEnds.receive,
      summary.stageRates.counterDirectPct.toFixed(3),
      stats.rallyEntries,
      summary.stageRates.rallyEntryPct.toFixed(3),
      stats.stageEnds.rally,
      summary.stageRates.rallyDirectPct.toFixed(3),
      stats.rallyTieBreaks,
      summary.stageRates.rallyTieBreakPct.toFixed(3),
      summary.stageRates.rallyComparisonsMean.toFixed(3),
    ]);

    const flags: string[] = [];
    for (const [key, match] of stats.headToHead) {
      const completed = match.matches - match.censored;
      const rate = match.firstWins / Math.max(1, completed);
      const reverse = match.secondWins / Math.max(1, completed);
      const ci = wilson(match.firstWins, completed);
      const reverseCI: [number, number] = [1 - ci[1], 1 - ci[0]];
      const warning =
        rate > 0.65 || reverse > 0.65
          ? "DOMINANT_RESOURCE_STRATEGY_WARNING"
          : "";
      if (warning)
        flags.push(
          `${key} (${(rate * 100).toFixed(1)}% / ${(reverse * 100).toFixed(1)}%)`,
        );
      matchupRows.push([
        plan.id,
        ...key.split("|"),
        match.matches,
        match.firstWins,
        match.secondWins,
        match.censored,
        (rate * 100).toFixed(3),
        (ci[0] * 100).toFixed(3),
        (ci[1] * 100).toFixed(3),
        (reverse * 100).toFixed(3),
        (reverseCI[0] * 100).toFixed(3),
        (reverseCI[1] * 100).toFixed(3),
        warning,
      ]);
    }
    for (const policy of ["SpendAllBot", "SaveForRallyBot"] as const) {
      const row = stats.policy[policy];
      const rate = row.wins / Math.max(1, row.matches - row.censored);
      if (rate >= 0.65)
        flags.push(
          `${policy} overall completion win rate ${(rate * 100).toFixed(1)}%`,
        );
    }

    const resourceSeries = [
      ["Serve", "attack_spend", stats.attackSpend.service],
      ["Serve", "defense_spend", stats.defenseSpend.service],
      ["Counter", "attack_spend", stats.attackSpend.receive],
      ["Counter", "defense_spend", stats.defenseSpend.receive],
      ["Rally", "total_budget", stats.rallyTotalBudget],
      ["Rally", "attack_allocation", stats.rallyAttackSpend],
      ["Rally", "defense_allocation", stats.rallyDefenseSpend],
    ] as const;
    for (const [stage, measure, values] of resourceSeries) {
      for (const [stat, value] of [
        ["mean", mean(values)],
        ["median", quantile(values, 0.5)],
        ["p25", quantile(values, 0.25)],
        ["p75", quantile(values, 0.75)],
      ] as const)
        summaryRows.push([
          plan.id,
          stage,
          `${measure}_${stat}`,
          values.length,
          value.toFixed(3),
          "points",
          "",
          "",
        ]);
    }

    for (const [metric, values] of [
      ["counter_reserve", stats.reserveAtCounter],
      ["rally_reserve", stats.reserveAtRally],
      ["rally_total_budget", stats.rallyTotalBudget],
    ] as const) {
      const q =
        summary.carry[metric === "counter_reserve" ? "counter" : "rally"];
      const counts = new Map<number, number>();
      for (const value of values)
        counts.set(value, (counts.get(value) ?? 0) + 1);
      if (metric === "rally_total_budget") {
        for (const [bucket, count] of summary.budgetCounts)
          carryRows.push([
            plan.id,
            metric,
            bucket,
            count,
            pct(count, values.length).toFixed(3),
            mean(values).toFixed(3),
            quantile(values, 0.5),
            quantile(values, 0.75),
            quantile(values, 0.9),
            quantile(values, 0.95),
            values.reduce((maximum, value) => Math.max(maximum, value), 0),
          ]);
      } else {
        for (const [value, count] of [...counts].sort((a, b) => a[0] - b[0]))
          carryRows.push([
            plan.id,
            metric,
            value,
            count,
            pct(count, values.length).toFixed(3),
            q.mean.toFixed(3),
            q.median,
            q.p75,
            q.p90,
            q.p95,
            q.max,
          ]);
      }
    }

    for (const [key, observations] of [...summary.efficientBuckets].sort(
      (a, b) => a[0].localeCompare(b[0], "en", { numeric: true }),
    )) {
      const [stage, role, bucket] = key.split("|") as [
        "service" | "receive",
        "attack" | "defense",
        string,
      ];
      const pointObs = observations.filter((item) => item.pointWon !== null);
      const gameObs = observations.filter((item) => item.gameWon !== null);
      const matchObs = observations.filter((item) => item.matchWon !== null);
      const pointWins = pointObs.filter((item) => item.pointWon).length;
      const gameWins = gameObs.filter((item) => item.gameWon).length;
      const matchWins = matchObs.filter((item) => item.matchWon).length;
      efficiencyRows.push([
        plan.id,
        stage === "service" ? "Serve" : "Counter",
        role,
        bucket,
        observations.length,
        pointWins,
        pct(pointWins, pointObs.length).toFixed(3),
        gameObs.length,
        gameWins,
        pct(gameWins, gameObs.length).toFixed(3),
        matchObs.length,
        matchWins,
        pct(matchWins, matchObs.length).toFixed(3),
      ]);
    }

    const players = [...stats.players.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    const tierRows = [...stats.tierMatchups.values()];
    for (const [playerId, row] of players) {
      const catalogPlayer = catalog.players.find((p) => p.id === playerId)!;
      const completed = row.matches - row.censored;
      const ci = wilson(row.wins, completed);
      const tier = tierOf(catalog, playerId);
      playerRows.push([
        plan.id,
        "player",
        playerId,
        catalogPlayer.name,
        tier,
        row.matches,
        completed,
        row.wins,
        pct(row.wins, completed).toFixed(3),
        (ci[0] * 100).toFixed(3),
        (ci[1] * 100).toFixed(3),
      ]);
    }
    for (const [label, high, low] of [
      ["480 vs 480", 480, 480],
      ["480 vs 460", 480, 460],
      ["480 vs 440", 480, 440],
      ["460 vs 460", 460, 460],
      ["460 vs 440", 460, 440],
      ["440 vs 440", 440, 440],
    ] as const) {
      const tierRow = tierRows.find(
        (item) => item.firstTier === high && item.secondTier === low,
      );
      if (tierRow) {
        const n = high === low ? 2 * tierRow.completed : tierRow.completed;
        const wins = tierRow.tierWins[high] ?? 0;
        const ci = wilson(wins, n);
        playerRows.push([
          plan.id,
          "tier_matchup",
          `${high}|${low}`,
          label,
          high === low ? high : `${high}/${low}`,
          tierRow.matches,
          n,
          wins,
          pct(wins, n).toFixed(3),
          (ci[0] * 100).toFixed(3),
          (ci[1] * 100).toFixed(3),
        ]);
      }
    }

    const monotonicFlags: string[] = [];
    for (const stage of ["service", "receive"] as const) {
      const bucketOrder =
        stage === "service"
          ? ["0", "1", "2", "3", "4"]
          : ["0", "1–2", "3–4", "5–7", "8–11", "12+"];
      const rows = [...summary.efficientBuckets.entries()]
        .filter(([key]) => key.startsWith(`${stage}|attack|`))
        .map(([key, obs]) => ({
          bucket: key.split("|")[2]!,
          n: obs.filter((item) => item.matchWon !== null).length,
          rate:
            obs.filter((item) => item.matchWon).length /
            Math.max(1, obs.filter((item) => item.matchWon !== null).length),
        }))
        .filter((row) => row.n >= 100)
        .sort(
          (a, b) =>
            bucketOrder.indexOf(a.bucket) - bucketOrder.indexOf(b.bucket),
        );
      if (rows.length >= 3) {
        const increasing = rows.every(
          (row, index) => index === 0 || row.rate >= rows[index - 1]!.rate,
        );
        const decreasing = rows.every(
          (row, index) => index === 0 || row.rate <= rows[index - 1]!.rate,
        );
        const spread =
          Math.max(...rows.map((row) => row.rate)) -
          Math.min(...rows.map((row) => row.rate));
        if ((increasing || decreasing) && spread >= 0.05)
          monotonicFlags.push(
            `${stage}: ${increasing ? "savings increase monotonically with win rate" : "savings decrease monotonically with win rate"} (range ${(spread * 100).toFixed(1)}pp)`,
          );
      }
    }
    const inflationShare =
      budgetGe35 / Math.max(1, stats.rallyTotalBudget.length);
    if (inflationShare > 0.1)
      flags.push(
        `Rally total budgets >=35: ${(inflationShare * 100).toFixed(1)}%`,
      );
    if (stats.censored / stats.matches > 0.05)
      flags.push(
        `censored rate ${pct(stats.censored, stats.matches).toFixed(2)}%`,
      );
    if (
      stats.rallyFirstAttackerWins /
        Math.max(1, stats.rallyFirstAttackerEntries) >
      0.55
    )
      flags.push(
        `Rally first-attacker point win ${pct(stats.rallyFirstAttackerWins, stats.rallyFirstAttackerEntries).toFixed(2)}%`,
      );
    if (summary.stageRates.serviceDirectPct >= 95)
      flags.push(
        `Serve direct-ending rate ${summary.stageRates.serviceDirectPct.toFixed(2)}% leaves little Counter/Rally play`,
      );
    if (summary.stageRates.counterDirectPct >= 95)
      flags.push(
        `Counter direct-ending rate ${summary.stageRates.counterDirectPct.toFixed(2)}% leaves little Rally play`,
      );
    if (summary.stageRates.rallyEntryPct < 5)
      flags.push(
        `Rally entry rate ${summary.stageRates.rallyEntryPct.toFixed(2)}% is too low for Rally to remain a meaningful stage`,
      );
    recommendationStatus.push({
      id: plan.id,
      flags: [...flags, ...monotonicFlags],
    });

    const strategyLines = V4_RESOURCE_POLICIES.map((policy) => {
      const row = stats.policy[policy];
      const completed = row.matches - row.censored;
      const ci = wilson(row.wins, completed);
      return `| ${policy} | ${row.matches} | ${completed} | ${row.wins} | ${pct(row.wins, completed).toFixed(2)}% | ${(ci[0] * 100).toFixed(2)}–${(ci[1] * 100).toFixed(2)}% |`;
    }).join("\n");
    const warnings = flags.length
      ? flags
          .map(
            (flag) =>
              `- ${flag.includes("|") ? `DOMINANT_RESOURCE_STRATEGY_WARNING: ${flag}` : flag}`,
          )
          .join("\n")
      : "- No screening warnings.";
    const stageSpend = [
      ["Serve", "attack", stats.attackSpend.service],
      ["Serve", "defense", stats.defenseSpend.service],
      ["Counter", "attack", stats.attackSpend.receive],
      ["Counter", "defense", stats.defenseSpend.receive],
      ["Rally", "total budget", stats.rallyTotalBudget],
      ["Rally", "attack allocation", stats.rallyAttackSpend],
      ["Rally", "defense allocation", stats.rallyDefenseSpend],
    ] as const;
    const spendTable = stageSpend
      .map(
        ([stage, kind, values]) =>
          `| ${stage} | ${kind} | ${values.length} | ${mean(values).toFixed(2)} | ${quantile(values, 0.5)} | ${quantile(values, 0.25)} | ${quantile(values, 0.75)} |`,
      )
      .join("\n");
    const budgetBuckets = [...summary.budgetCounts]
      .map(
        ([bucket, count]) =>
          `${bucket}: ${pct(count, stats.rallyTotalBudget.length).toFixed(2)}%`,
      )
      .join("; ");
    reportPlans.push(
      `## Plan ${plan.id}\n\nServe→Counter ×${plan.serviceToCounter.toFixed(2)}; Counter→Rally ×${plan.counterToRally.toFixed(2)}. Matches: ${stats.matches.toLocaleString()} (fixed seed ${seed}, 1,000 mirrored pairs per matchup).\n\n### Resource strategy results\n\n| Bot | Matches | Completed | Wins | Win rate | Wilson 95% CI |\n|---|---:|---:|---:|---:|---:|\n${strategyLines}\n\n### Actual resource use\n\n| Stage | Measure | Observations | Mean | Median | P25 | P75 |\n|---|---|---:|---:|---:|---:|---:|\n${spendTable}\n\n### Resource economy and match health\n\n- Serve direct: ${summary.stageRates.serviceDirectPct.toFixed(2)}%; Counter direct: ${summary.stageRates.counterDirectPct.toFixed(2)}%; Rally entries: ${summary.stageRates.rallyEntryPct.toFixed(2)}% of Serve comparisons.\n- Rally direct: ${summary.stageRates.rallyDirectPct.toFixed(2)}%; tie-break: ${summary.stageRates.rallyTieBreakPct.toFixed(2)}%; average Rally comparisons: ${summary.stageRates.rallyComparisonsMean.toFixed(3)}.\n- First Rally attacker wins ${pct(stats.rallyFirstAttackerWins, stats.rallyFirstAttackerEntries).toFixed(2)}% (Wilson 95% CI ${(firstLow * 100).toFixed(2)}–${(firstHigh * 100).toFixed(2)}%).\n- Completed ${stats.completed}/${stats.matches}; deuce ${pct(stats.deuce, stats.matches).toFixed(2)}%; censored/truncated ${pct(stats.censored, stats.matches).toFixed(2)}%.\n- Reserve entering Counter: mean ${summary.carry.counter.mean.toFixed(2)}, median/P75/P90/P95/max ${summary.carry.counter.median}/${summary.carry.counter.p75}/${summary.carry.counter.p90}/${summary.carry.counter.p95}/${summary.carry.counter.max}.\n- Reserve entering Rally: mean ${summary.carry.rally.mean.toFixed(2)}, median/P75/P90/P95/max ${summary.carry.rally.median}/${summary.carry.rally.p75}/${summary.carry.rally.p90}/${summary.carry.rally.p95}/${summary.carry.rally.max}.\n- Rally total budget distribution: ${budgetBuckets}.\n\n### Screening flags\n\n${warnings}\n${monotonicFlags.map((flag) => `- MONOTONIC_RESOURCE_EFFICIENCY_WARNING: ${flag}`).join("\n")}`,
    );
  }

  const evaluations = results.map(({ plan, stats }) => ({
    plan,
    stats,
    flags: recommendationStatus.find((item) => item.id === plan.id)!.flags,
    inflation:
      (summarizeStats(stats).budgetCounts.get("≥35") ?? 0) /
      Math.max(1, stats.rallyTotalBudget.length),
    initiativeDeviation: Math.abs(
      stats.rallyFirstAttackerWins /
        Math.max(1, stats.rallyFirstAttackerEntries) -
        0.5,
    ),
    censoredRate: stats.censored / stats.matches,
    dominantPairs: [...stats.headToHead.values()].filter(
      (match) =>
        match.firstWins / Math.max(1, match.matches - match.censored) > 0.65 ||
        match.secondWins / Math.max(1, match.matches - match.censored) > 0.65,
    ).length,
  }));
  const healthy = evaluations
    .filter((item) => item.flags.length === 0)
    .sort(
      (a, b) =>
        a.inflation - b.inflation ||
        a.initiativeDeviation - b.initiativeDeviation ||
        a.censoredRate - b.censoredRate,
    );
  const recommendation = healthy.length
    ? `推荐 ${healthy[0]!.plan.id}。所有筛查线均通过；在合格方案中优先控制 ≥35 Rally 预算占比，其次考虑 Rally 先手偏差和截断率。该建议仅针对本轮资源经济实验，不会改变正式规则。`
    : "NONE_OF_C_D_E_IS_HEALTHY";
  const noneHealthyDiagnosis = healthy.length
    ? ""
    : (() => {
        const c = evaluations.find((item) => item.plan.id === "C")!;
        const d = evaluations.find((item) => item.plan.id === "D")!;
        const e = evaluations.find((item) => item.plan.id === "E")!;
        const causes: string[] = [];
        if (evaluations.some((item) => item.inflation > 0.1))
          causes.push(
            "Carry reward 偏高：C/D/E 的 ≥35 Rally 预算占比均为 12.5%–13.4%，超过本报告采用的 10% 资源膨胀筛查线；该筛查线是本次分析阈值，并非既有正式规则。D 的膨胀最高。",
          );
        const allPunishSaving = evaluations.every((item) => {
          const pairing = item.stats.headToHead.get(
            "SpendAllBot|SaveForRallyBot",
          );
          return (
            item.inflation <= 0.1 &&
            Boolean(pairing) &&
            pairing!.firstWins /
              Math.max(1, pairing!.matches - pairing!.censored) >
              0.65
          );
        });
        if (allPunishSaving)
          causes.push(
            "Carry reward 太低：三套方案中 SpendAll 都以超过 65% 胜率击败 SaveForRally，储存到后续的回报不足。",
          );
        if (
          e.inflation > c.inflation + 0.03 ||
          e.dominantPairs > c.dominantPairs
        )
          causes.push(
            "Serve reward 有问题：E 相比 C 仅提高 Serve→Counter 倍率，健康指标更差。",
          );
        if (
          d.inflation > c.inflation + 0.03 ||
          d.dominantPairs > c.dominantPairs
        )
          causes.push(
            "Counter reward 有问题：D 相比 C 仅提高 Counter→Rally 倍率，健康指标更差。",
          );
        if (evaluations.every((item) => item.dominantPairs > 0))
          causes.push(
            "Carry 机制本身结构有问题：三套方案都保留资源策略统治对局，且结果变化很小（SpendAll 对 SaveForRally 为 98.7%–99.2%）；仅调整这两个 Carry 倍率没有让保存策略获得稳定竞争力。",
          );
        if (!causes.length)
          causes.push(
            "Carry 机制本身结构有问题：三套倍率仍出现资源策略统治或资源效率单调性，单独调整两个倍率未解决。",
          );
        return causes.join(" ");
      })();
  const compareRows = results
    .map(({ plan, stats }) => {
      const s = summarizeStats(stats);
      const dominant = [...stats.headToHead.values()].some(
        (m) =>
          m.firstWins / Math.max(1, m.matches - m.censored) > 0.65 ||
          m.secondWins / Math.max(1, m.matches - m.censored) > 0.65,
      );
      return `| ${plan.id} | ${plan.serviceToCounter.toFixed(2)} / ${plan.counterToRally.toFixed(2)} | ${dominant ? "有" : "无"} | ${pct(stats.policy.SpendAllBot.wins, stats.policy.SpendAllBot.matches - stats.policy.SpendAllBot.censored).toFixed(1)}% | ${pct(stats.policy.SaveForRallyBot.wins, stats.policy.SaveForRallyBot.matches - stats.policy.SaveForRallyBot.censored).toFixed(1)}% | ${pct(stats.policy.MinimumNeededBot.wins, stats.policy.MinimumNeededBot.matches - stats.policy.MinimumNeededBot.censored).toFixed(1)}% | ${pct(stats.policy.BalancedReserveBot.wins, stats.policy.BalancedReserveBot.matches - stats.policy.BalancedReserveBot.censored).toFixed(1)}% | ${pct(stats.rallyFirstAttackerWins, stats.rallyFirstAttackerEntries).toFixed(2)}% | ${pct(stats.censored, stats.matches).toFixed(2)}% | ${pct(s.budgetCounts.get("≥35") ?? 0, stats.rallyTotalBudget.length).toFixed(2)}% |`;
    })
    .join("\n");
  const report = `# V4 Carry Economy Focused Experiment: C / D / E\n\n## Scope and method\n\nThis is one isolated Carry-reward experiment. Candidate V4 attack bonuses, thresholds, base budgets, Rally pool, player data, blade data, rubber data, and formal rules were not changed. The experiment applies stage-specific Carry multipliers inside the balance simulator after the existing V4 deterministic floor conversion.\n\n- Seed: ${seed}; exactly 20,000 matches per plan; 60,000 total.\n- Sampling: the same ten pairwise combinations of the five requested resource bots; 1,000 mirrored pairs per matchup and plan (2,000 games per matchup). All three plans reuse each scenario's loadouts, server orientation, policy pairing and PRNG seed (common random numbers).\n- Integer rule: floor after multiplier, e.g. C/D/E Carry is Math.floor(unspent × stage multiplier). Existing integer unspent points and default V4 100% floor are preserved.\n- Match mode is BO1 as in the current simulator. For the efficiency table, “game win” equals match win; censored matches are excluded from completed-game and completed-match denominators. Point win is counted when that observed point ended.\n- Tier sanity matchups pool mixed gear observations only to check the fixed player tiers; no equipment ranking or balance inference is intended.\n\n## C / D / E comparison\n\n| Plan | Serve→Counter / Counter→Rally | Any >65% pair | SpendAll win | SaveForRally win | MinimumNeeded win | BalancedReserve win | Rally first attacker win | Censored | Rally budget ≥35 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${compareRows}\n\n## Resource strategy total win rates\n\nRates use completed strategy appearances across the four opponents; each bot has 8,000 scheduled appearances per plan. Paired matchup detail and Wilson intervals are in resource-strategy-matchups.csv. A pair gets DOMINANT_RESOURCE_STRATEGY_WARNING if a side's observed win rate exceeds 65%; CI is shown to distinguish screening signal from strength of evidence.\n\n${reportPlans.join("\n\n---\n\n")}\n\n## Resource efficiency curve\n\nSee resource-efficiency.csv. It groups each player's unused points at the end of Serve or Counter and reports point, game and match outcomes. MONOTONIC_RESOURCE_EFFICIENCY_WARNING is raised when the completed-match win rate moves only one direction across at least three sufficiently sampled buckets with a range of 5 percentage points or more. Each point in a BO1 match is a repeated observation for eventual match win, so match-rate bucket intervals are descriptive and not independent-sample confidence intervals.\n\n## Tier sanity check\n\nSee player-sanity.csv for each named player under C/D/E and pooled fixed tier matchups: 480 vs 480, 480 vs 460, 480 vs 440, 460 vs 460, 460 vs 440 and 440 vs 440. Player or equipment changes are out of scope.\n\n## Recommendation\n\n${recommendation}\n\n${noneHealthyDiagnosis}\n\n${recommendationStatus.map((item) => `- Plan ${item.id}: ${item.flags.length ? item.flags.join("; ") : "no screening flags"}`).join("\n")}\n\nNo Carry plan was installed as a formal ruleset. This report answers only the C/D/E Carry Economy question; it does not trigger additional Attack Bonus, Threshold, Rally budget, player or equipment experiments.`;

  return {
    report,
    summary: csv(summaryRows),
    matchups: csv(matchupRows),
    efficiency: csv(efficiencyRows),
    carry: csv(carryRows),
    phase: csv(phaseRows),
    players: csv(playerRows),
  };
}

export async function runCarryFocusedExperiment(
  catalog: GameRulesCatalog = loadCatalog(),
  seed = CARRY_CDE_SEED,
  reportDirectory = resolve(process.cwd(), "reports", "carry-c-d-e"),
): Promise<string> {
  const started = performance.now();
  const results = PLANS.map((plan) => {
    process.stdout.write(`Running plan ${plan.id}: 20,000 matches...\n`);
    const stats = runPlan(catalog, plan, seed);
    process.stdout.write(`Plan ${plan.id} complete.\n`);
    return { plan, stats };
  });
  const outputs = buildOutputs(results, seed, catalog);
  await mkdir(reportDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(reportDirectory, "CARRY_C_D_E_REPORT.md"),
      outputs.report,
      "utf8",
    ),
    writeFile(
      resolve(reportDirectory, "carry-summary.csv"),
      outputs.summary,
      "utf8",
    ),
    writeFile(
      resolve(reportDirectory, "resource-strategy-matchups.csv"),
      outputs.matchups,
      "utf8",
    ),
    writeFile(
      resolve(reportDirectory, "resource-efficiency.csv"),
      outputs.efficiency,
      "utf8",
    ),
    writeFile(
      resolve(reportDirectory, "carry-distribution.csv"),
      outputs.carry,
      "utf8",
    ),
    writeFile(
      resolve(reportDirectory, "phase-health.csv"),
      outputs.phase,
      "utf8",
    ),
    writeFile(
      resolve(reportDirectory, "player-sanity.csv"),
      outputs.players,
      "utf8",
    ),
  ]);
  process.stdout.write(
    `C/D/E experiment finished in ${((performance.now() - started) / 1000).toFixed(2)}s.\n`,
  );
  return reportDirectory;
}
