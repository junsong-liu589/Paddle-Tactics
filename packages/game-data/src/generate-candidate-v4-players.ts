import { copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type PlayerSource = {
  id: string;
  name: string;
  style: string;
  baseTotal: number;
};
type Pair = { id: string };
type SkillData = {
  stages: Record<"service" | "receive" | "rally", { pairs: Pair[] }>;
};
type PlayerData = PlayerSource & {
  stats: Record<
    string,
    {
      attack: { forehand: number; backhand: number };
      defense: { forehand: number; backhand: number };
    }
  >;
};

const root = resolve(import.meta.dirname, "../../..");
const playerPath = resolve(root, "data/players.json");
const previousPath = resolve(root, "data/players-balance-v1.1.json");
const validationPath = resolve(root, "data/validation-report.json");
const previousValidationPath = resolve(
  root,
  "data/validation-report-balance-v1.1.json",
);
const skillPath = resolve(root, "data/skills.json");

const profiles: Record<
  string,
  {
    style: string;
    strengths: string[];
    weaknesses: string[];
    weaknessStageOrder?: Array<"service" | "receive" | "rally">;
    stageReductionTargets?: Partial<
      Record<"service" | "receive" | "rally", number>
    >;
  }
> = {
  "ma-long": {
    style: "全能控制型 · 落点、变化与防守反击",
    strengths: [
      "service_variation.attack.forehand",
      "service_placement.attack.backhand",
      "service_spin.defense.forehand",
      "service_variation.defense.backhand",
      "receive_variation.defense.forehand",
      "deep_push.defense.backhand",
      "short_push.attack.forehand",
      "flip.defense.backhand",
      "line_change.attack.forehand",
      "counterattack.defense.backhand",
      "rally_exchange.attack.forehand",
      "continuous_attack.defense.backhand",
    ],
    weaknesses: [
      "service_speed.attack.backhand",
      "service_deception.attack.forehand",
      "flick.attack.backhand",
      "flip.attack.forehand",
      "loop_drive.attack.backhand",
      "continuous_attack.attack.forehand",
    ],
  },
  "fan-zhendong": {
    style: "正手爆破型 · 拉冲与相持连续压制",
    strengths: [
      "service_speed.attack.forehand",
      "service_spin.attack.forehand",
      "service_placement.defense.backhand",
      "service_deception.defense.forehand",
      "flick.attack.backhand",
      "receive_variation.attack.forehand",
      "short_push.defense.backhand",
      "deep_push.attack.forehand",
      "loop_drive.attack.forehand",
      "continuous_attack.attack.backhand",
      "rally_exchange.attack.forehand",
      "counterattack.defense.backhand",
    ],
    weaknesses: [
      "service_variation.defense.backhand",
      "flip.defense.forehand",
      "deep_push.defense.backhand",
      "line_change.defense.forehand",
      "counterattack.attack.backhand",
    ],
  },
  "zhang-jike": {
    style: "前三板爆发型 · 发抢、拧拉与二板进攻",
    strengths: [
      "service_deception.attack.forehand",
      "service_variation.attack.backhand",
      "service_spin.attack.forehand",
      "service_placement.defense.backhand",
      "flick.attack.backhand",
      "flip.attack.forehand",
      "receive_variation.attack.backhand",
      "short_push.defense.forehand",
      "loop_drive.attack.forehand",
      "line_change.attack.backhand",
      "counterattack.attack.forehand",
      "rally_exchange.defense.backhand",
    ],
    weaknesses: [
      "service_speed.defense.backhand",
      "deep_push.defense.backhand",
      "rally_exchange.attack.backhand",
      "continuous_attack.attack.backhand",
      "continuous_attack.defense.forehand",
      "loop_drive.defense.backhand",
    ],
  },
  "wang-chuqin": {
    style: "高速综合进攻型 · 两面先手与高风险压迫",
    strengths: [
      "service_speed.attack.forehand",
      "service_placement.attack.backhand",
      "service_variation.attack.forehand",
      "service_spin.defense.backhand",
      "flick.attack.backhand",
      "receive_variation.attack.forehand",
      "deep_push.attack.backhand",
      "flip.defense.forehand",
      "loop_drive.attack.forehand",
      "line_change.attack.backhand",
      "continuous_attack.attack.forehand",
      "rally_exchange.attack.backhand",
    ],
    weaknesses: [
      "service_deception.attack.backhand",
      "short_push.defense.forehand",
      "deep_push.defense.backhand",
      "counterattack.defense.backhand",
      "continuous_attack.defense.backhand",
    ],
  },
  "xu-xin": {
    style: "变化控制型 · 旋转、线路与防守反击",
    strengths: [
      "service_spin.attack.forehand",
      "service_deception.attack.backhand",
      "service_variation.defense.forehand",
      "service_placement.defense.backhand",
      "short_push.attack.forehand",
      "receive_variation.defense.backhand",
      "deep_push.defense.forehand",
      "flip.defense.backhand",
      "counterattack.defense.forehand",
      "rally_exchange.defense.backhand",
      "line_change.defense.forehand",
      "loop_drive.defense.backhand",
    ],
    weaknesses: [
      "service_speed.attack.forehand",
      "flick.attack.backhand",
      "deep_push.attack.forehand",
      "loop_drive.attack.forehand",
      "continuous_attack.attack.backhand",
      "rally_exchange.attack.forehand",
    ],
  },
  "tomokazu-harimoto": {
    style: "反手近台压迫型 · 接发反应与快速相持",
    strengths: [
      "service_speed.defense.backhand",
      "service_placement.defense.backhand",
      "service_spin.attack.backhand",
      "service_variation.defense.forehand",
      "flick.attack.backhand",
      "flip.attack.backhand",
      "receive_variation.attack.backhand",
      "short_push.defense.backhand",
      "rally_exchange.attack.backhand",
      "continuous_attack.attack.backhand",
      "counterattack.defense.forehand",
      "loop_drive.defense.backhand",
    ],
    weaknesses: [
      "service_deception.attack.forehand",
      "deep_push.attack.forehand",
      "flip.attack.forehand",
      "loop_drive.attack.forehand",
      "line_change.attack.forehand",
    ],
  },
  "truls-moregard": {
    style: "节奏破坏型 · 发球欺骗、变线与防反",
    strengths: [
      "service_deception.attack.forehand",
      "service_variation.attack.backhand",
      "service_variation.defense.forehand",
      "service_placement.defense.backhand",
      "receive_variation.attack.forehand",
      "flip.attack.backhand",
      "short_push.defense.backhand",
      "deep_push.defense.forehand",
      "line_change.attack.forehand",
      "line_change.defense.backhand",
      "counterattack.defense.forehand",
      "rally_exchange.defense.backhand",
    ],
    weaknesses: [
      "service_speed.attack.forehand",
      "service_speed.defense.backhand",
      "deep_push.attack.forehand",
      "loop_drive.attack.backhand",
      "continuous_attack.attack.forehand",
    ],
  },
  "lin-gaoyuan": {
    style: "反制大师 · 摆短、劈长与接发控制",
    strengths: [
      "service_variation.defense.forehand",
      "service_spin.defense.backhand",
      "service_placement.defense.forehand",
      "service_deception.defense.backhand",
      "short_push.defense.forehand",
      "deep_push.defense.backhand",
      "flick.defense.forehand",
      "flip.defense.backhand",
      "receive_variation.defense.forehand",
      "short_push.attack.backhand",
      "counterattack.defense.backhand",
      "rally_exchange.defense.forehand",
    ],
    weaknesses: [
      "service_speed.attack.forehand",
      "service_deception.attack.backhand",
      "loop_drive.attack.forehand",
      "continuous_attack.attack.backhand",
      "line_change.attack.forehand",
    ],
    weaknessStageOrder: ["service", "rally", "receive"],
    stageReductionTargets: { service: 26, receive: 6, rally: 26 },
  },
};

const pairOrder = new Map<string, number>();
const source = JSON.parse(await readFile(playerPath, "utf8")) as PlayerSource[];
const skills = JSON.parse(await readFile(skillPath, "utf8")) as SkillData;
for (const stage of Object.values(skills.stages))
  for (const [index, pair] of stage.pairs.entries())
    pairOrder.set(pair.id, index);

// Keep the original roster as an explicit data snapshot before promotion.
try {
  await readFile(previousPath);
} catch {
  await copyFile(playerPath, previousPath);
}
try {
  await readFile(previousValidationPath);
} catch {
  await copyFile(validationPath, previousValidationPath);
}

const players: PlayerData[] = source.map((player) => {
  const profile = profiles[player.id];
  if (!profile) throw new Error(`No Candidate V4 profile for ${player.id}`);
  const stats: PlayerData["stats"] = {};
  for (const stageId of ["service", "receive", "rally"] as const) {
    const pairs = skills.stages[stageId].pairs;
    for (const pair of pairs) {
      stats[pair.id] = {
        attack: { forehand: 8, backhand: 8 },
        defense: { forehand: 8, backhand: 8 },
      };
    }
  }

  const allKeys = Object.keys(stats).flatMap((pairId) =>
    (["attack", "defense"] as const).flatMap((role) =>
      (["forehand", "backhand"] as const).map(
        (side) => `${pairId}.${role}.${side}`,
      ),
    ),
  );
  const peakKeys = new Set<string>();
  for (const stageId of ["service", "receive", "rally"] as const) {
    for (const side of ["forehand", "backhand"] as const) {
      const group = skills.stages[stageId].pairs.flatMap(({ id }) =>
        (["attack", "defense"] as const).map((role) => `${id}.${role}.${side}`),
      );
      const ordered = [...group].sort((a, b) => {
        const aIndex = profile.strengths.indexOf(a);
        const bIndex = profile.strengths.indexOf(b);
        const aRank = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
        const bRank = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
        return (
          aRank - bRank ||
          pairOrder.get(a.split(".")[0]!)! - pairOrder.get(b.split(".")[0]!)! ||
          a.localeCompare(b)
        );
      });
      const ten = ordered[0]!;
      const nine = ordered[1]!;
      const setValue = (key: string, value: number) => {
        const [pairId, role, hand] = key.split(".") as [
          string,
          "attack" | "defense",
          "forehand" | "backhand",
        ];
        stats[pairId]![role][hand] = value;
      };
      setValue(ten, 10);
      setValue(nine, 9);
      peakKeys.add(ten);
      peakKeys.add(nine);
    }
  }

  const values = (key: string) => {
    const [pairId, role, hand] = key.split(".") as [
      string,
      "attack" | "defense",
      "forehand" | "backhand",
    ];
    return stats[pairId]![role][hand];
  };
  let reduction =
    allKeys.reduce((total, key) => total + values(key), 0) - player.baseTotal;
  const weaknessRank = (key: string) => {
    const index = profile.weaknesses.indexOf(key);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  const reducible = allKeys
    .filter((key) => !peakKeys.has(key))
    .sort(
      (a, b) =>
        weaknessRank(a) - weaknessRank(b) ||
        pairOrder.get(a.split(".")[0]!)! - pairOrder.get(b.split(".")[0]!)! ||
        a.localeCompare(b),
    );
  // Turn the roster budget into explicit style trade-offs while preserving
  // any deliberate per-stage budget profile.
  const preferredWeaknesses = profile.weaknesses.filter((key) =>
    reducible.includes(key),
  );
  if (profile.stageReductionTargets) {
    for (const [stageId, amount] of Object.entries(
      profile.stageReductionTargets,
    ) as Array<["service" | "receive" | "rally", number]>) {
      const pairIds = new Set(skills.stages[stageId].pairs.map(({ id }) => id));
      const group = reducible
        .filter((key) => pairIds.has(key.split(".")[0]!))
        .sort(
          (a, b) =>
            weaknessRank(a) - weaknessRank(b) ||
            pairOrder.get(a.split(".")[0]!)! - pairOrder.get(b.split(".")[0]!)!,
        );
      let remaining = amount;
      let cursor = 0;
      while (remaining > 0) {
        let inspected = 0;
        while (
          inspected < group.length &&
          values(group[cursor % group.length]!) <= 5
        ) {
          cursor = (cursor + 1) % group.length;
          inspected += 1;
        }
        const key = group[cursor % group.length];
        if (!key || inspected === group.length)
          throw new Error(
            `Cannot reach stage target for ${player.id}.${stageId}`,
          );
        const [pairId, role, hand] = key.split(".") as [
          string,
          "attack" | "defense",
          "forehand" | "backhand",
        ];
        stats[pairId]![role][hand] -= 1;
        cursor = (cursor + 1) % group.length;
        remaining -= 1;
        reduction -= 1;
      }
    }
  } else {
    for (const key of preferredWeaknesses) {
      while (reduction > 0 && values(key) > 5) {
        const [pairId, role, hand] = key.split(".") as [
          string,
          "attack" | "defense",
          "forehand" | "backhand",
        ];
        stats[pairId]![role][hand] -= 1;
        reduction -= 1;
      }
    }
  }
  if (reduction > 0) {
    const stageOrder = profile.weaknessStageOrder ?? [
      "service",
      "receive",
      "rally",
    ];
    const stageGroups = stageOrder.map((stageId) => {
      const pairIds = new Set(skills.stages[stageId].pairs.map(({ id }) => id));
      return reducible.filter(
        (key) =>
          !preferredWeaknesses.includes(key) && pairIds.has(key.split(".")[0]!),
      );
    });
    const stageCursors = stageGroups.map(() => 0);
    while (reduction > 0) {
      let changed = false;
      for (const [groupIndex, group] of stageGroups.entries()) {
        if (group.length === 0) continue;
        const cursor = stageCursors[groupIndex]! % group.length;
        const relativeIndex = group
          .slice(cursor)
          .findIndex((candidate) => values(candidate) > 5);
        const index =
          relativeIndex >= 0
            ? (cursor + relativeIndex) % group.length
            : group.findIndex((candidate) => values(candidate) > 5);
        const key = group[index];
        if (!key) continue;
        const [pairId, role, hand] = key.split(".") as [
          string,
          "attack" | "defense",
          "forehand" | "backhand",
        ];
        stats[pairId]![role][hand] -= 1;
        stageCursors[groupIndex] = (index + 1) % group.length;
        reduction -= 1;
        changed = true;
        if (reduction === 0) break;
      }
      if (!changed) throw new Error(`Cannot reach total for ${player.id}`);
    }
  }
  if (reduction !== 0) throw new Error(`Cannot reach total for ${player.id}`);

  return { ...player, style: profile.style, stats };
});

await writeFile(playerPath, `${JSON.stringify(players, null, 2)}\n`, "utf8");
const validation = players.map((player) => {
  const computedTotal = Object.values(player.stats).reduce(
    (sum, entry) =>
      sum +
      entry.attack.forehand +
      entry.attack.backhand +
      entry.defense.forehand +
      entry.defense.backhand,
    0,
  );
  return {
    player: player.name,
    declaredTotal: player.baseTotal,
    computedTotal,
    ok: computedTotal === player.baseTotal,
  };
});
await writeFile(
  validationPath,
  `${JSON.stringify(validation, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `Generated ${players.length} Candidate V4 player profiles.\n`,
);
