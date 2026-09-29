import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  CandidateV3Settings,
  GameRulesCatalog,
  Stage,
} from "@paddle-tactics/game-core";
import { DEFAULT_CANDIDATE_V4_SETTINGS } from "@paddle-tactics/game-core";
import type { ModeSummary, SimulationResult } from "./runner.js";

function pct(wins: number, matches: number): number {
  return matches ? wins / matches : 0;
}

function ratio(a: number, b: number): string {
  return b ? ((100 * a) / b).toFixed(2) : "n/a";
}

function rallyStarts(summary: ModeSummary): number {
  return Math.max(
    0,
    summary.points - summary.stageEnds.service - summary.stageEnds.receive,
  );
}

function histogramAverage(histogram: Record<string, number>): number {
  const n = Object.values(histogram).reduce((sum, count) => sum + count, 0);
  return n
    ? Object.entries(histogram).reduce(
        (sum, [value, count]) => sum + Number(value) * count,
        0,
      ) / n
    : 0;
}

function histogramPercentile(
  histogram: Record<string, number>,
  percentile: number,
): number {
  const total = Object.values(histogram).reduce((sum, count) => sum + count, 0);
  if (!total) return 0;
  const target = Math.ceil(total * percentile);
  let seen = 0;
  for (const [value, count] of Object.entries(histogram).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )) {
    seen += count;
    if (seen >= target) return Number(value);
  }
  return 0;
}

