export type BalanceParameters = {
  attackBonus: number;
  defensePool: number;
  defenseCap: number;
  serveThreshold: number;
  counterThreshold: number;
  rallyThreshold: number;
  rallyMaxRounds: number;
};

export const BASELINE_PARAMETERS: BalanceParameters = {
  attackBonus: 4,
  defensePool: 10,
  defenseCap: 4,
  serveThreshold: 5,
  counterThreshold: 5,
  rallyThreshold: 4,
  rallyMaxRounds: 5,
};

export const CANDIDATE_V3_PARAMETERS: CandidateV3Settings = {
  attackBonus: 4,
  defensePool: 8,
  defenderVisibleTopK: 3,
  serviceThreshold: 5,
  counterThreshold: 5,
  rallyThreshold: 4,
  rallyMaxComparisons: 5,
  explorationEpsilon: 0.05,
};

export const V3_PARAMETER_CANDIDATES: Record<
  keyof CandidateV3Settings,
  number[]
> = {
  attackBonus: [3, 4, 5],
  defensePool: [6, 7, 8, 9, 10],
  defenderVisibleTopK: [2, 3, 4],
  serviceThreshold: [4, 5, 6],
  counterThreshold: [4, 5, 6],
  rallyThreshold: [3, 4, 5],
  rallyMaxComparisons: [4, 5, 6],
  explorationEpsilon: [0.05],
};

export const PARAMETER_CANDIDATES: Record<keyof BalanceParameters, number[]> = {
  attackBonus: [3, 4, 5],
  defensePool: [8, 9, 10, 11, 12],
  defenseCap: [3, 4, 5],
  serveThreshold: [4, 5, 6],
  counterThreshold: [4, 5, 6],
  rallyThreshold: [3, 4, 5],
  rallyMaxRounds: [4, 5, 6],
};

export function withParameter(
  base: BalanceParameters,
  key: keyof BalanceParameters,
  value: number,
): BalanceParameters {
  return { ...base, [key]: value };
}
import type { CandidateV3Settings } from "@paddle-tactics/game-core";
