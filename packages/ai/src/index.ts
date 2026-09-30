import { allocationSkillKey } from "@paddle-tactics/game-core";
import type {
  Allocation,
  DomainEvent,
  MatchPublicView,
  Stage,
} from "@paddle-tactics/game-core";
import type { SkillCatalog } from "@paddle-tactics/game-data";

export type AiDifficulty = "easy" | "normal" | "hard";
/** Experimental allocation profiles; they never change game rules or budgets. */
export type AiStrategyVariant =
  "current" | "balanced" | "aggressive" | "balanced-varied" | "wide-varied";
export type AiCatalog = Pick<SkillCatalog, "stages">;

export type AiDecisionInput = {
  view: MatchPublicView;
  skills: AiCatalog;
  difficulty: AiDifficulty;
  seed: number;
  strategy?: AiStrategyVariant;
};
type ComparisonEvent = Extract<DomainEvent, { type: "COMPARISON_REVEALED" }>;

const EPSILON: Record<AiDifficulty, number> = {
  easy: 0.32,
  normal: 0.12,
  hard: 0.025,
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

function stagePairs(input: AiDecisionInput, stage: Stage) {
  return input.skills.stages[stage].pairs;
}

function opponentAttackHistory(
  input: AiDecisionInput,
  stage: Stage,
): ComparisonEvent[] {
  return input.view.events
    .filter(
      (event): event is ComparisonEvent =>
        event.type === "COMPARISON_REVEALED" &&
        event.stage === stage &&
        event.attackerPlayerId === input.view.opponent.id,
    )
    .slice(-12);
}

function ourAttackHistory(
  input: AiDecisionInput,
  stage: Stage,
): ComparisonEvent[] {
  return input.view.events
    .filter(
      (event): event is ComparisonEvent =>
        event.type === "COMPARISON_REVEALED" &&
        event.stage === stage &&
        event.attackerPlayerId === input.view.self.id,
    )
    .slice(-12);
}

function recentPairWeight(
  pairId: string,
  history: ReturnType<typeof opponentAttackHistory>,
): number {
  let weight = 1;
  history.forEach((event, index) => {
    if (event.pairId === pairId) weight += 1 + index / history.length;
  });
  return weight;
}

function rankedAttackPairs(input: AiDecisionInput, stage: Stage) {
  const history = opponentAttackHistory(input, stage);
  return stagePairs(input, stage)
    .map((pair) => {
      const attack = input.view.self.projectBattleValues[pair.id]!.attack;
      const defense = input.view.opponent.projectBattleValues[pair.id]!.defense;
      const funded =
        (input.view.self.allocation?.[allocationSkillKey(pair.id, "attack")] ??
          0) * 0.8;
      const opponentTendency = recentPairWeight(pair.id, history);
      return {
        pair,
        score: attack - defense + funded + Math.log(opponentTendency) * 1.15,
      };
    })
    .sort((a, b) => b.score - a.score || a.pair.id.localeCompare(b.pair.id));
}

function rankedDefensePairs(input: AiDecisionInput, stage: Stage) {
  const history = opponentAttackHistory(input, stage);
  return stagePairs(input, stage)
    .map((pair) => {
      const threat = input.view.opponent.projectBattleValues[pair.id]!.attack;
      const defense = input.view.self.projectBattleValues[pair.id]!.defense;
      const visibleTopRank =
        input.view.visibleAttackTop?.findIndex(
          (item) => item.pairId === pair.id,
        ) ?? -1;
      const visibilityBonus =
        visibleTopRank >= 0 ? (3 - visibleTopRank) * 0.2 : 0;
      return {
        pair,
        score:
          threat -
          defense +
          Math.log(recentPairWeight(pair.id, history)) * 1.6 +
          visibilityBonus,
      };
    })
    .sort((a, b) => b.score - a.score || a.pair.id.localeCompare(b.pair.id));
}

function chooseRanked<T>(
  ranked: T[],
  score: (entry: T) => number,
  input: AiDecisionInput,
): T {
  const random = seededRandom(input.seed);
  if (input.difficulty === "easy")
    return ranked[Math.floor(random() * ranked.length)]!;
  const explorationRate =
    input.strategy === "wide-varied"
      ? 0.65
      : input.strategy === "balanced-varied"
        ? 0.35
        : EPSILON[input.difficulty];
  if (ranked.length > 1 && random() < explorationRate) {
    const topCount = Math.min(
      input.strategy === "wide-varied"
        ? 4
        : input.strategy === "balanced-varied"
          ? 3
          : 2,
      ranked.length,
    );
    return ranked[Math.floor(random() * topCount)]!;
  }
  const best = score(ranked[0]!);
  const nearBest = ranked.filter((entry) => best - score(entry) < 0.75);
  return nearBest[Math.floor(random() * nearBest.length)]!;
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const result = [...items];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function emptyAllocation(input: AiDecisionInput, stage: Stage): Allocation {
  const meAttacks = input.view.point.attackerPlayerId === input.view.self.id;
  const role = stage === "rally" ? null : meAttacks ? "attack" : "defense";
  const keys = stagePairs(input, stage).flatMap((pair) =>
    role === null
      ? [
          allocationSkillKey(pair.id, "attack"),
          allocationSkillKey(pair.id, "defense"),
        ]
      : [allocationSkillKey(pair.id, role)],
  );
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function recentOpponentAttackSpend(
  input: AiDecisionInput,
  stage: Stage,
): number {
  const events = opponentAttackHistory(input, stage);
  if (!events.length)
    return input.difficulty === "easy"
      ? 1
      : input.difficulty === "normal"
        ? 2
        : 3;
  return (
    events.reduce((sum, event) => sum + event.attack.temporary, 0) /
    events.length
  );
}

function allocateFocusedAttack(
  input: AiDecisionInput,
  allocation: Allocation,
  stage: Stage,
) {
  const target = chooseRanked(
    rankedAttackPairs(input, stage),
    (entry) => entry.score,
    input,
  );
  const own = input.view.self.projectBattleValues[target.pair.id]!.attack;
  const defense =
    input.view.opponent.projectBattleValues[target.pair.id]!.defense;
  const threshold = input.view.point.stage === "rally" ? 4 : 5;
  const alreadyFunded =
    input.view.self.allocation?.[
      allocationSkillKey(target.pair.id, "attack")
    ] ?? 0;
  const need = Math.max(
    0,
    Math.ceil(defense + threshold - own - alreadyFunded),
  );
  const random = seededRandom(input.seed);
  const spend =
    input.difficulty === "easy"
      ? Math.floor(random() * Math.min(5, input.view.availableBudget + 1))
      : input.difficulty === "normal"
        ? input.strategy && input.strategy !== "current"
          ? Math.min(4, need, input.view.availableBudget)
          : Math.min(2, need)
        : need === 0
          ? 0
          : Math.min(4, input.view.availableBudget);
  allocation[allocationSkillKey(target.pair.id, "attack")] = spend;
}

function allocateFocusedDefense(
  input: AiDecisionInput,
  allocation: Allocation,
  stage: Stage,
) {
  const ranked = rankedDefensePairs(input, stage);
  const target = chooseRanked(ranked, (entry) => entry.score, input);
  const attack =
    input.view.opponent.projectBattleValues[target.pair.id]!.attack;
  const defense = input.view.self.projectBattleValues[target.pair.id]!.defense;
  const expectedAttackSpend = recentOpponentAttackSpend(input, stage);
  const canSecureDefenderPoint = Math.ceil(
    attack + expectedAttackSpend + 5 - defense,
  );
  const canPreventAttackerPoint = Math.max(
    0,
    Math.floor(attack + expectedAttackSpend - defense - 5) + 1,
  );
  const budget = input.view.availableBudget;
  const usefulSpend =
    canSecureDefenderPoint <= budget
      ? canSecureDefenderPoint
      : canPreventAttackerPoint;
  const randomSpend = Math.floor(seededRandom(input.seed)() * (budget + 1));
  const spend =
    input.difficulty === "easy"
      ? randomSpend
      : input.difficulty === "hard"
        ? budget
        : input.strategy && input.strategy !== "current"
          ? Math.min(budget, usefulSpend)
          : Math.min(3, usefulSpend);
  allocation[allocationSkillKey(target.pair.id, "defense")] = Math.max(
    0,
    Math.min(budget, spend),
  );
}

function allocateRally(input: AiDecisionInput, allocation: Allocation) {
  const attackOrder = rankedAttackPairs(input, "rally");
  if (input.strategy && input.strategy !== "current") {
    const budget = input.view.availableBudget;
    const share = input.strategy === "aggressive" ? 0.55 : 0.4;
    let attackRemaining = Math.min(
      attackOrder.length * 4,
      Math.floor(budget * share),
    );
    for (const { pair } of attackOrder) {
      if (attackRemaining <= 0) break;
      const points = Math.min(4, attackRemaining);
      allocation[allocationSkillKey(pair.id, "attack")] = points;
      attackRemaining -= points;
    }
    const defenseRemaining =
      budget -
      (Math.min(attackOrder.length * 4, Math.floor(budget * share)) -
        attackRemaining);
    const defenseOrder = rankedDefensePairs(input, "rally");
    const defensePoints = Math.max(0, defenseRemaining);
    const leadingCount = Math.min(2, defenseOrder.length);
    const leadingShare = Math.floor(defensePoints * 0.65);
    let allocated = 0;
    for (let index = 0; index < leadingCount; index += 1) {
      const points =
        index === leadingCount - 1
          ? leadingShare - allocated
          : Math.floor(leadingShare / leadingCount);
      allocation[allocationSkillKey(defenseOrder[index]!.pair.id, "defense")] =
        points;
      allocated += points;
    }
    let remainder = defensePoints - allocated;
    for (const { pair } of defenseOrder) {
      if (remainder <= 0) break;
      const key = allocationSkillKey(pair.id, "defense");
      allocation[key] = (allocation[key] ?? 0) + 1;
      remainder -= 1;
    }
    return;
  }
  const choices =
    input.difficulty === "easy"
      ? shuffleWithSeed(attackOrder, input.seed + 1)
      : attackOrder;
  const attackBudget = Math.min(4, input.view.availableBudget);
  let attackRemaining = attackBudget;
  const attackCount = input.difficulty === "hard" ? 1 : 2;
  for (const { pair } of choices.slice(0, attackCount)) {
    if (attackRemaining <= 0) break;
    const points =
      input.difficulty === "hard"
        ? attackRemaining
        : Math.min(attackRemaining, 1);
    allocation[allocationSkillKey(pair.id, "attack")] = points;
    attackRemaining -= points;
  }

  let defenseRemaining =
    input.view.availableBudget - (attackBudget - attackRemaining);
  const defenseRanked = rankedDefensePairs(input, "rally");
  const defenseOrder =
    input.difficulty === "easy"
      ? shuffleWithSeed(defenseRanked, input.seed + 2)
      : defenseRanked;
  const defenseLimit =
    input.difficulty === "easy"
      ? Math.min(3, defenseOrder.length)
      : input.difficulty === "hard"
        ? Math.min(3, defenseOrder.length)
        : defenseOrder.length;
  const selected = defenseOrder.slice(0, defenseLimit);
  while (defenseRemaining > 0 && selected.length > 0) {
    let placed = false;
    for (const { pair } of selected) {
      if (defenseRemaining <= 0) break;
      const key = allocationSkillKey(pair.id, "defense");
      const bias =
        input.difficulty === "hard" && pair.id === defenseOrder[0]?.pair.id
          ? 2
          : 0;
      const ceiling =
        Math.ceil(input.view.availableBudget / selected.length) + bias;
      if ((allocation[key] ?? 0) < ceiling) {
        allocation[key] = (allocation[key] ?? 0) + 1;
        defenseRemaining -= 1;
        placed = true;
      }
    }
    if (!placed) break;
  }
}

/** Choose a legal V4 allocation using only the acting player's public view. */
export function chooseAiAllocation(input: AiDecisionInput): Allocation {
  const stage = input.view.point.stage;
  if (input.view.rulesetId !== "candidate_v4") {
    throw new Error(
      "AI single-player currently supports Candidate V4 matches only",
    );
  }
  const allocation = emptyAllocation(input, stage);
  if (stage === "rally") {
    allocateRally(input, allocation);
  } else if (input.view.point.attackerPlayerId === input.view.self.id) {
    allocateFocusedAttack(input, allocation, stage);
  } else {
    allocateFocusedDefense(input, allocation, stage);
  }
  return allocation;
}

/** Select an attack project by expected base advantage and revealed tendencies. */
export function chooseAiAttack(input: AiDecisionInput): string {
  const stage = input.view.point.stage;
  if (input.view.point.attackerPlayerId !== input.view.self.id) {
    throw new Error(
      "AI can only select an attack when it is the current attacker",
    );
  }
  if (stage !== "rally" && input.view.self.allocation) {
    const fundedPair = Object.entries(input.view.self.allocation)
      .find(([key, points]) => key.endsWith(".attack") && points > 0)?.[0]
      .split(".")[0];
    if (fundedPair) return fundedPair;
  }
  const ranked = rankedAttackPairs(input, stage);
  if (
    stage === "rally" &&
    input.strategy &&
    input.strategy !== "current" &&
    input.view.self.allocation
  ) {
    const funded = new Set(
      Object.entries(input.view.self.allocation)
        .filter(([key, points]) => key.endsWith(".attack") && points > 0)
        .map(([key]) => key.split(".")[0]),
    );
    const bestFunded = ranked.find((entry) => funded.has(entry.pair.id));
    if (bestFunded) return bestFunded.pair.id;
  }
  const history = ourAttackHistory(input, stage);
  if (history.length && input.difficulty === "hard") {
    const leastUsed = ranked
      .map((entry) => ({
        ...entry,
        score:
          entry.score -
          history.filter((event) => event.pairId === entry.pair.id).length *
            0.08,
      }))
      .sort((a, b) => b.score - a.score || a.pair.id.localeCompare(b.pair.id));
    return chooseRanked(leastUsed, (entry) => entry.score, input).pair.id;
  }
  return chooseRanked(ranked, (entry) => entry.score, input).pair.id;
}

/** Package identity retained for workspace diagnostics. */
export const AI_PACKAGE = "@paddle-tactics/ai";