function v4ResourceReports(result: SimulationResult): {
  csv: string;
  report: string;
  recommendations: string;
} {
  const m = result.modes.candidateV4;
  const r = m.resources;
  const rallyEntries = Math.max(1, rallyStarts(m));
  const rows: Array<Array<string | number>> = [
    ["metric", "category", "value", "count"],
  ];
  for (const stage of ["service", "receive"] as const) {
    for (const [spent, count] of Object.entries(r.attackSpendHistogram[stage]))
      rows.push(["attack_spend", stage, spent, count]);
    const defense = r.defenseSpend[stage];
    rows.push([
      "defense_average_spend",
      stage,
      defense.points / Math.max(1, defense.decisions),
      defense.decisions,
    ]);
    rows.push([
      "defense_average_unspent",
      stage,
      defense.unspent / Math.max(1, defense.decisions),
      defense.decisions,
    ]);
  }
  for (const [reserve, count] of Object.entries(r.reserveAtCounter))
    rows.push(["reserve_at_counter", reserve, reserve, count]);
  for (const [reserve, count] of Object.entries(r.reserveAtRally))
    rows.push(["reserve_at_rally", reserve, reserve, count]);
  for (const [budget, count] of Object.entries(r.rallyBudget))
    rows.push(["rally_budget", budget, budget, count]);
  rows.push([
    "defense_hhi_average",
    "all_defenses",
    r.defenseHhi.sum / Math.max(1, r.defenseHhi.count),
    r.defenseHhi.count,
  ]);
  rows.push([
    "defense_hhi_maximum",
    "all_defenses",
    r.defenseHhi.max,
    r.defenseHhi.count,
  ]);
  const [tieStarterLow, tieStarterHigh] = wilsonInterval(
    m.tieBreakStarterWins,
    m.tieBreakStarterEntries,
  );
  rows.push([
    "tie_break_starter_win_rate_percent",
    "Candidate V4",
    ratio(m.tieBreakStarterWins, m.tieBreakStarterEntries),
    m.tieBreakStarterEntries,
  ]);
  rows.push([
    "tie_break_starter_ci95_low_percent",
    "Candidate V4",
    (tieStarterLow * 100).toFixed(2),
    m.tieBreakStarterEntries,
  ]);
  rows.push([
    "tie_break_starter_ci95_high_percent",
    "Candidate V4",
    (tieStarterHigh * 100).toFixed(2),
    m.tieBreakStarterEntries,
  ]);
  for (const [skill, points] of Object.entries(r.rallyAttackPoints)) {
    rows.push(["rally_attack_points", skill, points, 0]);
    const uses = r.rallyAttackUsage[skill] ?? 0;
    rows.push([
      "rally_attack_use_rate_percent",
      skill,
      ratio(uses, rallyEntries * 2),
      rallyEntries * 2,
    ]);
    rows.push([
      "rally_attack_average_points_when_used",
      skill,
      points / Math.max(1, uses),
      uses,
    ]);
    rows.push([
      "rally_attack_average_points_per_entry",
      skill,
      points / Math.max(1, rallyEntries * 2),
      rallyEntries * 2,
    ]);
  }
  for (const [reserve, observation] of Object.entries(r.rallyCarryWinByReserve))
    rows.push([
      "carry_win_rate",
      reserve,
      ratio(observation.wins, observation.observations),
      observation.observations,
    ]);
  for (const matchup of result.v4PolicyMatchups)
    rows.push([
      "focused_policy_head_to_head",
      `${matchup.policyA} vs ${matchup.policyB}`,
      `${(matchup.policyAWinRate * 100).toFixed(2)}%`,
      matchup.matches,
    ]);
  for (const [matchup, value] of Object.entries(r.policyHeadToHead))
    rows.push([
      "policy_head_to_head_seat_a",
      matchup,
      ((100 * value.seatAWins) / Math.max(1, value.matches)).toFixed(2),
      value.matches,
    ]);
  const experimentRows =
    result.v4Experiments
      .map(
        (item) =>
          `| ${JSON.stringify(item.parameters)} | ${item.matches} | ${(item.winRate * 100).toFixed(2)}% | ${(item.ci95Low * 100).toFixed(2)}–${(item.ci95High * 100).toFixed(2)}% | ${item.censoredDraws} |`,
      )
      .join("\n") || "| no parameter runs | 0 | n/a | n/a | 0 |";
  const validationRows =
    result.v4Validation
      .map(
        (item) =>
          `| ${JSON.stringify(item.parameters)} | ${item.matches} | ${(item.winRate * 100).toFixed(2)}% | ${(item.ci95Low * 100).toFixed(2)}–${(item.ci95High * 100).toFixed(2)}% | ${item.censoredDraws} |`,
      )
      .join("\n") || "| no focused runs | 0 | n/a | n/a | 0 |";
  const policyRows =
    result.v4PolicyMatchups
      .map(
        (item) =>
          `| ${item.policyA} | ${item.policyB} | ${item.matches} | ${(item.policyAWinRate * 100).toFixed(2)}% | ${(item.ci95Low * 100).toFixed(2)}–${(item.ci95High * 100).toFixed(2)}% | ${item.censoredDraws} |`,
      )
      .join("\n") || "| no head-to-head runs | 0 | 0% | n/a | 0 |";
  const dominantPairs = result.v4PolicyMatchups.filter(
    (item) =>
      item.matches >= 1_000 &&
      (item.policyAWinRate >= 0.65 || item.policyAWinRate <= 0.35),
  );
  const totalRallyBudgets = Object.values(r.rallyBudget).reduce(
    (sum, count) => sum + count,
    0,
  );
  const thirtyPlusShare =
    Object.entries(r.rallyBudget)
      .filter(([budget]) => Number(budget) >= 30)
      .reduce((sum, [, count]) => sum + count, 0) /
    Math.max(1, totalRallyBudgets);
  const rallyAttackerRate =
    m.firstRallyAttackerPointWins / Math.max(1, m.firstRallyAttackerEntries);
  const reviewFlags = [
    ...(dominantPairs.length
      ? [
          `${dominantPairs.length} paired policy results cross the 65% dominance screening threshold`,
        ]
      : []),
    ...(thirtyPlusShare > 0.1
      ? [
          `30+ Rally budgets occur in ${(100 * thirtyPlusShare).toFixed(2)}% of Rally entries`,
        ]
      : []),
    ...(m.draws / Math.max(1, m.matches) > 0.05
      ? [`censored-match rate is ${ratio(m.draws, m.matches)}%`]
      : []),
    ...(rallyAttackerRate < 0.45 || rallyAttackerRate > 0.55
      ? [
          `first Rally attacker rate is ${ratio(m.firstRallyAttackerPointWins, m.firstRallyAttackerEntries)}%`,
        ]
      : []),
  ];
  const insufficientSample =
    m.matches < 100_000 ||
    result.v4Validation.some((item) => item.matches < 20_000) ||
    result.v4PolicyMatchups.some((item) => item.matches < 1_000);
  const decision = insufficientSample
    ? "INSUFFICIENT_SAMPLE for promotion review: the run does not meet the V4 Full baseline, focused validation, or policy-pair sample targets."
    : reviewFlags.length
      ? `Do not promote V4 yet: ${reviewFlags.join("; ")}.`
      : "V4 passes the automated screening thresholds for human review; this report does not change the formal default.";
  const carryBuckets = Object.entries(r.rallyCarryWinByReserve)
    .map(([reserve, sample]) => ({
      reserve: Number(reserve),
      rate: sample.wins / Math.max(1, sample.observations),
    }))
    .sort((a, b) => a.reserve - b.reserve);
  const carrySlope =
    carryBuckets.length > 1
      ? (
          ((carryBuckets.at(-1)!.rate - carryBuckets[0]!.rate) /
            Math.max(
              1,
              carryBuckets.at(-1)!.reserve - carryBuckets[0]!.reserve,
            )) *
          100
        ).toFixed(2)
      : "INSUFFICIENT_SAMPLE";
  const attackMean = (stage: "service" | "receive") =>
    histogramAverage(r.attackSpendHistogram[stage]);
  const counterReserveMean = histogramAverage(r.reserveAtCounter);
  const rallyReserveMean = histogramAverage(r.reserveAtRally);
  const budgetHist = r.rallyBudget;
  const report = `# Candidate V4 Balance Report\n\nCandidate V4 was run as an experimental reducer ruleset. Legacy V1 and Candidate V3 remain unchanged comparison series; formal data and default rules were not modified.\n\n## Run and recommendation\n\n- Seed: ${result.seed}; Candidate V4 baseline: ${m.matches.toLocaleString()} matches; total runtime: ${(result.elapsedMs / 1000).toFixed(2)} s.\n- Parameters: service/counter attack ${DEFAULT_CANDIDATE_V4_SETTINGS.serviceAttackBudget}, defense ${DEFAULT_CANDIDATE_V4_SETTINGS.serviceDefenseBudget}; Rally ${DEFAULT_CANDIDATE_V4_SETTINGS.rallyBudget}; attack cap ${DEFAULT_CANDIDATE_V4_SETTINGS.attackCap}; carry ${DEFAULT_CANDIDATE_V4_SETTINGS.carryRatePercent}%; Top ${DEFAULT_CANDIDATE_V4_SETTINGS.defenderVisibleTopK}; Rally maximum ${DEFAULT_CANDIDATE_V4_SETTINGS.rallyMaxComparisons}.\n- Completed: ${m.winsTotal.toLocaleString()}; censored: ${m.draws.toLocaleString()} (${ratio(m.draws, m.matches)}%); deuce-cycle censored: ${m.deuceCycleMatches.toLocaleString()}.\n- Recommendation: ${decision}\n\n## V1 / V3 / V4 comparison\n\n| Ruleset | Matches | Completed | Points/match | Rally comparisons/match | Rally tie-break share | Deuce/censored | First Rally attacker point win |\n|---|---:|---:|---:|---:|---:|---:|---:|\n| Legacy V1 | ${result.modes.legacy.matches} | ${result.modes.legacy.winsTotal} | ${(result.modes.legacy.points / Math.max(1, result.modes.legacy.matches)).toFixed(3)} | ${(result.modes.legacy.rallyRounds / Math.max(1, result.modes.legacy.matches)).toFixed(3)} | ${ratio(result.modes.legacy.rallyTieBreaks, rallyStarts(result.modes.legacy))}% | ${ratio(result.modes.legacy.draws, result.modes.legacy.matches)}% | ${ratio(result.modes.legacy.firstRallyAttackerPointWins, result.modes.legacy.firstRallyAttackerEntries)}% |\n| Candidate V3 | ${result.modes.candidateV3.matches} | ${result.modes.candidateV3.winsTotal} | ${(result.modes.candidateV3.points / Math.max(1, result.modes.candidateV3.matches)).toFixed(3)} | ${(result.modes.candidateV3.rallyRounds / Math.max(1, result.modes.candidateV3.matches)).toFixed(3)} | ${ratio(result.modes.candidateV3.rallyTieBreaks, rallyStarts(result.modes.candidateV3))}% | ${ratio(result.modes.candidateV3.draws, result.modes.candidateV3.matches)}% | ${ratio(result.modes.candidateV3.firstRallyAttackerPointWins, result.modes.candidateV3.firstRallyAttackerEntries)}% |\n| Candidate V4 | ${m.matches} | ${m.winsTotal} | ${(m.points / Math.max(1, m.matches)).toFixed(3)} | ${(m.rallyRounds / Math.max(1, m.matches)).toFixed(3)} | ${ratio(m.rallyTieBreaks, rallyStarts(m))}% | ${ratio(m.draws, m.matches)}% | ${ratio(m.firstRallyAttackerPointWins, m.firstRallyAttackerEntries)}% (Wilson 95% ${(wilsonInterval(m.firstRallyAttackerPointWins, m.firstRallyAttackerEntries)[0] * 100).toFixed(2)}–${(wilsonInterval(m.firstRallyAttackerPointWins, m.firstRallyAttackerEntries)[1] * 100).toFixed(2)}%) |\n\n## Resource economy\n\n- Mean attack spend: Serve ${attackMean("service").toFixed(2)}; Counter ${attackMean("receive").toFixed(2)} (spend range 0–4). The per-value distribution is in resource-economy.csv.\n- Mean defense spend: Serve ${(r.defenseSpend.service.points / Math.max(1, r.defenseSpend.service.decisions)).toFixed(2)}; Counter ${(r.defenseSpend.receive.points / Math.max(1, r.defenseSpend.receive.decisions)).toFixed(2)}. Average unused points: Serve ${(r.defenseSpend.service.unspent / Math.max(1, r.defenseSpend.service.decisions)).toFixed(2)}; Counter ${(r.defenseSpend.receive.unspent / Math.max(1, r.defenseSpend.receive.decisions)).toFixed(2)}.\n- Mean reserve: Counter ${counterReserveMean.toFixed(2)}; Rally entry ${rallyReserveMean.toFixed(2)}.\n- Mean reserve: Counter ${counterReserveMean.toFixed(2)}; Rally entry ${rallyReserveMean.toFixed(2)}.\n- Rally-entry reserve median/P75/P90/P95/max: ${histogramPercentile(budgetHist, 0.5) - 20} / ${histogramPercentile(budgetHist, 0.75) - 20} / ${histogramPercentile(budgetHist, 0.9) - 20} / ${histogramPercentile(budgetHist, 0.95) - 20} / ${Math.max(0, ...Object.keys(budgetHist).map(Number)) - 20}. Corresponding Rally budget percentiles: ${histogramPercentile(budgetHist, 0.5)} / ${histogramPercentile(budgetHist, 0.75)} / ${histogramPercentile(budgetHist, 0.9)} / ${histogramPercentile(budgetHist, 0.95)} / ${Math.max(0, ...Object.keys(budgetHist).map(Number))}.\n- Rally budget groups 20 / 21–24 / 25–29 / 30+: ${ratio(
    budgetHist["20"] ?? 0,
    Object.values(budgetHist).reduce((s, n) => s + n, 0),
  )}% / ${ratio(
    Object.entries(budgetHist)
      .filter(([k]) => +k >= 21 && +k <= 24)
      .reduce((s, [, n]) => s + n, 0),
    Object.values(budgetHist).reduce((s, n) => s + n, 0),
  )}% / ${ratio(
    Object.entries(budgetHist)
      .filter(([k]) => +k >= 25 && +k <= 29)
      .reduce((s, [, n]) => s + n, 0),
    Object.values(budgetHist).reduce((s, n) => s + n, 0),
  )}% / ${ratio(
    Object.entries(budgetHist)
      .filter(([k]) => +k >= 30)
      .reduce((s, [, n]) => s + n, 0),
    Object.values(budgetHist).reduce((s, n) => s + n, 0),
  )}%.\n- Carry margin: among Rally entries, first attacker wins ${ratio(m.firstRallyAttackerPointWins, m.firstRallyAttackerEntries)}%; V4's even 4-comparison sequence gives each player two attack opportunities on points that reach all comparisons.\n- Rally tie-break starter win rate: ${ratio(m.tieBreakStarterWins, m.tieBreakStarterEntries)}% (Wilson 95% ${(tieStarterLow * 100).toFixed(2)}–${(tieStarterHigh * 100).toFixed(2)}%).\n- Defense concentration Herfindahl: mean ${(r.defenseHhi.sum / Math.max(1, r.defenseHhi.count)).toFixed(3)}, maximum ${r.defenseHhi.max.toFixed(3)}. Rally attack project allocation totals are in resource-economy.csv; inspect usage rates alongside the 4-comparison cap.\n- Policies: see strategies.csv and policy head-to-head rows in resource-economy.csv. Pair samples below 1,000 are descriptive and should not be called dominant.\n\n- Carry-value association: observed Rally-entry reserve buckets imply an endpoint slope of ${carrySlope} percentage points per reserve point across the observed range; this is descriptive, non-causal.\n\n## Resource-policy head-to-head\n\n| Policy | Opponent | Matches | Win rate | Wilson 95% CI | Censored |\n|---|---|---:|---:|---:|---:|\n${policyRows}\n\n## Parameter experiments\n\nOne-variable screen (seeded):\n\n| Parameters | Matches | Seat A win rate | Wilson 95% CI | Censored |\n|---|---:|---:|---:|---:|\n${experimentRows}\n\nFocused validation:\n\n| Parameters | Matches | Seat A win rate | Wilson 95% CI | Censored |\n|---|---:|---:|---:|---:|\n${validationRows}\n\n## Interpretation checklist\n\n- Rally first-attacker parity vs V3: ${ratio(m.firstRallyAttackerPointWins, m.firstRallyAttackerEntries)}% V4 vs ${ratio(result.modes.candidateV3.firstRallyAttackerPointWins, result.modes.candidateV3.firstRallyAttackerEntries)}% V3.\n- Rally comparison count is capped at 4; exact tie-break uses symmetric cumulative signed attack margin, positive-margin count, largest margin, then a point-number alternating fallback.\n- Carry strategy dominance is not inferred from overall policy frequency alone; use paired head-to-head outcomes, policy samples, carry distribution, and censor rate together.\n- Serve / Counter continued to Rally: ${ratio(m.points - m.stageEnds.service, m.points)}% / ${ratio(m.points - m.stageEnds.receive, m.points)}% (stage ends count direct finishes).\n- Player, blade, rubber, loadout and ability observations remain descriptive and player-unadjusted where noted; official data was not modified.\n- 100% carry, 20 Rally points, attack cap 4 and unlimited defense remain experimental parameters pending human review.\n`;
  const recommendations = `# Candidate V4 Recommendations\n\n- ${decision}\n- Baseline: 4/10 service, 4/10 counter, Rally 20, attack cap 4, no defense cap, 100% carry, Top 3, four Rally comparisons.\n- Compare the carry 50%/75% and Rally 16/18/22 one-variable rows, then use focused validation intervals rather than selecting by seat win rate alone.\n- Review SaveForRally, AllInEarly, MinimumNeeded, BalancedReserve, SpendAll and Fortress allocations in strategies.csv and resource-economy.csv.\n- No player, blade, rubber, skill value, or formal rules configuration was changed.\n`;
  return { csv: csv(rows), report, recommendations };
}

