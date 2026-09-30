import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AiStrategyVariant } from "@paddle-tactics/ai";
import { browserCatalog } from "../src/lib/catalog.js";
import type { PublicCatalog } from "../src/lib/catalog.js";
import { createWorldCup, simulateCupMatch } from "../src/lib/world-cup.js";

const OUTPUT = resolve(
  import.meta.dirname,
  "../../..",
  "reports",
  "world-cup-balance-2026-09-30",
);
const SEED = 20260930;
const RUN_MODE = process.env.BALANCE_EXPERIMENT_MODE ?? "screening";
const SCREENING_REPEATS = RUN_MODE === "confirmation" ? 12 : 4;
const PLAYER_ROSTER = browserCatalog.players;
const STRATEGIES: AiStrategyVariant[] = [
  "current",
  "balanced",
  "aggressive",
  "balanced-varied",
  "wide-varied",
];

type Candidate = { id: string; title: string; catalog: PublicCatalog };
type MatchupTotals = {
  matches: number;
  winsA: number;
  winsB: number;
  gameWinsA: number;
  gameWinsB: number;
  setLossScoreHistogram: Record<string, number>;
  seriesLengthHistogram: Record<string, number>;
};
type Metrics = {
  candidate: string;
  strategy: AiStrategyVariant;
  matches: number;
  games: number;
  closeGames: number;
  shutoutGames: number;
  onePointGames: number;
  gamesWithLoserAtMostFour: number;
  deuces: number;
  totalPointMargin: number;
  totalLoserScore: number;
  matchesEndingInSweep: number;
  matchesEndingInFiveOrSix: number;
  matchesEndingInSeven: number;
  playerSeries: Record<
    string,
    { matches: number; wins: number; gameWins: number }
  >;
  playerPairs: Record<string, MatchupTotals>;
};

function cloneCatalog(catalog: PublicCatalog): PublicCatalog {
  return structuredClone(catalog);
}

function statCells(player: PublicCatalog["players"][number]) {
  return Object.entries(player.stats).flatMap(([pairId, roles]) =>
    (["attack", "defense"] as const).flatMap((role) =>
      (["forehand", "backhand"] as const).map((side) => ({
        pairId,
        role,
        side,
        value: roles[role][side],
        key: `${pairId}.${role}.${side}`,
      })),
    ),
  );
}

/** Compresses non-signature values while keeping each player's total and top/bottom three cells. */
function compressPlayerProfiles(
  source: PublicCatalog,
  ratio: number,
): PublicCatalog {
  const catalog = cloneCatalog(source);
  for (const player of catalog.players) {
    const cells = statCells(player);
    const top = [...cells]
      .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
      .slice(0, 3);
    const bottom = [...cells]
      .sort((a, b) => a.value - b.value || a.key.localeCompare(b.key))
      .slice(0, 3);
    const fixed = new Set([...top, ...bottom].map((cell) => cell.key));
    const fixedTotal = cells
      .filter((cell) => fixed.has(cell.key))
      .reduce((sum, cell) => sum + cell.value, 0);
    const mutable = cells.filter((cell) => !fixed.has(cell.key));
    const mean = (player.baseTotal - fixedTotal) / Math.max(1, mutable.length);
    const targets = mutable.map((cell) => {
      const value = mean + (cell.value - mean) * (1 - ratio);
      return { ...cell, target: value, rounded: Math.floor(value) };
    });
    let remainder =
      player.baseTotal -
      fixedTotal -
      targets.reduce((sum, cell) => sum + cell.rounded, 0);
    targets.sort(
      (a, b) =>
        b.target - b.rounded - (a.target - a.rounded) ||
        b.value - a.value ||
        a.key.localeCompare(b.key),
    );
    for (const cell of targets) {
      if (remainder <= 0) break;
      if (cell.rounded < 10) {
        cell.rounded += 1;
        remainder -= 1;
      }
    }
    if (remainder !== 0)
      throw new Error(
        `${player.id} could not preserve its total in ${ratio} profile compression`,
      );
    for (const cell of targets) {
      const target = player.stats[cell.pairId]![cell.role];
      target[cell.side] = cell.rounded;
    }
  }
  return catalog;
}

