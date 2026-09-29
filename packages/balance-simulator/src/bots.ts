import type {
  Allocation,
  MatchPublicView,
  ProjectBattleValues,
  Stage,
} from "@paddle-tactics/game-core";
import { allocationSkillKey } from "@paddle-tactics/game-core";
import type { GameRulesCatalog } from "@paddle-tactics/game-core";
import type { Random } from "./random.js";

export const HISTORICAL_BOT_POLICIES = [
  "RandomBot",
  "BalancedBot",
  "FortressBot",
  "GreedyAttackBot",
  "WeaknessHunterBot",
  "Top3AwareDefenseBot",
  "AdaptiveBot",
  "BluffDefenseBot",
] as const;
export const V4_RESOURCE_POLICIES = [
  "SaveForRallyBot",
  "AllInEarlyBot",
  "MinimumNeededBot",
  "BalancedReserveBot",
  "SpendAllBot",
] as const;
export const BOT_POLICIES = [
  ...HISTORICAL_BOT_POLICIES,
  ...V4_RESOURCE_POLICIES,
] as const;
export type BotPolicy = (typeof BOT_POLICIES)[number];
export type HistoricalBotPolicy = (typeof HISTORICAL_BOT_POLICIES)[number];

export type RevealedDefense = Map<string, number>;

function distribute(
  keys: string[],
  total: number,
  cap: number | null,
  weights: number[],
  random: Random,
): Allocation {
  const allocation: Allocation = Object.fromEntries(
    keys.map((key) => [key, 0]),
  );
  for (let remaining = total; remaining > 0; remaining -= 1) {
    const eligible = keys
      .map((key, index) => ({ key, index }))
      .filter(({ key }) => cap === null || allocation[key]! < cap);
    if (eligible.length === 0) throw new Error("Allocation exceeds legal cap");
    const candidates = eligible.map(({ key, index }) => ({
      key,
      weight: Math.max(0.01, weights[index] ?? 1),
    }));
    const sum = candidates.reduce((value, item) => value + item.weight, 0);
    let target = random() * sum;
    const chosen = candidates.find((item) => (target -= item.weight) < 0)!;
    allocation[chosen.key] = allocation[chosen.key]! + 1;
  }
  return allocation;
}

function getWeights(
  policy: BotPolicy,
  own: ProjectBattleValues,
  opponent: ProjectBattleValues,
  keys: string[],
  revealed: RevealedDefense,
): number[] {
  if (policy === "RandomBot" || policy === "BalancedBot")
    return keys.map(() => 1);
  return keys.map((key, index) => {
    const [pairId] = key.split(".");
    const isAttack = key.endsWith(".attack");
    const attack = own[pairId!]?.attack ?? 0;
    const defense = own[pairId!]?.defense ?? 0;
    const likelyAttack = opponent[pairId!]?.attack ?? 0;
    if (policy === "FortressBot")
      return isAttack ? 0.1 : index % 2 === 1 ? 4 : 0.6;
    if (policy === "BluffDefenseBot")
      return isAttack ? 0.15 : 0.4 + likelyAttack * likelyAttack * 0.1;
    if (policy === "WeaknessHunterBot")
      return isAttack ? 1 + attack * 0.2 : 0.5 + Math.max(0, 12 - defense);
    if (policy === "AdaptiveBot") {
      if (isAttack) return 1 + attack * 0.15;
      const prior = revealed.get(pairId!);
      return (
        0.5 +
        (prior === undefined
          ? Math.max(0, 11 - defense)
          : Math.max(0, 10 - prior))
      );
    }
    return isAttack ? 1 + attack * 0.1 : 1;
  });
}