export function wilsonInterval(
  wins: number,
  matches: number,
  z = 1.959963984540054,
): [number, number] {
  if (!matches) return [0, 1];
  const p = wins / matches;
  const d = 1 + (z * z) / matches;
  const center = (p + (z * z) / (2 * matches)) / d;
  const radius =
    (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * matches)) / matches)) / d;
  return [Math.max(0, center - radius), Math.min(1, center + radius)];
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: Array<Array<string | number>>): string {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function stageRows(
  summary: ModeSummary,
  mode: string,
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ["mode", "stage", "comparisons", "stage_ends", "end_rate", "sample_size"],
  ];
  for (const stage of ["service", "receive", "rally"] as const) {
    rows.push([
      mode,
      stage,
      summary.stageComparisons[stage],
      summary.stageEnds[stage],
      pct(summary.stageEnds[stage], summary.stageComparisons[stage]).toFixed(4),
      summary.stageComparisons[stage],
    ]);
  }
  return rows;
}

function playerRows(
  summary: ModeSummary,
  catalog: GameRulesCatalog,
  mode: string,
): Array<Array<string | number>> {
  const data = new Map<
    string,
    { matches: number; wins: number; draws: number }
  >();
  for (const item of Object.values(summary.observedLoadouts)) {
    const row = data.get(item.playerId) ?? { matches: 0, wins: 0, draws: 0 };
    row.matches += item.matches;
    row.wins += item.wins;
    row.draws += item.draws;
    data.set(item.playerId, row);
  }
  const rows: Array<Array<string | number>> = [
    [
      "mode",
      "player_id",
      "player",
      "tier",
      "matches",
      "wins",
      "censored_draws",
      "completed_matches",
      "win_rate",
      "ci95_low",
      "ci95_high",
      "sample_status",
    ],
  ];
  for (const player of catalog.players) {
    const item = data.get(player.id) ?? { matches: 0, wins: 0, draws: 0 };
    const completed = item.matches - item.draws;
    const [low, high] = wilsonInterval(item.wins, completed);
    const tier =
      Object.entries(catalog.balance.playerTiers).find(([, ids]) =>
        ids.includes(player.id),
      )?.[0] ?? "unknown";
    rows.push([
      mode,
      player.id,
      player.name,
      tier,
      item.matches,
      item.wins,
      item.draws,
      completed,
      pct(item.wins, completed).toFixed(4),
      low.toFixed(4),
      high.toFixed(4),
      item.matches < 100 ? "INSUFFICIENT_SAMPLE" : "ok",
    ]);
  }
  return rows;
}

function gearRows(
  summary: ModeSummary,
  catalog: GameRulesCatalog,
  mode: string,
  kind: "blade" | "fh" | "bh",
): Array<Array<string | number>> {
  const field =
    kind === "blade"
      ? "bladeId"
      : kind === "fh"
        ? "forehandRubberId"
        : "backhandRubberId";
  const list = kind === "blade" ? catalog.blades : catalog.rubbers;
  const totals = new Map<
    string,
    {
      matches: number;
      wins: number;
      draws: number;
      byPlayer: Map<string, { matches: number; wins: number; draws: number }>;
    }
  >();
  for (const item of Object.values(summary.observedLoadouts)) {
    const id = item[field];
    const row = totals.get(id) ?? {
      matches: 0,
      wins: 0,
      draws: 0,
      byPlayer: new Map<
        string,
        { matches: number; wins: number; draws: number }
      >(),
    };
    row.matches += item.matches;
    row.wins += item.wins;
    row.draws += item.draws;
    const player = row.byPlayer.get(item.playerId) ?? {
      matches: 0,
      wins: 0,
      draws: 0,
    };
    player.matches += item.matches;
    player.wins += item.wins;
    player.draws += item.draws;
    row.byPlayer.set(item.playerId, player);
    totals.set(id, row);
  }
  const rows: Array<Array<string | number>> = [
    [
      "mode",
      "side",
      "item_id",
      "name",
      "style",
      "usage",
      "usage_share",
      "matches",
      "wins",
      "censored_draws",
      "completed_matches",
      "raw_win_rate",
      "ci95_low",
      "ci95_high",
      "player_standardized_win_rate",
      "adjusted_player_count",
      "sample_status",
    ],
  ];
  for (const item of list) {
    const result = totals.get(item.id) ?? {
      matches: 0,
      wins: 0,
      draws: 0,
      byPlayer: new Map<
        string,
        { matches: number; wins: number; draws: number }
      >(),
    };
    const completed = result.matches - result.draws;
    const [low, high] = wilsonInterval(result.wins, completed);
    const playerRates = [...result.byPlayer.values()]
      .filter((player) => player.matches > player.draws)
      .map((player) => pct(player.wins, player.matches - player.draws));
    const adjusted = playerRates.length
      ? playerRates.reduce((sum, value) => sum + value, 0) / playerRates.length
      : 0;
    const attack = item.modifiers
      .filter((modifier) => modifier.role === "attack")
      .reduce((sum, modifier) => sum + modifier.value, 0);
    const defense = item.modifiers
      .filter((modifier) => modifier.role === "defense")
      .reduce((sum, modifier) => sum + modifier.value, 0);
    rows.push([
      mode,
      kind === "blade" ? "both" : kind === "fh" ? "forehand" : "backhand",
      item.id,
      item.name,
      `${item.style}; attack_mod=${attack}; defense_mod=${defense}`,
      result.matches,
      pct(result.matches, summary.matches * 2).toFixed(4),
      result.matches,
      result.wins,
      result.draws,
      completed,
      pct(result.wins, completed).toFixed(4),
      low.toFixed(4),
      high.toFixed(4),
      adjusted.toFixed(4),
      playerRates.length,
      result.matches < 100 ? "INSUFFICIENT_SAMPLE" : "raw_only",
    ]);
  }
  return rows;
}