/** Lifts severe 5-point holes to 6 and pays for them from non-signature middle values. */
function softenStatFloors(source: PublicCatalog): PublicCatalog {
  const catalog = cloneCatalog(source);
  for (const player of catalog.players) {
    const cells = statCells(player);
    const signature = new Set(
      [...cells]
        .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
        .slice(0, 3)
        .map((cell) => cell.key),
    );
    const targetValues = new Map(cells.map((cell) => [cell.key, cell.value]));
    let raised = 0;
    for (const cell of cells) {
      if (!signature.has(cell.key) && cell.value < 6) {
        targetValues.set(cell.key, 6);
        raised += 6 - cell.value;
      }
    }
    const donors = [...cells]
      .filter((cell) => !signature.has(cell.key))
      .sort((a, b) => a.value - b.value || a.key.localeCompare(b.key));
    for (const cell of donors) {
      if (raised <= 0) break;
      const current = targetValues.get(cell.key)!;
      const take = Math.min(raised, Math.max(0, current - 6));
      targetValues.set(cell.key, current - take);
      raised -= take;
    }
    if (raised !== 0)
      throw new Error(
        `${player.id} cannot soften stat floors without changing its total`,
      );
    for (const cell of cells) {
      player.stats[cell.pairId]![cell.role][cell.side] = targetValues.get(
        cell.key,
      )!;
    }
  }
  return catalog;
}

const TARGETED_TRANSFERS: Record<
  string,
  { recipients: string[]; donors: string[] }
> = {
  "tomokazu-harimoto": {
    recipients: [
      "service_placement.attack.forehand",
      "flick.attack.backhand",
      "flip.attack.backhand",
      "loop_drive.attack.forehand",
      "rally_exchange.attack.backhand",
      "continuous_attack.attack.backhand",
    ],
    donors: [
      "service_spin.attack.forehand",
      "service_spin.attack.backhand",
      "deep_push.attack.backhand",
      "receive_variation.attack.forehand",
      "receive_variation.attack.backhand",
      "line_change.attack.backhand",
    ],
  },
  "zhang-jike": {
    recipients: [
      "service_spin.attack.forehand",
      "service_variation.attack.backhand",
      "service_deception.attack.forehand",
      "flick.attack.backhand",
      "flip.attack.forehand",
      "line_change.attack.backhand",
    ],
    donors: [
      "service_spin.defense.forehand",
      "service_spin.defense.backhand",
      "service_deception.defense.forehand",
      "service_deception.defense.backhand",
      "receive_variation.defense.forehand",
      "receive_variation.defense.backhand",
    ],
  },
};
const ZHANG_ATTACK_DONORS = [
  "service_speed.attack.forehand",
  "service_speed.attack.backhand",
  "service_variation.attack.forehand",
  "deep_push.attack.forehand",
  "short_push.attack.backhand",
  "receive_variation.attack.forehand",
];
const ZHANG_DEFENSE_RECIPIENTS = [
  "service_placement.defense.backhand",
  "service_speed.defense.forehand",
  "short_push.defense.forehand",
  "rally_exchange.defense.backhand",
  "counterattack.defense.forehand",
  "counterattack.defense.backhand",
];

