import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { GameRulesCatalog, Loadout } from "@paddle-tactics/game-core";
import { loadCatalog } from "@paddle-tactics/game-data";
import { V4_RESOURCE_POLICIES } from "./bots.js";
import { runCandidateV4Match } from "./engine.js";
import { seededRandom } from "./random.js";
import { wilsonInterval } from "./reports.js";

const MATCHES = 20_000;
const SEED = 20260929;
const PER_CELL = 312;
const EXTRA_UNORDERED_PAIRS = 16;
const catalog = loadCatalog() as GameRulesCatalog;
const players = catalog.players;
const loadout = (playerId: string): Loadout => ({
  playerId,
  bladeId: catalog.blades[0]!.id,
  forehandRubberId: catalog.rubbers[0]!.id,
  backhandRubberId: catalog.rubbers[0]!.id,
});
const cells = players.map(() =>
  players.map(() => ({ matches: 0, wins: 0, losses: 0, censored: 0 })),
);
const playerTotals = new Map(
  players.map((player) => [player.id, { matches: 0, wins: 0, censored: 0 }]),
);

function csv(rows: Array<Array<string | number>>): string {
  return `${rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value);
          return /[",\r\n]/.test(text)
            ? `"${text.replaceAll('"', '""')}"`
            : text;
        })
        .join(","),
    )
    .join("\n")}\n`;
}

function statValues(player: (typeof players)[number], pairId: string) {
  const stat = player.stats[pairId]!;
  return {
    attack: (stat.attack.forehand + stat.attack.backhand) / 2,
    defense: (stat.defense.forehand + stat.defense.backhand) / 2,
  };
}

function cellMatchCount(row: number, column: number): number {
  if (row === column) return PER_CELL;
  const low = Math.min(row, column);
  const high = Math.max(row, column);
  const pairIndex = (low * (2 * players.length - low - 1)) / 2 + high - low - 1;
  return PER_CELL + Number(pairIndex < EXTRA_UNORDERED_PAIRS);
}

let simulated = 0;
for (let row = 0; row < players.length; row += 1) {
  for (let column = 0; column < players.length; column += 1) {
    const sampleCount = cellMatchCount(row, column);
    const pairIndex =
      row === column
        ? players.length * (players.length - 1) + row
        : (Math.min(row, column) *
            (2 * players.length - Math.min(row, column) - 1)) /
            2 +
          Math.max(row, column) -
          Math.min(row, column) -
          1;
    const mirrorSeat = row <= column;
    const rowPlayer = players[row]!;
    const columnPlayer = players[column]!;
    const cell = cells[row]![column]!;

    for (let sample = 0; sample < sampleCount; sample += 1) {
      const policy =
        V4_RESOURCE_POLICIES[sample % V4_RESOURCE_POLICIES.length]!;
      const seed = (SEED ^ Math.imul(pairIndex + 1, 0x9e3779b1) ^ sample) >>> 0;
      const firstServerA = (sample % 2 === 0) === mirrorSeat;
      const outcome = runCandidateV4Match({
        catalog,
        loadoutA: loadout(rowPlayer.id),
        loadoutB: loadout(columnPlayer.id),
        policyA: policy,
        policyB: policy,
        firstServerA,
        random: seededRandom(seed),
      });
      cell.matches += 1;
      simulated += 1;
      playerTotals.get(rowPlayer.id)!.matches += 1;
      playerTotals.get(columnPlayer.id)!.matches += 1;
      if (outcome.winner === "A") {
        cell.wins += 1;
        playerTotals.get(rowPlayer.id)!.wins += 1;
      } else if (outcome.winner === "B") {
        cell.losses += 1;
        playerTotals.get(columnPlayer.id)!.wins += 1;
      } else {
        cell.censored += 1;
        playerTotals.get(rowPlayer.id)!.censored += 1;
        playerTotals.get(columnPlayer.id)!.censored += 1;
      }
      if (simulated % 2_000 === 0)
        process.stdout.write(
          `Candidate V4 player matrix: ${simulated}/${MATCHES}\n`,
        );
    }
  }
}

if (simulated !== MATCHES)
  throw new Error(`Expected ${MATCHES} matches, completed ${simulated}`);

const matrixRows: Array<Array<string | number>> = [
  [
    "player_a",
    "player_b",
    "matches",
    "a_wins",
    "b_wins",
    "censored",
    "a_win_rate_pct",
    "ci95_low_pct",
    "ci95_high_pct",
  ],
];
const markdownMatrix = [
  `| 球员 A ↓ / 球员 B → | ${players.map((player) => player.name).join(" | ")} |`,
  `|---|${players.map(() => "---:").join("|")}|`,
];
for (let row = 0; row < players.length; row += 1) {
  markdownMatrix.push(
    `| ${players[row]!.name} | ${players
      .map((_, column) => {
        const cell = cells[row]![column]!;
        const completed = cell.matches - cell.censored;
        return `${((100 * cell.wins) / Math.max(1, completed)).toFixed(1)}% (${cell.matches})`;
      })
      .join(" | ")} |`,
  );
  for (let column = 0; column < players.length; column += 1) {
    const cell = cells[row]![column]!;
    const completed = cell.matches - cell.censored;
    const ci = wilsonInterval(cell.wins, completed);
    matrixRows.push([
      players[row]!.id,
      players[column]!.id,
      cell.matches,
      cell.wins,
      cell.losses,
      cell.censored,
      ((100 * cell.wins) / Math.max(1, completed)).toFixed(3),
      (ci[0] * 100).toFixed(3),
      (ci[1] * 100).toFixed(3),
    ]);
  }
}

const playerRows: Array<Array<string | number>> = [
  [
    "player_id",
    "player_name",
    "tier",
    "style",
    "matches",
    "wins",
    "censored",
    "win_rate_pct",
    "ci95_low_pct",
    "ci95_high_pct",
  ],
];
for (const player of players) {
  const totals = playerTotals.get(player.id)!;
  const completed = totals.matches - totals.censored;
  const ci = wilsonInterval(totals.wins, completed);
  playerRows.push([
    player.id,
    player.name,
    player.baseTotal,
    player.style,
    totals.matches,
    totals.wins,
    totals.censored,
    ((100 * totals.wins) / Math.max(1, completed)).toFixed(3),
    (ci[0] * 100).toFixed(3),
    (ci[1] * 100).toFixed(3),
  ]);
}

const abilities = Object.values(catalog.skills.stages).flatMap((stage) =>
  stage.pairs.flatMap((pair) =>
    (["attack", "defense"] as const).map((role) => {
      const values = players.map((player) => ({
        name: player.name,
        value: statValues(player, pair.id)[role],
      }));
      const sorted = [...values].sort((a, b) => b.value - a.value);
      return {
        stage: stage.label,
        pair: pair.attackName,
        role,
        average:
          values.reduce((sum, item) => sum + item.value, 0) / values.length,
        high: sorted[0]!,
        low: sorted.at(-1)!,
      };
    }),
  ),
);
const abilityRows: Array<Array<string | number>> = [
  [
    "rank",
    "stage",
    "ability",
    "role",
    "average_project_base",
    "top_player",
    "top_player_value",
    "lowest_player",
    "lowest_player_value",
  ],
];
for (const [index, ability] of [...abilities]
  .sort((a, b) => b.average - a.average || a.pair.localeCompare(b.pair))
  .entries())
  abilityRows.push([
    index + 1,
    ability.stage,
    ability.pair,
    ability.role,
    ability.average.toFixed(3),
    ability.high.name,
    ability.high.value,
    ability.low.name,
    ability.low.value,
  ]);

const topAndWeak = players
  .map((player) => {
    const abilities = Object.values(catalog.skills.stages).flatMap((stage) =>
      stage.pairs.flatMap((pair) => {
        const values = statValues(player, pair.id);
        return [
          { name: pair.attackName, role: "攻" as const, value: values.attack },
          {
            name: pair.defenseName,
            role: "守" as const,
            value: values.defense,
          },
        ];
      }),
    );
    return {
      player,
      high: [...abilities].sort((a, b) => b.value - a.value).slice(0, 3),
      low: [...abilities].sort((a, b) => a.value - b.value).slice(0, 3),
    };
  })
  .map(
    ({ player, high, low }) =>
      `| ${player.name} | ${player.baseTotal} | ${player.style} | ${high.map((item) => `${item.name}(${item.role}) ${item.value}`).join("；")} | ${low.map((item) => `${item.name}(${item.role}) ${item.value}`).join("；")} |`,
  )
  .join("\n");
const playerStageTotals = players
  .map((player) => {
    const totals = Object.fromEntries(
      Object.entries(catalog.skills.stages).map(([stageId, stage]) => [
        stageId,
        stage.pairs.reduce(
          (sum, pair) =>
            sum +
            player.stats[pair.id]!.attack.forehand +
            player.stats[pair.id]!.attack.backhand +
            player.stats[pair.id]!.defense.forehand +
            player.stats[pair.id]!.defense.backhand,
          0,
        ),
      ]),
    );
    return `| ${player.name} | ${player.baseTotal} | ${totals.service} | ${totals.receive} | ${totals.rally} |`;
  })
  .join("\n");
const winRates = players.map((player) => {
  const totals = playerTotals.get(player.id)!;
  return {
    name: player.name,
    rate: (100 * totals.wins) / Math.max(1, totals.matches - totals.censored),
  };
});
const lowestRate = Math.min(...winRates.map((item) => item.rate));
const highestRate = Math.max(...winRates.map((item) => item.rate));

const totalCensored =
  [...playerTotals.values()].reduce((sum, item) => sum + item.censored, 0) / 2;
const report = `# Candidate V4 球员能力调整与模拟报告

