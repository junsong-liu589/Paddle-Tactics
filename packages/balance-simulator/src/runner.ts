import type {
  GameRulesCatalog,
  Loadout,
  Stage,
} from "@paddle-tactics/game-core";
import {
  BOT_POLICIES,
  policyFor,
  v4PolicyFor,
  type BotPolicy,
} from "./bots.js";
import {
  runCandidateMatch,
  runCandidateV3Match,
  runCandidateV4Match,
  runLegacyMatch,
  type PairMetric,
  type MatchOutcome,
} from "./engine.js";
import {
  BASELINE_PARAMETERS,
  CANDIDATE_V3_PARAMETERS,
  PARAMETER_CANDIDATES,
  V3_PARAMETER_CANDIDATES,
  withParameter,
  type BalanceParameters,
} from "./parameters.js";
import type {
  CandidateV3Settings,
  CandidateV4Settings,
} from "@paddle-tactics/game-core";
import { DEFAULT_CANDIDATE_V4_SETTINGS } from "@paddle-tactics/game-core";
import { seededRandom } from "./random.js";
import { wilsonInterval } from "./reports.js";

export type Preset = "quick" | "standard" | "full";
export type RunOptions = {
  preset: Preset;
  seed: number;
  matches?: number;
  experimentMatches?: number;
  mode: "all" | "rules" | "equipment";
};

export type ObservedLoadout = Loadout & {
  matches: number;
  wins: number;
  draws: number;
  style: string;
};
export type ModeSummary = {
  matches: number;
  winsTotal: number;
  draws: number;
  wins: Record<string, number>;
  policyWins: Record<string, number>;
  policyMatches: Record<string, number>;
  initiative: Record<Stage, { eligible: number; attackerWins: number }>;
  stageComparisons: Record<Stage, number>;
  stageEnds: Record<Stage, number>;
  attackChoices: Record<string, number>;
  defenseAllocations: Record<string, number>;
  topAttackChoices: Record<string, number>;
  topAttackConversions: Record<string, number>;
  pairMetrics: Record<string, PairMetric>;
  defensePatterns: Record<string, number>;
  points: number;
  deuceMatches: number;
  deuceCycleMatches: number;
  rallyRounds: number;
  rallyFifthRound: number;
  rallyTieBreaks: number;
  firstServerCompleted: number;
  firstServerWins: number;
  completedMatches: number;
  seatAWins: number;
  firstRallyAttackerEntries: number;
  firstRallyAttackerPointWins: number;
  tieBreakStarterEntries: number;
  tieBreakStarterWins: number;
  attackTop1Choices: number;
  attackTop3Choices: number;
  attackOffTop3Choices: number;
  defenseTop3Points: number;
  defenseOffTop3Points: number;
  directPoints: number;
  observedLoadouts: Record<string, ObservedLoadout>;
  configs: Record<
    string,
    {
      parameters: BalanceParameters | CandidateV3Settings | CandidateV4Settings;
      matches: number;
      wins: number;
      draws: number;
      points: number;
      rallyRounds: number;
      rallyTieBreaks: number;
    }
  >;
  resources: {
    attackSpendHistogram: Record<"service" | "receive", Record<string, number>>;
    defenseSpend: Record<
      "service" | "receive",
      { points: number; unspent: number; decisions: number }
    >;
    reserveAtCounter: Record<string, number>;
    reserveAtRally: Record<string, number>;
    rallyBudget: Record<string, number>;
    defenseHhi: { sum: number; count: number; max: number };
    rallyAttackPoints: Record<string, number>;
    rallyAttackUsage: Record<string, number>;
    rallyCarryWinByReserve: Record<
      string,
      { observations: number; wins: number }
    >;
    policyHeadToHead: Record<
      string,
      { matches: number; seatAWins: number; draws: number }
    >;
  };
};