export function allocateForCore(
  policy: BotPolicy,
  view: MatchPublicView,
  catalog: GameRulesCatalog,
  stage: Stage,
  revealed: RevealedDefense,
  random: Random,
): Allocation {
  const stageRule = catalog.skills.stages[stage];
  const attackerId = view.point.attackerPlayerId;
  const role = view.self.id === attackerId ? "attack" : "defense";
  if (view.rulesetId === "candidate_v4") {
    const keys =
      stage === "rally"
        ? stageRule.pairs.flatMap((pair) => [
            allocationSkillKey(pair.id, "attack"),
            allocationSkillKey(pair.id, "defense"),
          ])
        : stageRule.pairs.map((pair) => allocationSkillKey(pair.id, role));
    const result: Allocation = Object.fromEntries(keys.map((key) => [key, 0]));
    const budget = view.availableBudget;
    const attacks = keys.filter((key) => key.endsWith(".attack"));
    const defenses = keys.filter((key) => key.endsWith(".defense"));
    const explore =
      policy !== "RandomBot" && random() < view.explorationEpsilon;
    if (stage !== "rally" && role === "attack") {
      if (policy === "SaveForRallyBot") return result;
      const ranked = stageRule.pairs
        .map((pair) => ({
          pairId: pair.id,
          score:
            (view.self.projectBattleValues[pair.id]?.attack ?? 0) -
            (view.opponent.projectBattleValues[pair.id]?.defense ?? 0),
        }))
        .sort((a, b) => b.score - a.score || a.pairId.localeCompare(b.pairId));
      const chosen = ranked[0]!;
      const threshold = stageRule.directWinThreshold;
      const minimum = Math.max(
        0,
        Math.min(4, Math.ceil(threshold - chosen.score)),
      );
      const spend = explore
        ? Math.floor(random() * 5)
        : policy === "MinimumNeededBot"
          ? minimum
          : policy === "BalancedReserveBot"
            ? Math.min(2, budget)
            : policy === "AllInEarlyBot" || policy === "SpendAllBot"
              ? Math.min(4, budget)
              : Math.min(4, Math.floor(budget / 2));
      result[allocationSkillKey(chosen.pairId, "attack")] = spend;
      return result;
    }
    if (stage !== "rally" && role === "defense") {
      const spend = explore
        ? Math.floor(random() * (budget + 1))
        : policy === "SaveForRallyBot"
          ? 0
          : policy === "BalancedReserveBot"
            ? Math.floor(budget * 0.6)
            : policy === "MinimumNeededBot"
              ? Math.floor(budget * 0.75)
              : budget;
      const weights = explore
        ? defenses.map(() => 1)
        : getWeights(
            policy,
            view.self.projectBattleValues,
            view.opponent.projectBattleValues,
            defenses,
            revealed,
          );
      return distribute(defenses, spend, null, weights, random);
    }
    const desiredSpend = explore
      ? Math.floor(random() * (budget + 1))
      : policy === "MinimumNeededBot"
        ? Math.floor(budget * 0.85)
        : policy === "BalancedReserveBot"
          ? Math.floor(budget * 0.75)
          : budget;
    const attackSpend = Math.min(20, Math.floor(desiredSpend * 0.45));
    const attackWeights = explore
      ? attacks.map(() => 1)
      : getWeights(
          policy,
          view.self.projectBattleValues,
          view.opponent.projectBattleValues,
          attacks,
          revealed,
        );
    const attackAllocation = distribute(
      attacks,
      attackSpend,
      4,
      attackWeights,
      random,
    );
    Object.assign(result, attackAllocation);
    const defenseSpend = Math.max(
      0,
      desiredSpend -
        Object.values(attackAllocation).reduce((sum, value) => sum + value, 0),
    );
    const defenseWeights = explore
      ? defenses.map(() => 1)
      : getWeights(
          policy,
          view.self.projectBattleValues,
          view.opponent.projectBattleValues,
          defenses,
          revealed,
        );
    Object.assign(
      result,
      distribute(defenses, defenseSpend, null, defenseWeights, random),
    );
    return result;
  }
  if (
    view.rulesetId === "candidate_v3" &&
    stage !== "rally" &&
    view.self.id === attackerId
  )
    return {};
  const keys =
    view.rulesetId === "candidate_v3"
      ? stageRule.pairs.map((pair) => allocationSkillKey(pair.id, "defense"))
      : stage === "rally"
        ? stageRule.pairs.flatMap((pair) => [
            allocationSkillKey(pair.id, "attack"),
            allocationSkillKey(pair.id, "defense"),
          ])
        : stageRule.pairs.map((pair) => allocationSkillKey(pair.id, role));
  const weights = getWeights(
    policy,
    view.self.projectBattleValues,
    view.opponent.projectBattleValues,
    keys,
    revealed,
  );
  if (policy === "FortressBot" && view.rulesetId === "candidate_v3") {
    const patterns = [
      [8, 0, 0, 0, 0],
      [6, 2, 0, 0, 0],
      [4, 4, 0, 0, 0],
      [5, 3, 0, 0, 0],
      [4, 2, 1, 1, 0],
      [2, 2, 2, 1, 1],
    ];
    const basePattern = patterns[Math.floor(random() * patterns.length)]!;
    const pattern = basePattern.map((value) =>
      Math.floor((value * view.defensePool) / 8),
    );
    let remainder =
      view.defensePool - pattern.reduce((sum, value) => sum + value, 0);
    for (let index = 0; remainder > 0; index += 1, remainder -= 1)
      pattern[index % pattern.length]! += 1;
    const ordered = [...keys].sort(
      (a, b) =>
        (weights[keys.indexOf(b)] ?? 0) - (weights[keys.indexOf(a)] ?? 0) ||
        a.localeCompare(b),
    );
    const result: Allocation = Object.fromEntries(keys.map((key) => [key, 0]));
    for (let index = 0; index < pattern.length; index += 1) {
      if (ordered[index]) result[ordered[index]!] = pattern[index]!;
    }
    const total = Object.values(result).reduce((sum, value) => sum + value, 0);
    if (total < view.defensePool)
      result[ordered[0]!] = result[ordered[0]!]! + view.defensePool - total;
    return result;
  }
  if (policy === "Top3AwareDefenseBot" && view.rulesetId === "candidate_v3") {
    const visible = new Map(
      (view.visibleAttackTop ?? []).map((item, index) => [item.pairId, index]),
    );
    for (let index = 0; index < keys.length; index += 1) {
      const pairId = keys[index]!.split(".")[0]!;
      const rank = visible.get(pairId);
      weights[index] = rank === undefined ? 0.05 : 12 - rank * 3;
    }
  }
  if (
    view.rulesetId === "candidate_v3" &&
    policy !== "RandomBot" &&
    random() < view.explorationEpsilon
  ) {
    return distribute(
      keys,
      view.defensePool,
      null,
      keys.map(() => 1),
      random,
    );
  }
  if (policy === "BalancedBot") {
    const budget =
      view.rulesetId === "candidate_v3" ? view.defensePool : stageRule.budget;
    const base = Math.floor(budget / keys.length);
    const result: Allocation = Object.fromEntries(
      keys.map((key) => [key, base]),
    );
    let remaining = budget - base * keys.length;
    for (let index = 0; remaining > 0; index = (index + 1) % keys.length) {
      if (
        stageRule.perItemCap === null ||
        result[keys[index]!]! < stageRule.perItemCap
      ) {
        result[keys[index]!] = result[keys[index]!]! + 1;
        remaining -= 1;
      }
    }
    return result;
  }
  return distribute(
    keys,
    view.rulesetId === "candidate_v3" ? view.defensePool : stageRule.budget,
    stageRule.perItemCap,
    weights,
    random,
  );
}