/** Concentrates six points in each requested player's signature attacks, preserving tier totals. */
function strengthenRequestedPlayers(
  source: PublicCatalog,
  pointsPerCell: number | Record<string, number>,
  zhangTransferMode: "all-round" | "attack-only" | "defense-only" = "all-round",
  onlyPlayers: string[] = Object.keys(TARGETED_TRANSFERS),
): PublicCatalog {
  const catalog = cloneCatalog(source);
  for (const [playerId, transfer] of Object.entries(TARGETED_TRANSFERS)) {
    if (!onlyPlayers.includes(playerId)) continue;
    const player = catalog.players.find((item) => item.id === playerId);
    if (!player) throw new Error(`Missing targeted player: ${playerId}`);
    const originalTotal = statCells(player).reduce(
      (sum, cell) => sum + cell.value,
      0,
    );
    const points =
      typeof pointsPerCell === "number"
        ? pointsPerCell
        : (pointsPerCell[playerId] ?? 1);
    const recipients =
      playerId === "zhang-jike" && zhangTransferMode === "defense-only"
        ? ZHANG_DEFENSE_RECIPIENTS
        : transfer.recipients;
    for (const key of recipients) {
      const [skill, role, side] = key.split(".") as [
        string,
        "attack" | "defense",
        "forehand" | "backhand",
      ];
      player.stats[skill]![role][side] += points;
    }
    const donors =
      playerId === "zhang-jike" && zhangTransferMode !== "all-round"
        ? ZHANG_ATTACK_DONORS
        : transfer.donors;
    for (const key of donors) {
      const [skill, role, side] = key.split(".") as [
        string,
        "attack" | "defense",
        "forehand" | "backhand",
      ];
      player.stats[skill]![role][side] -= points;
    }
    if (statCells(player).some((cell) => cell.value < 5 || cell.value > 15))
      throw new Error(`${playerId} signature transfer left the 5..15 range`);
    const updatedTotal = statCells(player).reduce(
      (sum, cell) => sum + cell.value,
      0,
    );
    if (updatedTotal !== originalTotal)
      throw new Error(`${playerId} signature transfer changed the total`);
  }
  return catalog;
}

function legalStatTransfer(
  source: PublicCatalog,
  transfers: Record<string, { recipients: string[]; donors: string[] }>,
): PublicCatalog {
  const catalog = cloneCatalog(source);
  for (const [playerId, transfer] of Object.entries(transfers)) {
    const player = catalog.players.find((item) => item.id === playerId);
    if (!player)
      throw new Error(`Missing player for legal transfer: ${playerId}`);
    const originalTotal = statCells(player).reduce(
      (sum, cell) => sum + cell.value,
      0,
    );
    for (const key of transfer.recipients) {
      const [skill, role, side] = key.split(".") as [
        string,
        "attack" | "defense",
        "forehand" | "backhand",
      ];
      player.stats[skill]![role][side] += 1;
    }
    for (const key of transfer.donors) {
      const [skill, role, side] = key.split(".") as [
        string,
        "attack" | "defense",
        "forehand" | "backhand",
      ];
      player.stats[skill]![role][side] -= 1;
    }
    const values = statCells(player).map((cell) => cell.value);
    const updatedTotal = values.reduce((sum, value) => sum + value, 0);
    if (updatedTotal !== originalTotal)
      throw new Error(`${playerId} transfer changed the total`);
    if (Math.min(...values) < 5 || Math.max(...values) > 10)
      throw new Error(`${playerId} transfer violates the 5..10 stat limits`);
    for (const [stageId, stage] of Object.entries(catalog.skills.stages)) {
      for (const side of ["forehand", "backhand"] as const) {
        const peaks = stage.pairs.flatMap((pair) => [
          player.stats[pair.id]!.attack[side],
          player.stats[pair.id]!.defense[side],
        ]);
        if (
          peaks.filter((value) => value === 10).length > 1 ||
          peaks.filter((value) => value === 9).length > 1 ||
          peaks.some((value) => value > 8 && value !== 9 && value !== 10)
        )
          throw new Error(
            `${playerId} transfer violates Candidate V4 ${stageId}/${side} peak constraints`,
          );
      }
    }
  }
  return catalog;
}

const H_SAFE_TRANSFER = {
  recipients: [
    "service_speed.attack.forehand",
    "service_spin.attack.backhand",
    "flick.attack.forehand",
    "deep_push.attack.backhand",
    "rally_exchange.attack.forehand",
    "counterattack.attack.backhand",
  ],
  donors: [
    "service_placement.attack.forehand",
    "service_placement.defense.backhand",
    "short_push.defense.forehand",
    "flip.attack.backhand",
    "loop_drive.attack.forehand",
    "continuous_attack.attack.backhand",
  ],
};
const ZJ_SAFE_TRANSFER = {
  recipients: [
    "service_speed.attack.forehand",
    "service_placement.attack.backhand",
    "deep_push.attack.forehand",
    "flip.attack.backhand",
    "line_change.attack.forehand",
    "counterattack.attack.backhand",
  ],
  donors: [
    "service_spin.attack.forehand",
    "service_placement.defense.backhand",
    "short_push.defense.forehand",
    "receive_variation.attack.backhand",
    "counterattack.attack.forehand",
    "rally_exchange.defense.backhand",
  ],
};