export type SimulationResult = {
  seed: number;
  preset: Preset;
  startedAt: string;
  elapsedMs: number;
  requestedMatchesPerMode: number;
  modes: {
    legacy: ModeSummary;
    candidate: ModeSummary;
    candidateV3: ModeSummary;
    candidateV4: ModeSummary;
  };
  experiments: Array<{
    parameter: keyof BalanceParameters;
    value: number;
    matches: number;
    candidateWins: number;
    candidateDraws: number;
    completedMatches: number;
    candidateWinRate: number;
    ci95Low: number;
    ci95High: number;
  }>;
  v3Experiments: Array<{
    parameter: keyof CandidateV3Settings;
    value: number;
    matches: number;
    wins: number;
    censoredDraws: number;
    winRate: number;
    ci95Low: number;
    ci95High: number;
  }>;
  v3Validation: Array<{
    parameters: CandidateV3Settings;
    matches: number;
    aSeatWins: number;
    censoredDraws: number;
    winRate: number;
    ci95Low: number;
    ci95High: number;
  }>;
  v4Experiments: Array<{
    parameters: CandidateV4Settings;
    matches: number;
    seatAWins: number;
    censoredDraws: number;
    winRate: number;
    ci95Low: number;
    ci95High: number;
  }>;
  v4Validation: Array<{
    parameters: CandidateV4Settings;
    matches: number;
    seatAWins: number;
    censoredDraws: number;
    winRate: number;
    ci95Low: number;
    ci95High: number;
  }>;
  v4PolicyMatchups: Array<{
    policyA: BotPolicy;
    policyB: BotPolicy;
    matches: number;
    policyAWins: number;
    policyBWins: number;
    censoredDraws: number;
    policyAWinRate: number;
    ci95Low: number;
    ci95High: number;
  }>;
  policies: readonly BotPolicy[];
  catalogDimensions: {
    players: number;
    blades: number;
    rubbers: number;
    theoreticalLoadouts: number;
  };
};

export function presetMatches(preset: Preset): {
  matches: number;
  experimentMatches: number;
} {
  if (preset === "quick") return { matches: 1000, experimentMatches: 30 };
  if (preset === "standard") return { matches: 10000, experimentMatches: 200 };
  return { matches: 100000, experimentMatches: 1000 };
}

function makeLoadout(catalog: GameRulesCatalog, index: number): Loadout {
  const nPlayers = catalog.players.length;
  const nBlades = catalog.blades.length;
  const nRubbers = catalog.rubbers.length;
  return {
    playerId: catalog.players[index % nPlayers]!.id,
    bladeId: catalog.blades[Math.floor(index / nPlayers) % nBlades]!.id,
    forehandRubberId:
      catalog.rubbers[Math.floor(index / (nPlayers * nBlades)) % nRubbers]!.id,
    backhandRubberId:
      catalog.rubbers[
        Math.floor(index / (nPlayers * nBlades * nRubbers)) % nRubbers
      ]!.id,
  };
}

function emptySummary(): ModeSummary {
  return {
    matches: 0,
    winsTotal: 0,
    draws: 0,
    wins: {},
    policyWins: {},
    policyMatches: {},
    initiative: {
      service: { eligible: 0, attackerWins: 0 },
      receive: { eligible: 0, attackerWins: 0 },
      rally: { eligible: 0, attackerWins: 0 },
    },
    stageComparisons: { service: 0, receive: 0, rally: 0 },
    stageEnds: { service: 0, receive: 0, rally: 0 },
    attackChoices: {},
    defenseAllocations: {},
    topAttackChoices: {},
    topAttackConversions: {},
    pairMetrics: {},
    defensePatterns: {},
    points: 0,
    deuceMatches: 0,
    deuceCycleMatches: 0,
    rallyRounds: 0,
    rallyFifthRound: 0,
    rallyTieBreaks: 0,
    firstServerCompleted: 0,
    firstServerWins: 0,
    completedMatches: 0,
    seatAWins: 0,
    firstRallyAttackerEntries: 0,
    firstRallyAttackerPointWins: 0,
    tieBreakStarterEntries: 0,
    tieBreakStarterWins: 0,
    attackTop1Choices: 0,
    attackTop3Choices: 0,
    attackOffTop3Choices: 0,
    defenseTop3Points: 0,
    defenseOffTop3Points: 0,
    directPoints: 0,
    observedLoadouts: {},
    configs: {},
    resources: {
      attackSpendHistogram: { service: {}, receive: {} },
      defenseSpend: {
        service: { points: 0, unspent: 0, decisions: 0 },
        receive: { points: 0, unspent: 0, decisions: 0 },
      },
      reserveAtCounter: {},
      reserveAtRally: {},
      rallyBudget: {},
      defenseHhi: { sum: 0, count: 0, max: 0 },
      rallyAttackPoints: {},
      rallyAttackUsage: {},
      rallyCarryWinByReserve: {},
      policyHeadToHead: {},
    },
  };
}