function loadoutRows(
  summary: ModeSummary,
  catalog: GameRulesCatalog,
  mode: string,
): Array<Array<string | number>> {
  const sorted = Object.values(summary.observedLoadouts).sort(
    (a, b) =>
      pct(b.wins, b.matches - b.draws) - pct(a.wins, a.matches - a.draws),
  );
  const rows: Array<Array<string | number>> = [
    [
      "mode",
      "player",
      "blade",
      "fh_rubber",
      "bh_rubber",
      "win_rate",
      "matches",
      "censored_draws",
      "completed_matches",
      "style",
      "ci95_low",
      "ci95_high",
      "rank",
    ],
  ];
  const perPlayer = new Map<string, number>();
  for (const item of sorted) {
    const rank = (perPlayer.get(item.playerId) ?? 0) + 1;
    perPlayer.set(item.playerId, rank);
    if (rank > 10) continue;
    const completed = item.matches - item.draws;
    const [low, high] = wilsonInterval(item.wins, completed);
    const name =
      catalog.players.find((player) => player.id === item.playerId)?.name ??
      item.playerId;
    rows.push([
      mode,
      name,
      item.bladeId,
      item.forehandRubberId,
      item.backhandRubberId,
      pct(item.wins, completed).toFixed(4),
      item.matches,
      item.draws,
      completed,
      item.style,
      low.toFixed(4),
      high.toFixed(4),
      rank,
    ]);
  }
  return rows;
}

function abilityRows(
  summary: ModeSummary,
  mode: string,
): Array<Array<string | number>> {
  const keys = new Set([
    ...Object.keys(summary.attackChoices),
    ...Object.keys(summary.defenseAllocations),
  ]);
  const rows: Array<Array<string | number>> = [
    [
      "mode",
      "stage_pair",
      "selection_count",
      "allocation_points",
      "comparisons",
      "selection_rate",
      "allocation_rate",
      "attack_conversions",
      "defense_holds",
      "attack_conversion_rate",
      "defense_hold_rate",
      "avg_margin",
      "avg_defense_allocation",
      "marginal_defense_holds",
      "attack_bonus_assisted_conversions",
      "sample_status",
    ],
  ];
  for (const key of [...keys].sort()) {
    const stage = key.slice(
      0,
      key.indexOf(":"),
    ) as keyof ModeSummary["stageComparisons"];
    const selected = summary.attackChoices[key] ?? 0;
    const allocated = summary.defenseAllocations[key] ?? 0;
    const comparisons = summary.stageComparisons[stage] ?? 0;
    const metric = summary.pairMetrics[key];
    rows.push([
      mode,
      key,
      selected,
      allocated,
      comparisons,
      pct(selected, comparisons).toFixed(4),
      pct(allocated, comparisons).toFixed(4),
      metric?.attackerConversions ?? 0,
      metric?.defenseHolds ?? 0,
      pct(metric?.attackerConversions ?? 0, metric?.comparisons ?? 0).toFixed(
        4,
      ),
      pct(metric?.defenseHolds ?? 0, metric?.comparisons ?? 0).toFixed(4),
      (
        (metric?.marginTotal ?? 0) / Math.max(1, metric?.comparisons ?? 0)
      ).toFixed(3),
      (
        (metric?.defenseAllocationTotal ?? 0) /
        Math.max(1, metric?.comparisons ?? 0)
      ).toFixed(3),
      metric?.marginalDefenseHolds ?? 0,
      metric?.bonusAssistedConversions ?? 0,
      comparisons < 100 ? "INSUFFICIENT_SAMPLE" : "directional_only",
    ]);
  }
  return rows;
}

function summaryMarkdown(result: SimulationResult): string {
  const l = result.modes.legacy;
  const c = result.modes.candidate;
  const rate = (value: number, total: number) =>
    `${(pct(value, total) * 100).toFixed(2)}%`;
  const stageTable = (["service", "receive", "rally"] as const)
    .map(
      (stage) =>
        `| ${stage} | ${l.stageComparisons[stage]} | ${rate(l.stageEnds[stage], l.stageComparisons[stage])} | ${c.stageComparisons[stage]} | ${rate(c.stageEnds[stage], c.stageComparisons[stage])} |`,
    )
    .join("\n");
  const initiativeTable = (["service", "receive", "rally"] as const)
    .map((stage) => {
      const legacyData = l.initiative[stage];
      const candidateData = c.initiative[stage];
      const [legacyLow, legacyHigh] = wilsonInterval(
        legacyData.attackerWins,
        legacyData.eligible,
      );
      const [candidateLow, candidateHigh] = wilsonInterval(
        candidateData.attackerWins,
        candidateData.eligible,
      );
      return `| ${stage} | ${legacyData.eligible} | ${rate(legacyData.attackerWins, legacyData.eligible)} (${(legacyLow * 100).toFixed(1)}–${(legacyHigh * 100).toFixed(1)}%) | ${candidateData.eligible} | ${rate(candidateData.attackerWins, candidateData.eligible)} (${(candidateLow * 100).toFixed(1)}–${(candidateHigh * 100).toFixed(1)}%) |`;
    })
    .join("\n");
  const experimentTable = result.experiments
    .map(
      (item) =>
        `| ${item.parameter} | ${item.value} | ${item.matches} | ${item.completedMatches ?? item.matches - item.candidateDraws} | ${rate(item.candidateWins, item.matches)} (${(item.ci95Low * 100).toFixed(1)}–${(item.ci95High * 100).toFixed(1)}%) | ${item.candidateDraws} |`,
    )
    .join("\n");
  return `# Balance Report

Generated ${result.startedAt}. This report compares the production legacy 10/10/15 allocation rules with the Balance Lab candidate fixed-attack-bonus / secret-defense-allocation model. Candidate parameters are simulation-only overrides; production data and rules were not edited.

## Run

- Preset: ${result.preset}
- Seed: ${result.seed}
- Baseline matches per mode: ${result.requestedMatchesPerMode.toLocaleString()}
- Candidate one-variable experiment matches: ${result.experiments.reduce((sum, item) => sum + item.matches, 0).toLocaleString()}
- Runtime: ${(result.elapsedMs / 1000).toFixed(2)} seconds
- Loadout space: ${result.catalogDimensions.players} × ${result.catalogDimensions.blades} × ${result.catalogDimensions.rubbers} × ${result.catalogDimensions.rubbers} = ${result.catalogDimensions.theoreticalLoadouts}
- Bots: ${result.policies.join(", ")}
- Confidence intervals: Wilson 95%; gear rows are raw, unadjusted results and must not be treated as causal equipment values.

## Mechanism comparison

| Metric | Legacy | Candidate |
|---|---:|---:|
| Baseline matches | ${l.matches} | ${c.configs["Candidate baseline"]?.matches ?? 0} |
| Completed wins | ${l.winsTotal} | ${c.winsTotal} |
| Deuce-censored draws | ${l.draws} | ${c.draws} |
| Deuce reached at least once | ${pct(l.deuceMatches, l.matches).toFixed(3)} | ${pct(c.deuceMatches, c.matches).toFixed(3)} |
| Stable deuce cycle censored | ${l.deuceCycleMatches} | ${c.deuceCycleMatches} |
| Average points per match | ${(l.points / Math.max(1, l.matches)).toFixed(2)} | ${((c.configs["Candidate baseline"]?.points ?? 0) / Math.max(1, c.configs["Candidate baseline"]?.matches ?? 1)).toFixed(2)} |
| Rally rounds per match | ${(l.rallyRounds / Math.max(1, l.matches)).toFixed(2)} | ${((c.configs["Candidate baseline"]?.rallyRounds ?? 0) / Math.max(1, c.configs["Candidate baseline"]?.matches ?? 1)).toFixed(2)} |
| Fifth rally round rate per rally | ${rate(l.rallyFifthRound, rallyStarts(l))} | ${rate(c.rallyFifthRound, rallyStarts(c))} |
| Rally tie-break rate per rally | ${rate(l.rallyTieBreaks, rallyStarts(l))} | ${rate(c.rallyTieBreaks, rallyStarts(c))} |

| Stage | Legacy comparisons | Legacy direct-end rate | Candidate comparisons | Candidate direct-end rate |
|---|---:|---:|---:|---:|
${stageTable}

The sample uses seeded randomized policies and stratified player/equipment selection. “Direct-end rate” divides decisive comparisons by comparisons within that stage; it is not a player-adjusted strength estimate. No mechanism is declared superior solely from this mixed-policy sample.

## ATTACK_INITIATIVE_ADVANTAGE

This is attacker win share among decisive comparisons where public base values differ by at most 1. It estimates active initiative in near-equal base matchups; sample size and Wilson 95% intervals are included.

| Stage | Legacy sample | Legacy attacker win share | Candidate sample | Candidate attacker win share |
|---|---:|---:|---:|---:|
${initiativeTable}

## Candidate parameter experiments

| Parameter | Value | Matches | Completed | A-seat win rate (Wilson 95%, draws are no-wins) | Censored draws |
|---|---:|---:|---:|---:|---:|
${experimentTable}

These are one-variable-at-a-time A-seat win-rate observations against randomized matchups, not parameter recommendations. Censored draws are not credited as wins. The same fixed seed and data reproduce the same result.

## Player and equipment results

See \`players.csv\`, \`blades.csv\`, \`rubbers.csv\`, and \`loadouts.csv\`. Player tiers remain the configured 480 / 460 / 440 tiers. Gear win rates are unadjusted raw rates; low sample sizes carry \`INSUFFICIENT_SAMPLE\`. This run does not support automatically changing data files.

## Ability and strategy diagnostics

See \`abilities.csv\`, \`phases.csv\`, \`mechanics.csv\`, and \`strategies.csv\`. Attack selection and defense allocation rates are descriptive and do not prove marginal value. \`dominant strategy\` and \`dominant loadout\` alerts are emitted only where adequate repeat samples exist; low support is marked insufficient.
`;
}