function freshMetrics(
  candidate: Candidate,
  strategy: AiStrategyVariant,
): Metrics {
  return {
    candidate: candidate.id,
    strategy,
    matches: 0,
    games: 0,
    closeGames: 0,
    shutoutGames: 0,
    onePointGames: 0,
    gamesWithLoserAtMostFour: 0,
    deuces: 0,
    totalPointMargin: 0,
    totalLoserScore: 0,
    matchesEndingInSweep: 0,
    matchesEndingInFiveOrSix: 0,
    matchesEndingInSeven: 0,
    playerSeries: Object.fromEntries(
      PLAYER_ROSTER.map((player) => [
        player.id,
        { matches: 0, wins: 0, gameWins: 0 },
      ]),
    ),
    playerPairs: {},
  };
}

function pairKey(first: string, second: string): string {
  return `${first}__${second}`;
}

function measurePair(
  candidate: Candidate,
  strategy: AiStrategyVariant,
  repeats: number,
  metrics: Metrics,
  pairIndex: number,
  firstId: string,
  secondId: string,
  baseCup: ReturnType<typeof createWorldCup>,
): void {
  const key = pairKey(firstId, secondId);
  const pairTotals = (metrics.playerPairs[key] ??= {
    matches: 0,
    winsA: 0,
    winsB: 0,
    gameWinsA: 0,
    gameWinsB: 0,
    setLossScoreHistogram: {},
    seriesLengthHistogram: {},
  });
  const players = [firstId, secondId] as const;
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    const cup = {
      ...baseCup,
      seed: (SEED ^ Math.imul(pairIndex + 1, 0x9e3779b1) ^ repeat) >>> 0,
    };
    const matchIndex = pairIndex * repeats + repeat;
    for (const swapSeats of [false, true]) {
      for (const firstServer of ["A", "B"] as const) {
        const [playerA, playerB] = swapSeats
          ? [players[1], players[0]]
          : [players[0], players[1]];
        const match = {
          id: `experiment-r0-m${matchIndex}`,
          round: 0 as const,
          index: matchIndex,
          playerIds: [playerA, playerB] as [string, string],
          status: "pending" as const,
          games: [],
          visibleGameCount: 0,
          pendingWinnerId: null,
          winnerId: null,
        };
        const games = simulateCupMatch(
          cup,
          match,
          candidate.catalog,
          strategy,
          firstServer,
          null,
        );
        metrics.matches += 1;
        pairTotals.matches += 1;
        metrics.playerSeries[firstId]!.matches += 1;
        metrics.playerSeries[secondId]!.matches += 1;
        const winsA = games.filter(
          (game) => game.winnerPlayerId === playerA,
        ).length;
        const winsB = games.filter(
          (game) => game.winnerPlayerId === playerB,
        ).length;
        const winner = winsA > winsB ? playerA : playerB;
        pairTotals.winsA += Number(winner === firstId);
        pairTotals.winsB += Number(winner === secondId);
        if (winner === firstId) metrics.playerSeries[firstId]!.wins += 1;
        else metrics.playerSeries[secondId]!.wins += 1;
        metrics.games += games.length;
        pairTotals.seriesLengthHistogram[games.length] =
          (pairTotals.seriesLengthHistogram[games.length] ?? 0) + 1;
        metrics.matchesEndingInSweep += Number(games.length === 4);
        metrics.matchesEndingInFiveOrSix += Number(
          games.length === 5 || games.length === 6,
        );
        metrics.matchesEndingInSeven += Number(games.length === 7);
        if (games.length === 4)
          pairTotals.seriesLengthHistogram["sweep"] =
            (pairTotals.seriesLengthHistogram["sweep"] ?? 0) + 1;
        for (const game of games) {
          if (game.winnerPlayerId === firstId) pairTotals.gameWinsA += 1;
          else pairTotals.gameWinsB += 1;
          const lossScore = Math.min(game.a, game.b);
          const margin = Math.abs(game.a - game.b);
          metrics.closeGames += Number(margin <= 7);
          metrics.shutoutGames += Number(lossScore === 0);
          metrics.onePointGames += Number(lossScore === 1);
          metrics.gamesWithLoserAtMostFour += Number(lossScore <= 4);
          metrics.deuces += Number(Math.max(game.a, game.b) > 11);
          metrics.totalPointMargin += margin;
          metrics.totalLoserScore += lossScore;
          pairTotals.setLossScoreHistogram[lossScore] =
            (pairTotals.setLossScoreHistogram[lossScore] ?? 0) + 1;
          const gameWinnerId = game.winnerPlayerId;
          metrics.playerSeries[gameWinnerId]!.gameWins += 1;
        }
      }
    }
  }
}