function loadoutKey(loadout: Loadout): string {
  return `${loadout.playerId}|${loadout.bladeId}|${loadout.forehandRubberId}|${loadout.backhandRubberId}`;
}

function bump(record: Record<string, number>, key: string, amount = 1): void {
  record[key] = (record[key] ?? 0) + amount;
}

function styleOf(loadout: Loadout, catalog: GameRulesCatalog): string {
  const player = catalog.players.find(
    (entry) => entry.id === loadout.playerId,
  )!;
  const blade = catalog.blades.find((entry) => entry.id === loadout.bladeId)!;
  const fh = catalog.rubbers.find(
    (entry) => entry.id === loadout.forehandRubberId,
  )!;
  const bh = catalog.rubbers.find(
    (entry) => entry.id === loadout.backhandRubberId,
  )!;
  const style = `${blade.style} ${fh.style} ${bh.style} ${player.style}`;
  if (/防守|控制|稳健/.test(style)) return "Defense Counter";
  if (/旋转|弧圈/.test(style)) return "Spin Control";
  if (/相持|全面|均衡/.test(style)) return "Rally";
  if (/反手/.test(style)) return "Backhand Pressure";
  if (/正手|进攻|速度|快速/.test(style)) return "Forehand Attack";
  return "Balanced";
}