function recommendations(result: SimulationResult): {
  markdown: string;
  json: object;
} {
  const insufficient = result.requestedMatchesPerMode < 10000;
  const fullScale = result.requestedMatchesPerMode >= 100000;
  const items = result.experiments.map((row) => ({
    parameter: row.parameter,
    candidateValue: row.value,
    sampleSize: row.matches,
    candidateASeatWinRate: row.candidateWinRate,
    confidenceInterval95: [row.ci95Low, row.ci95High],
    status: row.matches < 1000 ? "INSUFFICIENT_SAMPLE" : "REVIEW_REQUIRED",
    note: "One-variable simulation observation only; not an applied change.",
  }));
  const json = {
    generatedAt: result.startedAt,
    seed: result.seed,
    sourceBalanceVersion: "balance_v1.1",
    recommendationsAreApplied: false,
    insufficientBaselineSample: insufficient,
    items,
  };
  const markdown = `# Balance Recommendations

No production values were changed. These are review candidates from the recorded run.

- Baseline: ${result.preset}, seed ${result.seed}, ${result.requestedMatchesPerMode.toLocaleString()} matches per mechanic; censored draws are reported separately.
- ${insufficient ? "The baseline run is below the 10,000 match Standard target; do not infer best-in-slot equipment or final rule settings." : fullScale ? "A Full-scale baseline is available; review uncertainty, censored draws, matchup structure and style diversity before making any balance decision." : "The baseline has Standard-level support; Full-scale confirmation is still recommended before balance decisions."}
- Parameter sweeps are one variable at a time and are flagged for human review; no automatic recommendation is applied.
- All equipment results remain unadjusted observations. Validate player synergy, mirror matches, confidence intervals and style diversity before considering a ±1 data revision.
- Source data files remain unchanged.
`;
  return { markdown, json };
}

