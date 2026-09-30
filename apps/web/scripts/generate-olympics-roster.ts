import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Player } from "@paddle-tactics/game-data/schema";

type SeedTier = 1 | 2 | 3 | 4;
type RosterSeed = {
  id: string;
  name: string;
  country: string;
  tier: SeedTier;
  sourceId: string;
  style: string;
};
type OlympicPlayer = Player & {
  country: string;
  seedTier: SeedTier;
  seedLabel: string;
  exclusiveToOlympics: boolean;
};

const SEED_LABELS: Record<SeedTier, string> = {
  1: "超级种子",
  2: "冠军级种子",
  3: "世界顶尖级",
  4: "强力挑战者",
};
const TIER_TOTALS: Record<SeedTier, number> = {
  1: 480,
  2: 470,
  3: 440,
  4: 410,
};
const sourceData = JSON.parse(
  await readFile(
    resolve(import.meta.dirname, "../../../data/players.json"),
    "utf8",
  ),
) as Player[];
const skillData = JSON.parse(
  await readFile(
    resolve(import.meta.dirname, "../../../data/skills.json"),
    "utf8",
  ),
) as { stages: Record<string, { pairs: Array<{ id: string }> }> };

const SEEDS: RosterSeed[] = [
  {
    id: "ma-long",
    name: "马龙",
    country: "中国",
    tier: 1,
    sourceId: "ma-long",
    style: "全面控制型 · 发接发与线路变化",
  },
  {
    id: "fan-zhendong",
    name: "樊振东",
    country: "中国",
    tier: 1,
    sourceId: "fan-zhendong",
    style: "正手爆发型 · 拉冲与相持压制",
  },
  {
    id: "zhang-jike",
    name: "张继科",
    country: "中国",
    tier: 1,
    sourceId: "zhang-jike",
    style: "前三板爆发型 · 发抢与二板进攻",
  },
  {
    id: "wang-chuqin",
    name: "王楚钦",
    country: "中国",
    tier: 1,
    sourceId: "wang-chuqin",
    style: "左右均衡型 · 快速衔接与连续进攻",
  },
  {
    id: "ma-lin",
    name: "马琳",
    country: "中国",
    tier: 1,
    sourceId: "xu-xin",
    style: "旋转控制型 · 台内变化与落点调动",
  },
  {
    id: "wang-liqin",
    name: "王励勤",
    country: "中国",
    tier: 1,
    sourceId: "fan-zhendong",
    style: "正手强攻型 · 质量与持续压迫",
  },
  {
    id: "wang-hao",
    name: "王皓",
    country: "中国",
    tier: 1,
    sourceId: "zhang-jike",
    style: "反手主导型 · 近台抢攻与快撕",
  },
  {
    id: "timo-boll",
    name: "波尔",
    country: "德国",
    tier: 1,
    sourceId: "ma-long",
    style: "弧圈控制型 · 旋转衔接与稳定相持",
  },

  {
    id: "jun-mizutani",
    name: "水谷隼",
    country: "日本",
    tier: 2,
    sourceId: "xu-xin",
    style: "旋转变化型 · 弧线控制与防反",
  },
  {
    id: "xu-xin",
    name: "许昕",
    country: "中国",
    tier: 2,
    sourceId: "xu-xin",
    style: "变化控制型 · 旋转、线路与防守反击",
  },
  {
    id: "vladimir-samsonov",
    name: "萨姆索诺夫",
    country: "白俄罗斯",
    tier: 2,
    sourceId: "ma-long",
    style: "稳定控制型 · 落点组织与连续衔接",
  },
  {
    id: "ryu-seung-min",
    name: "柳承敏",
    country: "韩国",
    tier: 2,
    sourceId: "fan-zhendong",
    style: "正手抢攻型 · 先上手与快速压制",
  },
  {
    id: "dimitrij-ovtcharov",
    name: "奥恰洛夫",
    country: "德国",
    tier: 2,
    sourceId: "wang-chuqin",
    style: "均衡反击型 · 反手拧拉与中台衔接",
  },
  {
    id: "hugo-calderano",
    name: "雨果·卡尔德拉诺",
    country: "巴西",
    tier: 2,
    sourceId: "fan-zhendong",
    style: "力量相持型 · 正反手转换与连续压迫",
  },
  {
    id: "truls-moregard",
    name: "莫雷加德",
    country: "瑞典",
    tier: 2,
    sourceId: "truls-moregard",
    style: "节奏破坏型 · 发球欺骗、变线与防反",
  },
  {
    id: "felix-lebrun",
    name: "菲利克斯·勒布伦",
    country: "法国",
    tier: 2,
    sourceId: "tomokazu-harimoto",
    style: "近台反手型 · 快速起板与主动变线",
  },

  {
    id: "lin-shidong",
    name: "林诗栋",
    country: "中国",
    tier: 3,
    sourceId: "fan-zhendong",
    style: "近台强攻型 · 快速衔接与反手压迫",
  },
  {
    id: "kristian-karlsson",
    name: "卡尔松",
    country: "瑞典",
    tier: 3,
    sourceId: "wang-chuqin",
    style: "均衡进攻型 · 发接发与连续抢攻",
  },
  {
    id: "tomokazu-harimoto",
    name: "张本智和",
    country: "日本",
    tier: 3,
    sourceId: "tomokazu-harimoto",
    style: "反手近台压迫型 · 接发反应与快速相持",
  },
  {
    id: "joo-sae-hyuk",
    name: "朱世赫",
    country: "韩国",
    tier: 3,
    sourceId: "xu-xin",
    style: "防守反击型 · 变化控制与反手转守为攻",
  },
  {
    id: "lin-yun-ju",
    name: "林昀儒",
    country: "中国台北",
    tier: 3,
    sourceId: "tomokazu-harimoto",
    style: "反手速度型 · 近台抢攻与落点转换",
  },
  {
    id: "liang-jingkun",
    name: "梁靖崑",
    country: "中国",
    tier: 3,
    sourceId: "fan-zhendong",
    style: "正手冲击型 · 连续拉冲与中台相持",
  },
  {
    id: "lin-gaoyuan",
    name: "林高远",
    country: "中国",
    tier: 3,
    sourceId: "lin-gaoyuan",
    style: "快攻均衡型 · 反手抢先与线路变化",
  },
  {
    id: "fang-bo",
    name: "方博",
    country: "中国",
    tier: 3,
    sourceId: "fan-zhendong",
    style: "正手进攻型 · 发球抢攻与连续进攻",
  },

  {
    id: "chuang-chih-yuan",
    name: "庄智渊",
    country: "中国台北",
    tier: 4,
    sourceId: "xu-xin",
    style: "台内控制型 · 变化落点与稳健衔接",
  },
  {
    id: "sora-matsushima",
    name: "松岛辉空",
    country: "日本",
    tier: 4,
    sourceId: "tomokazu-harimoto",
    style: "近台速度型 · 快速反手与主动上手",
  },
  {
    id: "dang-qiu",
    name: "邱党",
    country: "德国",
    tier: 4,
    sourceId: "truls-moregard",
    style: "前三板变化型 · 发球组织与节奏切换",
  },
  {
    id: "patrick-franziska",
    name: "弗朗西斯卡",
    country: "德国",
    tier: 4,
    sourceId: "ma-long",
    style: "全面衔接型 · 稳定防守与反击",
  },
  {
    id: "alexis-lebrun",
    name: "亚历克西斯·勒布伦",
    country: "法国",
    tier: 4,
    sourceId: "tomokazu-harimoto",
    style: "快速进攻型 · 反手起板与近台压迫",
  },
  {
    id: "koki-niwa",
    name: "丹羽孝希",
    country: "日本",
    tier: 4,
    sourceId: "xu-xin",
    style: "台内变化型 · 接发控制与突然变线",
  },
  {
    id: "anton-kallberg",
    name: "卡尔伯格",
    country: "瑞典",
    tier: 4,
    sourceId: "truls-moregard",
    style: "均衡反击型 · 防守稳定与主动衔接",
  },
  {
    id: "maharu-yoshimura",
    name: "吉村真晴",
    country: "日本",
    tier: 4,
    sourceId: "fan-zhendong",
    style: "正手突击型 · 发球抢攻与强势相持",
  },
];