function accumulate(
  summary: ModeSummary,
  result: MatchOutcome,
  a: Loadout,
  b: Loadout,
  catalog: GameRulesCatalog,
  configName: string,
  parameters: BalanceParameters | CandidateV3Settings | CandidateV4Settings,
): void {
  summary.matches += 1;
  summary.points += result.points.A! + result.points.B!;
  summary.deuceMatches += Number(result.deuceReached);
  summary.deuceCycleMatches += Number(result.deuceCycleDetected);
  summary.rallyRounds += result.rallyRounds;
  summary.rallyFifthRound += result.rallyFifthRound;
  summary.rallyTieBreaks += result.rallyTieBreaks;
  summary.firstServerCompleted += Number(result.firstServerWin !== null);
  summary.firstServerWins += Number(result.firstServerWin === true);
  summary.firstRallyAttackerEntries += result.firstRallyAttackerEntries;
  summary.firstRallyAttackerPointWins += result.firstRallyAttackerPointWins;
  summary.tieBreakStarterEntries += result.tieBreakStarterEntries;
  summary.tieBreakStarterWins += result.tieBreakStarterWins;
  summary.attackTop1Choices += result.attackTop1Choices;
  summary.attackTop3Choices += result.attackTop3Choices;
  summary.attackOffTop3Choices += result.attackOffTop3Choices;
  summary.defenseTop3Points += result.defenseTop3Points;
  summary.defenseOffTop3Points += result.defenseOffTop3Points;
  for (const stage of ["service", "receive", "rally"] as const) {
    summary.stageComparisons[stage] += result.stageComparisons[stage];
    summary.stageEnds[stage] += result.stageEnds[stage];
    summary.initiative[stage].eligible += result.initiative[stage].eligible;
    summary.initiative[stage].attackerWins +=
      result.initiative[stage].attackerWins;
  }
  for (const [key, value] of Object.entries(result.attackChoices))
    summary.attackChoices[key] = (summary.attackChoices[key] ?? 0) + value;
  for (const [key, value] of Object.entries(result.defenseAllocations))
    summary.defenseAllocations[key] =
      (summary.defenseAllocations[key] ?? 0) + value;
  for (const [key, value] of Object.entries(result.topAttackChoices))
    summary.topAttackChoices[key] =
      (summary.topAttackChoices[key] ?? 0) + value;
  for (const [key, value] of Object.entries(result.topAttackConversions))
    summary.topAttackConversions[key] =
      (summary.topAttackConversions[key] ?? 0) + value;
  for (const [pairId, metric] of Object.entries(result.pairMetrics)) {
    const total = (summary.pairMetrics[pairId] ??= {
      comparisons: 0,
      attackerConversions: 0,
      defenseHolds: 0,
      marginTotal: 0,
      defenseAllocationTotal: 0,
      marginalDefenseHolds: 0,
      bonusAssistedConversions: 0,
    });
    for (const key of Object.keys(total) as Array<keyof PairMetric>)
      total[key] += metric[key];
  }
  for (const [key, value] of Object.entries(result.defensePatterns))
    summary.defensePatterns[key] = (summary.defensePatterns[key] ?? 0) + value;
  if (result.resourceMetrics) {
    const resources = result.resourceMetrics;
    for (const stage of ["service", "receive"] as const) {
      for (const spent of resources.attackSpend[stage]) {
        const key = String(spent);
        summary.resources.attackSpendHistogram[stage][key] =
          (summary.resources.attackSpendHistogram[stage][key] ?? 0) + 1;
      }
      for (const spent of resources.defenseSpend[stage]) {
        summary.resources.defenseSpend[stage].points += spent;
        summary.resources.defenseSpend[stage].decisions += 1;
      }
      for (const unspent of resources.defenseUnspent[stage])
        summary.resources.defenseSpend[stage].unspent += unspent;
    }
    for (const amount of resources.reserveAtCounter)
      bump(summary.resources.reserveAtCounter, String(amount));
    for (const amount of resources.reserveAtRally)
      bump(summary.resources.reserveAtRally, String(amount));
    for (const amount of resources.rallyBudget)
      bump(summary.resources.rallyBudget, String(amount));
    for (const value of resources.defenseConcentration) {
      summary.resources.defenseHhi.sum += value;
      summary.resources.defenseHhi.count += 1;
      summary.resources.defenseHhi.max = Math.max(
        summary.resources.defenseHhi.max,
        value,
      );
    }
    for (const [key, value] of Object.entries(resources.rallyAttackAllocation))
      summary.resources.rallyAttackPoints[key] =
        (summary.resources.rallyAttackPoints[key] ?? 0) + value;
    for (const [key, value] of Object.entries(resources.rallyAttackUsage))
      summary.resources.rallyAttackUsage[key] =
        (summary.resources.rallyAttackUsage[key] ?? 0) + value;
    for (const observation of resources.rallyCarryPointOutcomes) {
      const bucket = (summary.resources.rallyCarryWinByReserve[
        String(observation.reserve)
      ] ??= { observations: 0, wins: 0 });
      bucket.observations += 1;
      bucket.wins += Number(observation.won);
    }
  }
  const matchupKey = `${result.policyA}|${result.policyB}`;
  const matchup = (summary.resources.policyHeadToHead[matchupKey] ??= {
    matches: 0,
    seatAWins: 0,
    draws: 0,
  });
  matchup.matches += 1;
  matchup.seatAWins += Number(result.winner === "A");
  matchup.draws += Number(result.winner === null);
  summary.directPoints += Object.values(result.stageEnds).reduce(
    (sum, value) => sum + value,
    0,
  );
  const winner = result.winner;
  if (winner === null) summary.draws += 1;
  else {
    summary.winsTotal += 1;
    summary.completedMatches += 1;
    summary.seatAWins += Number(winner === "A");
    const winnerLoadout = winner === "A" ? a : b;
    summary.wins[winnerLoadout.playerId] =
      (summary.wins[winnerLoadout.playerId] ?? 0) + 1;
    const winningPolicy = winner === "A" ? result.policyA : result.policyB;
    summary.policyWins[winningPolicy] =
      (summary.policyWins[winningPolicy] ?? 0) + 1;
  }
  summary.policyMatches[result.policyA] =
    (summary.policyMatches[result.policyA] ?? 0) + 1;
  summary.policyMatches[result.policyB] =
    (summary.policyMatches[result.policyB] ?? 0) + 1;
  for (const loadout of [a, b]) {
    const key = loadoutKey(loadout);
    const entry = (summary.observedLoadouts[key] ??= {
      ...loadout,
      matches: 0,
      wins: 0,
      draws: 0,
      style: styleOf(loadout, catalog),
    });
    entry.matches += 1;
    if (winner === null) entry.draws += 1;
    else if (loadout === (winner === "A" ? a : b)) entry.wins += 1;
  }
  const config = (summary.configs[configName] ??= {
    parameters,
    matches: 0,
    wins: 0,
    draws: 0,
    points: 0,
    rallyRounds: 0,
    rallyTieBreaks: 0,
  });
  config.matches += 1;
  config.wins += Number(winner === "A");
  config.draws += Number(winner === null);
  config.points += result.points.A! + result.points.B!;
  config.rallyRounds += result.rallyRounds;
  config.rallyTieBreaks += result.rallyTieBreaks;
}