const allCandidates: Candidate[] = [
  {
    id: "baseline",
    title: "当前球员数值",
    catalog: cloneCatalog(browserCatalog),
  },
  {
    id: "floor-six",
    title: "每人前三强保持不变，将其余 5 分短板提升至 6 并从中段回收等量点数",
    catalog: softenStatFloors(browserCatalog),
  },
  {
    id: "profile-mid-30",
    title: "保留每人前三强/前三弱，将其余能力差异压缩 30%（总分档不变）",
    catalog: compressPlayerProfiles(browserCatalog, 0.3),
  },
  {
    id: "signature-plus-one",
    title: "张本智和与张继科的六项招牌进攻各 +1，并从次要能力等量转移",
    catalog: strengthenRequestedPlayers(browserCatalog, 1),
  },
  {
    id: "harimoto-plus-one-only",
    title: "仅将张本智和六项招牌进攻各提高 1 点，保持总分 440",
    catalog: strengthenRequestedPlayers(browserCatalog, 1, "all-round", [
      "tomokazu-harimoto",
    ]),
  },
  {
    id: "harimoto-plus-two-only",
    title:
      "仅将张本智和六项招牌进攻各提高 2 点，从低使用率能力扣回并保持总分 440",
    catalog: strengthenRequestedPlayers(browserCatalog, 2, "all-round", [
      "tomokazu-harimoto",
    ]),
  },
  {
    id: "harimoto-plus-one-zhang-defense-plus-one",
    title: "张本招牌进攻各 +1，张继科关键防守各 +1，均保持原总分",
    catalog: strengthenRequestedPlayers(browserCatalog, 1, "defense-only"),
  },
  {
    id: "harimoto-plus-two-zhang-attack-plus-one",
    title: "张本智和招牌进攻各 +2；张继科招牌进攻各 +1，防守不降",
    catalog: strengthenRequestedPlayers(
      browserCatalog,
      { "tomokazu-harimoto": 2, "zhang-jike": 1 },
      "attack-only",
    ),
  },
  {
    id: "profile-mid-30-plus-signature",
    title: "30% 中段压缩后，再定向强化张本智和与张继科招牌进攻",
    catalog: strengthenRequestedPlayers(
      compressPlayerProfiles(browserCatalog, 0.3),
      1,
    ),
  },
  {
    id: "legal-harimoto-plus-one-only",
    title: "张本四项未满 10 的代表性进攻各 +1，总分不变",
    catalog: legalStatTransfer(browserCatalog, {
      "tomokazu-harimoto": H_SAFE_TRANSFER,
    }),
  },
  {
    id: "legal-zhang-jike-plus-one-only",
    title: "张继科六项未满 10 的进攻各 +1，总分不变",
    catalog: legalStatTransfer(browserCatalog, {
      "zhang-jike": ZJ_SAFE_TRANSFER,
    }),
  },
  {
    id: "legal-harimoto-and-zhang-jike-plus-one",
    title: "张本四项、张继科六项未满 10 的进攻各 +1，总分不变",
    catalog: legalStatTransfer(browserCatalog, {
      "tomokazu-harimoto": H_SAFE_TRANSFER,
      "zhang-jike": ZJ_SAFE_TRANSFER,
    }),
  },
];
const candidates =
  RUN_MODE === "legal-targeted-screening"
    ? allCandidates.filter((candidate) =>
        [
          "baseline",
          "legal-harimoto-plus-one-only",
          "legal-zhang-jike-plus-one-only",
          "legal-harimoto-and-zhang-jike-plus-one",
        ].includes(candidate.id),
      )
    : RUN_MODE === "targeted-screening"
      ? allCandidates.filter((candidate) =>
          [
            "baseline",
            "signature-plus-one",
            "harimoto-plus-one-only",
            "harimoto-plus-two-only",
            "harimoto-plus-one-zhang-defense-plus-one",
            "harimoto-plus-two-zhang-attack-plus-one",
            "profile-mid-30-plus-signature",
          ].includes(candidate.id),
        )
      : RUN_MODE === "confirmation"
        ? allCandidates.filter((candidate) =>
            [
              "baseline",
              "signature-plus-one",
              "harimoto-plus-one-only",
              "harimoto-plus-one-zhang-defense-plus-one",
            ].includes(candidate.id),
          )
        : allCandidates;