function hash(value: string): number {
  let result = 0x811c9dc5;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
}

function cells(player: Player) {
  return Object.entries(player.stats).flatMap(([pairId, roles]) =>
    (["attack", "defense"] as const).flatMap((role) =>
      (["forehand", "backhand"] as const).map((side) => ({
        pairId,
        role,
        side,
        key: `${pairId}.${role}.${side}`,
        value: roles[role][side],
      })),
    ),
  );
}

function varyProfile(player: Player, salt: string): Player {
  const copy = structuredClone(player);
  const list = cells(copy);
  let state = hash(salt);
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
  for (const stage of Object.values(skillData.stages)) {
    const pairIds = new Set(stage.pairs.map((pair) => pair.id));
    for (const side of ["forehand", "backhand"] as const) {
      const group = list.filter(
        (cell) =>
          pairIds.has(cell.pairId) && cell.side === side && cell.value <= 8,
      );
      for (let move = 0; move < 2; move += 1) {
        const recipients = group.filter((cell) => cell.value < 8);
        const donors = group.filter((cell) => cell.value > 5);
        if (recipients.length === 0 || donors.length === 0) break;
        const recipient = recipients[Math.floor(random() * recipients.length)]!;
        const availableDonors = donors.filter(
          (cell) => cell.key !== recipient.key,
        );
        if (availableDonors.length === 0) break;
        const donor =
          availableDonors[Math.floor(random() * availableDonors.length)]!;
        copy.stats[recipient.pairId]![recipient.role][recipient.side] += 1;
        copy.stats[donor.pairId]![donor.role][donor.side] -= 1;
        recipient.value += 1;
        donor.value -= 1;
      }
    }
  }
  return copy;
}