function candidateV3Markdown(result: SimulationResult): {
  report: string;
  recommendations: string;
} {
  const m = result.modes.candidateV3;
  const ratio = (a: number, b: number) =>
    b ? ((100 * a) / b).toFixed(2) : "n/a";
  const phase = (["service", "receive", "rally"] as const)
    .map((stage) => {
      const comparisons = m.stageComparisons[stage];
      const attacks = m.stageEnds[stage];
      return `| ${stage} | ${comparisons} | ${attacks} (${ratio(attacks, comparisons)}%) | ${comparisons - attacks} (${ratio(comparisons - attacks, comparisons)}%) |`;
    })
    .join("\n");
  const experiments = result.v3Experiments
    .map(
      (item) =>
        `| ${item.parameter} | ${item.value} | ${item.matches} | ${ratio(item.wins, item.matches)}% | ${(item.ci95Low * 100).toFixed(1)}–${(item.ci95High * 100).toFixed(1)}% | ${item.censoredDraws} |`,
    )
    .join("\n");
  const validation = result.v3Validation
    .map(
      (item, index) =>
        `| V3 focused candidate ${index + 1} | ${JSON.stringify(item.parameters)} | ${item.matches} | ${ratio(item.aSeatWins, item.matches)}% | ${(item.ci95Low * 100).toFixed(1)}–${(item.ci95High * 100).toFixed(1)}% | ${item.censoredDraws} |`,
    )
    .join("\n");
  const firstRally = wilsonInterval(
    m.firstRallyAttackerPointWins,
    m.firstRallyAttackerEntries,
  );
  const tieStarter = wilsonInterval(
    m.tieBreakStarterWins,
    m.tieBreakStarterEntries,
  );
  const rankDiagnostics = ["top1", "top2", "top3", "offTopK"]
    .map((rank) => {
      const selected = m.topAttackChoices[rank] ?? 0;
      const converted = m.topAttackConversions[rank] ?? 0;
      return `| ${rank} | ${selected} | ${converted} | ${ratio(converted, selected)}% | ${ratio(selected - converted, selected)}% |`;
    })
    .join("\n");
  const defensePatterns = Object.entries(m.defensePatterns).sort(
    (a, b) => b[1] - a[1],
  );
  const patternGroupTotals = new Map<string, number>();
  for (const [key, count] of defensePatterns) {
    const group = key.split(":").slice(0, 2).join(":");
    patternGroupTotals.set(group, (patternGroupTotals.get(group) ?? 0) + count);
  }
  const patternRows = defensePatterns
    .map(([pattern, count]) => {
      const group = pattern.split(":").slice(0, 2).join(":");
      return `| ${pattern} | ${count} | ${ratio(count, patternGroupTotals.get(group) ?? 0)}% |`;
    })
    .join("\n");
  const dominantAttackRows = Object.entries(m.attackChoices)
    .map(([key, count]) => {
      const stage = key.slice(0, key.indexOf(":")) as Stage;
      const total = m.stageComparisons[stage] ?? 0;
      return { key, count, share: total ? count / total : 0 };
    })
    .filter((row) => row.share >= 0.5)
    .map(
      (row) =>
        `| ${row.key} | ${row.count} | ${(row.share * 100).toFixed(2)}% | DOMINANT_ATTACK_OPTION_WARNING |`,
    )
    .join("\n");
  const stagePer100 = (["service", "receive", "rally"] as const)
    .map(
      (stage) =>
        `| ${stage} | ${((m.stageEnds[stage] * 100) / Math.max(1, m.points)).toFixed(2)} |`,
    )
    .join("\n");
  const baselineSettings: Array<[keyof CandidateV3Settings, number, string]> = [
    [
      "attackBonus",
      4,
      "Retain +4 as the reference; do not infer a change from A-seat parity alone.",
    ],
    [
      "defensePool",
      8,
      "Retain 8 provisionally; review Fortress allocation concentration before removing the cap formally.",
    ],
    [
      "defenderVisibleTopK",
      3,
      "Retain Top 3 provisionally; compare Top 2 and Top 4 with attack-rank and defense-hold metrics.",
    ],
    [
      "serviceThreshold",
      5,
      "Retain 5 provisionally; evaluate Serve conversion and deuce censoring together.",
    ],
    [
      "counterThreshold",
      5,
      "Retain 5 provisionally; Counter currently feeds Rally often, so check rally length and point duration.",
    ],
    [
      "rallyThreshold",
      4,
      "Retain 4 provisionally; inspect direct conversion and initiative together.",
    ],
    [
      "rallyMaxComparisons",
      5,
      "Do not retain odd 5 as a final choice until the 75% first-Rally-attacker bias is resolved; test even 4/6 and attacker-sequence alternatives.",
    ],
  ];
  const recommendationRows = baselineSettings
    .map(
      ([parameter, value, recommendation]) =>
        `| ${parameter} | ${value} | ${
          result.v3Experiments
            .filter((item) => item.parameter === parameter)
            .map((item) => item.value)
            .join(", ") || "baseline only"
        } | ${recommendation} |`,
    )
    .join("\n");
  const legacy = result.modes.legacy;
  const candidateV1 = result.modes.candidate;
  const comparisonRows = [
    [
      "Legacy V1",
      legacy.matches,
      ratio(legacy.draws, legacy.matches),
      (legacy.points / Math.max(1, legacy.matches)).toFixed(2),
      (legacy.rallyRounds / Math.max(1, legacy.matches)).toFixed(2),
    ],
    [
      "Candidate V1",
      candidateV1.matches,
      ratio(candidateV1.draws, candidateV1.matches),
      (candidateV1.points / Math.max(1, candidateV1.matches)).toFixed(2),
      (candidateV1.rallyRounds / Math.max(1, candidateV1.matches)).toFixed(2),
    ],
    [
      "Candidate V3",
      m.matches,
      ratio(m.draws, m.matches),
      (m.points / Math.max(1, m.matches)).toFixed(2),
      (m.rallyRounds / Math.max(1, m.matches)).toFixed(2),
    ],
  ]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
  const report = `# Candidate V3 Balance Report\n\nGenerated ${result.startedAt}. This is a separate experimental ruleset executed through the authoritative game-core reducer. Legacy V1 and the historical Candidate V1 simulator remain unchanged as comparison series. No official data or balance config was changed.\n\n## Run and status\n\n- Preset: ${result.preset}; seed: ${result.seed}; V3 baseline matches: ${m.matches.toLocaleString()}; runtime: ${(result.elapsedMs / 1000).toFixed(2)}s.\n- Data: balance_v1.1 source catalog, unchanged. V3 settings: attack bonus +4, defender pool 8 with no per-item cap, defender Top-3 visibility, thresholds 5/5/4, up to 5 Rally comparisons, epsilon 0.05.\n- Completed matches: ${m.winsTotal.toLocaleString()}; censored deuce matches: ${m.draws.toLocaleString()} (${ratio(m.draws, m.matches)}%). Censored matches are excluded from completed-match win rates.\n\n## Attack conversion and defense hold\n\nOnly attack can score on a V3 comparison. Any non-conversion—including a large defensive margin—is a hold and proceeds to the next stage or swaps Rally attacker.\n\n| Stage | Comparisons | Attack conversion | Defense hold |\n|---|---:|---:|---:|\n${phase}\n\n## Rally and initiative diagnostics\n\n- Average Rally comparisons per match: ${(m.rallyRounds / Math.max(1, m.matches)).toFixed(3)}; per Rally entry: ${(m.rallyRounds / Math.max(1, m.firstRallyAttackerEntries)).toFixed(3)}.\n- Rally fifth-comparison share: ${ratio(m.rallyFifthRound, m.firstRallyAttackerEntries)}%; tie-break share: ${ratio(m.rallyTieBreaks, m.firstRallyAttackerEntries)}%.\n- FIRST_RALLY_ATTACKER_ADVANTAGE: ${m.firstRallyAttackerPointWins}/${m.firstRallyAttackerEntries} points (${ratio(m.firstRallyAttackerPointWins, m.firstRallyAttackerEntries)}%; Wilson 95% ${(firstRally[0] * 100).toFixed(1)}–${(firstRally[1] * 100).toFixed(1)}%). The denominator is points reaching Rally.\n- First-server match wins: ${m.firstServerWins}/${m.firstServerCompleted} completed matches (${ratio(m.firstServerWins, m.firstServerCompleted)}%).\n- Rally tie-break starter wins: ${m.tieBreakStarterWins}/${m.tieBreakStarterEntries} (${ratio(m.tieBreakStarterWins, m.tieBreakStarterEntries)}%; Wilson 95% ${(tieStarter[0] * 100).toFixed(1)}–${(tieStarter[1] * 100).toFixed(1)}%).\n- Top option/off-top-K attack picks: top1 ${m.attackTop1Choices}, rank2–K ${m.attackTop3Choices}, off Top-K ${m.attackOffTop3Choices}. Defender allocations put ${m.defenseTop3Points} points on publicly visible Top-K options and ${m.defenseOffTop3Points} elsewhere.\n\n## One-factor parameter experiments\n\n| Parameter | Value | Matches | A-seat win rate | Wilson 95% CI | Censored |\n|---|---:|---:|---:|---:|---:|\n${experiments}\n\nSecond-stage focused validation (10,000+ matches each):\n\n| Candidate | Parameters | Matches | A-seat win rate | Wilson 95% CI | Censored |\n|---|---|---:|---:|---:|---:|\n${validation}\n\nThe focused candidates are selected from the attack bonus, defense pool, and Top-K sweeps by closest A-seat parity. This is a screening rule, not an endorsement. Full-scale baseline and focused validation should be reviewed alongside conversion, hold, Rally length, and censored-match rates.\n\n## Player, gear, loadout, abilities, and strategies\n\nSee players.csv, blades.csv, rubbers.csv, loadouts.csv, abilities.csv, phases.csv, mechanics.csv, and strategies.csv; each contains Legacy, Candidate V1, and Candidate V3 rows. Confidence intervals exclude censored games; low-support rows are marked. Gear results are descriptive mixed-matchup results and do not justify changing official data. Ability selection and allocation counts are descriptive.\n\n## Decision\n\nDo not promote Candidate V3 to the formal ruleset from this report alone. Preserve it as a reducer-backed candidate until the Full run, concentrated strategy checks, player-standardized gear analysis, and independent review establish acceptable conversion, Rally duration, first-attacker advantage, and censoring. No formal rules or data were changed.\n`;
  const rec = `# Candidate V3 Recommendations\n\n- Candidate V3 remains experimental and is not promoted to the formal balance configuration.\n- Use the one-factor sweep and its 10,000+ focused follow-up rows to shortlist settings; avoid combining changes without a separate interaction study.\n- Treat attack conversion, defensive holds, Top-K focus, first Rally attacker advantage, Rally tie-break rate, first-server win share, and censored deuce rate as joint review criteria.\n- Review the V3 player, gear, loadout, ability, phase, and strategy CSVs before any formal proposal. Raw gear performance is not causal and official data remains unchanged.\n- Source version: balance_v1.1.\n`;
  const analysis = `## V1 comparison and explicit mechanic recommendation\n\n| Ruleset | Matches | Censored deuce rate | Points per match | Rally comparisons per match |\n|---|---:|---:|---:|---:|\n${comparisonRows}\n\n## Visible Top-K attack and defense outcomes\n\n| Attacker base rank | Choices | Conversions | Conversion rate | Hold rate |\n|---|---:|---:|---:|---:|\n${rankDiagnostics}\n\n## FortressBot defense allocation patterns\n\n| Allocation shape | Count | Share |\n|---|---:|---:|\n${patternRows || "| no V3 FortressBot allocations | 0 | n/a |"}\n\nA single pattern above 50% is treated as a dominance warning; the strategy CSV marks it. FortressBot outcome rate is listed separately and should be reviewed with allocation shape frequency.\n\n## Mechanic recommendation\n\n| Mechanic | Baseline | Tested alternatives | Recommendation |\n|---|---:|---|---|\n${recommendationRows}\n\nTie Break: keep the cumulative-advantage rule only as the comparison baseline while investigating the measured first-attacker and tie-break-starter win shares. Do not select a tie-break rule from aggregate win rate alone; compare tied margin patterns, first/last attacker, and even/odd maximum comparisons.\n\nCandidate V3 is not ready to become the next formal ruleset. Its first Rally attacker has a ${ratio(m.firstRallyAttackerPointWins, m.firstRallyAttackerEntries)}% point-win share (95% CI ${(firstRally[0] * 100).toFixed(1)}–${(firstRally[1] * 100).toFixed(1)}%), while the first server wins ${ratio(m.firstServerWins, m.firstServerCompleted)}% of completed matches. This localizes the concern to Rally initiative rather than the overall first-server seat. Keep V3 experimental; investigate alternating initiative and even comparison counts, then rerun focused and Full simulations.\n\nAbility marginal-value columns are descriptive counterfactual counts: defense points whose removal would cross the direct-win threshold, and attack conversions that would fail without the +4 bonus. They are not causal estimates across matchups. Gear player-standardized rates average within-player performance for each item and are supplied beside raw rates; confidence intervals on raw rates are not transferred to the standardized statistic.`;
  const extraDiagnostics = `## Resolution frequency and concentration alerts\n\n| Stage | Attack-ending points per 100 played points |\n|---|---:|\n${stagePer100}\n\nThe attack-rank table above supplies hold rate for Top 1/2/3 and off Top-K choices. The parameter sweep compares Top 2/3/4 directly.\n\nDominant attack options (50% or more of a stage’s choices):\n\n| Stage and ability | Choices | Share | Alert |\n|---|---:|---:|---|\n${dominantAttackRows || "| None | 0 | 0% | none |"}\n\nDominant FortressBot allocation shapes are compared within each stage: ${defensePatterns.some(([key, count]) => count / Math.max(1, patternGroupTotals.get(key.split(":").slice(0, 2).join(":")) ?? 0) > 0.5) ? "see DOMINANT_DEFENSE_ALLOCATION_WARNING in strategies.csv" : "none exceeded 50% in this sample"}. Deuce-censored matches remain separate from wins and ordinary completed-match rates. `;
  const fullFinding =
    result.preset === "full"
      ? `\n\n## Full-run decision\n\nDo not promote V3. Its first-Rally-attacker point-win rate is ${ratio(m.firstRallyAttackerPointWins, m.firstRallyAttackerEntries)}%, tie-break starter win rate is ${ratio(m.tieBreakStarterWins, m.tieBreakStarterEntries)}%, and deuce censoring is ${ratio(m.draws, m.matches)}%. The first-server win rate is ${ratio(m.firstServerWins, m.firstServerCompleted)}%, which points to Rally initiative and tie-break resolution—not service seating—as the main concern. Keep +4 / pool 8 / Top 3 / thresholds 5-5-4 as the measured reference only; do not formalize the unbounded defense pool until initiative and censoring behavior are corrected. Test even Rally limits 4 and 6 plus alternating initiative, then repeat focused validation and Full.`
      : "";
  const censorDiagnostics = `\n\n## Deuce / unresolved match details\n\n- Matches reaching deuce: ${m.deuceMatches}/${m.matches} (${ratio(m.deuceMatches, m.matches)}%).\n- Stable deuce-cycle truncations: ${m.deuceCycleMatches}.\n- 250-point unresolved truncations: ${Math.max(0, m.draws - m.deuceCycleMatches)}.\n- Total unresolved/censored matches: ${m.draws}; these are excluded from completed win rates and are never recorded as ordinary draws.`;
  return {
    report: `${report}\n\n${analysis}\n\n${extraDiagnostics}${censorDiagnostics}${fullFinding}`,
    recommendations: `${rec}${fullFinding}`,
  };
}