function makeScenario(catalog: GameRulesCatalog, seed: number, i: number) {
  const policyRandom = seededRandom(seed + i * 0x9e3779b1);
  let a = makeLoadout(catalog, i * 17);
  let b = makeLoadout(catalog, i * 139 + 1);
  if (i % 20 === 0) b = { ...a };
  if (i % 2 === 1) [a, b] = [b, a];
  const policyA = policyFor(policyRandom());
  const policyB = policyFor(policyRandom());
  const policyV4A = v4PolicyFor(policyRandom());
  const policyV4B = v4PolicyFor(policyRandom());
  const firstServerA = i % 2 === 0;
  const matchSeed = seed + i * 0x9e3779b1;
  const common = {
    catalog,
    loadoutA: a,
    loadoutB: b,
    policyA,
    policyB,
    firstServerA,
  };
  return {
    a,
    b,
    common,
    v4Common: { ...common, policyA: policyV4A, policyB: policyV4B },
    randomSeed: matchSeed ^ 0x5f356495,
  };
}

function playOne(
  catalog: GameRulesCatalog,
  seed: number,
  i: number,
  params: BalanceParameters,
  v3Settings: CandidateV3Settings = CANDIDATE_V3_PARAMETERS,
): {
  legacy: MatchOutcome;
  candidate: MatchOutcome;
  candidateV3: MatchOutcome;
  candidateV4: MatchOutcome;
  a: Loadout;
  b: Loadout;
} {
  const { a, b, common, v4Common, randomSeed } = makeScenario(catalog, seed, i);
  const legacy = runLegacyMatch({
    ...common,
    random: seededRandom(randomSeed),
  });
  const candidate = runCandidateMatch(
    { ...common, random: seededRandom(randomSeed) },
    params,
  );
  const candidateV3 = runCandidateV3Match(
    { ...common, random: seededRandom(randomSeed) },
    v3Settings,
  );
  const candidateV4 = runCandidateV4Match({
    ...v4Common,
    random: seededRandom(randomSeed),
  });
  return {
    a,
    b,
    legacy,
    candidate,
    candidateV3,
    candidateV4,
  };
}