export function allocateDefense(
  policy: BotPolicy,
  stage: Stage,
  ownStats: ProjectBattleValues,
  opponentStats: ProjectBattleValues,
  catalog: GameRulesCatalog,
  pool: number,
  cap: number,
  revealed: RevealedDefense,
  random: Random,
): Allocation {
  const keys = catalog.skills.stages[stage].pairs.map((pair) =>
    allocationSkillKey(pair.id, "defense"),
  );
  if (policy === "BalancedBot") {
    const values = Object.fromEntries(keys.map((key) => [key, 0]));
    for (let remaining = pool; remaining > 0; remaining -= 1) {
      const key = keys.find((item) => values[item]! < cap)!;
      values[key] = values[key]! + 1;
    }
    return values;
  }
  return distribute(
    keys,
    pool,
    cap,
    getWeights(policy, ownStats, opponentStats, keys, revealed),
    random,
  );
}

export function choosePair(
  policy: BotPolicy,
  view: MatchPublicView,
  catalog: GameRulesCatalog,
  revealed: RevealedDefense,
  random: Random,
  stageOverride?: Stage,
): string {
  const stage = stageOverride ?? view.point.stage;
  const pairs = catalog.skills.stages[stage].pairs;
  if (view.rulesetId === "candidate_v4") {
    const invested = pairs
      .filter(
        (pair) =>
          (view.self.allocation?.[allocationSkillKey(pair.id, "attack")] ?? 0) >
          0,
      )
      .sort(
        (a, b) =>
          (view.self.allocation?.[allocationSkillKey(b.id, "attack")] ?? 0) -
            (view.self.allocation?.[allocationSkillKey(a.id, "attack")] ?? 0) ||
          a.id.localeCompare(b.id),
      );
    if (invested[0]) return invested[0].id;
  }
  if (policy === "RandomBot")
    return pairs[Math.floor(random() * pairs.length)]!.id;
  const opponentBase = view.opponent.projectBattleValues;
  const ownBase = view.self.projectBattleValues;
  const ranked = pairs.map((pair) => {
    const defense =
      revealed.get(pair.id) ?? opponentBase[pair.id]?.defense ?? 7;
    const attack =
      (ownBase[pair.id]?.attack ?? 0) +
      (view.rulesetId === "candidate_v4"
        ? (view.self.allocation?.[allocationSkillKey(pair.id, "attack")] ?? 0)
        : 0);
    const score =
      policy === "WeaknessHunterBot"
        ? -defense
        : policy === "AdaptiveBot"
          ? attack - defense + (revealed.has(pair.id) ? -2 : 0)
          : attack;
    return { id: pair.id, score };
  });
  ranked.sort((a, b) => b.score - a.score);
  if (view.rulesetId === "candidate_v3" && random() < view.explorationEpsilon) {
    const plausible = ranked.filter(
      (item) => item.score >= ranked[0]!.score - 1,
    );
    return plausible[Math.floor(random() * plausible.length)]!.id;
  }
  if (
    policy === "AdaptiveBot" &&
    revealed.has(ranked[0]!.id) &&
    ranked.length > 1
  ) {
    const unrevealed = ranked.find((item) => !revealed.has(item.id));
    if (unrevealed && random() < 0.65) return unrevealed.id;
  }
  const best = ranked.filter((item) => item.score === ranked[0]!.score);
  return best[Math.floor(random() * best.length)]!.id;
}

export function policyFor(seedRoll: number): HistoricalBotPolicy {
  return HISTORICAL_BOT_POLICIES[
    Math.floor(seedRoll * HISTORICAL_BOT_POLICIES.length)
  ]!;
}

export function v4PolicyFor(seedRoll: number): BotPolicy {
  return BOT_POLICIES[Math.floor(seedRoll * BOT_POLICIES.length)]!;
}

export function defenseSkillKey(pairId: string): string {
  return allocationSkillKey(pairId, "defense");
}