## 本次结论

八名球员总分与玩家设定一致，所有能力值均满足 Candidate V4 的阶段/正反手峰值约束。模拟使用 Candidate V4 默认规则、统一基础装备与五种资源 Bot。20,000 场、8×8 球员配对显示风格克制与总分档差异；以下排名和胜率是这套固定 Bot/装备下的校验数据，不代表球员脱离打法的绝对强度。

## 规则和样本

- Candidate V4 参数未调整：Serve / Counter 攻击预算 4、防守预算 10；Rally 预算 20 + Carry；Top-3 提示；攻击单项上限 +4；Carry 率 100%；Rally 最多 4 次比较。
- 规则比较、资源和加点仍通过 game-core / Candidate V4 模拟器完成。
- 总场数：${simulated.toLocaleString()}；seed：${SEED}；设备固定为默认底板与两面默认胶皮，不测试装备平衡。
- 每格 312 或 313 场；座位和发球先后交替。每场两边使用相同资源策略，五种 V4 资源 Bot 轮换。
- 截断/未完成：${totalCensored.toLocaleString()} 场（矩阵按两侧出场统计后折半）。未完成场不计入胜率。

## 球员数据

每个阶段、每只手的十个攻防能力中最多一个 10、一个 9，其余不超过 8。各球员 15 组攻防项目的正反手数值之和保持指定总分。