function summarize(metrics: Metrics) {
  const pairs = Object.entries(metrics.playerPairs);
  const sameTier = pairs.filter(([key]) => {
    const [a, b] = key.split("__");
    return (
      browserCatalog.players.find((player) => player.id === a)!.baseTotal ===
      browserCatalog.players.find((player) => player.id === b)!.baseTotal
    );
  });
  const rates = sameTier.map(([, value]) => {
    const a = value.winsA / Math.max(1, value.matches);
    return Math.abs(a - 0.5);
  });
  const tierWins = Object.fromEntries(
    [480, 460, 440].map((tier) => {
      const players = browserCatalog.players.filter(
        (player) => player.baseTotal === tier,
      );
      const totals = players.reduce(
        (sum, player) => {
          const row = metrics.playerSeries[player.id]!;
          sum.matches += row.matches;
          sum.wins += row.wins;
          return sum;
        },
        { matches: 0, wins: 0 },
      );
      return [tier, totals.wins / Math.max(1, totals.matches)];
    }),
  );
  const closeRate = metrics.closeGames / Math.max(1, metrics.games);
  const fiveSixRate =
    metrics.matchesEndingInFiveOrSix / Math.max(1, metrics.matches);
  const sweepRate = metrics.matchesEndingInSweep / Math.max(1, metrics.matches);
  const sameTierBias =
    rates.reduce((sum, value) => sum + value, 0) / Math.max(1, rates.length);
  const tierOrder =
    tierWins[480]! > tierWins[460]! && tierWins[460]! > tierWins[440]!;
  return {
    candidate: metrics.candidate,
    strategy: metrics.strategy,
    matches: metrics.matches,
    games: metrics.games,
    closeGameRate: closeRate,
    meanLoserScore: metrics.totalLoserScore / metrics.games,
    shutoutRate: metrics.shutoutGames / metrics.games,
    onePointLossRate: metrics.onePointGames / metrics.games,
    loserAtMostFourRate: metrics.gamesWithLoserAtMostFour / metrics.games,
    deuceRate: metrics.deuces / metrics.games,
    meanMatchLength: metrics.games / metrics.matches,
    sweepRate,
    fiveOrSixGameSeriesRate: fiveSixRate,
    sevenGameSeriesRate: metrics.matchesEndingInSeven / metrics.matches,
    meanSameTierWinRateDistanceFrom50Pct: sameTierBias,
    tierWinRates: tierWins,
    score:
      closeRate * 0.42 +
      fiveSixRate * 0.35 +
      (1 - sweepRate) * 0.13 +
      Number(tierOrder) * 0.1 -
      sameTierBias * 0.2,
    playerSeries: metrics.playerSeries,
    playerPairs: metrics.playerPairs,
  };
}