export function runSimulation(
  catalog: GameRulesCatalog,
  options: RunOptions,
): SimulationResult {
  const started = performance.now();
  const startedAt = new Date().toISOString();
  const defaults = presetMatches(options.preset);
  const matches = options.matches ?? defaults.matches;
  const experimentMatches =
    options.experimentMatches ?? defaults.experimentMatches;
  const legacy = emptySummary();
  const candidate = emptySummary();
  const candidateV3 = emptySummary();
  const candidateV4 = emptySummary();
  for (let i = 0; i < matches; i += 1) {
    const setup = playOne(catalog, options.seed, i, BASELINE_PARAMETERS);
    accumulate(
      legacy,
      setup.legacy,
      setup.a,
      setup.b,
      catalog,
      "Legacy 10/10/15",
      BASELINE_PARAMETERS,
    );
    accumulate(
      candidateV3,
      setup.candidateV3,
      setup.a,
      setup.b,
      catalog,
      "Candidate V3 baseline",
      CANDIDATE_V3_PARAMETERS,
    );
    accumulate(
      candidateV4,
      setup.candidateV4,
      setup.a,
      setup.b,
      catalog,
      "Candidate V4 baseline",
      DEFAULT_CANDIDATE_V4_SETTINGS,
    );
    accumulate(
      candidate,
      setup.candidate,
      setup.a,
      setup.b,
      catalog,
      "Candidate baseline",
      BASELINE_PARAMETERS,
    );
  }

  const experiments: SimulationResult["experiments"] = [];
  const v3Experiments: SimulationResult["v3Experiments"] = [];
  const v3Validation: SimulationResult["v3Validation"] = [];
  const v4Experiments: SimulationResult["v4Experiments"] = [];
  const v4Validation: SimulationResult["v4Validation"] = [];
  const v4PolicyMatchups: SimulationResult["v4PolicyMatchups"] = [];
  let experimentIndex = matches;
  if (options.mode !== "equipment") {
    for (const parameter of Object.keys(
      PARAMETER_CANDIDATES,
    ) as (keyof BalanceParameters)[]) {
      for (const value of PARAMETER_CANDIDATES[parameter]!) {
        if (value === BASELINE_PARAMETERS[parameter]) continue;
        let wins = 0;
        let draws = 0;
        for (let i = 0; i < experimentMatches; i += 1) {
          const testParams = withParameter(
            BASELINE_PARAMETERS,
            parameter,
            value,
          );
          const scenario = playOne(
            catalog,
            options.seed + 1000003,
            experimentIndex++,
            testParams,
          );
          wins += Number(scenario.candidate.winner === "A");
          draws += Number(scenario.candidate.winner === null);
        }
        candidate.configs[`${parameter}=${value}`] = {
          parameters: withParameter(BASELINE_PARAMETERS, parameter, value),
          matches: experimentMatches,
          wins,
          draws,
          points: 0,
          rallyRounds: 0,
          rallyTieBreaks: 0,
        };
        const completedMatches = experimentMatches - draws;
        const p = wins / Math.max(1, experimentMatches);
        const z = 1.959963984540054;
        const divisor = 1 + (z * z) / Math.max(1, experimentMatches);
        const center =
          (p + (z * z) / (2 * Math.max(1, experimentMatches))) / divisor;
        const radius =
          (z *
            Math.sqrt(
              (p * (1 - p) + (z * z) / (4 * Math.max(1, experimentMatches))) /
                Math.max(1, experimentMatches),
            )) /
          divisor;
        experiments.push({
          parameter,
          value,
          matches: experimentMatches,
          completedMatches,
          candidateWins: wins,
          candidateDraws: draws,
          candidateWinRate: p,
          ci95Low: Math.max(0, center - radius),
          ci95High: Math.min(1, center + radius),
        });
      }
    }
    for (const parameter of Object.keys(
      V3_PARAMETER_CANDIDATES,
    ) as (keyof CandidateV3Settings)[]) {
      for (const value of V3_PARAMETER_CANDIDATES[parameter]!) {
        if (value === CANDIDATE_V3_PARAMETERS[parameter]) continue;
        let wins = 0;
        let censoredDraws = 0;
        const settings = { ...CANDIDATE_V3_PARAMETERS, [parameter]: value };
        for (let i = 0; i < experimentMatches; i += 1) {
          const setup = makeScenario(
            catalog,
            options.seed + 2000033,
            experimentIndex++,
          );
          const outcome = runCandidateV3Match(
            { ...setup.common, random: seededRandom(setup.randomSeed) },
            settings,
          );
          wins += Number(outcome.winner === "A");
          censoredDraws += Number(outcome.winner === null);
        }
        const n = experimentMatches;
        const p = wins / Math.max(1, n);
        const z = 1.959963984540054;
        const divisor = 1 + (z * z) / Math.max(1, n);
        const center = (p + (z * z) / (2 * Math.max(1, n))) / divisor;
        const radius =
          (z *
            Math.sqrt(
              (p * (1 - p) + (z * z) / (4 * Math.max(1, n))) / Math.max(1, n),
            )) /
          divisor;
        v3Experiments.push({
          parameter,
          value,
          matches: n,
          wins,
          censoredDraws,
          winRate: p,
          ci95Low: Math.max(0, center - radius),
          ci95High: Math.min(1, center + radius),
        });
      }
    }
    const selected: CandidateV3Settings[] = [];
    for (const parameter of [
      "attackBonus",
      "defensePool",
      "defenderVisibleTopK",
    ] as const) {
      const row = v3Experiments
        .filter((item) => item.parameter === parameter)
        .sort(
          (a, b) => Math.abs(a.winRate - 0.5) - Math.abs(b.winRate - 0.5),
        )[0];
      if (row)
        selected.push({ ...CANDIDATE_V3_PARAMETERS, [parameter]: row.value });
    }
    const validationMatches = Math.max(10_000, experimentMatches);
    for (
      let candidateIndex = 0;
      candidateIndex < selected.length;
      candidateIndex += 1
    ) {
      const settings = selected[candidateIndex]!;
      let wins = 0;
      let censoredDraws = 0;
      for (let i = 0; i < validationMatches; i += 1) {
        const matchIndex = 9000001 + candidateIndex * validationMatches + i;
        const setup = makeScenario(catalog, options.seed, matchIndex);
        const outcome = runCandidateV3Match(
          {
            ...setup.common,
            random: seededRandom(setup.randomSeed),
          },
          settings,
        );
        wins += Number(outcome.winner === "A");
        censoredDraws += Number(outcome.winner === null);
      }
      const p = wins / validationMatches;
      const z = 1.959963984540054;
      const divisor = 1 + (z * z) / validationMatches;
      const center = (p + (z * z) / (2 * validationMatches)) / divisor;
      const radius =
        (z *
          Math.sqrt(
            (p * (1 - p) + (z * z) / (4 * validationMatches)) /
              validationMatches,
          )) /
        divisor;
      v3Validation.push({
        parameters: settings,
        matches: validationMatches,
        aSeatWins: wins,
        censoredDraws,
        winRate: p,
        ci95Low: Math.max(0, center - radius),
        ci95High: Math.min(1, center + radius),
      });
    }
  }
  if (options.mode !== "equipment") {
    const policyPairs: Array<[BotPolicy, BotPolicy]> = [
      ["SaveForRallyBot", "AllInEarlyBot"],
      ["SaveForRallyBot", "MinimumNeededBot"],
      ["SaveForRallyBot", "BalancedReserveBot"],
      ["AllInEarlyBot", "MinimumNeededBot"],
      ["AllInEarlyBot", "BalancedReserveBot"],
      ["MinimumNeededBot", "BalancedReserveBot"],
      ["FortressBot", "BalancedReserveBot"],
      ["SpendAllBot", "SaveForRallyBot"],
      ["SpendAllBot", "MinimumNeededBot"],
      ["SaveForRallyBot", "FortressBot"],
    ];
    const headToHeadMatches =
      matches >= 100_000
        ? 5_000
        : matches >= 10_000
          ? 1_000
          : Math.min(250, matches);
    for (let pairIndex = 0; pairIndex < policyPairs.length; pairIndex += 1) {
      const [policyA, policyB] = policyPairs[pairIndex]!;
      let policyAWins = 0;
      let policyBWins = 0;
      let censoredDraws = 0;
      for (let i = 0; i < headToHeadMatches; i += 1) {
        const scenario = makeScenario(
          catalog,
          options.seed + 9_000_001 + pairIndex,
          50_000_000 + pairIndex * headToHeadMatches + i,
        );
        const firstIsA = i % 2 === 0;
        const outcome = runCandidateV4Match({
          ...scenario.v4Common,
          policyA: firstIsA ? policyA : policyB,
          policyB: firstIsA ? policyB : policyA,
          random: seededRandom(scenario.randomSeed),
        });
        if (outcome.winner === null) censoredDraws += 1;
        else if ((outcome.winner === "A") === firstIsA) policyAWins += 1;
        else policyBWins += 1;
      }
      const [ci95Low, ci95High] = wilsonInterval(
        policyAWins,
        headToHeadMatches - censoredDraws,
      );
      v4PolicyMatchups.push({
        policyA,
        policyB,
        matches: headToHeadMatches,
        policyAWins,
        policyBWins,
        censoredDraws,
        policyAWinRate:
          policyAWins / Math.max(1, headToHeadMatches - censoredDraws),
        ci95Low,
        ci95High,
      });
    }
    const sweeps: Array<{
      parameter: keyof CandidateV4Settings;
      value: number;
    }> = [
      { parameter: "carryRatePercent", value: 50 },
      { parameter: "carryRatePercent", value: 75 },
      { parameter: "rallyBudget", value: 16 },
      { parameter: "rallyBudget", value: 18 },
      { parameter: "rallyBudget", value: 22 },
    ];
    let index = matches + 20_000_000;
    for (const sweep of sweeps) {
      const parameters = {
        ...DEFAULT_CANDIDATE_V4_SETTINGS,
        [sweep.parameter]: sweep.value,
      };
      let seatAWins = 0;
      let censoredDraws = 0;
      for (let i = 0; i < experimentMatches; i += 1) {
        const scenario = makeScenario(
          catalog,
          options.seed + 3_000_017,
          index++,
        );
        const outcome = runCandidateV4Match(
          { ...scenario.v4Common, random: seededRandom(scenario.randomSeed) },
          parameters,
        );
        seatAWins += Number(outcome.winner === "A");
        censoredDraws += Number(outcome.winner === null);
      }
      const [ci95Low, ci95High] = wilsonInterval(seatAWins, experimentMatches);
      v4Experiments.push({
        parameters,
        matches: experimentMatches,
        seatAWins,
        censoredDraws,
        winRate: seatAWins / experimentMatches,
        ci95Low,
        ci95High,
      });
    }
    const focusedSettings = [
      { ...DEFAULT_CANDIDATE_V4_SETTINGS, carryRatePercent: 75 },
      { ...DEFAULT_CANDIDATE_V4_SETTINGS, carryRatePercent: 50 },
      { ...DEFAULT_CANDIDATE_V4_SETTINGS, rallyBudget: 18 },
    ];
    const validationMatches =
      matches >= 100_000
        ? 20_000
        : matches >= 10_000
          ? 2_000
          : Math.min(1_000, matches);
    for (
      let candidateIndex = 0;
      candidateIndex < focusedSettings.length;
      candidateIndex += 1
    ) {
      const parameters = focusedSettings[candidateIndex]!;
      let seatAWins = 0;
      let censoredDraws = 0;
      for (let i = 0; i < validationMatches; i += 1) {
        const scenario = makeScenario(
          catalog,
          options.seed + 7_000_033,
          40_000_000 + candidateIndex * validationMatches + i,
        );
        const outcome = runCandidateV4Match(
          { ...scenario.v4Common, random: seededRandom(scenario.randomSeed) },
          parameters,
        );
        seatAWins += Number(outcome.winner === "A");
        censoredDraws += Number(outcome.winner === null);
      }
      const [ci95Low, ci95High] = wilsonInterval(seatAWins, validationMatches);
      v4Validation.push({
        parameters,
        matches: validationMatches,
        seatAWins,
        censoredDraws,
        winRate: seatAWins / validationMatches,
        ci95Low,
        ci95High,
      });
    }
  }
  return {
    seed: options.seed,
    preset: options.preset,
    startedAt,
    elapsedMs: Math.round(performance.now() - started),
    requestedMatchesPerMode: matches,
    modes: { legacy, candidate, candidateV3, candidateV4 },
    experiments,
    v3Experiments,
    v3Validation,
    v4Experiments,
    v4Validation,
    v4PolicyMatchups,
    policies: BOT_POLICIES,
    catalogDimensions: {
      players: catalog.players.length,
      blades: catalog.blades.length,
      rubbers: catalog.rubbers.length,
      theoreticalLoadouts:
        catalog.players.length *
        catalog.blades.length *
        catalog.rubbers.length ** 2,
    },
  };
}