function assertCandidateV4Profile(player: Player): void {
  for (const [stageId, stage] of Object.entries(skillData.stages)) {
    for (const side of ["forehand", "backhand"] as const) {
      const values = stage.pairs.flatMap((pair) => [
        player.stats[pair.id]!.attack[side],
        player.stats[pair.id]!.defense[side],
      ]);
      if (
        values.filter((value) => value === 10).length > 1 ||
        values.filter((value) => value === 9).length > 1 ||
        values.some(
          (value) => value < 5 || (value > 8 && value !== 9 && value !== 10),
        )
      )
        throw new Error(
          `${player.id} violates Candidate V4 ${stageId}/${side} peak constraints`,
        );
    }
  }
}

function retargetTotal(player: Player, total: number, salt: string): Player {
  const copy = structuredClone(player);
  copy.baseTotal = total;
  let remainder =
    total - cells(copy).reduce((sum, cell) => sum + cell.value, 0);
  const order = cells(copy).sort((a, b) => {
    const delta = hash(`${salt}:${a.key}`) - hash(`${salt}:${b.key}`);
    return delta || a.key.localeCompare(b.key);
  });
  while (remainder !== 0) {
    let changed = false;
    for (const cell of order) {
      const current = copy.stats[cell.pairId]![cell.role][cell.side];
      if (remainder > 0 && current < 8) {
        copy.stats[cell.pairId]![cell.role][cell.side] += 1;
        remainder -= 1;
        changed = true;
      } else if (remainder < 0 && current > 5 && current <= 8) {
        copy.stats[cell.pairId]![cell.role][cell.side] -= 1;
        remainder += 1;
        changed = true;
      }
      if (remainder === 0) break;
    }
    if (!changed)
      throw new Error(`${player.id} cannot reach tier total ${total}`);
  }
  return copy;
}

const entries: OlympicPlayer[] = SEEDS.map((seed) => {
  const source = sourceData.find((player) => player.id === seed.sourceId);
  if (!source) throw new Error(`Missing profile source ${seed.sourceId}`);
  const isStandardRoster = seed.sourceId === seed.id;
  const profile = isStandardRoster
    ? structuredClone(source)
    : varyProfile(source, seed.id);
  const player = retargetTotal(profile, TIER_TOTALS[seed.tier], seed.id);
  assertCandidateV4Profile(player);
  player.id = seed.id;
  player.name = seed.name;
  player.style = seed.style;
  const values = cells(player).map((cell) => cell.value);
  if (Math.min(...values) < 5 || Math.max(...values) > 10)
    throw new Error(`${seed.id} has a stat outside the allowed 5..15 range`);
  return {
    ...player,
    country: seed.country,
    seedTier: seed.tier,
    seedLabel: SEED_LABELS[seed.tier],
    exclusiveToOlympics: !isStandardRoster,
  };
});

for (const tier of [1, 2, 3, 4] as const) {
  const tierPlayers = entries.filter((player) => player.seedTier === tier);
  if (tierPlayers.length !== 8)
    throw new Error(
      `Tier ${tier} has ${tierPlayers.length} players, expected 8`,
    );
  if (tierPlayers.some((player) => player.baseTotal !== TIER_TOTALS[tier]))
    throw new Error(`Tier ${tier} has an unexpected base total`);
}
if (
  entries.length !== 32 ||
  new Set(entries.map((player) => player.id)).size !== 32
)
  throw new Error("Olympics roster must have 32 unique players");

const outputPath = resolve(
  import.meta.dirname,
  "../../../data/olympics-roster-v4.json",
);
await mkdir(resolve(outputPath, ".."), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ version: "olympics-roster-v4", tierTotals: TIER_TOTALS, players: entries }, null, 2)}\n`,
);
process.stdout.write(
  `Generated ${entries.length} Olympic players at ${outputPath}\n`,
);