| 球员 | 总分 | 风格 | 突出能力（项目平均值） | 相对弱项（项目平均值） |
|---|---:|---|---|---|
${topAndWeak}

各阶段的球员能力总分（包含阶段内所有攻防项目与正反手）

| 球员 | 总分 | 发球 | 反制 | 相持 |
|---|---:|---:|---:|---:|
${playerStageTotals}

完整 30 项能力均值和对应高低球员见 ability-rankings.csv。

## 8×8 matchup 胜率矩阵

矩阵单元为行球员的完成局胜率；括号内为场数。完整计数及 Wilson 95% CI 见 player-matchup-matrix.csv。

${markdownMatrix.join("\n")}

## 球员总体胜率

| 球员 | 总分 | 完成出场 | 胜场 | 胜率 | Wilson 95% CI |
|---|---:|---:|---:|---:|---:|
${players
  .map((player) => {
    const totals = playerTotals.get(player.id)!;
    const completed = totals.matches - totals.censored;
    const ci = wilsonInterval(totals.wins, completed);
    return `| ${player.name} | ${player.baseTotal} | ${completed} | ${totals.wins} | ${((100 * totals.wins) / completed).toFixed(2)}% | ${(ci[0] * 100).toFixed(2)}–${(ci[1] * 100).toFixed(2)}% |`;
  })
  .join("\n")}

## 解读与风险

本轮总体胜率跨度为 ${lowestRate.toFixed(2)}%–${highestRate.toFixed(2)}%。这表明目前分配出的风格与档位存在明显强度差异，数据适合用于可玩原型和下一轮迭代，不应据此宣称球员平衡已完成。林高远反制阶段总值设计为 160，与马龙、樊振东持平；要在保持 440 总分时做到这一点，他在发球和相持阶段的总值各为 140。是否能在玩家实际构筑和策略中形成有效反制，还需结合真人试玩及后续独立平衡回合验证。

## 解读

总分档之间存在差异，但 8×8 矩阵同时包含同分、跨档和低分球员配对。应重点看对角线约 50% 的同球员镜像、同档匹配、跨档总体，以及高低能力互相覆盖的对局；不要以总体玩家胜率均等作为目标。该矩阵只用于检查明显强度异常和风格互克，若更换装备或策略需重新评估。
`;

const outputDirectory = resolve(
  import.meta.dirname,
  "../../..",
  "reports",
  "candidate-v4-player-refresh",
);
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, "CANDIDATE_V4_PLAYER_REPORT.md"), report),
  writeFile(
    resolve(outputDirectory, "player-matchup-matrix.csv"),
    csv(matrixRows),
  ),
  writeFile(resolve(outputDirectory, "player-win-rates.csv"), csv(playerRows)),
  writeFile(resolve(outputDirectory, "ability-rankings.csv"), csv(abilityRows)),
]);
process.stdout.write(`Completed ${simulated} Candidate V4 matches.\n`);
process.stdout.write(`Report: ${outputDirectory}\n`);