const results = [];
for (const candidate of candidates) {
  const baseCup = createWorldCup({ catalog: candidate.catalog, seed: SEED });
  const strategies =
    RUN_MODE === "confirmation"
      ? (["balanced-varied"] as const)
      : RUN_MODE === "targeted-screening" ||
          RUN_MODE === "legal-targeted-screening"
        ? (["balanced-varied", "wide-varied"] as const)
        : candidate.id === "baseline"
          ? STRATEGIES
          : (["balanced", "balanced-varied"] as const);
  for (const strategy of strategies) {
    const metrics = freshMetrics(candidate, strategy);
    let pairIndex = 0;
    for (let first = 0; first < PLAYER_ROSTER.length; first += 1) {
      for (let second = first + 1; second < PLAYER_ROSTER.length; second += 1) {
        measurePair(
          candidate,
          strategy,
          SCREENING_REPEATS,
          metrics,
          pairIndex,
          PLAYER_ROSTER[first]!.id,
          PLAYER_ROSTER[second]!.id,
          baseCup,
        );
        pairIndex += 1;
      }
    }
    results.push(summarize(metrics));
    process.stdout.write(
      `${candidate.id} / ${strategy}: ${metrics.matches} matches, ${metrics.games} games\n`,
    );
  }
}

results.sort((a, b) => b.score - a.score);
await mkdir(OUTPUT, { recursive: true });
const resultsFilename =
  RUN_MODE === "confirmation"
    ? "confirmation-results.json"
    : RUN_MODE === "targeted-screening" ||
        RUN_MODE === "legal-targeted-screening"
      ? "targeted-screening-results.json"
      : "screening-results.json";
await writeFile(
  resolve(OUTPUT, resultsFilename),
  `${JSON.stringify(results, null, 2)}\n`,
);
const report = [
  `# World Cup balance strategy and player-stat ${RUN_MODE}`,
  "",
  `Seed: ${SEED}; mode: ${RUN_MODE}; repetitions per player pairing and strategy: ${SCREENING_REPEATS}; mirrored seats and first-server positions: 4; Candidate V4 rules unchanged.`,
  "",
  "The score target is a losing set score of at least 4 (margin <= 7). For the current eight-player roster, player totals and the 480 > 460 > 440 tiers are held fixed. Targeted variants redistribute stats while conserving each affected player's stat total, and compare two ranked-choice exploration levels. Track per-player and per-pair outcomes before considering any roster data change.",
  "",
  `| Rank | Player data | AI strategy | Matches | Games | Margin ≤7 | 0–1 point losses | Average loser score | 4–0 | 4–1/4–2 | 4–3 | Same-tier bias | Tier order | ${RUN_MODE === "confirmation" ? "Score" : "Screening score"} |`,
  "|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|",
  ...results.map(
    (item, index) =>
      `| ${index + 1} | ${item.candidate} | ${item.strategy} | ${item.matches} | ${item.games} | ${(item.closeGameRate * 100).toFixed(1)}% | ${((item.shutoutRate + item.onePointLossRate) * 100).toFixed(1)}% | ${item.meanLoserScore.toFixed(2)} | ${(item.sweepRate * 100).toFixed(1)}% | ${(item.fiveOrSixGameSeriesRate * 100).toFixed(1)}% | ${(item.sevenGameSeriesRate * 100).toFixed(1)}% | ${(item.meanSameTierWinRateDistanceFrom50Pct * 100).toFixed(1)}% | ${item.tierWinRates[480]! > item.tierWinRates[460]! && item.tierWinRates[460]! > item.tierWinRates[440]! ? "yes" : "no"} | ${item.score.toFixed(3)} |`,
  ),
  "",
  `See \`${resultsFilename}\` for per-player and per-pair outcomes. This is a deterministic local simulation, not a claim that player outcomes will match human play.`,
  "",
].join("\n");
const reportFilename =
  RUN_MODE === "confirmation"
    ? "CONFIRMATION_REPORT.md"
    : RUN_MODE === "targeted-screening" ||
        RUN_MODE === "legal-targeted-screening"
      ? "TARGETED_SCREENING_REPORT.md"
      : "SCREENING_REPORT.md";
await writeFile(resolve(OUTPUT, reportFilename), report);
process.stdout.write(`Report written to ${OUTPUT}\n`);