export async function writeReports(
  result: SimulationResult,
  catalog: GameRulesCatalog,
  reportRoot = resolve(process.cwd(), "reports"),
): Promise<string> {
  const stamp = result.startedAt.replaceAll(":", "-").replaceAll(".", "-");
  const directory = resolve(reportRoot, stamp);
  await mkdir(directory, { recursive: true });
  const legacy = result.modes.legacy;
  const candidate = result.modes.candidate;
  const candidateV3 = result.modes.candidateV3;
  const candidateV4 = result.modes.candidateV4;
  const v4 = v4ResourceReports(result);
  const combined = (
    header: string[],
    left: Array<Array<string | number>>,
    ...rest: Array<Array<Array<string | number>>>
  ) =>
    csv([header, ...left.slice(1), ...rest.flatMap((rows) => rows.slice(1))]);
  await Promise.all([
    writeFile(
      resolve(directory, "summary.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve(directory, "players.csv"),
      combined(
        [
          "mode",
          "player_id",
          "player",
          "tier",
          "matches",
          "wins",
          "censored_draws",
          "completed_matches",
          "win_rate",
          "ci95_low",
          "ci95_high",
          "sample_status",
        ],
        playerRows(legacy, catalog, "Legacy"),
        playerRows(candidate, catalog, "Candidate"),
        playerRows(candidateV3, catalog, "Candidate V3"),
        playerRows(candidateV4, catalog, "Candidate V4"),
      ),
      "utf8",
    ),
    writeFile(
      resolve(directory, "blades.csv"),
      combined(
        [
          "mode",
          "side",
          "item_id",
          "name",
          "style",
          "usage",
          "usage_share",
          "matches",
          "wins",
          "censored_draws",
          "completed_matches",
          "raw_win_rate",
          "ci95_low",
          "ci95_high",
          "player_standardized_win_rate",
          "adjusted_player_count",
          "sample_status",
        ],
        gearRows(legacy, catalog, "Legacy", "blade"),
        gearRows(candidate, catalog, "Candidate", "blade"),
        gearRows(candidateV3, catalog, "Candidate V3", "blade"),
        gearRows(candidateV4, catalog, "Candidate V4", "blade"),
      ),
      "utf8",
    ),
    writeFile(
      resolve(directory, "rubbers.csv"),
      csv([
        [
          "mode",
          "side",
          "item_id",
          "name",
          "style",
          "usage",
          "usage_share",
          "matches",
          "wins",
          "censored_draws",
          "completed_matches",
          "raw_win_rate",
          "ci95_low",
          "ci95_high",
          "sample_status",
        ],
        ...gearRows(legacy, catalog, "Legacy", "fh").slice(1),
        ...gearRows(legacy, catalog, "Legacy", "bh").slice(1),
        ...gearRows(candidate, catalog, "Candidate", "fh").slice(1),
        ...gearRows(candidate, catalog, "Candidate", "bh").slice(1),
        ...gearRows(candidateV3, catalog, "Candidate V3", "fh").slice(1),
        ...gearRows(candidateV3, catalog, "Candidate V3", "bh").slice(1),
        ...gearRows(candidateV4, catalog, "Candidate V4", "fh").slice(1),
        ...gearRows(candidateV4, catalog, "Candidate V4", "bh").slice(1),
      ]),
      "utf8",
    ),
    writeFile(
      resolve(directory, "loadouts.csv"),
      combined(
        [
          "mode",
          "player",
          "blade",
          "fh_rubber",
          "bh_rubber",
          "win_rate",
          "matches",
          "censored_draws",
          "completed_matches",
          "style",
          "ci95_low",
          "ci95_high",
          "rank",
        ],
        loadoutRows(legacy, catalog, "Legacy"),
        loadoutRows(candidate, catalog, "Candidate"),
        loadoutRows(candidateV3, catalog, "Candidate V3"),
        loadoutRows(candidateV4, catalog, "Candidate V4"),
      ),
      "utf8",
    ),
    writeFile(
      resolve(directory, "abilities.csv"),
      combined(
        [
          "mode",
          "stage_pair",
          "selection_count",
          "allocation_points",
          "comparisons",
          "selection_rate",
          "allocation_rate",
          "attack_conversions",
          "defense_holds",
          "attack_conversion_rate",
          "defense_hold_rate",
          "avg_margin",
          "avg_defense_allocation",
          "marginal_defense_holds",
          "attack_bonus_assisted_conversions",
          "sample_status",
        ],
        abilityRows(legacy, "Legacy"),
        abilityRows(candidate, "Candidate"),
        abilityRows(candidateV3, "Candidate V3"),
        abilityRows(candidateV4, "Candidate V4"),
      ),
      "utf8",
    ),
    writeFile(
      resolve(directory, "phases.csv"),
      combined(
        [
          "mode",
          "stage",
          "comparisons",
          "stage_ends",
          "end_rate",
          "sample_size",
        ],
        stageRows(legacy, "Legacy"),
        stageRows(candidate, "Candidate"),
        stageRows(candidateV3, "Candidate V3"),
        stageRows(candidateV4, "Candidate V4"),
      ),
      "utf8",
    ),
    writeFile(
      resolve(directory, "mechanics.csv"),
      csv([
        [
          "mode",
          "baseline_matches",
          "avg_points",
          "avg_rally_rounds",
          "rallies_started",
          "fifth_round_rate_per_rally",
          "tie_break_rate_per_rally",
          "deuce_match_rate",
          "deuce_cycle_censored",
          "legacy_reference",
        ],
        [
          "Legacy",
          legacy.matches,
          (legacy.points / Math.max(1, legacy.matches)).toFixed(3),
          (legacy.rallyRounds / Math.max(1, legacy.matches)).toFixed(3),
          rallyStarts(legacy),
          pct(legacy.rallyFifthRound, rallyStarts(legacy)).toFixed(4),
          pct(legacy.rallyTieBreaks, rallyStarts(legacy)).toFixed(4),
          pct(legacy.deuceMatches, legacy.matches).toFixed(4),
          legacy.deuceCycleMatches,
          "production 10/10/15",
        ],
        [
          "Candidate",
          candidate.configs["Candidate baseline"]?.matches ?? 0,
          (
            (candidate.configs["Candidate baseline"]?.points ?? 0) /
            Math.max(1, candidate.configs["Candidate baseline"]?.matches ?? 1)
          ).toFixed(3),
          (
            (candidate.configs["Candidate baseline"]?.rallyRounds ?? 0) /
            Math.max(1, candidate.configs["Candidate baseline"]?.matches ?? 1)
          ).toFixed(3),
          rallyStarts(candidate),
          pct(candidate.rallyFifthRound, rallyStarts(candidate)).toFixed(4),
          pct(candidate.rallyTieBreaks, rallyStarts(candidate)).toFixed(4),
          pct(candidate.deuceMatches, candidate.matches).toFixed(4),
          candidate.deuceCycleMatches,
          "experimental only",
        ],
        [
          "Candidate V3",
          candidateV3.matches,
          (candidateV3.points / Math.max(1, candidateV3.matches)).toFixed(3),
          (candidateV3.rallyRounds / Math.max(1, candidateV3.matches)).toFixed(
            3,
          ),
          rallyStarts(candidateV3),
          pct(candidateV3.rallyFifthRound, rallyStarts(candidateV3)).toFixed(4),
          pct(candidateV3.rallyTieBreaks, rallyStarts(candidateV3)).toFixed(4),
          pct(candidateV3.deuceMatches, candidateV3.matches).toFixed(4),
          candidateV3.deuceCycleMatches,
          "experimental reducer ruleset",
        ],
        [
          "Candidate V4",
          candidateV4.matches,
          (candidateV4.points / Math.max(1, candidateV4.matches)).toFixed(3),
          (candidateV4.rallyRounds / Math.max(1, candidateV4.matches)).toFixed(
            3,
          ),
          rallyStarts(candidateV4),
          pct(candidateV4.rallyFifthRound, rallyStarts(candidateV4)).toFixed(4),
          pct(candidateV4.rallyTieBreaks, rallyStarts(candidateV4)).toFixed(4),
          pct(candidateV4.deuceMatches, candidateV4.matches).toFixed(4),
          candidateV4.deuceCycleMatches,
          "experimental reducer ruleset",
        ],
      ]),
      "utf8",
    ),
    writeFile(
      resolve(directory, "strategies.csv"),
      combined(
        [
          "mode",
          "analysis_type",
          "policy_or_allocation",
          "observations",
          "wins",
          "win_rate",
          "allocation_share",
          "sample_status",
        ],
        strategyRows(legacy, "Legacy"),
        strategyRows(candidate, "Candidate"),
        strategyRows(candidateV3, "Candidate V3"),
        strategyRows(candidateV4, "Candidate V4"),
      ),
      "utf8",
    ),
    writeFile(
      resolve(directory, "v3-parameter-experiments.csv"),
      csv([
        [
          "phase",
          "parameter",
          "value",
          "matches",
          "a_seat_wins",
          "censored_draws",
          "a_seat_win_rate",
          "ci95_low",
          "ci95_high",
        ],
        ...result.v3Experiments.map((item) => [
          "one_factor",
          item.parameter,
          item.value,
          item.matches,
          item.wins,
          item.censoredDraws,
          item.winRate.toFixed(4),
          item.ci95Low.toFixed(4),
          item.ci95High.toFixed(4),
        ]),
        ...result.v3Validation.map((item, index) => [
          "focused_validation",
          `candidate_${index + 1}`,
          JSON.stringify(item.parameters),
          item.matches,
          item.aSeatWins,
          item.censoredDraws,
          item.winRate.toFixed(4),
          item.ci95Low.toFixed(4),
          item.ci95High.toFixed(4),
        ]),
      ]),
      "utf8",
    ),
    writeFile(resolve(directory, "resource-economy.csv"), v4.csv, "utf8"),
    writeFile(
      resolve(directory, "carry-distribution.csv"),
      csv([
        ["metric", "value", "count"],
        ...Object.entries(candidateV4.resources.reserveAtCounter).map(
          ([value, count]) => ["reserve_at_counter", value, count],
        ),
        ...Object.entries(candidateV4.resources.reserveAtRally).map(
          ([value, count]) => ["reserve_at_rally", value, count],
        ),
        ...Object.entries(candidateV4.resources.rallyBudget).map(
          ([value, count]) => ["rally_total_budget", value, count],
        ),
      ]),
      "utf8",
    ),
    writeFile(
      resolve(directory, "v4-parameter-experiments.csv"),
      csv([
        [
          "phase",
          "parameters",
          "matches",
          "seat_a_wins",
          "censored",
          "win_rate",
          "ci95_low",
          "ci95_high",
        ],
        ...result.v4Experiments.map((item) => [
          "one_factor",
          JSON.stringify(item.parameters),
          item.matches,
          item.seatAWins,
          item.censoredDraws,
          item.winRate.toFixed(4),
          item.ci95Low.toFixed(4),
          item.ci95High.toFixed(4),
        ]),
        ...result.v4Validation.map((item) => [
          "focused_validation",
          JSON.stringify(item.parameters),
          item.matches,
          item.seatAWins,
          item.censoredDraws,
          item.winRate.toFixed(4),
          item.ci95Low.toFixed(4),
          item.ci95High.toFixed(4),
        ]),
      ]),
      "utf8",
    ),
  ]);
  const rec = recommendations(result);
  await writeFile(
    resolve(directory, "BALANCE_REPORT.md"),
    summaryMarkdown(result),
    "utf8",
  );
  await writeFile(
    resolve(directory, "BALANCE_RECOMMENDATIONS.md"),
    rec.markdown,
    "utf8",
  );
  await writeFile(
    resolve(directory, "balance-recommendations.json"),
    `${JSON.stringify(rec.json, null, 2)}\n`,
    "utf8",
  );
  const v3 = candidateV3Markdown(result);
  await Promise.all([
    writeFile(resolve(directory, "V4_BALANCE_REPORT.md"), v4.report, "utf8"),
    writeFile(
      resolve(directory, "V4_RECOMMENDATIONS.md"),
      v4.recommendations,
      "utf8",
    ),
  ]);
  await Promise.all([
    writeFile(resolve(directory, "BALANCE_REPORT_V3.md"), v3.report, "utf8"),
    writeFile(
      resolve(directory, "BALANCE_RECOMMENDATIONS_V3.md"),
      v3.recommendations,
      "utf8",
    ),
  ]);
  return directory;
}

function strategyRows(
  summary: ModeSummary,
  mode: string,
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    [
      "mode",
      "analysis_type",
      "policy_or_allocation",
      "observations",
      "wins",
      "win_rate",
      "allocation_share",
      "sample_status",
    ],
  ];
  for (const [policy, matches] of Object.entries(summary.policyMatches)) {
    const wins = summary.policyWins[policy] ?? 0;
    rows.push([
      mode,
      "bot_policy",
      policy,
      matches,
      wins,
      pct(wins, matches).toFixed(4),
      "",
      matches < 1000 ? "INSUFFICIENT_SAMPLE" : "observed_only",
    ]);
  }
  const patternGroupTotals = new Map<string, number>();
  for (const [key, count] of Object.entries(summary.defensePatterns)) {
    const group = key.split(":").slice(0, 2).join(":");
    patternGroupTotals.set(group, (patternGroupTotals.get(group) ?? 0) + count);
  }
  for (const [pattern, observations] of Object.entries(
    summary.defensePatterns,
  ).sort((a, b) => b[1] - a[1])) {
    const group = pattern.split(":").slice(0, 2).join(":");
    const share = pct(observations, patternGroupTotals.get(group) ?? 0);
    rows.push([
      mode,
      "Fortress_defense_pattern",
      pattern,
      observations,
      "",
      "",
      share.toFixed(4),
      share > 0.5
        ? "DOMINANT_DEFENSE_ALLOCATION_WARNING"
        : observations < 100
          ? "INSUFFICIENT_SAMPLE"
          : "observed_only",
    ]);
  }
  return rows;
}
